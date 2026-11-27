import type { V2AsReportedPresentationNode, V2StandardizedPresentationNode, V2StatementPeriod } from "@/lib/api/types";

/** A standardized presentation node of `/v1/financials/standardized/presentation` (`metric_id`, `value`, `children?`). */
export type StandardizedPresentationFactRaw = V2StandardizedPresentationNode;
/** An as-reported presentation node of `/v1/financials/as-reported/presentation` (`concept`, `label`, `is_total?`, …). */
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
    /** `source.is_preliminary`: the period's values come from the earnings release before the 10-Q / 10-K. */
    preliminary?: boolean;
    reportedPeriod?: V2StatementPeriod;
    /** The column header's tooltip (the filing the period was rendered from). */
    title?: string;
};

export type TreeRow = {
    chartId?: string;
    depth: number;
    id?: string;
    hasChildren: boolean;
    isTotal: boolean;
    label: string;
    metricId: string;
    nodes?: ReadonlyMap<number, V2AsReportedPresentationNode>;
    parentId: null | string;
    preserve?: boolean;
    title?: string;
    values: Record<string, null | number | undefined>;
};
