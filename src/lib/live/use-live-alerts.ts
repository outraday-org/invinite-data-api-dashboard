import { useEffect, useRef, useState } from "react";

import type { AlertEvent } from "@/lib/api/types";

import { STREAM_TIER } from "@/lib/api/operations.gen";

import type { StreamMode, StreamStop } from "./stream-socket";
import type { AlertsServerFrame, AlertsSubscribeOptions } from "./ws-frames";

import { admissionCloses, openStreamSocket } from "./stream-socket";
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
 * STOPS (no reconnect loop): close 4001 / 4003 (the stream needs `STREAM_TIER`, the PRO plan; the REST feed does not) / 4029,
 * `channel_unavailable` and an unknown error code call `onStop` and close; the page turns its switch off. `unavailable`
 * re-subscribes after 10 s; `bad_message` (e.g. an `after` the account does not hold: "live delivery continues") is a
 * note. Other closes reconnect with backoff 1 s → 30 s (≤ 10 tries). The socket lifecycle is `stream-socket.ts`'s.
 */

export type LiveAlertsStop = StreamStop;

export type LiveAlertsMode = StreamMode;

/** Most events held (newest first); older ones are on the REST pages. */
const MAX_LIVE_EVENTS = 500;

const ADMISSION_CLOSE = admissionCloses(`Your plan does not include the live stream (${STREAM_TIER.toUpperCase()}); the list above still works`);

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

        const subscription = JSON.parse(filterKey) as ReturnType<typeof alertsSubscribeFrame>;

        // The newest event received on this subscription: the next `after` (a reconnect replays from it).
        let newestLive: string | undefined;

        const setMode = (mode: LiveAlertsMode) => setModeOf({ key: filterKey, mode });

        const update = (change: (current: Received) => Received) => setReceived(prev => change(prev.key === filterKey ? prev : { ...EMPTY, key: filterKey }));

        const subscribe = () => {
            const from = newestLive ?? latest.current.after;

            stream.send(from ? { ...subscription, after: from } : subscription);
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

                        stream.resubscribeLater(subscribe);

                        break;
                    }

                    if (frame.code === "bad_message") {
                        update(current => ({ ...current, note: frame.message }));

                        break;
                    }

                    stream.stop(frame.code === "channel_unavailable"
                        ? { kind: "unavailable", message: "Live alert events are not available on the API yet" }
                        : { kind: "error", message: frame.message });

                    break;
                }

                case "replay_truncated": {
                    update(current => ({ ...current, truncatedAt: frame.last_event_id }));

                    break;
                }

                case "subscribed": {
                    stream.resetTries();

                    setMode("live");

                    break;
                }

                case "unsubscribed": {
                    break;
                }
            }
        };

        // Carries the key: never logged (see the header).
        const stream = openStreamSocket(liveWsUrl(baseUrl, apiKey), {
            admission: ADMISSION_CLOSE,
            closeFrame: { channel: ALERTS_CHANNEL, type: "unsubscribe" },
            onMessage: (data) => {
                const parsed = parseAlertsFrame(data);

                if (parsed.kind === "frame") onFrame(parsed.frame);
                else if (parsed.kind === "unknown" || parsed.kind === "malformed") update(current => ({ ...current, ignored: current.ignored + 1 }));
            },
            onOpen: () => {
                setMode("connecting");

                subscribe();
            },
            onRetrying: () => setMode("retrying"),
            onStop: reason => latest.current.onStop(reason),
        });

        return () => {
            stream.dispose();

            // The next socket (same filters or not) starts as "connecting", never with this one's mode.
            setModeOf({ key: "", mode: "connecting" });
        };
    }, [apiKey, apiKeyUpdatedAt, baseUrl, enabled, filterKey]);

    const current = enabled && received.key === filterKey ? received : EMPTY;

    const mode = modeOf.key === filterKey ? modeOf.mode : "connecting";

    return { events: current.events, ignored: current.ignored, mode, note: current.note, truncatedAt: current.truncatedAt };
}
