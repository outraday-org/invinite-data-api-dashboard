import { describe, expect, it } from "vitest";

import { DASH, fiscalYearEndText, formatDay, formatInstant, formatMoney, formatMoneyCompact, formatNumber, formatShares } from "@/lib/format";
import { pageTitle } from "@/lib/layout";

describe("formatDay", () => {
    it("a date-only string is its own calendar day, in every timezone", () => {
        expect(formatDay("2026-10-29")).toBe("Oct 29, 2026");

        expect(formatDay("2026-01-01", "Pacific/Honolulu")).toBe("Jan 1, 2026");
    });

    it("a timestamp is its day in the given timezone", () => {
        expect(formatDay("2026-10-30T02:00:00Z", "America/New_York")).toBe("Oct 29, 2026");

        expect(formatDay("2026-10-30T02:00:00Z", "UTC")).toBe("Oct 30, 2026");
    });

    it("absent = dash, unparsable = as given", () => {
        expect(formatDay(null)).toBe(DASH);

        expect(formatDay(undefined)).toBe(DASH);

        expect(formatDay("soon")).toBe("soon");
    });
});

describe("formatInstant", () => {
    it("the moment with its zone label", () => {
        expect(formatInstant("2026-10-29T20:30:00.000Z", "America/New_York")).toBe("Oct 29, 2026, 4:30 PM EDT");

        expect(formatInstant("2026-12-01T15:05:00Z", "UTC")).toBe("Dec 1, 2026, 3:05 PM UTC");
    });

    it("a date-only value is a day; absent = dash", () => {
        expect(formatInstant("2026-10-29")).toBe("Oct 29, 2026");

        expect(formatInstant(null)).toBe(DASH);
    });
});

describe("formatMoneyCompact", () => {
    it("K / M / B / T by magnitude", () => {
        expect(formatMoneyCompact(3_950_000_000_000)).toBe("$3.95T");

        expect(formatMoneyCompact(712_345_678_901.23)).toBe("$712.35B");

        expect(formatMoneyCompact(812_400_000)).toBe("$812.4M");

        expect(formatMoneyCompact(12_500)).toBe("$12.5K");

        expect(formatMoneyCompact(950)).toBe("$950");
    });

    it("negative values keep their sign; another currency its symbol; absent = dash", () => {
        expect(formatMoneyCompact(-2_100_000)).toBe("-$2.1M");

        expect(formatMoneyCompact(5_000_000_000, "EUR")).toBe("€5B");

        expect(formatMoneyCompact(null)).toBe(DASH);

        expect(formatMoneyCompact(Number.NaN)).toBe(DASH);
    });
});

describe("formatMoney / formatShares / formatNumber", () => {
    it("exact money with up to the asked decimals (a dividend keeps 4)", () => {
        expect(formatMoney(1234.5)).toBe("$1,234.50");

        expect(formatMoney(0.2625, { maximumFractionDigits: 4 })).toBe("$0.2625");

        expect(formatMoney(0.25, { maximumFractionDigits: 4 })).toBe("$0.25");
    });

    it("shares and counts grouped in English", () => {
        expect(formatShares(15_204_137_000)).toBe("15,204,137,000");

        expect(formatShares(10.12345)).toBe("10.1235");

        expect(formatNumber(164_000)).toBe("164,000");

        expect(formatShares(undefined)).toBe(DASH);
    });
});

describe("fiscalYearEndText", () => {
    it("reads `MM-DD` as a day of the year; anything else as answered, none as a dash", () => {
        expect(fiscalYearEndText("09-30")).toBe("Sep 30");

        expect(fiscalYearEndText("12-31")).toBe("Dec 31");

        expect(fiscalYearEndText(null)).toBe(DASH);

        expect(fiscalYearEndText("2026-09")).toBe("2026-09");

        expect(fiscalYearEndText("13-01")).toBe("13-01");
    });
});

describe("pageTitle", () => {
    it("symbol · section — Invinite Data", () => {
        expect(pageTitle("AAPL", "Dividends")).toBe("AAPL · Dividends — Invinite Data");

        expect(pageTitle("Funds")).toBe("Funds — Invinite Data");

        expect(pageTitle()).toBe("Invinite Data");

        expect(pageTitle("AAPL", null)).toBe("AAPL — Invinite Data");
    });
});
