import type HlsType from "hls.js";

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
 * jumps forward, in between it catches up at ≤ 1.1×. The stream has no LL-HLS parts. The live
 * watermark's marker-chain delay (≤ 6 s) is inside the playlist's `PROGRAM-DATE-TIME`, so the
 * transcript sync needs no client-side offset.
 */
export const LIVE_HLS_CONFIG = {
    liveMaxLatencyDurationCount: 15,
    liveSyncDurationCount: 3,
    lowLatencyMode: false,
    maxLiveSyncPlaybackRate: 1.1,
} as const;
