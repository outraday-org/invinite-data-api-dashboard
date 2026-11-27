import { useEffect, useRef, useState } from "react";

import type { NewsItemPublic } from "@/lib/api/types";

import type { StreamMode, StreamStop } from "./stream-socket";
import type { NewsServerFrame, NewsSubscribeOptions } from "./ws-frames";

import { admissionCloses, feedMode, openStreamSocket } from "./stream-socket";
import { liveWsUrl, NEWS_LIVE_CHANNEL, newsSubscribeFrame, parseNewsFrame } from "./ws-frames";

/**
 * New news items over the data API's `/v1/stream` channel `news` (backend earnings tasks/inhouse-news-pipeline task
 * 17), for the News page's "Live" switch.
 *
 * THE BROWSER OPENS THE SOCKET WITH THE STORED API KEY, as `use-live-transcript.ts` (owner decision 2026-10-09): the
 * URL carries the key — never logged, never put in an error.
 *
 * FLOW. On `open`: `subscribe { channel: "news", tickers?, kinds?, sources?, earnings_only? }` (no tickers = the
 * whole market). Each `news_item` frame is collected newest first, one per id; the page merges them on top of its
 * first page. Missed items are not replayed: after a reconnect the next `subscribed` calls `onResubscribed` (the page
 * refetches its list).
 *
 * STOPS (no reconnect loop): `forbidden_tier` (plan), `channel_unavailable` (live news not enabled on the API), close
 * 4029 (connection limit), 4001 / 4003 and `bad_message` call `onStop` and close; the page turns its switch off.
 * Other closes reconnect with backoff 1 s → 30 s (≤ 10 tries); `unavailable` re-subscribes after 10 s. The socket
 * lifecycle is `stream-socket.ts`'s.
 */

export type LiveNewsStop = StreamStop;

/** Most items held (newest first); older ones are on the REST pages anyway. */
const MAX_LIVE_ITEMS = 200;

const ADMISSION_CLOSE = admissionCloses("Your plan does not include the live news feed");

const ERROR_STOP: Record<Exclude<Extract<NewsServerFrame, { type: "error" }>["code"], "unavailable">, LiveNewsStop> = {
    bad_message: { kind: "error", message: "The live feed rejected a request of this page" },
    channel_unavailable: { kind: "unavailable", message: "Live news is not enabled on the API yet" },
    forbidden_tier: { kind: "plan", message: "Your plan does not include the live news feed" },
};

type UseLiveNewsInput = {
    apiKey: null | string;
    /** The key store's change stamp: a new value reopens the socket. */
    apiKeyUpdatedAt: number;
    baseUrl: null | string;
    enabled: boolean;
    filters: NewsSubscribeOptions;
    onResubscribed?: () => void;
    onStop: (stop: LiveNewsStop) => void;
};

export function useLiveNews({ apiKey, apiKeyUpdatedAt, baseUrl, enabled, filters, onResubscribed, onStop }: UseLiveNewsInput) {
    // One key per subscription: items of an earlier filter set are never shown under a new one.
    const filterKey = JSON.stringify(newsSubscribeFrame(filters));

    const sessionKey = JSON.stringify([apiKeyUpdatedAt, baseUrl, filterKey]);

    const [received, setReceived] = useState<{ items: Array<{ item: NewsItemPublic; arrivedAt: string }>; key: string }>({ items: [], key: "" });

    const [mode, setMode] = useState<StreamMode>("connecting");

    const callbacks = useRef({ onResubscribed, onStop });

    useEffect(() => {
        callbacks.current = { onResubscribed, onStop };
    }, [onResubscribed, onStop]);

    useEffect(() => {
        if (!enabled || apiKey === null || baseUrl === null) return undefined;

        const subscribe = JSON.parse(filterKey) as object;

        let subscribedOnce = false;

        const onFrame = (frame: NewsServerFrame) => {
            switch (frame.type) {
                case "error": {
                    if (frame.code === "unavailable") {
                        setMode("retrying");

                        stream.resubscribeLater(() => stream.send(subscribe));

                        break;
                    }

                    // A client bug: the page sent a frame the API could not read (the message names the field).
                    if (frame.code === "bad_message") console.error("[live-news] bad_message:", frame.message);

                    stream.stop(ERROR_STOP[frame.code]);

                    break;
                }

                case "news_item": {
                    const item = frame.item as unknown as NewsItemPublic;

                    const arrivedAt = new Date().toISOString();

                    setReceived((prev) => {
                        const items = prev.key === sessionKey ? prev.items : [];

                        if (items.some(held => held.item.id === item.id)) return prev;

                        return { items: [{ arrivedAt, item }, ...items].slice(0, MAX_LIVE_ITEMS), key: sessionKey };
                    });

                    break;
                }

                case "subscribed": {
                    stream.resetTries();

                    setMode("live");

                    if (subscribedOnce) callbacks.current.onResubscribed?.();

                    subscribedOnce = true;

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
            closeFrame: { channel: NEWS_LIVE_CHANNEL, type: "unsubscribe" },
            onMessage: (data) => {
                const parsed = parseNewsFrame(data);

                if (parsed.kind === "frame") onFrame(parsed.frame);
            },
            onOpen: () => {
                setMode("connecting");

                stream.send(subscribe);
            },
            onRetrying: () => setMode("retrying"),
            onStop: reason => callbacks.current.onStop(reason),
        });

        return () => stream.dispose();
    }, [apiKey, apiKeyUpdatedAt, baseUrl, enabled, filterKey, sessionKey]);

    const rows = enabled && apiKey !== null && baseUrl !== null && received.key === sessionKey ? received.items : [];

    return {
        arrivals: new Map(rows.map(row => [row.item.id, row.arrivedAt])),
        items: rows.map(row => row.item),
        mode: feedMode(enabled, apiKey, mode),
    };
}
