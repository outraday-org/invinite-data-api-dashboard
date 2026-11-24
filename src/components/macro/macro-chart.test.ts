import { describe, expect, it } from "vitest";

import { historyPoints } from "./macro-chart";

describe("Treasury quotation history", () => {
    it.each([
        ["2026-10-09", "2026-10-13"],
        ["2026-11-10", "2026-11-12"],
    ])("connects the published quotations on %s and %s across the market closure", (before, after) => {
        const first = { label: before, value: 4.2 };

        const last = { label: after, value: 4.3 };

        expect(historyPoints([last, first], "D")).toEqual([first, last]);
    });

    it("keeps a break when a published curve has no yield for the selected maturity", () => {
        const quotes = [
            { label: "2026-11-16", value: 4.2 },
            { label: "2026-11-17", value: null },
            { label: "2026-11-18", value: 4.3 },
        ];

        expect(historyPoints(quotes, "D")).toEqual(quotes);
    });
});
