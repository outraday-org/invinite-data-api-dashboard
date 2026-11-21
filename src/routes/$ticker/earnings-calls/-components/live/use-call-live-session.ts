import * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { isEarningsEventLiveish, useV2LiveEvents } from "@/lib/api/queries";

/** After the end, the page waits this long for the recording (`has_audio`), polling the event every 30 s. */
export const RECORDING_WAIT_MS = 60 * 60 * 1000;

export const RECORDING_WAIT_POLL_MS = 30 * 1000;

/** Capture states of a call that has not ended: about to be captured, or being captured. */
const NOT_ENDED_CAPTURE_STATUSES = new Set(["armed", "capturing"]);

/** What the page knows of its live session: whether it saw the call live, and when it saw it end (`null` = not yet). */
export type LiveSessionClock = { endedAtMs: null | number; sawLive: boolean };

/**
 * The event's poll once `isEarningsEventLiveish` stopped it (`has_transcript` came first): every 30 s while this page
 * saw the call live and the recording is not published, for at most `RECORDING_WAIT_MS` after the end. An end not
 * seen yet counts from now (the poll that ends the call is the one asking).
 */
export function recordingWaitInterval(event: Pick<V2Event, "has_audio">, session: LiveSessionClock, nowMs: number): false | number {
    if (!session.sawLive || event.has_audio) return false;

    if (session.endedAtMs !== null && nowMs - session.endedAtMs >= RECORDING_WAIT_MS) return false;

    return RECORDING_WAIT_POLL_MS;
}

/** The waiting state the player shows after the end: `waiting` (polling), `gave-up` (60 min passed: "Reload"). */
export type RecordingWait = "gave-up" | "waiting" | null;

export type CallLiveSession = {
    /** The page saw the call live (capturing, or in `/v1/events?status=live`); sticky for the page's life. */
    sawLive: boolean;
    /** Ended: `capture_status` is past `armed` / `capturing` after the page saw it live. */
    ended: boolean;
    recordingWait: RecordingWait;
    /** What `recordingWaitInterval` reads (the page hands it to `useV2Event`'s poll through a ref). */
    clock: LiveSessionClock;
};

/**
 * The call page's live session (O4; the sticky rule of the former `LivePlayerSlot`): a call is followed live once it
 * is `capturing` or listed by `/v1/events?status=live` (asked only while `isEarningsEventLiveish` — never for an `armed`
 * call hours ahead, which would bill `/live-audio`). `clock` feeds `recordingWaitInterval` from `useV2Event`'s
 * `refetchInterval` option (evaluated by the query, outside render, so the page keeps it in a ref).
 */
export function useCallLiveSession(event: null | V2Event): CallLiveSession {
    const { data: live } = useV2LiveEvents(event !== null && isEarningsEventLiveish(event));

    const listed = event !== null && live?.data.some(item => item.event_id === event.event_id) === true;

    const [sawLive, setSawLive] = React.useState(false);

    const [endedAtMs, setEndedAtMs] = React.useState<null | number>(null);

    const [gaveUp, setGaveUp] = React.useState(false);

    if (!sawLive && event !== null && (event.capture_status === "capturing" || listed)) setSawLive(true);

    // `armed` is not over: a call listed live a moment before its capture starts has not ended yet.
    const ended = sawLive && event !== null && !NOT_ENDED_CAPTURE_STATUSES.has(event.capture_status);

    // The wait counts from the end the page saw last: a status back to `capturing` (a capture restart) resets it.
    React.useEffect(() => {
        setEndedAtMs(previous => (ended ? (previous ?? Date.now()) : null));
    }, [ended]);

    React.useEffect(() => {
        if (endedAtMs === null) {
            setGaveUp(false);

            return undefined;
        }

        const timer = setTimeout(() => setGaveUp(true), Math.max(0, endedAtMs + RECORDING_WAIT_MS - Date.now()));

        return () => clearTimeout(timer);
    }, [endedAtMs]);

    const recordingWait: RecordingWait = event === null || !ended || event.has_audio ? null : gaveUp ? "gave-up" : "waiting";

    const clock = React.useMemo(() => ({ endedAtMs, sawLive }), [endedAtMs, sawLive]);

    return { clock, ended, recordingWait, sawLive };
}
