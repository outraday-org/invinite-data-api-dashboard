import * as React from "react";

import type { V2FinancialsView } from "@/lib/api/types";

import { FinancialsStatementsView, ViewButtons } from "@/components/financials-presentation/financials-statements-view";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { StatementSelect } from "@/components/financials-presentation/statement-select";
import { usePlanAllows } from "@/components/ui/credit-hint";
import { PageHeader } from "@/components/ui/page-header";
import { isTierError } from "@/lib/api/errors";
import { useV2FinancialsInfinite } from "@/lib/api/queries";

import { useFinancialsSearch } from "./financials-search";
import { FiscalYearRange } from "./fiscal-year-range";
import { filingChoices, PointInTimeBanner, PointInTimeControls } from "./point-in-time";

/** Periods per page of `/v1/financials/standardized*` (one row per period; "Load more" adds older ones). */
const STATEMENT_PAGE = 8;

const VIEW_SUBTITLES: Record<V2FinancialsView, string> = {
    detailed: "Standard metrics with unit, formula and source filing per value (PRO)",
    presentation: "Standard metrics as a tree (PRO)",
    summary: "Financial data normalized to standard metrics",
};

/** The PRO operations behind the views (their badges show before a request when the plan lacks them). */
const STANDARDIZED_VIEW_OPERATIONS = {
    detailed: "getStandardizedFinancialsDetailed",
    presentation: "getStandardizedFinancialsPresentation",
} as const;

/** The page body of the Financials route's tab (`/$ticker/financials?view=`). */
export function StandardizedFinancials({ ticker }: { ticker: string }) {
    const [search, update] = useFinancialsSearch();

    const statement = search.statement ?? "income-statement";

    const periodType = search.period ?? "quarterly";

    // The default view is the presentation tree (PRO); a plan without it (`useMe()`'s plan vs the operation's `x-tier`)
    // starts at the summary before any request, and a refusal still falls back. A view the reader picks (`?layout=`)
    // is kept (its refusal is the view's notice).
    const pickedView = search.layout ?? null;

    const presentationAllowed = usePlanAllows("getStandardizedFinancialsPresentation");

    const [presentationRefused, setPresentationRefused] = React.useState(false);

    const view: V2FinancialsView = pickedView ?? (presentationRefused || presentationAllowed === false ? "summary" : "presentation");

    // `/v1/financials/standardized[/detailed|/presentation]?company=<ticker>&statement=<one>&period=<type>`, newest first.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2FinancialsInfinite({
        asOf: search.asOf,
        basis: "standardized",
        company: ticker,
        filing: search.filing,
        fiscalYearGte: search.fyFrom,
        fiscalYearLte: search.fyTo,
        limit: STATEMENT_PAGE,
        period: periodType,
        statement: [statement],
        view,
    });

    const pages = React.useMemo(() => data?.pages ?? [], [data]);

    const choices = React.useMemo(() => filingChoices(pages, search.filing ?? null), [pages, search.filing]);

    React.useEffect(() => {
        if (pickedView === null && view === "presentation" && isTierError(error)) setPresentationRefused(true);
    }, [error, pickedView, view]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <StatementSelect onValueChange={value => update({ chart: undefined, statement: value === "income-statement" ? undefined : value })} value={statement} />
                        <ViewButtons badges={STANDARDIZED_VIEW_OPERATIONS} onValueChange={value => update({ chart: undefined, layout: value })} value={view} />
                        <PeriodTypeButtons onValueChange={value => update({ period: value === "quarterly" ? undefined : value })} value={periodType} />
                        <FiscalYearRange from={search.fyFrom} onChange={update} to={search.fyTo} />
                        <PointInTimeControls asOf={search.asOf} choices={choices} filing={search.filing} onChange={update} />
                    </>
                )}
                description={VIEW_SUBTITLES[view]}
                title="Standardized Financials"
            />
            <PointInTimeBanner onClear={() => update({ asOf: undefined, filing: undefined })} pointInTime={pages.at(0)?.meta.point_in_time} />
            <FinancialsStatementsView
                basis="standardized"
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={pages}
                statement={statement}
                view={view}
            />
        </div>
    );
}
