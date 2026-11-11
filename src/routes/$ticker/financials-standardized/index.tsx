import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { FiscalPeriodType, StatementType, V2FinancialsView } from "@/lib/api/types";

import { FinancialsStatementsView, ViewButtons } from "@/components/financials-presentation/financials-statements-view";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { StatementSelect } from "@/components/financials-presentation/statement-select";
import { useV2FinancialsInfinite } from "@/lib/api/queries";

export const Route = createFileRoute("/$ticker/financials-standardized/")({
    component: StandardizedFinancialsPage,
});

/** Periods per page of `/v1/financials/standardized*` (one row per period; "Load more" adds older ones). */
const STATEMENT_PAGE = 8;

const VIEW_SUBTITLES: Record<V2FinancialsView, string> = {
    detailed: "Standard metrics with unit, formula and source filing per value (PRO)",
    presentation: "Standard metrics as a tree (PRO)",
    summary: "Financial data normalized to standard metrics",
};

function StandardizedFinancialsPage() {
    const { ticker } = Route.useParams();

    const [statement, setStatement] = React.useState<StatementType>("income-statement");

    const [periodType, setPeriodType] = React.useState<FiscalPeriodType>("quarterly");

    const [view, setView] = React.useState<V2FinancialsView>("presentation");

    // `/v1/financials/standardized[/detailed|/presentation]?company=<ticker>&statement=<one>&period=<type>`, newest first.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2FinancialsInfinite({
        basis: "standardized",
        company: ticker,
        limit: STATEMENT_PAGE,
        period: periodType,
        statement: [statement],
        view,
    });

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col shrink-0 gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div>Standardized Financials</div>
                    <div>{VIEW_SUBTITLES[view]}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <StatementSelect onValueChange={setStatement} value={statement} />
                    <ViewButtons onValueChange={setView} value={view} />
                    <PeriodTypeButtons onValueChange={setPeriodType} value={periodType} />
                </div>
            </div>
            <FinancialsStatementsView
                basis="standardized"
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={data?.pages ?? []}
                statement={statement}
                view={view}
            />
        </div>
    );
}
