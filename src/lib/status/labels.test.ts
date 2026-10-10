import { describe, expect, it } from "vitest";

import {
    datasetLabel,
    dayTickLabel,
    describeEarningsScope,
    FAMILY_LABELS,
    familyLabel,
    familySeriesStyle,
    formatAgeHours,
    formatMs,
    formatRatioPercent,
    formatSeconds,
    formatUtcDateTime,
    PRODUCT_FAMILIES,
    utcDayOf,
    vendorLabel,
} from "./labels";

describe("FAMILY_LABELS", () => {
    it("labels every measured family and the WebSocket", () => {
        for (const family of PRODUCT_FAMILIES) expect(FAMILY_LABELS[family]).toBeTruthy();

        expect(FAMILY_LABELS.websocket).toBe("WebSocket");

        expect(FAMILY_LABELS.sec_filings).toBe("SEC filings");
    });
});

describe("familySeriesStyle", () => {
    it("gives each of the first eight families its fixed slot in PRODUCT_FAMILIES order", () => {
        expect(familySeriesStyle("company")).toEqual({ color: "var(--series-1)", dashed: false });

        expect(familySeriesStyle("earnings_calls")).toEqual({ color: "var(--series-8)", dashed: false });
    });

    it("draws the ninth family muted and dashed", () => {
        expect(familySeriesStyle("metadata")).toEqual({ color: "var(--muted-foreground)", dashed: true });
    });

    it("labels an unknown family with its raw key", () => {
        expect(familyLabel("options_chain")).toBe("options_chain");

        expect(familyLabel("ipos")).toBe("IPOs");
    });
});

describe("formatters", () => {
    it("formats ratios as percent with two decimals", () => {
        expect(formatRatioPercent(0.99987)).toBe("99.99%");

        expect(formatRatioPercent(1, 1)).toBe("100.0%");

        expect(formatRatioPercent(null)).toBe("—");
    });

    it("formats latency and age", () => {
        expect(formatMs(1234)).toBe("1,234 ms");

        expect(formatMs(null)).toBe("—");

        expect(formatSeconds(12.345)).toBe("12.3 s");

        expect(formatAgeHours(3.2)).toBe("3.2 h");

        expect(formatAgeHours(72)).toBe("3.0 d");

        expect(formatAgeHours(null)).toBe("—");
    });
});

describe("describeEarningsScope", () => {
    it("describes top-N and all, and nothing for unknown", () => {
        expect(describeEarningsScope("top500")).toBe("the top 500 US companies by market cap");

        expect(describeEarningsScope("top1500")).toBe("the top 1,500 US companies by market cap");

        expect(describeEarningsScope("all")).toBe("all US-listed companies");

        expect(describeEarningsScope("unknown")).toBeNull();
    });
});

describe("day labels", () => {
    it("labels the current UTC day as partial", () => {
        const today = utcDayOf("2026-10-10T08:15:00Z");

        expect(today).toBe("2026-10-10");

        expect(dayTickLabel("2026-10-10", today)).toBe("today (partial)");

        expect(dayTickLabel("2026-10-09", today)).toBe("10-09");

        expect(utcDayOf("not a date")).toBeNull();
    });
});

describe("display helpers", () => {
    it("formats timestamps in UTC", () => {
        expect(formatUtcDateTime("2026-10-10T08:15:00Z")).toBe("Oct 10, 2026, 8:15 AM UTC");

        expect(formatUtcDateTime(null)).toBe("—");
    });

    it("labels vendors and datasets", () => {
        expect(vendorLabel("all")).toBe("All vendors");

        expect(vendorLabel("q4events")).toBe("Q4 Events");

        expect(vendorLabel("newvendor")).toBe("newvendor");

        expect(datasetLabel("insider_transactions")).toBe("Insider transactions");
    });
});
