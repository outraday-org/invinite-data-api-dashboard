import * as React from "react";

import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { OperationId } from "@/lib/api/operations.gen";
import type { StatementType, V2FinancialsBasis, V2FinancialsView, V2StatementPeriod, V2StatementsResponse } from "@/lib/api/types";

import { MetricsListBody } from "@/components/financial-metrics/metrics-list-body";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/ui/credit-hint";
import { hasStatement, presentationPeriods, statementColumns, statementLines } from "@/lib/financials/statements";

import { FinancialsFlatTable } from "./financials-flat-table";
import { FinancialsPresentationTable } from "./financials-presentation-table";

const VIEW_OPTIONS: Array<{ label: string; value: V2FinancialsView }> = [
    { label: "Summary", value: "summary" },
    { label: "Detailed", value: "detailed" },
    { label: "Presentation", value: "presentation" },
];

/** The view switch of the statement pages (summary / detailed (PRO) / presentation (PRO)), the same for both bases. */
export function ViewButtons({ badges, onValueChange, value }: {
    /** The operation behind a view: its PRO badge shows before any request when the plan lacks it (O6). */
    badges?: Partial<Record<V2FinancialsView, OperationId>>;
    onValueChange: (value: V2FinancialsView) => void;
    value: V2FinancialsView;
}) {
    return (
        <div aria-label="View" className="flex gap-1" role="group">
            {VIEW_OPTIONS.map(opt => (
                <Button
                    aria-pressed={value === opt.value}
                    key={opt.value}
                    onClick={() => onValueChange(opt.value)}
                    variant={value === opt.value ? "default" : "outline"}
                >
                    {opt.label}
                    {badges?.[opt.value] && <PlanBadge operationId={badges[opt.value]!} />}
                </Button>
            ))}
        </div>
    );
}

/** Where "Explain this number" lives: only the standardized detailed view carries a fact id per value. */
const EXPLAIN_HINTS: Record<V2FinancialsView, string> = {
    detailed: "Click a value to explain it: rule, formula, source filing and its place in the filing.",
    presentation: "The Detailed view explains each value.",
    summary: "The Detailed view explains each value.",
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

    return (
        <MetricsListBody
            coverage={meta?.coverage}
            emptyText="No financial data available."
            hasRows={hasStatement(rows, statement)}
            loadedPages={pages.length}
            pendingTitle={STATEMENTS_PENDING_TITLE}
            state={state}
            title="Failed to load financials"
        >
            {meta?.currency || basis === "standardized"
                ? (
                        <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                            {meta?.currency && <span data-testid="financials-meta">{`Values in ${meta.currency}`}</span>}
                            {basis === "standardized" && <span data-testid="explain-hint">{EXPLAIN_HINTS[view]}</span>}
                        </div>
                    )
                : null}
            {view === "presentation"
                ? <FinancialsPresentationTable isCollapsible={basis === "standardized"} periods={trees} />
                : <FinancialsFlatTable columns={columns} lines={lines} />}
        </MetricsListBody>
    );
}
