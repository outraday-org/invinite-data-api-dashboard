import { describe, expect, it } from "vitest";

import {
    formatGuidanceRange,
    formatGuidanceValue,
    formatSigned,
    highlightSpans,
    highlightTerms,
    metricLabel,
    participationDetailText,
    participationKindLabel,
    percent,
    roleGroup,
} from "./labels";

describe("highlightTerms", () => {
    it("marks every term case-insensitively and keeps the original casing", () => {
        expect(highlightTerms("Gross Margin expanded; margin guidance raised", "margin RAISED")).toEqual([
            { match: false, text: "Gross " },
            { match: true, text: "Margin" },
            { match: false, text: " expanded; " },
            { match: true, text: "margin" },
            { match: false, text: " guidance " },
            { match: true, text: "raised" },
        ]);
    });

    it("treats regex metacharacters as plain text (no regex injection)", () => {
        expect(highlightTerms("EPS (non-GAAP) of $2.05+", "(non-GAAP) $2.05+ .*")).toEqual([
            { match: false, text: "EPS " },
            { match: true, text: "(non-GAAP)" },
            { match: false, text: " of " },
            { match: true, text: "$2.05+" },
        ]);

        expect(highlightTerms("anything", "[")).toEqual([{ match: false, text: "anything" }]);
    });

    it("prefers the longest term at a position and ignores one-character terms", () => {
        expect(highlightTerms("revenues grew", "rev revenues a")).toEqual([
            { match: true, text: "revenues" },
            { match: false, text: " grew" },
        ]);
    });

    it("returns the whole text unmarked for an empty query and nothing for empty text", () => {
        expect(highlightTerms("text", "   ")).toEqual([{ match: false, text: "text" }]);

        expect(highlightTerms("", "term")).toEqual([]);
    });
});

describe("highlightSpans", () => {
    it("marks code-point spans, so an emoji before the match does not shift it", () => {
        // "📈" is one code point but two UTF-16 units: string.slice offsets would be off by one.
        expect(highlightSpans("📈 Margin rose", [{ end: 8, start: 2 }])).toEqual([
            { match: false, text: "📈 " },
            { match: true, text: "Margin" },
            { match: false, text: " rose" },
        ]);
    });

    it("sorts, clamps and merges overlapping or touching spans", () => {
        expect(highlightSpans("abcdefgh", [{ end: 99, start: 6 }, { end: 3, start: 1 }, { end: 4, start: 2 }, { end: 6, start: 4 }])).toEqual([
            { match: false, text: "a" },
            { match: true, text: "bcdefgh" },
        ]);

        expect(highlightSpans("abc", [{ end: 1, start: 1 }, { end: 0, start: -2 }])).toEqual([{ match: false, text: "abc" }]);
    });

    it("returns the whole text unmarked without spans and nothing for empty text", () => {
        expect(highlightSpans("text", [])).toEqual([{ match: false, text: "text" }]);

        expect(highlightSpans("", [{ end: 1, start: 0 }])).toEqual([]);
    });
});

describe("percent", () => {
    it("formats a 0–1 share with one decimal by default", () => {
        expect(percent(0.425)).toBe("42.5%");

        expect(percent(1)).toBe("100.0%");

        expect(percent(0.12345, 2)).toBe("12.35%");
    });

    it("renders null, undefined and non-finite values as a dash", () => {
        expect(percent(null)).toBe("—");

        expect(percent(undefined)).toBe("—");

        expect(percent(Number.NaN)).toBe("—");
    });
});

describe("formatSigned", () => {
    it("prefixes the sign and returns null for a missing value", () => {
        expect(formatSigned(0.123)).toBe("+0.12");

        expect(formatSigned(-0.05)).toBe("−0.05");

        expect(formatSigned(0)).toBe("0");

        expect(formatSigned(null)).toBeNull();
    });
});

describe("guidance values", () => {
    it("formats a figure in its unit", () => {
        expect(formatGuidanceValue(9_700_000_000, "usd", "USD")).toBe("$9.70 B");

        expect(formatGuidanceValue(2.05, "usd", null)).toBe("$2.05");

        expect(formatGuidanceValue(45, "pct", null)).toBe("45%");

        expect(formatGuidanceValue(1_200_000_000, "usd", "EUR")).toBe("EUR 1.20 B");

        expect(formatGuidanceValue(null, "usd", "USD")).toBe("—");
    });

    it("shows a range, a single value or a dash", () => {
        expect(formatGuidanceRange({ currency: "USD", high: 2.25, low: 2.05, unit: "usd" })).toBe("$2.05 – $2.25");

        expect(formatGuidanceRange({ currency: null, high: 40, low: 40, unit: "pct" })).toBe("40%");

        expect(formatGuidanceRange({ currency: null, high: null, low: 3, unit: "ratio" })).toBe("3");

        expect(formatGuidanceRange({ currency: null, high: null, low: null, unit: null })).toBe("—");
    });
});

describe("labels", () => {
    it("names normalized metrics and segments", () => {
        expect(metricLabel("eps_non_gaap")).toBe("EPS (non-GAAP)");

        expect(metricLabel("segment:cloud-services")).toBe("Segment: cloud services");

        expect(metricLabel("backlog_value")).toBe("Backlog value");

        expect(metricLabel(null)).toBe("—");
    });

    it("groups the pipeline's participant roles", () => {
        expect(roleGroup("executive")).toBe("management");

        expect(roleGroup("ir_host")).toBe("management");

        expect(roleGroup("analyst")).toBe("analyst");

        expect(roleGroup("operator")).toBe("operator");

        expect(roleGroup(null)).toBe("unknown");
    });

    it("renders participation events without ids", () => {
        expect(participationKindLabel("new_cfo")).toBe("New CFO");

        expect(participationKindLabel("some_new_kind")).toBe("Some new kind");

        expect(participationDetailText({ priorEventUid: "x", priorPersonId: "y", title: "Chief Financial Officer" }))
            .toBe("Chief Financial Officer");

        expect(participationDetailText({ personIds: ["a", "b", "c"] })).toBe("3 people");

        expect(participationDetailText({ personIds: ["a"], role: "analyst" })).toBe("Analyst");

        expect(participationDetailText(null)).toBe("");
    });
});
