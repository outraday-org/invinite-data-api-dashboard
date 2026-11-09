import type { V2AsReportedPresentationNode, V2StandardizedPresentationNode } from "@/lib/api/types";

/** A standardized presentation node of `/v2/financials/standardized/presentation` (`metric_id`, `value`, `children?`). */
export type StandardizedPresentationFactRaw = V2StandardizedPresentationNode;
/** An as-reported presentation node of `/v2/financials/as-reported/presentation` (`concept`, `label`, `is_total?`, …). */
export type AsReportedPresentationFactRaw = V2AsReportedPresentationNode;

export type PresentationFact
    = | (Omit<AsReportedPresentationFactRaw, "children"> & {
        children?: Array<PresentationFact>;
        type: "as-reported";
    })
    | (Omit<StandardizedPresentationFactRaw, "children"> & {
        children?: Array<PresentationFact>;
        type: "standardized";
    });

/** One column of the presentation table: a period's label and its statement tree. */
export type PresentationPeriod = {
    facts: Array<AsReportedPresentationFactRaw> | Array<StandardizedPresentationFactRaw>;
    label: string;
    /** The column header's tooltip (the filing the period was rendered from). */
    title?: string;
};

export type TreeRow = {
    depth: number;
    hasChildren: boolean;
    isTotal: boolean;
    label: string;
    metricId: string;
    parentId: null | string;
    values: Record<string, null | number | undefined>;
};
