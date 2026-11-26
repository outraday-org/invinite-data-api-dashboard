import { useEffect, useRef, useState } from "react";

import type { ReceivedFiling } from "./live-filings";
import type { StreamMode, StreamStop } from "./stream-socket";

import { addLiveFiling } from "./live-filings";
import { admissionCloses, feedMode, openStreamSocket } from "./stream-socket";
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
 * (≤ 10 tries). The socket lifecycle is `stream-socket.ts`'s.
 */

export type LiveFilingsStop = StreamStop;

export type LiveFilingsMode = StreamMode;

const ADMISSION_CLOSE = admissionCloses("Your plan does not include the live filings feed");

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
        const stream = openStreamSocket(liveWsUrl(baseUrl, apiKey), {
            admission: ADMISSION_CLOSE,
            onMessage: (data) => {
                const parsed = parseFilingFrame(data);

                if (parsed.kind !== "frame") return;

                const receivedAt = new Date().toISOString();

                setFilings(held => addLiveFiling(held, parsed.frame.filing, receivedAt));
            },
            onOpen: (reopened) => {
                stream.resetTries();

                setMode("live");

                if (reopened) callbacks.current.onReconnected?.();
            },
            onRetrying: () => setMode("retrying"),
            onStop: reason => callbacks.current.onStop(reason),
        });

        return () => {
            stream.dispose();

            // Switched off (or a new key / URL): the next session starts empty and connecting, never with old rows.
            setFilings([]);

            setMode("connecting");
        };
    }, [apiKey, apiKeyUpdatedAt, baseUrl, enabled]);

    return { filings: enabled ? filings : [], mode: feedMode(enabled, apiKey, mode) };
}
