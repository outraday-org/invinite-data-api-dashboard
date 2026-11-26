import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import type { MacroFamily } from "@/lib/alerts/macro-condition";

import { isMacroSeries, MACRO_FAMILIES } from "@/lib/alerts/macro-condition";
import { MACRO_ALERT_SERIES } from "@/lib/api/operations.gen";

import type { StreamMode, StreamStop } from "./stream-socket";

import { admissionCloses, feedMode, openStreamSocket } from "./stream-socket";
import { liveWsUrl } from "./ws-frames";

const family = z.enum(MACRO_FAMILIES);

const sid = z.string().refine(isMacroSeries);

const date = z.iso.date();

const reading = z.object({ reference_date: date, series_id: sid, status: z.enum(["available", "unavailable", "suppressed", "withdrawn"]), unit: z.string(), value: z.number().nullable() });

const curve = z.object({ agency: z.literal("Treasury"), date, observed_at: z.iso.datetime({ offset: true }), source_url: z.string() })
    .and(z.record(z.string(), z.unknown()).refine(record => Object.keys(MACRO_ALERT_SERIES).filter(id => id.startsWith("treasury_par_")).every((id) => {
        const value = record[id.slice("treasury_par_".length)];

        return value === null || (typeof value === "number" && Number.isFinite(value));
    })));

const edition = z.object({ affected: z.array(z.object({ first_reference_date: date, last_reference_date: date, series_id: sid })).max(64), channel: z.literal("macro"), curve: curve.nullable(), event_id: z.string().regex(/^macro_[a-f0-9]{64}$/),
    families: z.array(family).min(1).max(4), observed_at: z.iso.datetime({ offset: true }), published_at: z.iso.datetime({ offset: true }).nullable(), readings: z.array(reading).max(64),
    release_id: z.string().min(1), release_name: z.string(), schema_version: z.literal(1), source: z.literal("backend-us-macro"),
    type: z.enum(["macro.released", "macro.revised"]), version: z.number().int().positive() });

export type MacroEdition = z.infer<typeof edition>;

const frames = z.discriminatedUnion("type", [
    edition,
    z.object({ channel: z.literal("macro"), families: z.array(family), type: z.literal("subscribed") }),
    z.object({ channel: z.literal("macro"), type: z.literal("unsubscribed") }),
    z.object({ channel: z.literal("macro"), code: z.enum(["channel_unavailable", "forbidden_tier", "bad_message", "unavailable"]), type: z.literal("error") }),
]);

export function affectsMacroQuery(key: QueryKey, scope: MacroFamily, keyStamp: number, event?: MacroEdition): boolean {
    if (key[0] !== "v2" || key[1] !== "macro" || String(key.at(-1)) !== String(keyStamp)) return false;

    if (key[2] === "catalog") return key[3] === scope || key[3] === "all";

    if (key[2] !== scope) return false;

    if (!event || key[3] === "snapshot") return true;

    if (key[3] !== "history") return false;

    const from = String(key[5] ?? ""), seriesId = key[4], to = String(key[6] ?? "");

    const intersects = (first: string, last: string) => (!to || first <= to) && (!from || last >= from);

    const accepts = (id: string) => scope === "yield_curve" ? isMacroSeries(id) && MACRO_ALERT_SERIES[id].family === scope : id === seriesId;

    return Boolean(event.curve && scope === "yield_curve" && intersects(event.curve.date, event.curve.date))
        || event.readings.some(r => accepts(r.series_id) && intersects(r.reference_date, r.reference_date))
        || event.affected.some(span => accepts(span.series_id) && intersects(span.first_reference_date, span.last_reference_date));
}

/** Cancel first, including a page with no data yet. TanStack discards a canceled server-function result
 * even when the underlying network call completes late. Only enabled/visible queries refetch. */
