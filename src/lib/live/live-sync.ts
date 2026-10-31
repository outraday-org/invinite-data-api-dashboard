/**
 * THE SYNC RULE OF A LIVE CALL PLAYER (backend earnings `tasks/inhouse-kyutai-live-quality-2026-10-31` task 5).
 *
 * TWINS: `invinite/admin-dashboard/src/components/earnings-calls/live-sync.ts`,
 * `invinite/src/components/earnings-call-page/live/live-sync.ts` and
 * `invinite-data-api-dashboard/src/lib/live/live-sync.ts` hold the same content: the three share no package.
 * Change all three (and their tests). The Data API guide states the same rule.
 *
 * The transcript is released about 8 s + STT latency behind the capture and the audio could play about 6 s behind it,
 * so the text trails the audio. In SYNCED mode the audio is held back to the text:
 *
 *     audioCallMs <= newestFinal.endMs - SYNC_MARGIN_MS
 *
 * Only a FINAL moves that point, never a partial: a partial can still change or be taken back. The words themselves are
 * revealed when the audio reaches them (`liveTurns`' `revealUntilMs`), finals and partials alike.
 *
 * - Past the point: 0.9x, and past it by more than 3 s a pause until the text arrives.
 * - More than 20 s behind it: a jump forward, to the start of the newest final when that is ahead of the audio, so the
 *   sentence the text has just reached is still heard. Never a seek backwards: the audio falls back by slowing or waiting.
 * - No new final for 25 s (the turn builder guarantees one within 20.4 s of speech, so this is silence, hold music or a
 *   dead transcript): the audio plays on. A player must never go quiet because the text did.
 * - An explicit seek behind the point ("following"): the listener's choice stands, nothing moves the audio until it
 *   reaches the point again or "Back to synced" is pressed.
 */

export type LiveAudioMode = "live" | "synced";

export type SyncAction = "jump" | "play" | "slow" | "wait";

export type SyncDecision = {
    readonly action: SyncAction;
    /** Where the audio may be at most (for `jump`: where it lands), `null` without a final. */
    readonly targetCallMs: null | number;
};

export type SyncInput = {
    readonly audioCallMs: null | number;
    /** The call is over: no more text will come, the audio plays out. */
    readonly ended?: boolean;
    /** The listener seeked behind the point. */
    readonly following?: boolean;
    readonly mode: LiveAudioMode;
    /** The newest released final's `endMs`, never a partial's. */
    readonly newestReleasedEndMs: null | number;
    /** That final's `startMs`: where a jump lands. */
    readonly newestReleasedStartMs?: null | number;
    /** No new final for `SYNC_TEXT_IDLE_MS`. */
    readonly textIdle?: boolean;
};

/** How far the audio stays behind the newest final's end. */
export const SYNC_MARGIN_MS = 1_500;

/** The catch-down speed past the point. */
export const SYNC_SLOW_RATE = 0.9;

/** Past the point by more than this: pause. */
export const SYNC_WAIT_AHEAD_MS = 3_000;

/** Behind the point by more than this: jump forward. */
export const SYNC_JUMP_BEHIND_MS = 20_000;

/** No new final for this long: stop holding the audio (see the header). */
export const SYNC_TEXT_IDLE_MS = 25_000;

/** hls.js's distance to the edge before the first final was measured (s). */
export const SYNC_START_LATENCY_S = 12;

/** The measured distance is kept inside these (s): under 6 s hls.js runs dry, over 120 s it is a broken transcript. */
export const SYNC_MIN_LATENCY_S = 6;

export const SYNC_MAX_LATENCY_S = 120;

export function syncTarget(input: SyncInput): SyncDecision {
    const { audioCallMs, newestReleasedEndMs } = input;

    const targetCallMs = newestReleasedEndMs === null ? null : newestReleasedEndMs - SYNC_MARGIN_MS;

    const holding = input.mode === "synced" && input.ended !== true && input.following !== true;

    if (!holding || audioCallMs === null || targetCallMs === null) return { action: "play", targetCallMs };

    const aheadMs = audioCallMs - targetCallMs;

    if (aheadMs < -SYNC_JUMP_BEHIND_MS) {
        const startMs = input.newestReleasedStartMs ?? null;

        const landing = startMs !== null && startMs > audioCallMs ? Math.min(startMs, targetCallMs) : targetCallMs;

        return { action: "jump", targetCallMs: landing };
    }

    if (aheadMs <= 0 || input.textIdle === true) return { action: "play", targetCallMs };

    return { action: aheadMs > SYNC_WAIT_AHEAD_MS ? "wait" : "slow", targetCallMs };
}

/** The newest released final (by `endMs`) of a transcript's finals. Partials are not finals: never pass them here. */
export function newestReleasedFinal<T extends { readonly endMs: number }>(finals: ReadonlyArray<T>): null | T {
    let newest: null | T = null;

    for (const final of finals) {
        if (newest === null || final.endMs >= newest.endMs) newest = final;
    }

    return newest;
}

export type SyncMediaState = {
    readonly heldAtBoundary: boolean;
    readonly paused: boolean;
};

/**
 * What a decision does to the media element. Only a pause this rule made is ever resumed (`heldAtBoundary`): the
 * listener's own pause stays. There is no seek here and no backwards one anywhere: `jump` goes forward by construction.
 */
export function syncPauseStep(action: SyncAction, media: SyncMediaState): "none" | "pause" | "resume" {
    if (action === "wait") return media.paused ? "none" : "pause";

    return media.heldAtBoundary && media.paused ? "resume" : "none";
}

/**
 * hls.js's target distance to the edge in synced mode, measured when a final arrives: edge to the START of that final.
 * Text for a word exists only from this moment, so the audio must be at least this far back to hear the word no earlier
 * than its text (the final's length is the sawtooth of the newest end, up to 15 s; the end alone would pause the audio
 * on every long final). Null without an edge position.
 */
export function syncLatencyS(edgeCallMs: null | number, newestReleasedStartMs: null | number): null | number {
    if (edgeCallMs === null || newestReleasedStartMs === null) return null;

    const latencyS = (edgeCallMs - newestReleasedStartMs + SYNC_MARGIN_MS) / 1000;

    return Math.min(SYNC_MAX_LATENCY_S, Math.max(SYNC_MIN_LATENCY_S, latencyS));
}

/** The diagnostics row's "text behind edge" (s), never negative; null while either side is unknown. */
export function textBehindEdgeS(edgeCallMs: null | number, newestReleasedEndMs: null | number): null | number {
    if (edgeCallMs === null || newestReleasedEndMs === null) return null;

    return Math.max(0, (edgeCallMs - newestReleasedEndMs) / 1000);
}

/** The mode in force: the stored choice, else synced; without a transcript on screen there is nothing to sync to. */
export function resolveLiveMode(stored: LiveAudioMode | null, transcriptVisible: boolean): LiveAudioMode {
    if (!transcriptVisible) return "live";

    return stored ?? "synced";
}

/** A stored value as a mode; anything this code did not write reads as no choice. */
export function parseLiveMode(stored: null | string): LiveAudioMode | null {
    return stored === "live" || stored === "synced" ? stored : null;
}
