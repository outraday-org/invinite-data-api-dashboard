import * as React from "react";

import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { OperationId } from "@/lib/api/operations.gen";
import type { StatementType, V2FinancialsBasis, V2FinancialsView, V2StatementPeriod, V2StatementsResponse } from "@/lib/api/types";

import { MetricsListBody } from "@/components/financial-metrics/metrics-list-body";
import { PlanBadge } from "@/components/ui/credit-hint";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { hasStatement, presentationPeriods, statementColumns, statementLines } from "@/lib/financials/statements";

import { FinancialsFlatTable } from "./financials-flat-table";
import { FinancialsPresentationTable } from "./financials-presentation-table";

const VIEW_OPTIONS: Array<{ label: string; value: V2FinancialsView }> = [
    { label: "Standard", value: "summary" },
    { label: "Detailed", value: "detailed" },
    { label: "Presentation", value: "presentation" },
];

/**
 * The view switch of the statement pages (summary / detailed / presentation), the same for both bases: a segmented
 * control; a view whose operation the plan lacks carries its generated plan badge.
 */
export function ViewButtons({ badges, onValueChange, value }: {
    /** The operation behind a view: its plan badge shows before any request when the plan lacks it (O6). */
    badges?: Partial<Record<V2FinancialsView, OperationId>>;
    onValueChange: (value: V2FinancialsView) => void;
    value: V2FinancialsView;
}) {
    const options = VIEW_OPTIONS.map((option) => {
        const operationId = badges?.[option.value];

        return { ...option, badge: operationId ? <PlanBadge operationId={operationId} /> : undefined };
    });

    return <SegmentedButtons aria-label="View" onChange={onValueChange} options={options} value={value} />;
}

/** Where "Explain this number" lives: the detailed view (a standardized fact id, an as-reported value's own lineage). */
const EXPLAIN_HINTS: Record<V2FinancialsBasis, Record<V2FinancialsView, string>> = {
    "as-reported": {
        detailed: "Click a value to explain it: formula and operands of a computed value, source filing and its place in the filing.",
        presentation: "The Detailed view explains each value.",
        summary: "Click a filed value to see every filing that stated it; the Detailed view explains each value.",
    },
    "standardized": {
        detailed: "Click a value to explain it: rule, formula, source filing and its place in the filing.",
        presentation: "The Detailed view explains each value.",
        summary: "The Detailed view explains each value.",
    },
};

export const STATEMENTS_PENDING_TITLE = "Statements are being prepared — asked again in 30 s";

/**
 * A statement page's body (pure): the request's state, the coverage notice, the table of the chosen view (flat for
 * summary / detailed, the tree for presentation) over the loaded periods (newest first), and "Load more" (older
 * periods by `next_cursor`).
 */
export function FinancialsStatementsView({
    basis,
    pages,
    statement,
    view,
    ...state
}: MetricsListState & {
    basis: V2FinancialsBasis;
    pages: ReadonlyArray<V2StatementsResponse>;
    statement: StatementType;
    view: V2FinancialsView;
}) {
    const rows = React.useMemo(() => pages.flatMap<V2StatementPeriod>(page => page.data), [pages]);

    const columns = React.useMemo(() => statementColumns(rows), [rows]);

    const lines = React.useMemo(
        () => (view === "presentation" ? [] : statementLines(rows, statement, basis === "standardized")),
        [basis, rows, statement, view],
    );

    const trees = React.useMemo(() => (view === "presentation" ? presentationPeriods(rows, statement) : []), [rows, statement, view]);

    const meta = pages.at(0)?.meta;

    // The line above the table: the currency and where "Explain this number" lives (the tree adds Expand / Collapse).
    const toolbar = (
        <>
            {meta?.currency && <span data-testid="financials-meta">{`Values in ${meta.currency}`}</span>}
            <span data-testid="explain-hint">{EXPLAIN_HINTS[basis][view]}</span>
        </>
    );

    return (
        <MetricsListBody
            coverage={meta?.coverage}
            emptyText="No financial data available."
            hasRows={hasStatement(rows, statement)}
            loadedPages={pages.length}
            pendingTitle={STATEMENTS_PENDING_TITLE}
            state={state}
            title="Failed to load financials"
            toolbar={view === "presentation" ? undefined : <div className="flex min-w-0 flex-wrap items-center gap-x-3">{toolbar}</div>}
        >
            {view === "presentation"
                ? <FinancialsPresentationTable isCollapsible={basis === "standardized"} periods={trees} toolbar={toolbar} />
                : <FinancialsFlatTable cik={rows.at(0)?.company.cik ?? null} columns={columns} filedValues={basis === "as-reported"} lines={lines} rows={rows} />}
        </MetricsListBody>
    );
}
