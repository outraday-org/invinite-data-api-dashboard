/** One vocabulary for the segment picker and its period-end balance controls. */
export const SEGMENT_METRICS = [
    { instant: false, label: "Revenue (Product)", value: "seg_revenue_product" },
    { instant: false, label: "Revenue (Geographic)", value: "seg_revenue_geographic" },
    { instant: false, label: "Revenue (Business Segment)", value: "seg_revenue_business_segment" },
    { instant: false, label: "Cost of Revenue (Business Segment)", value: "seg_cost_of_revenue_business_segment" },
    { instant: false, label: "R&D Expenses (Business Segment)", value: "seg_research_and_development_expenses_business_segment" },
    { instant: false, label: "Selling & Marketing Expenses (Business Segment)", value: "seg_selling_and_marketing_expenses_business_segment" },
    { instant: false, label: "G&A Expenses (Business Segment)", value: "seg_general_and_administrative_expenses_business_segment" },
    { instant: false, label: "Operating Income (Business Segment)", value: "seg_operating_income_business_segment" },
    { instant: false, label: "Depreciation & Amortization (Business Segment)", value: "seg_depreciation_and_amortization_business_segment" },
    { instant: true, label: "Total Assets (Business Segment)", value: "seg_total_assets_business_segment" },
    { instant: true, label: "Goodwill (Business Segment)", value: "seg_goodwill_business_segment" },
    { instant: false, label: "Capital Expenditure (Business Segment)", value: "seg_capital_expenditure_business_segment" },
] as const;

export type SegmentMetricId = (typeof SEGMENT_METRICS)[number]["value"];

/** Assets and goodwill are period-end values, never summed into YTD/TTM. */
export function isInstantSegmentId(value: string): boolean {
    return SEGMENT_METRICS.some(metric => metric.value === value && metric.instant);
}
