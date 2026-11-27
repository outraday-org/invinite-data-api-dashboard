/**
 * ONE `/v1/stream` socket per browser tab, shared by the channel hooks `use-live-filings.ts`, `use-live-news.ts`,
 * `use-live-alerts.ts` and `use-live-macro.ts`. The API counts concurrent sockets per account (`WS_CONNECTION_LIMITS`:
 * PRO / ENTERPRISE 1 unless an enterprise deal sets `wsConnections`) and closes one over the limit with 4029, while one
 * socket carries every channel. So a hook joins the tab's connection for its URL instead of opening its own: the first
 * feed opens it, the last one's leaving closes it after `LINGER_MS`. The hook owns its channel — what to send on open,
 * how to read a frame (every frame of the socket reaches every feed: each parser drops the other channels'), what to
 * keep — and this owns the socket: the admission closes that stop every feed for good, the reconnect backoff 1 s → 30 s
 * (≤ 10 tries, then a stop), each feed's re-subscribe timer, and a feed's `unsubscribe` on a stop or on dispose.
 *
 * THE URL CARRIES THE STORED API KEY (owner decision 2026-10-09: the browser opens the socket itself): it is never
 * logged and never put in a stop message. Not used by `use-live-transcript.ts`, whose resume rules (`since_seq`, gap
 * frames, the stalled timer) are its own.
 */

/** Why a live feed stopped for good: the page turns its switch off and says this. */
export type StreamStop = { kind: "error" | "limit" | "plan" | "unavailable"; message: string };

/**
 * `no_key`: switched on without a key stored in this browser. The socket needs the browser's own key; the server's
 * `INVINITE_DATA_API_KEY` (which the REST calls fall back to) never reaches the browser, so nothing is opened.
 */
export type StreamMode = "connecting" | "live" | "no_key" | "retrying";

/** The mode a feed hook reports: `no_key` while it is on without a stored key, else its socket's. */
export function feedMode(enabled: boolean, apiKey: null | string, mode: StreamMode): StreamMode {
    return enabled && !apiKey ? "no_key" : mode;
}

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
    /** Sent when this feed leaves by a stop or a dispose (the channel's `unsubscribe`); none = it just stops listening. */
    closeFrame?: object;
    onMessage: (data: unknown) => void;
    /** Each socket's `open`; `reopened` = an earlier socket of this connection had opened. */
    onOpen: (reopened: boolean) => void;
    /** A close that will be retried (the backoff timer runs). */
    onRetrying: () => void;
    /** A final stop (admission close, a hook's `stop`, or the tries ran out). Called once, after the feed left. */
    onStop: (stop: StreamStop) => void;
};

export type StreamSocket = {
    /** The page let go (unmount, switch off, new key / filters): no stop callback. */
    dispose: () => void;
    /** The channel is healthy again (opened or subscribed): the next drop starts the backoff from 1 s (shared). */
    resetTries: () => void;
    /** Run `resubscribe` after `RESUBSCRIBE_AFTER_MS` (replaces this feed's pending one; any close cancels it). */
    resubscribeLater: (resubscribe: () => void) => void;
    /** Sends a JSON frame while the socket is open; dropped otherwise. */
    send: (frame: object) => void;
    stop: (reason: StreamStop) => void;
};

/** Shared connections by URL (the URL carries the key: kept in memory only, never logged). */
const connections = new Map<string, Connection>();

/**
 * How long a connection without feeds stays open: a page change (old feed leaves, new one joins in the next commit) or
 * a StrictMode remount reuses it instead of opening a second socket while the API still counts the first (4029).
 */
export const LINGER_MS = 2_000;

type Member = {
    ended: boolean;
    openedOnce: boolean;
    options: StreamSocketOptions;
    resubscribeTimer: ReturnType<typeof setTimeout> | undefined;
};

type Connection = {
    lingerTimer: ReturnType<typeof setTimeout> | undefined;
    members: Set<Member>;
    reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    retrying: boolean;
    socket: null | WebSocket;
    tries: number;
    url: string;
};

/** Tests only: forget every connection (each test starts without a shared socket). */
export function resetStreamConnections() {
    for (const connection of connections.values()) {
        clearTimeout(connection.lingerTimer);

        clearTimeout(connection.reconnectTimer);

        for (const member of connection.members) clearTimeout(member.resubscribeTimer);
    }

    connections.clear();
}

const isOpen = (connection: Connection) => connection.socket?.readyState === WebSocket.OPEN;

const sendOn = (connection: Connection, frame: object) => {
    if (isOpen(connection)) connection.socket?.send(JSON.stringify(frame));
};

const notifyOpen = (member: Member) => {
    const reopened = member.openedOnce;

    member.openedOnce = true;

    member.options.onOpen(reopened);
};

