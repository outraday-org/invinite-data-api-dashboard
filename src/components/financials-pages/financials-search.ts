import { useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";

import type { V2DisplaySign, V2FinancialsView, V2GrowthBasis } from "@/lib/api/types";

import { V2_RATIO_CATEGORIES, V2_STATEMENTS } from "@/lib/api/v2";
import { IN_PLACE, optionalEnum, optionalFlag, optionalText } from "@/lib/url-state";

/** `?view=` of `/$ticker/financials`: one tab per former financial page. */
export const FINANCIAL_VIEW_VALUES = ["standardized", "as-reported", "ratios", "growth", "cagr", "segments"] as const;

/**
 * Every filter of the Financials route's tabs (O6 URL state; a tab change keeps only `view`): `statement`, `period`,
 * `layout` (summary / detailed / presentation — `view` is the tab), `reportedOnly` + `sign` (as reported), `category`
 * (ratios), `basis` (growth), `horizon` (CAGR), `segment` (segments) and `chart` = the charted row's key (a metric id,
 * an as-reported concept, a segment line).
 */
export const financialsSearchSchema = z.object({
    basis: optionalEnum(["yoy", "qoq"] as const satisfies ReadonlyArray<V2GrowthBasis>),
    category: optionalEnum(V2_RATIO_CATEGORIES),
    chart: optionalText(300),
    horizon: optionalEnum(["3", "5", "10"]),
    layout: optionalEnum(["summary", "detailed", "presentation"] as const satisfies ReadonlyArray<V2FinancialsView>),
    period: optionalEnum(["quarterly", "annual", "ytd", "ttm"]),
    reportedOnly: optionalFlag(),
    segment: optionalText(100),
    sign: optionalEnum(["as_filed", "cash_flow_direction"] as const satisfies ReadonlyArray<V2DisplaySign>),
    statement: optionalEnum(V2_STATEMENTS),
    view: optionalEnum(FINANCIAL_VIEW_VALUES),
});

export type FinancialsSearch = z.infer<typeof financialsSearchSchema>;

/** The Financials route's search and its in-place updater (a changed filter closes an open chart). */
export function useFinancialsSearch() {
    const search = useSearch({ from: "/$ticker/financials/" });

    const navigate = useNavigate({ from: "/$ticker/financials" });

    const update = (patch: FinancialsSearch) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    return [search, update] as const;
}
