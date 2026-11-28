import { describe, expect, it } from "vitest";

import { kpiHistoryCallCount, kpiHistorySeries } from "./kpi-history";
import { isLowSpeakerConfidence, versionKindText } from "./labels";
import { NVDA_REVENUE_HISTORY } from "./o7-earnings-fixtures";

describe("kpiHistorySeries", () => {
    it("plots every mention of the most common unit, oldest call first, never summed or picked", () => {
        const series = kpiHistorySeries(NVDA_REVENUE_HISTORY);

        expect(series.unit).toBe("usd");

        expect(series.points.map(point => point.value)).toEqual([57_000_000_000, 68_000_000_000, 82_000_000_000, 96_000_000_000]);

        expect(series.omitted).toBe(2);
    });

    it("keeps an empty history empty", () => {
        expect(kpiHistorySeries([])).toEqual({ omitted: 0, points: [], unit: null });
    });

    it("counts distinct calls", () => {
        expect(kpiHistoryCallCount(NVDA_REVENUE_HISTORY)).toBe(4);
    });
});

describe("call header + transcript labels", () => {
    it("uses public version kind without correction workflow details", () => {
        expect(versionKindText({ version_kind: "final" })).toBe("Final");
        expect(versionKindText({ version_kind: "corrected" })).toBe("Corrected");
    });

    it("marks only a named turn below 0.8", () => {
        expect(isLowSpeakerConfidence("Jane Doe", 0.6)).toBe(true);

        expect(isLowSpeakerConfidence("Jane Doe", 0.8)).toBe(false);

        expect(isLowSpeakerConfidence(null, 0.1)).toBe(false);

        expect(isLowSpeakerConfidence("Jane Doe", undefined)).toBe(false);
    });
});