/** The socket is gone for good (admission close, tries ran out): every feed on it stops, the next join opens anew. */
const endConnection = (connection: Connection, stopOf: (member: Member) => StreamStop) => {
    if (connections.get(connection.url) === connection) connections.delete(connection.url);

    clearTimeout(connection.reconnectTimer);

    clearTimeout(connection.lingerTimer);

    const members = [...connection.members];

    connection.members.clear();

    for (const member of members) {
        member.ended = true;

        clearTimeout(member.resubscribeTimer);

        member.options.onStop(stopOf(member));
    }
};

/** No feed left: close after `LINGER_MS` unless one joins first. */
const release = (connection: Connection) => {
    if (connection.members.size > 0) return;

    clearTimeout(connection.lingerTimer);

    connection.lingerTimer = setTimeout(() => {
        if (connection.members.size > 0) return;

        if (connections.get(connection.url) === connection) connections.delete(connection.url);

        clearTimeout(connection.reconnectTimer);

        connection.socket?.close(1000);

        connection.socket = null;
    }, LINGER_MS);
};

const connect = (connection: Connection) => {
    const next = new WebSocket(connection.url);

    connection.socket = next;

    next.addEventListener("open", () => {
        if (connection.socket !== next) return;

        connection.retrying = false;

        for (const member of [...connection.members]) {
            if (!member.ended) notifyOpen(member);
        }
    });

    next.addEventListener("message", (message: MessageEvent) => {
        if (connection.socket !== next) return;

        for (const member of [...connection.members]) {
            if (!member.ended) member.options.onMessage(message.data);
        }
    });

    next.addEventListener("close", (event: CloseEvent) => {
        for (const member of connection.members) clearTimeout(member.resubscribeTimer);

        if (connection.socket !== next) return;

        connection.socket = null;

        // Closed while no feed held it (the linger ran out on the server side first): nothing to retry.
        if (connection.members.size === 0) {
            if (connections.get(connection.url) === connection) connections.delete(connection.url);

            clearTimeout(connection.lingerTimer);

            return;
        }

        const admitted = [...connection.members].some(member => member.options.admission[event.code] !== undefined);

        if (admitted) {
            endConnection(connection, member => member.options.admission[event.code] ?? { kind: "error", message: "The live feed closed the connection" });

            return;
        }

        if (connection.tries >= MAX_RECONNECT_TRIES) {
            endConnection(connection, () => CONNECTION_LOST);

            return;
        }

        connection.tries += 1;

        connection.retrying = true;

        for (const member of [...connection.members]) member.options.onRetrying();

        connection.reconnectTimer = setTimeout(() => connect(connection), reconnectDelayMs(connection.tries));
    });
};

/**
 * Joins this tab's ONE `/v1/stream` connection for `url` (opened by the first feed, closed `LINGER_MS` after the last
 * leaves). `onOpen` runs for every open of the socket — on a socket that is already open, right after this returns.
 */
export function openStreamSocket(url: string, options: StreamSocketOptions): StreamSocket {
    let connection = connections.get(url);

    if (!connection) {
        connection = { lingerTimer: undefined, members: new Set(), reconnectTimer: undefined, retrying: false, socket: null, tries: 0, url };

        connections.set(url, connection);

        connect(connection);
    }

    const shared = connection;

    clearTimeout(shared.lingerTimer);

    const member: Member = { ended: false, openedOnce: false, options, resubscribeTimer: undefined };

    shared.members.add(member);

    // The caller's `onOpen` reads the handle this returns: tell it about an open socket only after it holds it.
    if (isOpen(shared) || shared.retrying) {
        queueMicrotask(() => {
            if (member.ended) return;

            if (isOpen(shared)) notifyOpen(member);
            else if (shared.retrying) options.onRetrying();
        });
    }

    /** This feed leaves: its `unsubscribe` goes out, the socket stays for the others. */
    const leave = () => {
        member.ended = true;

        clearTimeout(member.resubscribeTimer);

        if (options.closeFrame) sendOn(shared, options.closeFrame);

        shared.members.delete(member);

        release(shared);
    };

    return {
        dispose: () => {
            if (!member.ended) leave();
        },
        resetTries: () => {
            shared.tries = 0;
        },
        resubscribeLater: (resubscribe) => {
            clearTimeout(member.resubscribeTimer);

            member.resubscribeTimer = setTimeout(() => {
                if (!member.ended) resubscribe();
            }, RESUBSCRIBE_AFTER_MS);
        },
        send: (frame) => {
            if (!member.ended) sendOn(shared, frame);
        },
        stop: (reason) => {
            if (member.ended) return;

            leave();

            options.onStop(reason);
        },
    };
}
