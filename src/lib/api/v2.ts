import { formatDay } from "@/lib/format";

/**
 * Pure helpers of the Data API v2 calls (`/v1/*`, backend tasks/data-api-v2 task 4): the query builder (an unknown
 * parameter is a 400 `unknown_parameter`, so an unset one is never sent), the `expand` lists and the company
 * coverage's words.
 */
import type {
    StatementType,
    V2CompanyCoverage,
    V2CompanyExpand,
    V2EventExpand,
    V2FilerExpand,
    V2FilingExpand,
    V2FormerTicker,
    V2FundExpand,
    V2IpoStage,
    V2RatioCategory,
    V2SlidesInclude,
    V2StatementKey,
} from "./types";

export const V2_COMPANY_EXPANDS = ["coverage", "former_tickers"] as const satisfies ReadonlyArray<V2CompanyExpand>;

export const V2_FUND_EXPANDS = ["coverage"] as const satisfies ReadonlyArray<V2FundExpand>;

export const V2_EVENT_EXPANDS = ["calendar", "observations"] as const satisfies ReadonlyArray<V2EventExpand>;

/** `GET /v1/events/{event_id}/slides?include=` (the timeline is opt-in in v2). */
export const V2_SLIDES_INCLUDES = ["markdown", "timeline"] as const satisfies ReadonlyArray<V2SlidesInclude>;

export const V2_FILER_EXPANDS = [
    "lifecycle",
    "proposed_symbols",
    "former_names",
    "former_tickers",
    "successors",
    "fund",
    "private_offerings",
] as const satisfies ReadonlyArray<V2FilerExpand>;

/** `GET /v1/filings/{accession}?expand=`. */
export const V2_FILING_EXPANDS = ["documents", "parties", "relations"] as const satisfies ReadonlyArray<V2FilingExpand>;

/** The offering stages of `GET /v1/ipos` (`stage=`), in lifecycle order; compile-time exhaustive over the contract enum. */
export const V2_IPO_STAGES = [
    "announced",
    "registered",
    "price_range",
    "exchange_approved",
    "effective",
    "priced",
    "trading",
    "postponed",
    "dormant",
    "withdrawn",
] as const satisfies ReadonlyArray<V2IpoStage>;

/**
 * The stages of an SEC registration track (an offering with `sources.registration`); the others (`announced`,
 * `postponed`, `dormant`, `withdrawn` without a track) are listing-calendar rows.
 */
export const V2_IPO_REGISTRATION_STAGES = ["registered", "price_range", "exchange_approved", "effective", "priced"] as const satisfies ReadonlyArray<V2IpoStage>;

type MissingIpoStage = Exclude<V2IpoStage, (typeof V2_IPO_STAGES)[number]>;

// A stage added to the contract fails here until it gets its place in the list.
export const V2_IPO_STAGES_COMPLETE: MissingIpoStage extends never ? true : never = true;

/** `statement=` of the statement operations, in display order. */
export const V2_STATEMENTS = ["income-statement", "balance-sheet", "cash-flow"] as const satisfies ReadonlyArray<StatementType>;

/** The response key of a statement (`cash-flow` → `statements.cash_flow`). */
export const V2_STATEMENT_KEYS: Record<StatementType, V2StatementKey> = {
    "balance-sheet": "balance_sheet",
    "cash-flow": "cash_flow",
    "income-statement": "income_statement",
};

/** `category=` of `GET /v1/metrics/ratios` (any of). */
export const V2_RATIO_CATEGORIES = [
    "profitability",
    "liquidity",
    "leverage",
    "efficiency",
    "valuation",
] as const satisfies ReadonlyArray<V2RatioCategory>;

/** The query without its unset (`undefined`) parameters: only what the caller set reaches the API. */
export function v2Query<TQuery extends Record<string, unknown>>(query: TQuery): TQuery {
    return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as TQuery;
}

/** `expand=a,b` (sorted, de-duplicated: one spelling per set, so one cache key), undefined when empty. */
export function v2Expand(values: ReadonlyArray<string> | undefined) {
    const unique = [...new Set(values ?? [])].sort();

    return unique.length > 0 ? unique.join(",") : undefined;
}

// The families of `expand=coverage` (IDA `src/routes/v1/companies/companies.ts` COVERAGE_FAMILIES).
const FAMILY_LABELS: Partial<Record<string, string>> = {
    dividends: "dividends",
    financials: "financials",
    holdings: "institutional holdings",
    insider_trades: "insider trades",
    metrics: "financial metrics",
    segments: "segments",
};

/** A coverage family in words (`insider_trades` → "insider trades"); an unknown family = its code with spaces. */
export function coverageFamilyLabel(family: string) {
    return FAMILY_LABELS[family] ?? family.replaceAll("_", " ");
}

/** "financials through Sep 26, 2026" / "news" (no `through` date): one entry per family, in the API's order. */
export function coverageEntries(coverage: null | undefined | V2CompanyCoverage) {
    return (coverage?.families ?? []).map(({ family, through }) => ({
        family,
        text: through ? `${coverageFamilyLabel(family)} through ${formatDay(through)}` : coverageFamilyLabel(family),
    }));
}

/** Where a former ticker was seen (`registry` dates = when the SEC company ticker file listed it, `listing` = a retired listing's dates). */
export const FORMER_TICKER_SOURCE_LABELS: Record<V2FormerTicker["source"], string> = {
    listing: "Retired listing",
    registry: "SEC company ticker file",
};

/** A former ticker in words: "FB · XNAS · May 18, 2012 – Jun 8, 2022 · Retired listing" (unknown parts left out). */
export function formerTickerText(former: V2FormerTicker) {
    const span = former.first_seen_on || former.last_seen_on
        ? `${former.first_seen_on ? formatDay(former.first_seen_on) : "?"} – ${former.last_seen_on ? formatDay(former.last_seen_on) : "?"}`
        : null;

    return [former.ticker, former.exchange, span, FORMER_TICKER_SOURCE_LABELS[former.source]].filter(Boolean).join(" · ");
}
