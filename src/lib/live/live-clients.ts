import type HlsType from "hls.js";

import type { LiveAudioMode } from "./live-sync";

import { SYNC_START_LATENCY_S } from "./live-sync";

/**
 * The live player's third-party client: hls.js, pinned to `1.7.3` (the admin console's
 * version, whose config below was tuned on real calls). Loaded lazily, so pages without a
 * live call never ship it. The live transcript needs no SDK: it is the browser's own
 * `WebSocket` (`use-live-transcript.ts`).
 */

/** The hls.js constructor, loaded on demand. */
export async function loadHls(): Promise<typeof HlsType> {
    const module = await import("hls.js");

    return module.default;
}

/**
 * hls.js config for the live rendition's 2-s segments (the admin console's values, owner
 * decision 2026-10-09): 3 segments (~6 s) behind the edge; past 15 segments (30 s) hls.js
 * jumps forward, unless the listener chose a place back there (`keepListenerPlace`). `maxLiveSyncPlaybackRate` is inert: hls.js only changes the speed with
 * `lowLatencyMode`, so nothing fights the sync rule's 0.9×. The stream has no LL-HLS parts. The live
 * watermark's marker-chain delay (≤ 6 s) is inside the playlist's `PROGRAM-DATE-TIME`, so the
 * transcript sync needs no client-side offset.
 */
export const LIVE_HLS_CONFIG = {
    liveMaxLatencyDurationCount: 15,
    liveSyncDurationCount: 3,
    lowLatencyMode: false,
    maxLiveSyncPlaybackRate: 1.1,
} as const;

/** The capture's segment length, for an answer that does not say. */
const DEFAULT_SEGMENT_SECONDS = 2;

/** No forward jump of hls.js's own in synced mode: a held audio may trail for minutes, `syncTarget` owns the jump. */
const SYNCED_MAX_LATENCY_S = 86_400;

/**
 * Synced mode's config (hls.js refuses `liveSyncDuration` next to `liveSyncDurationCount`, so not a spread): starts
 * `SYNC_START_LATENCY_S` behind the edge, later moved to the measured distance (`syncLatencyS`).
 */
export const SYNCED_HLS_CONFIG = {
    liveMaxLatencyDuration: SYNCED_MAX_LATENCY_S,
    liveSyncDuration: SYNC_START_LATENCY_S,
    lowLatencyMode: false,
    maxLiveSyncPlaybackRate: 1.1,
} as const;

/** A mode switch on a running hls.js: its distance to the edge and when it jumps by itself. */
export function applyLiveLatency(hls: HlsType, mode: LiveAudioMode, syncedLatencyS: number, segmentSeconds: number): void {
    const seconds = segmentSeconds > 0 ? segmentSeconds : DEFAULT_SEGMENT_SECONDS;

    hls.targetLatency = mode === "synced" ? syncedLatencyS : LIVE_HLS_CONFIG.liveSyncDurationCount * seconds;

    hls.config.liveMaxLatencyDuration = mode === "synced" ? SYNCED_MAX_LATENCY_S : LIVE_HLS_CONFIG.liveMaxLatencyDurationCount * seconds;
}

/**
 * The listener chose a place behind the edge ("From the beginning", a seek): hls.js's own forward jump would
 * throw it back at the next playlist update. `applyLiveLatency` puts the jump back.
 */
export function keepListenerPlace(hls: HlsType): void {
    hls.config.liveMaxLatencyDuration = SYNCED_MAX_LATENCY_S;
}
