import type * as React from "react";

import type { V2Dataset } from "@/lib/api/types";

import type { FinancialsTabProps } from "./financials-frame";

import { AsReportedFinancials } from "./as-reported";
import { CagrFinancials } from "./cagr";
import { FINANCIAL_VIEW_VALUES } from "./financials-search";
import { GrowthFinancials } from "./growth";
import { RatiosFinancials } from "./ratios";
import { SegmentsFinancials } from "./segments";
import { StandardizedFinancials } from "./standardized";

export { FINANCIAL_VIEW_VALUES };

export type FinancialView = (typeof FINANCIAL_VIEW_VALUES)[number];

/** Each tab: its label, the dataset of `datasets` it shows (a tab the instrument lacks is hidden) and its body. */
export const FINANCIAL_VIEWS: ReadonlyArray<{
    /** The tab's page body: it renders the page header, then `tabs` (the route's tab row), its toolbar and table. */
    Body: React.ComponentType<FinancialsTabProps>;
    dataset: V2Dataset;
    label: string;
    value: FinancialView;
}> = [
    { Body: StandardizedFinancials, dataset: "financials", label: "Standardized", value: "standardized" },
    { Body: AsReportedFinancials, dataset: "financials", label: "As reported", value: "as-reported" },
    { Body: RatiosFinancials, dataset: "metrics", label: "Ratios", value: "ratios" },
    { Body: GrowthFinancials, dataset: "metrics", label: "Growth", value: "growth" },
    { Body: CagrFinancials, dataset: "metrics", label: "CAGR", value: "cagr" },
    { Body: SegmentsFinancials, dataset: "segments", label: "Segments", value: "segments" },
];

/** The tabs an instrument's `datasets` serve (every tab while the datasets are unknown). */
export function financialViewsFor(datasets: null | ReadonlyArray<V2Dataset>) {
    return datasets === null ? FINANCIAL_VIEWS : FINANCIAL_VIEWS.filter(view => datasets.includes(view.dataset));
}
