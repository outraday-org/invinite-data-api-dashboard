import { describe, expect, it } from "vitest";

import type { PlaylistFragment } from "./position-to-call-ms";

import {
    activeTurnIndex,
    mediaTimeForCallMs,
    positionToCallMs,
    secondsBehindEdge,
} from "./position-to-call-ms";

const CALL_T0 = "2026-10-30T21:00:00.000Z";

const T0_MS = Date.parse(CALL_T0);

/**
 * Task 37's playlist for segments `0, <skipped 1>, 2` across a worker restart:
 * 2-s segments; segment 1 failed for good and was left out, so segment 2 carries
 * `#EXT-X-DISCONTINUITY` + its own PDT (call clock 4 s). The relaunched attempt
 * then resumes 10 s later on the call clock (another discontinuity).
 */
const FRAGMENTS: ReadonlyArray<PlaylistFragment> = [
    { duration: 2, programDateTime: T0_MS, start: 0 },
    { duration: 2, programDateTime: T0_MS + 4_000, start: 2 },
    { duration: 2, programDateTime: T0_MS + 16_000, start: 4 },
];

describe("position-to-call-ms", () => {
    it("is playingDate − callT0", () => {
        expect(positionToCallMs(new Date(T0_MS + 12_345), CALL_T0)).toBe(12_345);
    });

    it("gives no position (so no highlight) without playingDate or callT0", () => {
        expect(positionToCallMs(null, CALL_T0)).toBeNull();

        expect(positionToCallMs(undefined, CALL_T0)).toBeNull();

        expect(positionToCallMs(new Date(T0_MS), null)).toBeNull();

        expect(activeTurnIndex([{ startMs: 0 }], null)).toBe(-1);
    });

    it("picks the last turn that started at or before the position", () => {
        const turns = [{ startMs: 0 }, { startMs: 4_000 }, { startMs: 9_000 }];

        expect(activeTurnIndex(turns, 4_500)).toBe(1);

        expect(activeTurnIndex(turns, 10_000)).toBe(2);
    });

    it("measures 'behind the edge' on the media timeline", () => {
        expect(secondsBehindEdge(120, 100)).toBe(20);

        expect(secondsBehindEdge(120, 125)).toBe(0);

        expect(secondsBehindEdge(null, 3)).toBe(0);
    });
});

describe("mediaTimeForCallMs (a turn click behind the edge)", () => {
    it("maps call ms back onto the media timeline across both discontinuities", () => {
        expect(mediaTimeForCallMs(FRAGMENTS, CALL_T0, 1_500)).toBe(1.5);

        expect(mediaTimeForCallMs(FRAGMENTS, CALL_T0, 4_500)).toBe(2.5);

        expect(mediaTimeForCallMs(FRAGMENTS, CALL_T0, 17_000)).toBe(5);
    });

    it("lands a target inside a gap on the next fragment's start", () => {
        // Call 2.5 s was the skipped segment 1; call 10 s was the restart gap.
        expect(mediaTimeForCallMs(FRAGMENTS, CALL_T0, 2_500)).toBe(2);

        expect(mediaTimeForCallMs(FRAGMENTS, CALL_T0, 10_000)).toBe(4);
    });

    it("answers null without a callT0", () => {
        expect(mediaTimeForCallMs(FRAGMENTS, null, 1_000)).toBeNull();
    });
});
