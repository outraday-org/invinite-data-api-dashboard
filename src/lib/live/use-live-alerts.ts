import { useEffect, useRef, useState } from "react";

import type { AlertEvent } from "@/lib/api/types";

import type { AlertsServerFrame, AlertsSubscribeOptions } from "./ws-frames";

import { ALERTS_CHANNEL, alertsSubscribeFrame, liveWsUrl, parseAlertsFrame } from "./ws-frames";

/**
 * The account's alert events over the data API's `/v1/stream` channel `alerts` (backend tasks/data-api-dashboard
 * 2-alerts task 2), for the event feed's "Live" switch. Modelled on `use-live-news.ts`.
 *
 * THE BROWSER OPENS THE SOCKET WITH THE STORED API KEY, as the other live hooks (owner decision 2026-10-09): the URL
 * carries the key — never logged, never put in an error. It is the only browser connection to the API host
 * (`no-direct-api-calls.test.ts`).
 *
 * FLOW. On `open`: `subscribe { channel: "alerts", alert_ids?, external_user_id?, types?, after? }`; `after` = the newest
 * event the page holds (the REST list's, then the newest live one), so the API replays what was missed (≤ 1,000) before
 * live delivery — also after a reconnect. Each `alert_event` is kept newest first, one per id. `replay_truncated` =
 * more were missed than the replay holds: the page says "some events were skipped, reload the list". A frame of the
 * channel with an unknown type is counted (`ignored`), never thrown on.
 *
 * STOPS (no reconnect loop): close 4001 / 4003 (the stream needs the STANDARD plan; the REST feed does not) / 4029,
 * `channel_unavailable` and an unknown error code call `onStop` and close; the page turns its switch off. `unavailable`
 * re-subscribes after 10 s; `bad_message` (e.g. an `after` the account does not hold: "live delivery continues") is a
 * note. Other closes reconnect with backoff 1 s → 30 s (≤ 10 tries).
 */

export type LiveAlertsStop = { kind: "error" | "limit" | "plan" | "unavailable"; message: string };

export type LiveAlertsMode = "connecting" | "live" | "retrying";

const RESUBSCRIBE_AFTER_MS = 10_000;

const MAX_RECONNECT_TRIES = 10;

/** Most events held (newest first); older ones are on the REST pages. */
const MAX_LIVE_EVENTS = 500;

