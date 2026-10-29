import { useEffect, useRef, useState } from "react";

import type { NewsItemPublic } from "@/lib/api/types";

import type { NewsServerFrame, NewsSubscribeOptions } from "./ws-frames";

import { liveWsUrl, NEWS_LIVE_CHANNEL, newsSubscribeFrame, parseNewsFrame } from "./ws-frames";

/**
 * New news items over the data API's `/v1/ws` channel `news.live` (backend earnings tasks/inhouse-news-pipeline task
 * 17), for the News page's "Live" switch.
 *
 * THE BROWSER OPENS THE SOCKET WITH THE STORED API KEY, as `use-live-transcript.ts` (owner decision 2026-10-09): the
 * URL carries the key — never logged, never put in an error.
 *
 * FLOW. On `open`: `subscribe { channel: "news.live", tickers?, kinds?, sources?, earnings_only? }` (no tickers = the
 * whole market). Each `news_item` frame is collected newest first, one per id; the page merges them on top of its
 * first page. Missed items are not replayed: after a reconnect the next `subscribed` calls `onResubscribed` (the page
 * refetches its list).
 *
 * STOPS (no reconnect loop): `forbidden_tier` (plan), `channel_unavailable` (live news not enabled on the API), close
 * 4029 (connection limit), 4001 / 4003 and `bad_message` call `onStop` and close; the page turns its switch off.
 * Other closes reconnect with backoff 1 s → 30 s (≤ 10 tries); `unavailable` re-subscribes after 10 s.
 */

export type LiveNewsStop = { kind: "error" | "limit" | "plan" | "unavailable"; message: string };

type LiveNewsMode = "connecting" | "live" | "retrying";

const RESUBSCRIBE_AFTER_MS = 10_000;

const MAX_RECONNECT_TRIES = 10;

/** Most items held (newest first); older ones are on the REST pages anyway. */
const MAX_LIVE_ITEMS = 200;

function reconnectDelayMs(attempt: number) {
    return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

/** `/v1/ws` admission close codes (IDA `routes/websocket/filings.ts`): final. */
const ADMISSION_CLOSE: Partial<Record<number, LiveNewsStop>> = {
    4001: { kind: "error", message: "The API key was rejected by the live feed" },
    4003: { kind: "plan", message: "Your plan does not include the live news feed" },
    4029: { kind: "limit", message: "Live feed unavailable: connection limit" },
};

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

    const [received, setReceived] = useState<{ items: Array<NewsItemPublic>; key: string }>({ items: [], key: "" });

    const [mode, setMode] = useState<LiveNewsMode>("connecting");

    const callbacks = useRef({ onResubscribed, onStop });

    useEffect(() => {
        callbacks.current = { onResubscribed, onStop };
    }, [onResubscribed, onStop]);

    useEffect(() => {
        if (!enabled || apiKey === null || baseUrl === null) return undefined;

        // Carries the key: never logged (see the header).
        const url = liveWsUrl(baseUrl, apiKey);

        const subscribe = JSON.parse(filterKey) as object;

        let socket: null | WebSocket = null;

        let disposed = false;

        let stopped = false;

        let tries = 0;

        let subscribedOnce = false;

        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        let resubscribeTimer: ReturnType<typeof setTimeout> | undefined;

        const send = (frame: object) => {
            if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
        };

        const close = () => {
            send({ channel: NEWS_LIVE_CHANNEL, type: "unsubscribe" });

            socket?.close(1000);
        };

        const stop = (reason: LiveNewsStop) => {
            stopped = true;

            clearTimeout(reconnectTimer);

            clearTimeout(resubscribeTimer);

            close();

            callbacks.current.onStop(reason);
        };

        const onFrame = (frame: NewsServerFrame) => {
            switch (frame.type) {
                case "error": {
                    if (frame.code === "unavailable") {
                        setMode("retrying");

                        clearTimeout(resubscribeTimer);

                        resubscribeTimer = setTimeout(() => send(subscribe), RESUBSCRIBE_AFTER_MS);

                        break;
                    }

                    // A client bug: the page sent a frame the API could not read (the message names the field).
                    if (frame.code === "bad_message") console.error("[live-news] bad_message:", frame.message);

                    stop(ERROR_STOP[frame.code]);

                    break;
                }

                case "news_item": {
                    const item = frame.item as unknown as NewsItemPublic;

                    setReceived((prev) => {
                        const items = prev.key === filterKey ? prev.items : [];

                        if (items.some(held => held.id === item.id)) return prev;

                        return { items: [item, ...items].slice(0, MAX_LIVE_ITEMS), key: filterKey };
                    });

                    break;
                }

                case "subscribed": {
                    tries = 0;

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

        const connect = () => {
            const next = new WebSocket(url);

            socket = next;

            next.addEventListener("open", () => {
                setMode("connecting");

                send(subscribe);
            });

            next.addEventListener("message", (message: MessageEvent) => {
                const parsed = parseNewsFrame(message.data);

                if (parsed.kind === "frame") onFrame(parsed.frame);
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
        };
    }, [apiKey, apiKeyUpdatedAt, baseUrl, enabled, filterKey]);

    return {
        items: enabled && received.key === filterKey ? received.items : [],
        mode,
    };
}
