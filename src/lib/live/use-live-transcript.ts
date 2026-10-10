import { useEffect, useReducer, useRef, useState } from "react";

import type { EarningsServerFrame, UnsubscribeReason } from "./ws-frames";

import { INITIAL_LIVE_TRANSCRIPT, liveTranscriptReducer } from "./live-transcript-reducer";
import {
    liveWsUrl,
    parseServerFrame,
    subscribeFrame,
    toLiveSegment,
    toSpeakerNames,
    unsubscribeFrame,
} from "./ws-frames";

/**
 * The live transcript of one call over the data API's `/v1/ws` channel `earnings-calls.live`
 * (modelled on the admin console's `use-live-transcript.ts`, which reads a REST backlog + Ably).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BROWSER OPENS THE SOCKET WITH THE STORED API KEY (owner decision 2026-10-09).
 *
 * `wss://<api>/v1/ws?api_key=<key>` — the one place the key leaves the server functions. This
 * app runs on Netlify (serverless), which cannot hold a long-lived server-side socket, and the
 * key is the user's own and already in this browser's localStorage. The URL is never logged
 * and never put in an error. A key change (`apiKeyUpdatedAt`) closes the socket and opens a
 * new one.
 *
 * FLOW. On `open`: `subscribe { event_id, since_seq, partials: true }` — `since_seq` = the
 * reducer's last contiguous final (`-1` at first: the API replays every final of the call, so
 * there is no REST backlog). Finals / partials / names go through the reducer. The API
 * reorders finals and reports each jump as a `gap` frame before the jumped final (late finals
 * inside it still arrive on the same subscription) → the gap is accepted at once, never
 * re-subscribed. A seq jump without a `gap` frame is accepted the same way once the reducer's
 * short `gapRefetch` delay has passed.
 *
 * RECONNECT. A dropped socket reconnects with backoff 1 s → 30 s (10 tries) and re-subscribes
 * from `since_seq = lastSeq`: the API replays what was missed. `attach_failed` / `unavailable`
 * re-send the subscribe after 10 s on the same socket. Admission closes (4001 bad key, 4003
 * plan, 4029 connection limit) and the terminal error codes do not reconnect.
 *
 * KEEP-ALIVE is the server's protocol-level ping (the browser answers it; IDA rejects a JSON
 * `ping` frame as `bad_message`). 60 s without any frame while subscribed → `stalled` (a pill,
 * not a reconnect: a quiet stretch of a call sends nothing).
 * ─────────────────────────────────────────────────────────────────────────────
 */

type LiveTranscriptMode = "connecting" | "ended" | "error" | "live" | "retrying";

/** No frame for this long while subscribed → the stalled pill. */
const LIVE_WS_STALLED_AFTER_MS = 60_000;

/** `attach_failed` / `unavailable` → the subscribe is sent again after this. */
const RESUBSCRIBE_AFTER_MS = 10_000;

/** After `call_ended` the socket stays open this long for late finals, then closes. */
const CALL_ENDED_CLOSE_AFTER_MS = 5_000;

const MAX_RECONNECT_TRIES = 10;

