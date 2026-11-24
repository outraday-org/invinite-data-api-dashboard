import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import type { MacroFamily } from "@/lib/alerts/macro-condition";
import type { StreamStop } from "@/lib/live/stream-socket";

import { LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { plansAlerts } from "@/lib/alerts/labels";
import { isMacroSeries } from "@/lib/alerts/macro-condition";
import { MACRO_ALERT_SERIES, STREAM_TIER } from "@/lib/api/operations.gen";
import { useApiBaseUrl, useKeyState } from "@/lib/api/queries";
import { planAllows } from "@/lib/api/request-meta";
import { formatInstant } from "@/lib/format";
import { useLiveMacro } from "@/lib/live/use-live-macro";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

export function MacroPageActions({ family, selectedDate, seriesId}: { family: MacroFamily; seriesId: string; selectedDate?: string }) {
    const { me } = useKeyState();

    const [enabled, setEnabled] = useState(false);

    const [stop, setStop] = useState<null | StreamStop>(null);

    const eligible = Boolean(me && me.plan !== "payg" && planAllows(me.plan, STREAM_TIER));

    const onStop = useCallback((why: StreamStop) => {
        setStop(why);

        setEnabled(false);
    }, []);

    const live = useLiveMacro({ apiKey: useApiKeyStore(s => s.apiKey), apiKeyUpdatedAt: useApiKeyStore(s => s.apiKeyUpdatedAt), baseUrl: useApiBaseUrl(eligible && enabled),
        enabled: eligible && enabled, onStop, queryClient: useQueryClient(), scope: family });

    const event = live.latest;

    const matching = event?.readings.find(r => r.series_id === seriesId && (!selectedDate || r.reference_date === selectedDate));

    const curve = event?.curve;

    const tenorValue = curve && family === "yield_curve" && (!selectedDate || selectedDate === curve.date) ? curve[seriesId.slice("treasury_par_".length)] : undefined;

    const measurement = matching
        ? `${matching.reference_date} · ${matching.value ?? "Unavailable"} ${matching.unit}`
        : tenorValue !== undefined && curve && isMacroSeries(seriesId) ? `${curve.date} · ${tenorValue ?? "Unavailable"} ${MACRO_ALERT_SERIES[seriesId].unit}` : null;

    return (
        <div className="flex max-w-lg flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                {eligible
                    ? (
                            <LiveToggle
                                listening="Listening"
                                live={enabled}
                                mode={live.mode}
                                onChange={(on) => {
                                    setStop(null);

                                    setEnabled(on);
                                }}
                            />
                        )
                    : <Button disabled type="button" variant="outline">Live · Pro</Button>}
                {me && plansAlerts(me) && isMacroSeries(seriesId) && <Link className={buttonVariants({ size: "sm", variant: "outline" })} search={{ series: seriesId, type: "macro" }} to="/alerts/new">Create alert</Link>}
            </div>
            {eligible && <span className="text-xs text-muted-foreground">Live is free to stream. Refreshing visible data after a release or connection uses ordinary REST credits.</span>}
            {live.latest && (
                <p aria-live="polite" className="text-xs">
                    <strong>
                        {live.latest.type === "macro.revised" ? "Revision" : "Release"}
                        {" "}
                        ·
                        {" "}
                        {live.latest.release_name}
                    </strong>
                    {" "}
                    · v
                    {live.latest.version}
                    {" "}
                    · observed
                    {" "}
                    {formatInstant(live.latest.observed_at)}
                    {measurement && <span className="block">{measurement}</span>}
                </p>
            )}
            <LiveStopNotice planNote="Historical reads and snapshots remain available on Lite." stop={stop} />
        </div>
    );
}
