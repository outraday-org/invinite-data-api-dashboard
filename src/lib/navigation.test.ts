import { describe, expect, it } from "vitest";

import { AAPL_INSTRUMENT, GLD_INSTRUMENT, PDI_INSTRUMENT, SPY_INSTRUMENT, VXX_INSTRUMENT } from "@/lib/instruments-fixtures";

import {
    BROWSE_NAV,
    filerContextAnchors,
    filerSubjectLabel,
    HELP_NAV,
    INSTRUMENT_SECTION_GROUPS,
    instrumentSubjectLabel,
    isManagerFiler,
    MARKET_NAV,
    searchPages,
    visibleInstrumentItems,
} from "./navigation";

const labels = (datasets: Parameters<typeof visibleInstrumentItems>[0]) => visibleInstrumentItems(datasets).map(item => item.label);

describe("navigation table", () => {
    it("a stock: calls, documents, filings, ONE Financials entry, holders, insider trades, no fund holdings", () => {
        expect(labels(AAPL_INSTRUMENT.datasets)).toEqual(["Overview", "Calls", "Investor documents", "Filings", "Financials", "Holders", "Insider trades", "Dividends", "Splits", "News"]);
    });

    it("a registered fund: Holdings and Holders, no Financials; a trust no Holdings; an ETN neither Financials nor Holdings", () => {
        expect(labels(SPY_INSTRUMENT.datasets)).toEqual(["Overview", "Filings", "Holders", "Holdings", "Dividends", "Splits"]);

        expect(labels(GLD_INSTRUMENT.datasets)).not.toContain("Holdings");

        expect(labels(PDI_INSTRUMENT.datasets)).toContain("Calls");

        expect(labels(VXX_INSTRUMENT.datasets)).toEqual(["Overview", "Holders", "Dividends", "Splits"]);
    });

    it("every section while the datasets are unknown", () => {
        expect(labels(null)).toHaveLength(INSTRUMENT_SECTION_GROUPS.flatMap(group => group.items).length);
    });

    it("distinct icons per item", () => {
        const icons = [...MARKET_NAV, ...BROWSE_NAV, ...HELP_NAV, ...INSTRUMENT_SECTION_GROUPS.flatMap(group => group.items)].map(item => item.icon);

        expect(new Set(icons).size).toBe(icons.length);
    });

    it("subject labels", () => {
        expect(instrumentSubjectLabel(AAPL_INSTRUMENT)).toBe("AAPL · Stock");

        expect(instrumentSubjectLabel(GLD_INSTRUMENT)).toBe("GLD · ETF (trust)");

        expect(instrumentSubjectLabel(PDI_INSTRUMENT)).toBe("PDI · Closed-end fund");

        expect(filerSubjectLabel("Vanguard Group Inc", "102909", true)).toBe("Vanguard Group Inc · Institution");

        expect(filerSubjectLabel(null, "2156369", false)).toBe("CIK 2156369 · SEC filer");
    });

    it("the search's Pages group matches labels, paths and keywords", () => {
        expect(searchPages("ipo").map(page => page.label)).toEqual(["IPOs"]);

        expect(searchPages("calendar").map(page => page.label)).toEqual(expect.arrayContaining(["Earnings calendar", "IPOs"]));

        expect(searchPages("account").map(page => page.label)).toEqual(["Account"]);

        expect(searchPages("  ")).toEqual([]);
    });

    it("a filer's blocks: profile and filings always; fund, offerings and the 13F portfolio when it has them", () => {
        expect(filerContextAnchors(null, false).map(anchor => anchor.label)).toEqual(["Profile", "Filings"]);

        expect(isManagerFiler("public", ["10-K", "13F-HR"])).toBe(true);

        expect(isManagerFiler("public", ["10-K"])).toBe(false);

        const anchors = filerContextAnchors({ fund: { series: [] } as never, private_offerings: { count: 2 } as never }, true);

        expect(anchors.map(anchor => anchor.label)).toEqual(["Profile", "Fund series", "Private offerings", "13F portfolio", "Filings"]);
    });
});
