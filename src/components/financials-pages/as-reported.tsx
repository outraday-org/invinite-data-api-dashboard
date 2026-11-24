import * as React from "react";

import type { V2DisplaySign, V2FinancialsView } from "@/lib/api/types";

import { FinancialsStatementsView, ViewButtons } from "@/components/financials-presentation/financials-statements-view";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { StatementSelect } from "@/components/financials-presentation/statement-select";
import { Button } from "@/components/ui/button";
import { tierLabel, usePlanAllows } from "@/components/ui/credit-hint";
import { FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { isTierError } from "@/lib/api/errors";
import { useV2FinancialsInfinite } from "@/lib/api/queries";

import type { FinancialsTabProps } from "./financials-frame";

import { financialsFilterCount, FinancialsFrame, STATEMENT_FILTERS } from "./financials-frame";
import { useFinancialsSearch } from "./financials-search";
import { FiscalYearRange } from "./fiscal-year-range";
import { filingChoices, PointInTimeBanner, PointInTimeControls } from "./point-in-time";

/** Periods per page of `/v1/financials/as-reported*` (one row per period; "Load more" adds older ones). */
const STATEMENT_PAGE = 8;

const DISPLAY_SIGN_OPTIONS: Array<{ label: string; value: V2DisplaySign }> = [
    { label: "Signs as filed", value: "as_filed" },
    { label: "Cash-flow direction", value: "cash_flow_direction" },
];

/** The higher-tier operations behind the views (their badges show before a request when the plan lacks them). */
const AS_REPORTED_VIEW_OPERATIONS = {
    detailed: "getAsReportedFinancialsDetailed",
    presentation: "getAsReportedFinancialsPresentation",
} as const;

/** Each view's subtitle; a view's plan is its operation's `x-tier`, never typed here. */
const VIEW_SUBTITLES: Record<V2FinancialsView, string> = {
    detailed: `Line items with the company's captions, formula and source filing per value (${tierLabel(AS_REPORTED_VIEW_OPERATIONS.detailed)})`,
    presentation: `Financial data reported by the company (tree / presentation format, ${tierLabel(AS_REPORTED_VIEW_OPERATIONS.presentation)})`,
    summary: "Financial data reported by the company, by XBRL concept",
};

/** The page body of the Financials route's tab (`/$ticker/financials?view=`). */
export function AsReportedFinancials({ tabs, ticker }: FinancialsTabProps) {
    const [search, update] = useFinancialsSearch();

    const statement = search.statement ?? "income-statement";

    const periodType = search.period ?? "quarterly";

    // The default view is the presentation tree (a higher tier); a plan without it (`useMe()`'s plan vs the operation's `x-tier`)
    // starts at the summary before any request, and a refusal still falls back. A view the reader picks (`?layout=`)
    // is kept (its refusal is the view's notice).
    const pickedView = search.layout ?? null;

    const presentationAllowed = usePlanAllows("getAsReportedFinancialsPresentation");

    const [presentationRefused, setPresentationRefused] = React.useState(false);

    const view: V2FinancialsView = pickedView ?? (presentationRefused || presentationAllowed === false ? "summary" : "presentation");

    const reportedOnly = search.reportedOnly ?? false;

    const displaySign: V2DisplaySign = search.sign ?? "as_filed";

    // `/v1/financials/as-reported[/detailed|/presentation]`; `reported_only` / `display_sign` sent only when changed
    // from the API defaults (false / as_filed), so the default view keeps one cache key.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2FinancialsInfinite({
        asOf: search.asOf,
        basis: "as-reported",
        company: ticker,
        displaySign: displaySign === "as_filed" ? undefined : displaySign,
        filing: search.filing,
        fiscalYearGte: search.fyFrom,
        fiscalYearLte: search.fyTo,
        limit: STATEMENT_PAGE,
        period: periodType,
        reportedOnly: reportedOnly || undefined,
        statement: [statement],
        view,
    });

    const pages = React.useMemo(() => data?.pages ?? [], [data]);

    const choices = React.useMemo(() => filingChoices(pages, search.filing ?? null), [pages, search.filing]);

    React.useEffect(() => {
        if (pickedView === null && view === "presentation" && isTierError(error)) setPresentationRefused(true);
    }, [error, pickedView, view]);

    return (
        <FinancialsFrame
            activeCount={financialsFilterCount(search, [...STATEMENT_FILTERS, ["sign"], ["reportedOnly"]])}
            description={VIEW_SUBTITLES[view]}
            filters={(
                <>
                    <FilterField label="Fiscal years">
                        <FiscalYearRange from={search.fyFrom} onChange={update} to={search.fyTo} />
                    </FilterField>
                    <PointInTimeControls asOf={search.asOf} choices={choices} filing={search.filing} onChange={update} />
                    <FilterField label="Signs">
                        {id => <FilterSelect aria-label="Display sign" className="w-full" id={id} onValueChange={value => update({ sign: value === "as_filed" ? undefined : value })} options={DISPLAY_SIGN_OPTIONS} value={displaySign} />}
                    </FilterField>
                    <FilterField label="Derived values">
                        <Button
                            aria-pressed={reportedOnly}
                            className="w-full"
                            onClick={() => update({ reportedOnly: reportedOnly ? undefined : true })}
                            title="Hide the values Invinite derived (Q4, TTM, YTD)"
                            variant={reportedOnly ? "secondary" : "outline"}
                        >
                            Reported only
                        </Button>
                    </FilterField>
                </>
            )}
            onReset={() => update({ asOf: undefined, filing: undefined, fyFrom: undefined, fyTo: undefined, reportedOnly: undefined, sign: undefined })}
            tabs={tabs}
            what={(
                <>
                    <StatementSelect onValueChange={value => update({ chart: undefined, statement: value === "income-statement" ? undefined : value })} value={statement} />
                    <ViewButtons badges={AS_REPORTED_VIEW_OPERATIONS} onValueChange={value => update({ chart: undefined, layout: value })} value={view} />
                    <PeriodTypeButtons onValueChange={value => update({ period: value === "quarterly" ? undefined : value })} value={periodType} />
                </>
            )}
        >
            <PointInTimeBanner onClear={() => update({ asOf: undefined, filing: undefined })} pointInTime={pages.at(0)?.meta.point_in_time} />
            <FinancialsStatementsView
                basis="as-reported"
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={pages}
                statement={statement}
                view={view}
            />
        </FinancialsFrame>
    );
}
