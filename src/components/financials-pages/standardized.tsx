import * as React from "react";

import type { FiscalPeriodType, StatementType, V2FinancialsView } from "@/lib/api/types";

import { FinancialsStatementsView, ViewButtons } from "@/components/financials-presentation/financials-statements-view";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { StatementSelect } from "@/components/financials-presentation/statement-select";
import { PageHeader } from "@/components/ui/page-header";
import { isTierError } from "@/lib/api/errors";
import { useV2FinancialsInfinite } from "@/lib/api/queries";

/** Periods per page of `/v1/financials/standardized*` (one row per period; "Load more" adds older ones). */
const STATEMENT_PAGE = 8;

const VIEW_SUBTITLES: Record<V2FinancialsView, string> = {
    detailed: "Standard metrics with unit, formula and source filing per value (PRO)",
    presentation: "Standard metrics as a tree (PRO)",
    summary: "Financial data normalized to standard metrics",
};

/** The page body of the Financials route's tab (`/$ticker/financials?view=`). */
export function StandardizedFinancials({ ticker }: { ticker: string }) {
    const [statement, setStatement] = React.useState<StatementType>("income-statement");

    const [periodType, setPeriodType] = React.useState<FiscalPeriodType>("quarterly");

    // The default view is the presentation tree (PRO); a plan without it falls back to the summary once the request
    // answers `plan_required`. A view the reader picks is kept (its refusal is the view's notice).
    const [pickedView, setView] = React.useState<null | V2FinancialsView>(null);

    const [presentationRefused, setPresentationRefused] = React.useState(false);

    const view: V2FinancialsView = pickedView ?? (presentationRefused ? "summary" : "presentation");

    // `/v1/financials/standardized[/detailed|/presentation]?company=<ticker>&statement=<one>&period=<type>`, newest first.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2FinancialsInfinite({
        basis: "standardized",
        company: ticker,
        limit: STATEMENT_PAGE,
        period: periodType,
        statement: [statement],
        view,
    });

    React.useEffect(() => {
        if (pickedView === null && view === "presentation" && isTierError(error)) setPresentationRefused(true);
    }, [error, pickedView, view]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <StatementSelect onValueChange={setStatement} value={statement} />
                        <ViewButtons onValueChange={setView} value={view} />
                        <PeriodTypeButtons onValueChange={setPeriodType} value={periodType} />
                    </>
                )}
                description={VIEW_SUBTITLES[view]}
                title="Standardized Financials"
            />
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
