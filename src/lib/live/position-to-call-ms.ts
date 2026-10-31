/**
 * Player position → CALL milliseconds, the clock of the live transcript's `start_ms`
 * (pipeline phase 3 tasks 33 / 37). Ported unchanged from the admin console
 * (`invinite/admin-dashboard/src/components/earnings-calls/position-to-call-ms.ts`, with its
 * suite). `callT0` is the live-stream answer's `call_t0`; the live watermark's marker-chain
 * delay is already inside the playlist's `PROGRAM-DATE-TIME`, so there is no client offset.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MEDIA TIMELINE, NEVER THE WALL CLOCK.
 *
 * Task 37's playlist stamps `#EXT-X-PROGRAM-DATE-TIME` on the first segment and
 * after every `#EXT-X-DISCONTINUITY` (a worker restart, a re-resolve, a relaunched
 * attempt, a segment it skipped for good) with the CALL clock: `PDT − callT0` =
 * call ms. hls.js turns that into `playingDate` for the position being played, so
 * a discontinuity's jump is already inside the date — subtracting two wall-clock
 * readings instead would drift by every stall and every gap.
 *
 * `playingDate` null (Safari's native player before metadata, or hls.js before
 * the first fragment) or `callT0` null (a run that never stamped `t0_wallclock`)
 * → `null`: no follow mode, no highlight, the text simply appends.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function positionToCallMs(playingDate: Date | null | undefined, callT0: null | string): null | number {
    if (playingDate === null || playingDate === undefined || callT0 === null) return null;

    const playingMs = playingDate.getTime();

    const t0Ms = Date.parse(callT0);

    if (!Number.isFinite(playingMs) || Number.isNaN(t0Ms)) return null;

    return Math.max(0, playingMs - t0Ms);
}

/** One fragment as the playlist lists it: media start, duration and its program date. */
export type PlaylistFragment = {
    readonly start: number;
    readonly duration: number;
    /** Epoch ms of the fragment's first sample (`#EXT-X-PROGRAM-DATE-TIME` carried forward). */
    readonly programDateTime: null | number;
};

/**
 * "Click a turn to hear it" behind the edge: the MEDIA time at
 * which the call reaches `callMs`. The fragment whose program date is the last
 * at or before the target holds it; a target inside a gap (a skipped segment, a
 * restart) lands on the next fragment's start rather than inside the previous
 * one's audio. `null` without program dates or a `callT0`.
 */
export function mediaTimeForCallMs(
    fragments: ReadonlyArray<PlaylistFragment>,
    callT0: null | string,
    callMs: number,
): null | number {
    const t0Ms = callT0 === null ? Number.NaN : Date.parse(callT0);

    if (Number.isNaN(t0Ms)) return null;

    const targetMs = t0Ms + callMs;

    let found: PlaylistFragment | undefined;

    for (const fragment of fragments) {
        if (fragment.programDateTime === null) continue;

        if (fragment.programDateTime <= targetMs) found = fragment;
        else if (found === undefined) return fragment.start;
        else break;
    }

    if (found === undefined || found.programDateTime === null) return null;

    const offsetS = (targetMs - found.programDateTime) / 1000;

    if (offsetS <= found.duration) return found.start + offsetS;

    // Past this fragment's audio: inside a gap, so the next fragment's start.
    const next = fragments.find(fragment => fragment.start > found.start);

    return next === undefined ? found.start + found.duration : next.start;
}

/** Seconds behind the live edge on the MEDIA timeline (never negative). */
export function secondsBehindEdge(edgeSeconds: null | number, currentTimeSeconds: number): number {
    if (edgeSeconds === null || !Number.isFinite(edgeSeconds)) return 0;

    return Math.max(0, edgeSeconds - currentTimeSeconds);
}

/** "Jump to live" appears past this (task 35 §5). */
export const JUMP_TO_LIVE_AFTER_S = 10;

/**
 * Index of the turn being spoken at `callMs` — the last turn whose start is at
 * or before it — or `-1` (no highlight) when there is no position.
 */
export function activeTurnIndex(turns: ReadonlyArray<{ readonly startMs: number }>, callMs: null | number): number {
    if (callMs === null) return -1;

    let found = -1;

    for (let index = 0; index < turns.length; index += 1) {
        if (turns[index].startMs <= callMs) found = index;
        else break;
    }

    return found;
}
