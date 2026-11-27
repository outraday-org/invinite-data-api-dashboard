import { describe, expect, it } from "vitest";

import { inNewsWindow, marketWindowBounds, marketWindowProblem, newsSearchWindowProblem } from "./market-window";

describe("published windows", () => {
    it("uses local midnight on each side of DST", () => {
        expect(marketWindowBounds({ from: "2026-11-01", to: "2026-11-01" })).toEqual({ gte: "2026-11-01T04:00:00.000Z", lt: "2026-11-02T05:00:00.000Z" });

        expect(marketWindowBounds({ from: "2027-03-14", to: "2027-03-14" })).toEqual({ gte: "2027-03-14T05:00:00.000Z", lt: "2027-03-15T04:00:00.000Z" });
    });

    it("bounds unscoped lists by seven New York days", () => {
        const today = "2026-11-27";

        for (const bounds of [{}, { from: "2026-11-21" }, { from: "2026-01-01", to: "2026-01-07" }]) expect(marketWindowProblem(bounds, today)).toBeNull();

        for (const bounds of [{ from: "2026-11-20" }, { from: "2026-01-01", to: "2026-01-08" }, { from: "2026-01-02", to: "2026-01-01" }]) expect(marketWindowProblem(bounds, today)).toBeTruthy();

        expect(inNewsWindow("2026-11-21T04:59:59Z", {}, true, today)).toBe(false);

        expect(inNewsWindow("2026-01-08T04:59:59Z", { to: "2026-01-07" }, true, today)).toBe(true);

        expect(inNewsWindow("2025-12-31T23:59:59Z", { to: "2026-01-07" }, true, today)).toBe(false);
    });

    it("bounds UTC search independently of the list", () => {
        const now = new Date("2026-01-01T00:00:00Z");

        expect(newsSearchWindowProblem({ from: "2024-01-01" }, now)).toBeNull();

        expect(newsSearchWindowProblem({ from: "2023-12-31" }, now)).toBeTruthy();

        expect(newsSearchWindowProblem({ to: "2020-01-01" }, now)).toBeNull();

        expect(newsSearchWindowProblem({ from: "2026-01-02", to: "2026-01-01" }, now)).toBeTruthy();
    });
});
