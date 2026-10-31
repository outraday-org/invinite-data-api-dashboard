import { describe, expect, it } from "vitest";

import {
    newestReleasedFinal,
    parseLiveMode,
    resolveLiveMode,
    SYNC_MARGIN_MS,
    syncLatencyS,
    syncPauseStep,
    syncTarget,
    textBehindEdgeS,
} from "./live-sync";

const E = 100_000;

const POINT = E - SYNC_MARGIN_MS;

describe("syncTarget", () => {
    it.each([
        ["at the point", POINT, "play"],
        ["behind the point", POINT - 5_000, "play"],
        ["just behind the jump threshold", POINT - 20_000, "play"],
        ["ahead by less than 3 s", POINT + 1, "slow"],
        ["ahead by exactly 3 s", POINT + 3_000, "slow"],
        ["ahead by more than 3 s", POINT + 3_001, "wait"],
        ["far behind", POINT - 20_001, "jump"],
    ] as const)("%s", (_name, audioCallMs, action) => {
        expect(syncTarget({ audioCallMs, mode: "synced", newestReleasedEndMs: E }).action).toBe(action);
    });

    it("targets the newest final's end minus the margin", () => {
        expect(syncTarget({ audioCallMs: POINT, mode: "synced", newestReleasedEndMs: E }).targetCallMs).toBe(POINT);
    });

    it("no text yet: plays, no target", () => {
        expect(syncTarget({ audioCallMs: 5_000, mode: "synced", newestReleasedEndMs: null })).toEqual({
            action: "play",
            targetCallMs: null,
        });
    });

    it("no position yet: plays", () => {
        expect(syncTarget({ audioCallMs: null, mode: "synced", newestReleasedEndMs: E }).action).toBe("play");
    });

    it("call ended: plays out, ahead or far behind", () => {
        for (const audioCallMs of [POINT + 10_000, POINT - 60_000]) {
            expect(syncTarget({ audioCallMs, ended: true, mode: "synced", newestReleasedEndMs: E }).action).toBe("play");
        }
    });

    it("live mode: always plays", () => {
        for (const audioCallMs of [POINT + 10_000, POINT - 60_000]) {
            expect(syncTarget({ audioCallMs, mode: "live", newestReleasedEndMs: E }).action).toBe("play");
        }
    });

    it("a listener who seeked behind stays there", () => {
        expect(syncTarget({ audioCallMs: 0, following: true, mode: "synced", newestReleasedEndMs: E }).action).toBe("play");
    });

    it("text idle: never holds the audio, still jumps when the text comes back far ahead", () => {
        const input = { mode: "synced", newestReleasedEndMs: E, textIdle: true } as const;

        expect(syncTarget({ ...input, audioCallMs: POINT + 1 }).action).toBe("play");

        expect(syncTarget({ ...input, audioCallMs: POINT + 60_000 }).action).toBe("play");

        expect(syncTarget({ ...input, audioCallMs: POINT - 30_000 }).action).toBe("jump");
    });

    it("a jump lands on the newest final's start when that is ahead of the audio, so its sentence is heard", () => {
        const base = { audioCallMs: 10_000, mode: "synced", newestReleasedEndMs: E } as const;

        expect(syncTarget({ ...base, newestReleasedStartMs: 85_000 })).toEqual({ action: "jump", targetCallMs: 85_000 });

        // A start already passed, or none known: the point.
        expect(syncTarget({ ...base, newestReleasedStartMs: 5_000 }).targetCallMs).toBe(POINT);

        expect(syncTarget(base).targetCallMs).toBe(POINT);
    });

    it("a jump only ever goes forward", () => {
        for (const audioCallMs of [0, 10_000, POINT - 20_001]) {
            const { action, targetCallMs } = syncTarget({
                audioCallMs,
                mode: "synced",
                newestReleasedEndMs: E,
                newestReleasedStartMs: 85_000,
            });

            expect(action).toBe("jump");

            expect(targetCallMs).toBeGreaterThan(audioCallMs);
        }
    });
});

describe("syncPauseStep", () => {
    it.each([
        ["wait, playing: pause", "wait", false, false, "pause"],
        ["wait, already held: nothing", "wait", true, true, "none"],
        ["wait, the listener's pause: nothing", "wait", true, false, "none"],
        ["play, held: resume", "play", true, true, "resume"],
        ["slow, held: resume", "slow", true, true, "resume"],
        ["jump, held: resume", "jump", true, true, "resume"],
        ["play, the listener's pause: stays", "play", true, false, "none"],
        ["play, playing: nothing", "play", false, false, "none"],
    ] as const)("%s", (_name, action, paused, heldAtBoundary, step) => {
        expect(syncPauseStep(action, { heldAtBoundary, paused })).toBe(step);
    });
});

describe("newestReleasedFinal", () => {
    it("is the final with the newest end, null without one", () => {
        const a = { endMs: 5, startMs: 1 };

        const b = { endMs: 9, startMs: 6 };

        expect(newestReleasedFinal([a, b])).toBe(b);

        expect(newestReleasedFinal([b, a])).toBe(b);

        expect(newestReleasedFinal([])).toBeNull();
    });
});

describe("syncLatencyS", () => {
    it("is the edge to the newest final's start plus the margin, clamped", () => {
        expect(syncLatencyS(30_000, 10_000)).toBe(21.5);

        expect(syncLatencyS(10_000, 9_000)).toBe(6);

        expect(syncLatencyS(600_000, 0)).toBe(120);
    });

    it("is null while either side is unknown", () => {
        expect(syncLatencyS(null, 10_000)).toBeNull();

        expect(syncLatencyS(30_000, null)).toBeNull();
    });
});

describe("textBehindEdgeS", () => {
    it("never goes negative, null while unknown", () => {
        expect(textBehindEdgeS(30_000, 18_000)).toBe(12);

        expect(textBehindEdgeS(10_000, 18_000)).toBe(0);

        expect(textBehindEdgeS(null, 18_000)).toBeNull();
    });
});

describe("the mode", () => {
    it("defaults to synced where a transcript is shown, live where none is", () => {
        expect(resolveLiveMode(null, true)).toBe("synced");

        expect(resolveLiveMode("live", true)).toBe("live");

        expect(resolveLiveMode("synced", false)).toBe("live");
    });

    it("a stored value reads as a mode only if it is one", () => {
        expect(parseLiveMode("live")).toBe("live");

        expect(parseLiveMode("synced")).toBe("synced");

        expect(parseLiveMode("other")).toBeNull();

        expect(parseLiveMode(null)).toBeNull();
    });
});
