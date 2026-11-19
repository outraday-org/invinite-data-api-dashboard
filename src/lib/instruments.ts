import type { V2Dataset, V2FundStructure, V2Instrument, V2InstrumentType } from "@/lib/api/types";

/**
 * The dashboard's view of an instrument (Data API 7.0): its type badge and which sections of `/$ticker` exist for it.
 * The API's `datasets` is the ONLY source of that answer; no per-type list lives here, only the section → dataset map.
 */

export const INSTRUMENT_TYPE_LABELS: Record<V2InstrumentType, string> = {
    closed_end_fund: "Closed-end fund",
    etf: "ETF",
    etn: "ETN",
    stock: "Stock",
};

export const FUND_STRUCTURE_LABELS: Record<V2FundStructure, string> = {
    exchange_traded_trust: "Exchange-traded trust",
    registered_fund: "Registered fund",
};

/** The article-led noun of a type for sentences ("an ETF", "a closed-end fund"). */
const TYPE_NOUNS: Record<V2InstrumentType, string> = {
    closed_end_fund: "a closed-end fund",
    etf: "an ETF",
    etn: "an ETN",
    stock: "a stock",
};

/** The badges of a search hit / header: the type, plus "Trust" for an exchange-traded trust and "Delisted". */
export function instrumentBadges(instrument: Pick<V2Instrument, "is_active" | "structure" | "type">): Array<string> {
    const badges = [INSTRUMENT_TYPE_LABELS[instrument.type]];

    if (instrument.structure === "exchange_traded_trust") badges.push("Trust");

    if (!instrument.is_active) badges.push("Delisted");

    return badges;
}

export const isFundType = (type: V2InstrumentType): boolean => type === "etf" || type === "closed_end_fund";

/**
 * The `$ticker` section (the first path segment after the ticker; "" = the overview) → the dataset it shows. `null` =
 * market-wide (Earnings Calendar, IPOs, Market Holidays): shown for every ticker.
 */
export const SECTION_DATASETS: Record<string, null | V2Dataset> = {
    "": "profile",
    "dividends": "dividends",
    "documents": "investor_documents",
    "earnings-calendar": null,
    "earnings-calls": "events",
    "filings": "filings",
    "financials-as-reported": "financials",
    "financials-cagr": "metrics",
    "financials-growth": "metrics",
    "financials-ratios": "metrics",
    "financials-standardized": "financials",
    "holders": "holders",
    "holdings": "fund_holdings",
    "insider-trades": "insider_trades",
    "ipos": null,
    "market-holidays": null,
    "news": "news",
    "segmented-financials": "segments",
    "stock-splits": "splits",
};

/** The section of a `/$ticker/...` path ("" = the overview); undefined outside `$ticker`. */
export function sectionOf(pathname: string): string | undefined {
    const parts = pathname.split("/").filter(Boolean);

    if (parts.length === 0) return undefined;

    return parts[1] ?? "";
}

/** Whether a section exists for an instrument: market-wide always, an unknown section never, else by `datasets`. */
export function servesSection(datasets: ReadonlyArray<V2Dataset>, section: string): boolean {
    if (!(section in SECTION_DATASETS)) return false;

    const dataset = SECTION_DATASETS[section];

    return dataset === null || datasets.includes(dataset);
}

const DATASET_WORDS: Partial<Record<V2Dataset, string>> = {
    events: "earnings calls and events",
    financials: "financial statements",
    fund_holdings: "fund holdings",
    insider_trades: "insider trades",
    investor_documents: "company documents",
    metrics: "financial metrics",
    segments: "segment financials",
};

/**
 * The sentence for a section the instrument has no data family for (a typed URL; the navigation hides it): "SPY is an
 * ETF: financial statements are not served for it." An exchange-traded trust's holdings name its structure (owner
 * decision 11): it files no holdings report.
 */
export function datasetGateText(instrument: Pick<V2Instrument, "structure" | "symbol" | "type">, dataset: V2Dataset): string {
    const words = DATASET_WORDS[dataset] ?? dataset.replaceAll("_", " ");

    if (instrument.structure === "exchange_traded_trust" && (dataset === "fund_holdings" || dataset === "fund_weights")) {
        return `${instrument.symbol} is an ETF structured as an exchange-traded trust: it files no holdings report (N-PORT), so no holdings or weights are reported.`;
    }

    return `${instrument.symbol} is ${TYPE_NOUNS[instrument.type]}: ${words} are not served for it.`;
}
