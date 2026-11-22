import { describe, expect, it } from "vitest";

import { AAPL_INSTRUMENT, GLD_INSTRUMENT, PDI_INSTRUMENT, SPY_INSTRUMENT, TQQQ_INSTRUMENT, VXX_INSTRUMENT } from "@/lib/instruments-fixtures";

import { datasetGateText, instrumentBadges, isSymbolParam, sectionOf, servesSection } from "./instruments";

describe("instrument badges", () => {
    it("one type badge; an exchange-traded trust adds Trust; a delisted symbol says so", () => {
        expect(instrumentBadges(AAPL_INSTRUMENT)).toEqual(["Stock"]);

        expect(instrumentBadges(TQQQ_INSTRUMENT)).toEqual(["ETF"]);

        expect(instrumentBadges(PDI_INSTRUMENT)).toEqual(["Closed-end fund"]);

        expect(instrumentBadges(GLD_INSTRUMENT)).toEqual(["ETF", "Trust"]);

        expect(instrumentBadges(VXX_INSTRUMENT)).toEqual(["ETN"]);

        expect(instrumentBadges({ ...AAPL_INSTRUMENT, is_active: false })).toEqual(["Stock", "Delisted"]);
    });
});

describe("sections from datasets", () => {
    it("reads the section of a path", () => {
        expect(sectionOf("/AAPL")).toBe("");

        expect(sectionOf("/AAPL/holders")).toBe("holders");

        expect(sectionOf("/AAPL/earnings-calls/0b6f")).toBe("earnings-calls");

        expect(sectionOf("/")).toBeUndefined();
    });

    it("a stock has no fund holdings; a registered fund has no financials; a trust has no holdings; an ETN has holders, no filings", () => {
        expect(servesSection(AAPL_INSTRUMENT.datasets, "holdings")).toBe(false);

        expect(servesSection(AAPL_INSTRUMENT.datasets, "financials")).toBe(true);

        expect(servesSection(SPY_INSTRUMENT.datasets, "financials")).toBe(false);

        expect(servesSection(SPY_INSTRUMENT.datasets, "insider-trades")).toBe(false);

        expect(servesSection(SPY_INSTRUMENT.datasets, "holdings")).toBe(true);

        expect(servesSection(GLD_INSTRUMENT.datasets, "holdings")).toBe(false);

        expect(servesSection(PDI_INSTRUMENT.datasets, "earnings-calls")).toBe(true);

        expect(servesSection(VXX_INSTRUMENT.datasets, "holders")).toBe(true);

        expect(servesSection(VXX_INSTRUMENT.datasets, "filings")).toBe(false);

        // The market pages are top-level routes now: no `$ticker` section.
        expect(servesSection(VXX_INSTRUMENT.datasets, "ipos")).toBe(false);

        expect(servesSection(AAPL_INSTRUMENT.datasets, "no-such-page")).toBe(false);
    });

    it("the gate sentence names the type, and an exchange-traded trust's structure", () => {
        expect(datasetGateText(SPY_INSTRUMENT, "financials")).toBe("SPY is an ETF: financial statements are not served for it.");

        expect(datasetGateText(VXX_INSTRUMENT, "filings")).toBe("VXX is an ETN: filings are not served for it.");

        expect(datasetGateText(GLD_INSTRUMENT, "fund_holdings")).toMatch(/^GLD is an ETF structured as an exchange-traded trust: it files no holdings report/);
    });
});

describe("isSymbolParam", () => {
    it("a symbol-sized segment can be asked; an empty or longer one never is (UI walk F008)", () => {
        expect(isSymbolParam("BRK.B")).toBe(true);

        expect(isSymbolParam("ABCDEFGHIJKLMNO")).toBe(true);

        expect(isSymbolParam("ABCDEFGHIJKLMNOP")).toBe(false);

        expect(isSymbolParam("  ")).toBe(false);
    });
});
