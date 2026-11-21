import { describe, expect, it } from "vitest";

import type { HlsAudioView } from "./hls-engine";

import { hlsClockOffsetMs, hlsEngineFields, hlsEngineState } from "./hls-engine";

const T0 = "2026-10-31T14:00:00.000Z";

const T0_MS = Date.parse(T0);

function audioOf(overrides: Partial<HlsAudioView> = {}, position: Partial<HlsAudioView["position"]> = {}): HlsAudioView {
    return {
        autoplayBlocked: false,
        canJumpToLive: false,
        phase: "playing",
        position: {
            behindS: 0,
            currentTime: 0,
            edgeBehindS: 0,
            edgeDate: null,
            edgeSeconds: null,
            heardDate: null,
            playingDate: null,
            ...position,
        },
        started: true,
        ...overrides,
    };
}

describe("hlsEngineState", () => {
    it("maps the live hook onto the player states", () => {
        expect(hlsEngineState(audioOf({ phase: "idle", started: false }), null)).toBe("idle");

        expect(hlsEngineState(audioOf({ phase: "loading" }), null)).toBe("loading");

        expect(hlsEngineState(audioOf(), null)).toBe("live-edge");

        expect(hlsEngineState(audioOf({ canJumpToLive: true }), null)).toBe("live-behind");

        expect(hlsEngineState(audioOf({ phase: "ended" }), null)).toBe("ended");

        // `stop()` at the switch to the recording: not started, ended.
        expect(hlsEngineState(audioOf({ phase: "ended", started: false }), null)).toBe("ended");

        expect(hlsEngineState(audioOf({ phase: "unavailable" }), null)).toBe("error");
    });

    it("a refused autoplay shows the controls (the listener's play starts it); a failed stream request is an error", () => {
        expect(hlsEngineState(audioOf({ autoplayBlocked: true, phase: "loading" }), null)).toBe("live-edge");

        expect(hlsEngineState(audioOf({ phase: "idle", started: false }), new Error("plan"))).toBe("error");
    });
});

describe("hlsEngineFields", () => {
    const position = {
        behindS: 31.6,
        currentTime: 50,
        edgeSeconds: 81.6,
        heardDate: new Date(T0_MS + 60_400),
        playingDate: new Date(T0_MS + 60_400),
    };

    it("answers the call clock in whole seconds: the heard position, the edge, how far behind", () => {
        const offsetMs = hlsClockOffsetMs(audioOf({}, position).position, T0);

        expect(offsetMs).toBe(10_400);

        expect(hlsEngineFields(audioOf({ canJumpToLive: true }, position), { callT0: T0, mode: "live", offsetMs: 10_400, streamError: null })).toEqual({
            behindMs: 31_000,
            endMs: 92_000,
            positionMs: 60_000,
            state: "live-behind",
        });
    });

    it("Synced at its normal distance is not behind; after a seek back it is", () => {
        const input = { callT0: T0, mode: "synced" as const, offsetMs: 10_400, streamError: null };

        expect(hlsEngineFields(audioOf({}, position), input).behindMs).toBe(0);

        expect(hlsEngineFields(audioOf({ canJumpToLive: true }, position), input).behindMs).toBe(31_000);
    });

    it("without call_t0 it falls back to the media time", () => {
        const noT0 = audioOf({}, { ...position, heardDate: null, playingDate: null });

        expect(hlsClockOffsetMs(noT0.position, null)).toBeNull();

        expect(hlsEngineFields(noT0, { callT0: null, mode: "live", offsetMs: 0, streamError: null })).toMatchObject({ endMs: 81_000, positionMs: 50_000 });
    });
});
