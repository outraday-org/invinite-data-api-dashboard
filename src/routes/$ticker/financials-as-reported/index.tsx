import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { FiscalPeriodType, StatementType, V2DisplaySign, V2FinancialsView } from "@/lib/api/types";

import { FinancialsStatementsView, ViewButtons } from "@/components/financials-presentation/financials-statements-view";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { StatementSelect } from "@/components/financials-presentation/statement-select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { isTierError } from "@/lib/api/errors";
import { useV2FinancialsInfinite } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/$ticker/financials-as-reported/")({
    component: AsReportedFinancialsPage,
    head: ({ params }) => tickerHead(params.ticker, "As Reported Financials"),
});

/** Periods per page of `/v1/financials/as-reported*` (one row per period; "Load more" adds older ones). */
const STATEMENT_PAGE = 8;

const DISPLAY_SIGN_OPTIONS: Array<{ label: string; value: V2DisplaySign }> = [
    { label: "Signs as filed", value: "as_filed" },
    { label: "Cash-flow direction", value: "cash_flow_direction" },
];

const VIEW_SUBTITLES: Record<V2FinancialsView, string> = {
    detailed: "Line items with the company's captions, formula and source filing per value (PRO)",
    presentation: "Financial data reported by the company (tree / presentation format, PRO)",
    summary: "Financial data reported by the company, by XBRL concept",
};

function AsReportedFinancialsPage() {
    const { ticker } = Route.useParams();

    const [statement, setStatement] = React.useState<StatementType>("income-statement");

    const [periodType, setPeriodType] = React.useState<FiscalPeriodType>("quarterly");

    // The default view is the presentation tree (PRO); a plan without it falls back to the summary once the request
    // answers `plan_required`. A view the reader picks is kept (its refusal is the view's notice).
    const [pickedView, setView] = React.useState<null | V2FinancialsView>(null);

    const [presentationRefused, setPresentationRefused] = React.useState(false);

    const view: V2FinancialsView = pickedView ?? (presentationRefused ? "summary" : "presentation");

    const [reportedOnly, setReportedOnly] = React.useState(false);

    const [displaySign, setDisplaySign] = React.useState<V2DisplaySign>("as_filed");

    // `/v1/financials/as-reported[/detailed|/presentation]`; `reported_only` / `display_sign` sent only when changed
    // from the API defaults (false / as_filed), so the default view keeps one cache key.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2FinancialsInfinite({
        basis: "as-reported",
        company: ticker,
        displaySign: displaySign === "as_filed" ? undefined : displaySign,
        limit: STATEMENT_PAGE,
        period: periodType,
        reportedOnly: reportedOnly || undefined,
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
                        <Button
                            aria-pressed={reportedOnly}
                            onClick={() => setReportedOnly(value => !value)}
                            title="Hide the values Invinite derived (Q4, TTM, YTD)"
                            variant={reportedOnly ? "default" : "outline"}
                        >
                            Reported only
                        </Button>
                        <FilterSelect className="w-[190px]" onValueChange={setDisplaySign} options={DISPLAY_SIGN_OPTIONS} value={displaySign} />
                    </>
                )}
                description={VIEW_SUBTITLES[view]}
                title="As Reported Financials"
            />
            <FinancialsStatementsView
                basis="as-reported"
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
