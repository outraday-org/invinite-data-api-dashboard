import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { kpiHistoryCallCount, kpiHistorySeries } from "./kpi-history";
import { EXPIRED_REASON_LABELS, isLowSpeakerConfidence, versionKindText } from "./labels";
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
    type Spec = { components: { schemas: { Event: { properties: { expired_reason: { enum: Array<null | string> } } } } } };

    // The pinned contract itself: a reason added to `openapi.json` fails here until it is labelled.
    const spec = JSON.parse(readFileSync(new URL("../../../openapi.json", import.meta.url), "utf8")) as Spec;

    it("labels every expired_reason of the contract", () => {
        const reasons = spec.components.schemas.Event.properties.expired_reason.enum.filter((value): value is string => value !== null);

        expect(Object.keys(EXPIRED_REASON_LABELS).sort()).toEqual([...reasons].sort());
    });

    it("names who corrected a version (corrected_by)", () => {
        expect(versionKindText({ corrected_by: null, version_kind: "final" })).toBe("final");

        expect(versionKindText({ corrected_by: "human", version_kind: "corrected" })).toBe("corrected by a person");

        expect(versionKindText({ corrected_by: "system:company_text", version_kind: "corrected" })).toBe("corrected by the system (company text)");

        expect(versionKindText({ corrected_by: "human", version_kind: "final" })).toBe("final, corrected by a person");
    });

    it("marks only a named turn below 0.8", () => {
        expect(isLowSpeakerConfidence("Jane Doe", 0.6)).toBe(true);

        expect(isLowSpeakerConfidence("Jane Doe", 0.8)).toBe(false);

        expect(isLowSpeakerConfidence(null, 0.1)).toBe(false);

        expect(isLowSpeakerConfidence("Jane Doe", undefined)).toBe(false);
    });
});
