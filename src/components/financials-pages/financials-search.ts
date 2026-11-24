import { useNavigate, useSearch } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2DisplaySign, V2FinancialsView, V2GrowthBasis } from "@/lib/api/types";

import { V2_RATIO_CATEGORIES, V2_STATEMENTS } from "@/lib/api/v2";
import { IN_PLACE, optionalAccession, optionalDay, optionalEnum, optionalFlag, optionalInt, optionalText } from "@/lib/url-state";

/** `?view=` of `/$ticker/financials`: one tab per former financial page. */
export const FINANCIAL_VIEW_VALUES = ["standardized", "as-reported", "ratios", "growth", "cagr", "segments"] as const;

/**
 * Every filter of the Financials route's tabs (O6 URL state; a tab change keeps every filter but the chart — `tabSearch`): `statement`, `period`,
 * `layout` (summary / detailed / presentation — `view` is the tab; the Segments tab: summary / detailed), `reportedOnly`
 * + `sign` (as reported), `category` (ratios), `basis` (growth), `horizon` (CAGR), `segment` + `metric` + `axis`
 * (segments), the point in time `asOf` / `filing` (statements), the fiscal-year window `fyFrom` / `fyTo` (every tab)
 * and `chart` = the charted row's key (a metric id, an as-reported concept, a segment line).
 */
export const financialsSearchSchema = z.object({
    asOf: optionalDay(),
    axis: optionalText(200),
    basis: optionalEnum(["yoy", "qoq"] as const satisfies ReadonlyArray<V2GrowthBasis>),
    category: optionalEnum(V2_RATIO_CATEGORIES),
    chart: optionalText(300),
    filing: optionalAccession(),
    fyFrom: optionalInt(1900, 2200),
    fyTo: optionalInt(1900, 2200),
    // A typed `?horizon=5` parses as the number 5 (TanStack's JSON search parser), the select writes the string "5".
    horizon: z.coerce.string().pipe(z.enum(["3", "5", "10"])).optional().catch(undefined),
    layout: optionalEnum(["summary", "detailed", "presentation"] as const satisfies ReadonlyArray<V2FinancialsView>),
    metric: optionalText(200),
    period: optionalEnum(["quarterly", "annual", "ytd", "ttm"]),
    reportedOnly: optionalFlag(),
    segment: optionalText(100),
    sign: optionalEnum(["as_filed", "cash_flow_direction"] as const satisfies ReadonlyArray<V2DisplaySign>),
    statement: optionalEnum(V2_STATEMENTS),
    view: optionalEnum(FINANCIAL_VIEW_VALUES),
});

export type FinancialsSearch = z.infer<typeof financialsSearchSchema>;

type FinancialView = (typeof FINANCIAL_VIEW_VALUES)[number];

/** A tab's period when `?period=` is absent: CAGR reads annual, every other tab quarterly. */
export const defaultPeriodOf = (view: FinancialView) => (view === "cagr" ? "annual" : "quarterly");

/**
 * The search after a tab change: the statement, period, layout (summary / detailed / presentation), point in time and
 * fiscal-year window stay as they are (a tab ignores what it has no control for); the charted row closes. The period
 * is carried as SHOWN, so CAGR's annual default never turns a quarterly view annual (or back).
 */
export function tabSearch(prev: FinancialsSearch, next: FinancialView): FinancialsSearch {
    const from = prev.view ?? "standardized";

    const period = prev.period ?? defaultPeriodOf(from);

    return {
        ...prev,
        chart: undefined,
        period: period === defaultPeriodOf(next) ? undefined : period,
        view: next === "standardized" ? undefined : next,
    };
}

/** The Financials route's search and its in-place updater (a changed filter closes an open chart). */
export function useFinancialsSearch() {
    const search = useSearch({ from: "/$ticker/financials/" });

    const navigate = useNavigate({ from: "/$ticker/financials" });

    // Stable: the debounced fields (fiscal years) keep their timer across the page's re-renders.
    const update = React.useCallback((patch: FinancialsSearch) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) }), [navigate]);

    return [search, update] as const;
}