function reconnectDelayMs(attempt: number) {
    return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

const ADMISSION_CLOSE: Partial<Record<number, LiveAlertsStop>> = {
    4001: { kind: "error", message: "The API key was rejected by the live feed" },
    4003: { kind: "plan", message: "Your plan does not include the live stream (STANDARD); the list above still works" },
    4029: { kind: "limit", message: "Live feed unavailable: connection limit" },
};

type UseLiveAlertsInput = {
    /** The newest event id the page holds (read when a subscription is sent; a change does not resubscribe). */
    after: string | undefined;
    apiKey: null | string;
    /** The key store's change stamp: a new value reopens the socket. */
    apiKeyUpdatedAt: number;
    baseUrl: null | string;
    enabled: boolean;
    filters: Omit<AlertsSubscribeOptions, "after">;
    onStop: (stop: LiveAlertsStop) => void;
};

type Received = { events: Array<AlertEvent>; ignored: number; key: string; note: null | string; truncatedAt: null | string };

const EMPTY: Received = { events: [], ignored: 0, key: "", note: null, truncatedAt: null };

export function useLiveAlerts({ after, apiKey, apiKeyUpdatedAt, baseUrl, enabled, filters, onStop }: UseLiveAlertsInput) {
    // One key per subscription: events of an earlier filter set are never shown under a new one.
    const filterKey = JSON.stringify(alertsSubscribeFrame(filters));

    const [received, setReceived] = useState<Received>(EMPTY);

    // The mode of one subscription (its key): a new socket (Live on again, other filters) reads "connecting" at once.
    const [modeOf, setModeOf] = useState<{ key: string; mode: LiveAlertsMode }>({ key: "", mode: "connecting" });

    const latest = useRef({ after, onStop });

    useEffect(() => {
        latest.current = { after, onStop };
    }, [after, onStop]);

    useEffect(() => {
        if (!enabled || apiKey === null || baseUrl === null) return undefined;

        // Carries the key: never logged (see the header).
        const url = liveWsUrl(baseUrl, apiKey);

        const subscription = JSON.parse(filterKey) as ReturnType<typeof alertsSubscribeFrame>;

        let socket: null | WebSocket = null;

        let disposed = false;

        let stopped = false;

        let tries = 0;

        // The newest event received on this subscription: the next `after` (a reconnect replays from it).
        let newestLive: string | undefined;

        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        let resubscribeTimer: ReturnType<typeof setTimeout> | undefined;

        const setMode = (mode: LiveAlertsMode) => setModeOf({ key: filterKey, mode });

        const update = (change: (current: Received) => Received) => setReceived(prev => change(prev.key === filterKey ? prev : { ...EMPTY, key: filterKey }));

        const send = (frame: object) => {
            if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
        };

        const subscribe = () => {
            const from = newestLive ?? latest.current.after;

            send(from ? { ...subscription, after: from } : subscription);
        };

        const close = () => {
            send({ channel: ALERTS_CHANNEL, type: "unsubscribe" });

            socket?.close(1000);
        };

        const stop = (reason: LiveAlertsStop) => {
            stopped = true;

            clearTimeout(reconnectTimer);

            clearTimeout(resubscribeTimer);

            close();

            latest.current.onStop(reason);
        };

        const onFrame = (frame: AlertsServerFrame) => {
            switch (frame.type) {
                case "alert_event": {
                    const event = frame.event as AlertEvent;

                    newestLive = event.id;

                    update((current) => {
                        if (current.events.some(held => held.id === event.id)) return current;

                        return { ...current, events: [event, ...current.events].slice(0, MAX_LIVE_EVENTS) };
                    });

                    break;
                }

                case "error": {
                    if (frame.code === "unavailable") {
                        setMode("retrying");

                        clearTimeout(resubscribeTimer);

                        resubscribeTimer = setTimeout(subscribe, RESUBSCRIBE_AFTER_MS);

                        break;
                    }

                    if (frame.code === "bad_message") {
                        update(current => ({ ...current, note: frame.message }));

                        break;
                    }

                    stop(frame.code === "channel_unavailable"
                        ? { kind: "unavailable", message: "Live alert events are not available on the API yet" }
                        : { kind: "error", message: frame.message });

                    break;
                }

                case "replay_truncated": {
                    update(current => ({ ...current, truncatedAt: frame.last_event_id }));

                    break;
                }

                case "subscribed": {
                    tries = 0;

                    setMode("live");

                    break;
                }

                case "unsubscribed": {
                    break;
                }
            }
        };

        const connect = () => {
            const next = new WebSocket(url);

            socket = next;

            next.addEventListener("open", () => {
                setMode("connecting");

                subscribe();
            });

            next.addEventListener("message", (message: MessageEvent) => {
                const parsed = parseAlertsFrame(message.data);

                if (parsed.kind === "frame") onFrame(parsed.frame);
                else if (parsed.kind === "unknown" || parsed.kind === "malformed") update(current => ({ ...current, ignored: current.ignored + 1 }));
            });

            next.addEventListener("close", (event: CloseEvent) => {
                clearTimeout(resubscribeTimer);

                if (disposed || stopped || socket !== next) return;

                const admission = ADMISSION_CLOSE[event.code];

                if (admission !== undefined) {
                    stop(admission);

                    return;
                }

                if (tries >= MAX_RECONNECT_TRIES) {
                    stop({ kind: "error", message: "The live feed connection was lost; switch Live on again to retry" });

                    return;
                }

                tries += 1;

                setMode("retrying");

                reconnectTimer = setTimeout(connect, reconnectDelayMs(tries));
            });
        };

        connect();

        return () => {
            disposed = true;

            clearTimeout(reconnectTimer);

            clearTimeout(resubscribeTimer);

            close();

            // The next socket (same filters or not) starts as "connecting", never with this one's mode.
            setModeOf({ key: "", mode: "connecting" });
        };
    }, [apiKey, apiKeyUpdatedAt, baseUrl, enabled, filterKey]);

    const current = enabled && received.key === filterKey ? received : EMPTY;

    const mode = modeOf.key === filterKey ? modeOf.mode : "connecting";

    return { events: current.events, ignored: current.ignored, mode, note: current.note, truncatedAt: current.truncatedAt };
}
