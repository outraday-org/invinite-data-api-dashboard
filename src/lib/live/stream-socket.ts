/**
 * One `/v1/stream` connection's lifecycle, shared by the channel hooks `use-live-filings.ts`, `use-live-news.ts` and
 * `use-live-alerts.ts` (backend tasks/data-api-dashboard: the three lanes had written it three times). The hook owns
 * its channel — what to send on open, how to read a frame, what to keep — and this owns the socket: the admission
 * closes that stop for good, the reconnect backoff 1 s → 30 s (≤ 10 tries, then a stop), the channel's re-subscribe
 * timer, and the unsubscribe + close on a stop or on dispose.
 *
 * THE URL CARRIES THE STORED API KEY (owner decision 2026-10-09: the browser opens the socket itself): it is never
 * logged and never put in a stop message. Not used by `use-live-transcript.ts`, whose resume rules (`since_seq`, gap
 * frames, the stalled timer) are its own.
 */

/** Why a live feed stopped for good: the page turns its switch off and says this. */
export type StreamStop = { kind: "error" | "limit" | "plan" | "unavailable"; message: string };

export type StreamMode = "connecting" | "live" | "retrying";

export const MAX_RECONNECT_TRIES = 10;

/** `unavailable` (a transient server failure): the channel asks again after this long, on the same socket. */
export const RESUBSCRIBE_AFTER_MS = 10_000;

export function reconnectDelayMs(attempt: number) {
    return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

/** The stop after the last reconnect failed. */
export const CONNECTION_LOST: StreamStop = { kind: "error", message: "The live feed connection was lost; switch Live on again to retry" };

/** `/v1/stream` admission close codes (IDA `routes/websocket`): final. `planMessage` names the feed the plan lacks. */
export function admissionCloses(planMessage: string): Partial<Record<number, StreamStop>> {
    return {
        4001: { kind: "error", message: "The API key was rejected by the live feed" },
        4003: { kind: "plan", message: planMessage },
        4029: { kind: "limit", message: "Live feed unavailable: connection limit" },
    };
}

export type StreamSocketOptions = {
    admission: Partial<Record<number, StreamStop>>;
    /** Sent before the socket is closed by a stop or a dispose (the channel's `unsubscribe`); none = just close. */
    closeFrame?: object;
    onMessage: (data: unknown) => void;
    /** Each socket's `open`; `reopened` = an earlier socket of this connection had opened. */
    onOpen: (reopened: boolean) => void;
    /** A close that will be retried (the backoff timer runs). */
    onRetrying: () => void;
    /** A final stop (admission close, a hook's `stop`, or the tries ran out). Called once, after the socket closed. */
    onStop: (stop: StreamStop) => void;
};

export type StreamSocket = {
    /** The page let go (unmount, switch off, new key / filters): no stop callback. */
    dispose: () => void;
    /** The channel is healthy again (opened or subscribed): the next drop starts the backoff from 1 s. */
    resetTries: () => void;
    /** Run `resubscribe` after `RESUBSCRIBE_AFTER_MS` (replaces a pending one; any close cancels it). */
    resubscribeLater: (resubscribe: () => void) => void;
    /** Sends a JSON frame while the socket is open; dropped otherwise. */
    send: (frame: object) => void;
    stop: (reason: StreamStop) => void;
};

export function openStreamSocket(url: string, options: StreamSocketOptions): StreamSocket {
    let socket: null | WebSocket = null;

    let disposed = false;

    let stopped = false;

    let tries = 0;

    let openedOnce = false;

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    let resubscribeTimer: ReturnType<typeof setTimeout> | undefined;

    const send = (frame: object) => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
    };

    const closeSocket = () => {
        if (options.closeFrame) send(options.closeFrame);

        socket?.close(1000);
    };

    const stop = (reason: StreamStop) => {
        stopped = true;

        clearTimeout(reconnectTimer);

        clearTimeout(resubscribeTimer);

        closeSocket();

        options.onStop(reason);
    };

    const connect = () => {
        const next = new WebSocket(url);

        socket = next;

        next.addEventListener("open", () => {
            if (disposed || stopped || socket !== next) return;

            const reopened = openedOnce;

            openedOnce = true;

            options.onOpen(reopened);
        });

        next.addEventListener("message", (message: MessageEvent) => {
            if (!disposed && !stopped && socket === next) options.onMessage(message.data);
        });

        next.addEventListener("close", (event: CloseEvent) => {
            clearTimeout(resubscribeTimer);

            if (disposed || stopped || socket !== next) return;

            const admission = options.admission[event.code];

            if (admission !== undefined) {
                stop(admission);

                return;
            }

            if (tries >= MAX_RECONNECT_TRIES) {
                stop(CONNECTION_LOST);

                return;
            }

            tries += 1;

            options.onRetrying();

            reconnectTimer = setTimeout(connect, reconnectDelayMs(tries));
        });
    };

    connect();

    return {
        dispose: () => {
            disposed = true;

            clearTimeout(reconnectTimer);

            clearTimeout(resubscribeTimer);

            closeSocket();
        },
        resetTries: () => {
            tries = 0;
        },
        resubscribeLater: (resubscribe) => {
            clearTimeout(resubscribeTimer);

            resubscribeTimer = setTimeout(resubscribe, RESUBSCRIBE_AFTER_MS);
        },
        send,
        stop,
    };
}
