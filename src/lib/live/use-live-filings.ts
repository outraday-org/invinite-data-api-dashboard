import { useEffect, useRef, useState } from "react";

import type { ReceivedFiling } from "./live-filings";

import { addLiveFiling } from "./live-filings";
import { liveWsUrl, parseFilingFrame } from "./ws-frames";

/**
 * New SEC filings over the data API's `/v1/stream` channel `filings` (STANDARD; backend tasks/data-api-dashboard O7
 * group 3): the "Live" switch of `$ticker/filings` and the `/filings` page.
 *
 * THE BROWSER OPENS THE SOCKET WITH THE STORED API KEY, as `use-live-news.ts`: the URL carries the key — never logged,
 * never put in an error.
 *
 * FLOW. `new_filing` frames reach every connection of the stream: nothing is sent, the socket only listens. Each
 * frame is collected newest first, one per accession (`addLiveFiling`). Missed filings are not replayed: after a
 * reconnect `onReconnected` lets the page refetch its list.
 *
 * STOPS (no reconnect loop): close 4001 (key), 4003 (plan below STANDARD), 4029 (connection limit) call `onStop` and
 * close; the page turns its switch off. Other closes (1013 "try again later" included) reconnect with backoff 1 s → 30 s
 * (≤ 10 tries).
 */

export type LiveFilingsStop = { kind: "error" | "limit" | "plan"; message: string };

export type LiveFilingsMode = "connecting" | "live" | "retrying";

const MAX_RECONNECT_TRIES = 10;

function reconnectDelayMs(attempt: number) {
    return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

/** `/v1/stream` admission close codes (IDA `routes/websocket/filings.ts`): final. */
const ADMISSION_CLOSE: Partial<Record<number, LiveFilingsStop>> = {
    4001: { kind: "error", message: "The API key was rejected by the live feed" },
    4003: { kind: "plan", message: "Your plan does not include the live filings feed" },
    4029: { kind: "limit", message: "Live feed unavailable: connection limit" },
};

type UseLiveFilingsInput = {
    apiKey: null | string;
    /** The key store's change stamp: a new value reopens the socket. */
    apiKeyUpdatedAt: number;
    baseUrl: null | string;
    enabled: boolean;
    onReconnected?: () => void;
    onStop: (stop: LiveFilingsStop) => void;
};

export function useLiveFilings({ apiKey, apiKeyUpdatedAt, baseUrl, enabled, onReconnected, onStop }: UseLiveFilingsInput) {
    const [filings, setFilings] = useState<Array<ReceivedFiling>>([]);

    const [mode, setMode] = useState<LiveFilingsMode>("connecting");

    const callbacks = useRef({ onReconnected, onStop });

    useEffect(() => {
        callbacks.current = { onReconnected, onStop };
    }, [onReconnected, onStop]);

    useEffect(() => {
        if (!enabled || apiKey === null || baseUrl === null) return undefined;

        // Carries the key: never logged (see the header).
        const url = liveWsUrl(baseUrl, apiKey);

        let socket: null | WebSocket = null;

        let disposed = false;

        let stopped = false;

        let tries = 0;

        let openedOnce = false;

        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        const stop = (reason: LiveFilingsStop) => {
            stopped = true;

            clearTimeout(reconnectTimer);

            socket?.close(1000);

            callbacks.current.onStop(reason);
        };

        const connect = () => {
            const next = new WebSocket(url);

            socket = next;

            next.addEventListener("open", () => {
                tries = 0;

                setMode("live");

                if (openedOnce) callbacks.current.onReconnected?.();

                openedOnce = true;
            });

            next.addEventListener("message", (message: MessageEvent) => {
                const parsed = parseFilingFrame(message.data);

                if (parsed.kind !== "frame") return;

                const receivedAt = new Date().toISOString();

                setFilings(held => addLiveFiling(held, parsed.frame.filing, receivedAt));
            });

            next.addEventListener("close", (event: CloseEvent) => {
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

            socket?.close(1000);
        };
    }, [apiKey, apiKeyUpdatedAt, baseUrl, enabled]);

    return { filings: enabled ? filings : [], mode };
}
