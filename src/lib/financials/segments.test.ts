import { describe, expect, it } from "vitest";

import type { V2Segment } from "@/lib/api/types";

import { isInstantSegmentId, SEGMENT_METRICS } from "./segment-metrics";
import { segmentFactKey, segmentLines } from "./statements";
import { V2_SEGMENTS } from "./v2-fixtures";

function fact(overrides: Partial<V2Segment> = {}): V2Segment {
    return {
        ...V2_SEGMENTS.data[0],
        currency: "USD",
        dimensions: [{ axis: "StatementBusinessSegmentsAxis", member: "CurrentMember" }],
        metric_id: "is_operating_income",
        segment_id: "seg_operating_income_business_segment",
        value: 20,
        ...overrides,
    };
}

describe("segment vocabulary and series identity", () => {
    it("contains twelve unique ids and only assets/goodwill are instant metrics", () => {
        expect(SEGMENT_METRICS).toHaveLength(12);

        expect(new Set(SEGMENT_METRICS.map(metric => metric.value)).size).toBe(12);

        expect(SEGMENT_METRICS.filter(metric => isInstantSegmentId(metric.value)).map(metric => metric.value)).toEqual([
            "seg_total_assets_business_segment", "seg_goodwill_business_segment",
        ]);
    });

    it("keeps both same-period merge components without adding their non-additive values", () => {
        const rows = [
            fact({ source_member: "FirstMember", source_row_id: "first-period", value: 20, via_link: true }),
            fact({ source_member: "SecondMember", source_row_id: "second-period", value: 30, via_link: true }),
        ];

        const lines = segmentLines(rows);

        expect(lines).toHaveLength(2);

        expect(lines.map(line => [line.sourceMember, line.values["Q3 2026"]])).toEqual([
            ["FirstMember", 20], ["SecondMember", 30],
        ]);
    });

    it("keeps target identity for one source copied to several successors", () => {
        const first = fact({ source_member: "OldMember", source_row_id: "one-source", via_link: true });

        const second = fact({ ...first, dimensions: [{ axis: "StatementBusinessSegmentsAxis", member: "OtherMember" }] });

        expect(segmentFactKey(first)).not.toBe(segmentFactKey(second));

        expect(segmentLines([first, second])).toHaveLength(2);
    });

    it("de-duplicates a repeated page fact and does not merge an original row with its followed copy", () => {
        const original = fact({ source_member: "OldMember", source_row_id: "one-source", via_link: false });

        const followed = fact({ dimensions: [{ axis: "StatementBusinessSegmentsAxis", member: "SuccessorMember" }], source_member: "OldMember", source_row_id: "one-source",
            via_link: true });

        const lines = segmentLines([original, followed, { ...followed }]);

        expect(lines).toHaveLength(2);

        expect(lines.map(line => line.values["Q3 2026"])).toEqual([20, 20]);
    });

    it("retains distinct source rows even if their member and displayed period happen to collide", () => {
        const rows = [fact({ source_member: "OldMember", source_row_id: "a", via_link: true }),
            fact({ source_member: "OldMember", source_row_id: "b", value: 35, via_link: true })];

        expect(segmentLines(rows)).toHaveLength(2);

        expect(segmentLines(rows).map(line => line.values["Q3 2026"]).sort((a, b) => Number(a) - Number(b))).toEqual([20, 35]);
    });

    it("keeps one source-member series across periods, separating currencies", () => {
        const current = fact({ source_member: "OldMember", source_row_id: "old-q3", via_link: true });

        const earlier = fact({ ...current, fiscal_quarter: 2, period_end: "2026-03-31", source_row_id: "old-q2", value: 18 });

        const otherCurrency = fact({ ...current, currency: "EUR", source_row_id: "eur-q3", value: 17 });

        const lines = segmentLines([current, earlier, otherCurrency]);

        expect(lines).toHaveLength(2);

        expect(lines.find(line => line.currency === "USD")?.values).toEqual({ "Q2 2026": 18, "Q3 2026": 20 });

        expect(lines.find(line => line.currency === "EUR")?.values).toEqual({ "Q3 2026": 17 });
    });

    it("never adds duplicate default-mode rows, and retains zero values", () => {
        const zero = fact({ currency: undefined, value: 0 });

        expect(segmentLines([zero, { ...zero }])).toHaveLength(1);

        expect(segmentLines([zero])[0].values["Q3 2026"]).toBe(0);
    });
});