export async function refreshMacroQueries(client: QueryClient, scope: MacroFamily, keyStamp: number, event?: MacroEdition) {
    const filters = { predicate: (q: { queryKey: QueryKey }) => affectsMacroQuery(q.queryKey, scope, keyStamp, event) };

    await client.cancelQueries(filters);

    await client.invalidateQueries({ ...filters, refetchType: "active" });
}

const stops: Record<string, StreamStop> = {
    bad_message: { kind: "error", message: "The macro subscription was rejected." },
    forbidden_tier: { kind: "plan", message: "Live macro delivery requires Pro." },
};

const MAX_RELEASES = 1024;

export function useLiveMacro({ apiKey, apiKeyUpdatedAt, baseUrl, enabled, onStop, queryClient, scope}: {
    apiKey: null | string; apiKeyUpdatedAt: number; baseUrl: null | string; enabled: boolean; scope: MacroFamily; queryClient: QueryClient; onStop: (why: StreamStop) => void;
}) {
    const [mode, setMode] = useState<StreamMode>("connecting");

    const [received, setReceived] = useState<null | { scope: MacroFamily; keyStamp: number; frame: MacroEdition }>(null);

    const requested = useRef(scope);

    const replace = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (requested.current === scope) return;

        requested.current = scope;

        replace.current?.();
    }, [scope]);

    useEffect(() => {
        if (!enabled || !apiKey || !baseUrl) return undefined;

        let current = true;

        let acknowledged = false;

        const versions = new Map<string, number>();

        const subscribe = () => {
            acknowledged = false;

            setMode("connecting");

            stream.send({ channel: "macro", families: [requested.current], type: "subscribe" });
        };

        const stream = openStreamSocket(liveWsUrl(baseUrl, apiKey), {
            admission: admissionCloses("Live macro delivery requires Pro."),
            closeFrame: { channel: "macro", type: "unsubscribe" },
            onMessage: (data) => {
                if (!current || typeof data !== "string" || data.length > 48 * 1024) return;

                let raw: unknown;

                try {
                    raw = JSON.parse(data);
                }
                catch {
                    return;
                }

                const parsed = frames.safeParse(raw);

                if (!parsed.success) return;

                const f = parsed.data;

                const activeScope = requested.current;

                if (f.type === "subscribed") {
                    if (!f.families.includes(activeScope) || acknowledged) return;

                    acknowledged = true;

                    stream.resetTries();

                    setMode("live");

                    void refreshMacroQueries(queryClient, activeScope, apiKeyUpdatedAt);
                }
                else if (f.type === "error") {
                    acknowledged = false;

                    if (f.code === "unavailable" || f.code === "channel_unavailable") {
                        setMode("retrying");

                        stream.resubscribeLater(subscribe);
                    }
                    else stream.stop(stops[f.code]);
                }
                else if (f.type === "unsubscribed") {
                    acknowledged = false;
                }
                else if (acknowledged && f.families.includes(activeScope)) {
                    const previous = versions.get(f.release_id);

                    if (previous !== undefined && f.version <= previous) return;

                    if (previous === undefined && versions.size >= MAX_RELEASES) {
                        stream.stop({ kind: "limit", message: "Restart Live to refresh this long-running macro session." });

                        return;
                    }

                    versions.set(f.release_id, f.version);

                    setReceived({ frame: f, keyStamp: apiKeyUpdatedAt, scope: activeScope });

                    // Two independent official editions can revise the same date. REST is authoritative.
                    void refreshMacroQueries(queryClient, activeScope, apiKeyUpdatedAt, f);
                }
            },
            onOpen: subscribe,
            onRetrying: () => {
                acknowledged = false;

                setMode("retrying");
            },
            onStop,
        });

        replace.current = subscribe;

        return () => {
            replace.current = null;

            current = false;

            stream.dispose();
        };
    }, [apiKey, apiKeyUpdatedAt, baseUrl, enabled, onStop, queryClient]);

    return { latest: enabled && received?.scope === scope && received.keyStamp === apiKeyUpdatedAt ? received.frame : null, mode: feedMode(enabled, apiKey, mode) };
}