/** Backoff of reconnect try `attempt` (1-based): 1 s, 2 s, 4 s … capped at 30 s. */
function reconnectDelayMs(attempt: number) {
    return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

const LIVE_TRANSCRIPT_TIER_TEXT = "PRO plan required for the live transcript";

/** `/v1/ws` admission close codes (IDA `routes/websocket/filings.ts`): final, no reconnect. */
const ADMISSION_CLOSE_TEXT: Partial<Record<number, string>> = {
    4001: "The API key was rejected by the live transcript",
    4003: LIVE_TRANSCRIPT_TIER_TEXT,
    4029: "Too many WebSocket connections on this key",
};

const ERROR_TEXT: Partial<Record<string, string>> = {
    bad_message: "The live transcript rejected a request of this page",
    forbidden_tier: LIVE_TRANSCRIPT_TIER_TEXT,
    not_found: "Not live",
    not_live: "Not live",
    subscription_limit: "Too many live subscriptions on this key",
};

function unsubscribedText(reason: UnsubscribeReason): null | string {
    if (reason === "requested" || reason === "transcript_ready") return null;

    if (reason === "rescheduled") return "This call was rescheduled";

    return `Live transcript ended (${reason.replaceAll("_", " ")})`;
}

type UseLiveTranscriptInput = {
    apiKey: null | string;
    /** The key store's change stamp: a new value reopens the socket. */
    apiKeyUpdatedAt: number;
    /** The API base URL (`useApiBaseUrl`); `null` while unknown. */
    baseUrl: null | string;
    eventId: string;
};

export function useLiveTranscript({ apiKey, apiKeyUpdatedAt, baseUrl, eventId }: UseLiveTranscriptInput) {
    const [state, dispatch] = useReducer(liveTranscriptReducer, INITIAL_LIVE_TRANSCRIPT);

    const [mode, setMode] = useState<LiveTranscriptMode>("connecting");

    const [error, setError] = useState<null | string>(null);

    const [notice, setNotice] = useState<null | string>(null);

    const [rescheduledTo, setRescheduledTo] = useState<null | string>(null);

    const [reconnecting, setReconnecting] = useState(false);

    const [stalled, setStalled] = useState(false);

    const [malformedFrames, setMalformedFrames] = useState(0);

    const [provisionalVersion, setProvisionalVersion] = useState<null | number>(null);

    // The socket callbacks read the newest contiguous seq for `since_seq`.
    const lastSeqRef = useRef(state.lastSeq);

    useEffect(() => {
        lastSeqRef.current = state.lastSeq;
    }, [state.lastSeq]);

    // A seq jump without a `gap` frame: accepted (an empty `forGap` backlog) once the reducer's
    // delay has passed — the API delivers late finals on the same subscription anyway.
    const gap = state.gapRefetch;

    useEffect(() => {
        if (gap === null) return undefined;

        const timer = setTimeout(() => {
            dispatch({ atMs: Date.now(), ended: false, forGap: true, kind: "backlog", lastSeq: -1, segments: [] });
        }, Math.max(0, gap.notBeforeMs - Date.now()));

        return () => clearTimeout(timer);
    }, [gap]);

    useEffect(() => {
        if (apiKey === null || baseUrl === null) return undefined;

        // Carries the key: never logged (see the header).
        const url = liveWsUrl(baseUrl, apiKey);

        let socket: null | WebSocket = null;

        let subscriptionId: null | string = null;

        let disposed = false;

        let finished = false;

        let tries = 0;

        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        let resubscribeTimer: ReturnType<typeof setTimeout> | undefined;

        let stallTimer: ReturnType<typeof setTimeout> | undefined;

        let closeTimer: ReturnType<typeof setTimeout> | undefined;

        const send = (frame: object) => {
            if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
        };

        const subscribe = () => send(subscribeFrame(eventId, lastSeqRef.current));

        const armStall = () => {
            clearTimeout(stallTimer);

            setStalled(false);

            stallTimer = setTimeout(() => setStalled(true), LIVE_WS_STALLED_AFTER_MS);
        };

        const clearTimers = () => {
            clearTimeout(reconnectTimer);

            clearTimeout(resubscribeTimer);

            clearTimeout(stallTimer);

            clearTimeout(closeTimer);
        };

        /** Unsubscribe (when still subscribed) and close; nothing reconnects afterwards. */
        const closeSocket = () => {
            if (subscriptionId !== null) send(unsubscribeFrame(subscriptionId));

            subscriptionId = null;

            socket?.close(1000);
        };

        const finish = (nextMode: "ended" | "error", message: null | string = null) => {
            finished = true;

            clearTimers();

            setMode(nextMode);

            setReconnecting(false);

            setStalled(false);

            if (message !== null) setError(message);

            closeSocket();
        };

        const onFrame = (frame: EarningsServerFrame) => {
            // One subscription per socket; frames of an older one (before a re-subscribe) are dropped.
            if (
                frame.type !== "subscribed"
                && subscriptionId !== null
                && frame.subscription_id !== undefined
                && frame.subscription_id !== subscriptionId
            ) {
                return;
            }

            const atMs = Date.now();

            switch (frame.type) {
                case "call_ended": {
                    dispatch({ atMs, ended: true, kind: "backlog", lastSeq: -1, segments: [] });

                    setMode("ended");

                    clearTimeout(closeTimer);

                    closeTimer = setTimeout(() => finish("ended"), CALL_ENDED_CLOSE_AFTER_MS);

                    break;
                }

                case "call_started": {
                    break;
                }

                case "error": {
                    if (frame.code === "resume_unavailable") {
                        setNotice("Missed segments could not be replayed for this call; live delivery continues");

                        break;
                    }

                    if (frame.code === "attach_failed" || frame.code === "unavailable") {
                        setMode("retrying");

                        clearTimeout(resubscribeTimer);

                        resubscribeTimer = setTimeout(subscribe, RESUBSCRIBE_AFTER_MS);

                        break;
                    }

                    // A client bug: the page sent a frame the API could not read.
                    if (frame.code === "bad_message") console.error("[live-transcript] bad_message:", frame.message);

                    finish("error", ERROR_TEXT[frame.code] ?? frame.message);

                    break;
                }

                case "gap": {
                    // Known missing up to `next_seq`: the run continues from there (late finals still merge).
                    dispatch({ atMs, ended: false, kind: "backlog", lastSeq: frame.next_seq - 1, segments: [] });

                    break;
                }

                case "rescheduled": {
                    setRescheduledTo(frame.new_conference_date);

                    finish("ended");

                    break;
                }

                case "speaker_names": {
                    dispatch({ kind: "speakerNames", names: toSpeakerNames(frame) });

                    break;
                }

                case "subscribed": {
                    subscriptionId = frame.subscription_id;

                    tries = 0;

                    setReconnecting(false);

                    setMode("live");

                    dispatch({ atMs, ended: frame.state === "ended", kind: "backlog", lastSeq: -1, segments: [] });

                    break;
                }

                case "transcript_provisional": {
                    setProvisionalVersion(frame.version);

                    break;
                }

                case "transcript_ready": {
                    dispatch({ atMs, ended: true, kind: "backlog", lastSeq: -1, segments: [] });

                    finish("ended");

                    break;
                }

                case "transcript_segment": {
                    const segment = toLiveSegment(frame);

                    if (frame.is_final) dispatch({ atMs, kind: "final", segment });
                    else dispatch({ atMs, kind: "partial", segment });

                    break;
                }

                case "unsubscribed": {
                    if (frame.reason === "requested") break;

                    subscriptionId = null;

                    setNotice(unsubscribedText(frame.reason));

                    finish("ended");

                    break;
                }
            }
        };

        const connect = () => {
            const next = new WebSocket(url);

            socket = next;

            next.addEventListener("open", () => {
                setMode("connecting");

                setError(null);

                armStall();

                subscribe();
            });

            next.addEventListener("message", (message: MessageEvent) => {
                armStall();

                const parsed = parseServerFrame(message.data);

                if (parsed.kind === "malformed") setMalformedFrames(count => count + 1);

                if (parsed.kind === "frame") onFrame(parsed.frame);
            });

            next.addEventListener("close", (event: CloseEvent) => {
                clearTimeout(stallTimer);

                clearTimeout(resubscribeTimer);

                subscriptionId = null;

                if (disposed || finished || socket !== next) return;

                const admission = ADMISSION_CLOSE_TEXT[event.code];

                if (admission !== undefined) {
                    finish("error", admission);

                    return;
                }

                if (tries >= MAX_RECONNECT_TRIES) {
                    finish("error", "The live transcript connection was lost; reload the page to try again");

                    return;
                }

                tries += 1;

                setStalled(false);

                setReconnecting(true);

                setMode("connecting");

                reconnectTimer = setTimeout(connect, reconnectDelayMs(tries));
            });
        };

        connect();

        return () => {
            disposed = true;

            clearTimers();

            closeSocket();
        };
    }, [apiKey, apiKeyUpdatedAt, baseUrl, eventId]);

    return {
        error,
        malformedFrames,
        mode,
        notice,
        provisionalVersion,
        reconnecting,
        rescheduledTo,
        stalled,
        state,
    };
}
