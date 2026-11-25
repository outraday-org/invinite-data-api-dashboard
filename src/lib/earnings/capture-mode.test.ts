import { describe, expect, it } from "vitest";

import { isReplayCapture, withoutReplayCaptures } from "./capture-mode";

describe("capture mode", () => {
    it("only capture_mode 'replay' is a replay (live, null, missing are not)", () => {
        expect(isReplayCapture({ capture_mode: "replay" })).toBe(true);

        expect(isReplayCapture({ capture_mode: "live" })).toBe(false);

        expect(isReplayCapture({ capture_mode: null })).toBe(false);

        expect(isReplayCapture({})).toBe(false);
    });

    it("drops the replay rows of a live list and keeps the rest of the page", () => {
        const page = { data: [{ capture_mode: "live" as const, id: "a" }, { capture_mode: "replay" as const, id: "b" }, { id: "c" }], has_more: false };

        expect(withoutReplayCaptures(page)).toEqual({ data: [{ capture_mode: "live", id: "a" }, { id: "c" }], has_more: false });
    });

    it("returns a list without replays as it is", () => {
        const page = { data: [{ capture_mode: "live" as const }] };

        expect(withoutReplayCaptures(page)).toBe(page);
    });
});
