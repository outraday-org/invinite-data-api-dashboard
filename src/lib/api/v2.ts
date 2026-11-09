/**
 * Pure helpers of the Data API v2 calls (`/v2/*`, backend tasks/data-api-v2 task 4): the query builder (an unknown
 * parameter is a 400 `unknown_parameter`, so an unset one is never sent), the `expand` lists and the company
 * coverage's words.
 */
import type { V2CompanyCoverage, V2CompanyExpand, V2FilerExpand } from "./types";

export const V2_COMPANY_EXPANDS = ["coverage"] as const satisfies ReadonlyArray<V2CompanyExpand>;

export const V2_FILER_EXPANDS = [
    "lifecycle",
    "proposed_symbols",
    "former_names",
    "successors",
] as const satisfies ReadonlyArray<V2FilerExpand>;

/** The query without its unset (`undefined`) parameters: only what the caller set reaches the API. */
export function v2Query<TQuery extends Record<string, unknown>>(query: TQuery): TQuery {
    return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)) as TQuery;
}

/** `expand=a,b` (sorted, de-duplicated: one spelling per set, so one cache key), undefined when empty. */
export function v2Expand(values: ReadonlyArray<string> | undefined) {
    const unique = [...new Set(values ?? [])].sort();

    return unique.length > 0 ? unique.join(",") : undefined;
}

// The families of `expand=coverage` (IDA `src/routes/v2/companies/companies.ts` COVERAGE_FAMILIES).
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

/** "financials through 2026-09-26" / "news" (no `through` date): one entry per family, in the API's order. */
export function coverageEntries(coverage: null | undefined | V2CompanyCoverage) {
    return (coverage?.families ?? []).map(({ family, through }) => ({
        family,
        text: through ? `${coverageFamilyLabel(family)} through ${through}` : coverageFamilyLabel(family),
    }));
}
