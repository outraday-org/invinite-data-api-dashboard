import { describe, expect, it } from "vitest";

import type { V2Me } from "@/lib/api/types";

import { liveOn, liveParam, planStreams } from "./live-default";

const me = (plan: V2Me["plan"]) => ({ plan }) as V2Me;

describe("planStreams", () => {
    it("is true from the stream's tier, false below it, for pay-as-you-go and an unknown plan", () => {
        expect(planStreams(me("pro"))).toBe(true);

        expect(planStreams(me("enterprise"))).toBe(true);

        expect(planStreams(me("standard"))).toBe(false);

        expect(planStreams(me("payg"))).toBe(false);

        expect(planStreams(null)).toBe(false);
    });
});

describe("liveOn / liveParam", () => {
    it("reads the URL value when written, else the default", () => {
        expect(liveOn(undefined, true)).toBe(true);

        expect(liveOn(undefined, false)).toBe(false);

        expect(liveOn(false, true)).toBe(false);

        expect(liveOn(true, false)).toBe(true);
    });

    it("writes the default as undefined and the other state explicitly", () => {
        expect(liveParam(true, true)).toBeUndefined();

        expect(liveParam(false, true)).toBe(false);

        expect(liveParam(true, false)).toBe(true);

        expect(liveParam(false, false)).toBeUndefined();
    });
});
