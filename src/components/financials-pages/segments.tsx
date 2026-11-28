import * as React from "react";

import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { SegmentedFinancialsSegmentId, V2SegmentsResponse } from "@/lib/api/types";

import { MetricsListBody, PeriodTableFrame } from "@/components/financial-metrics/metrics-list-body";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { PlanBadge, tierLabel } from "@/components/ui/credit-hint";
import { FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { Notice } from "@/components/ui/notice";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { useV2SegmentsDetailedInfinite, useV2SegmentsInfinite } from "@/lib/api/queries";
import { isInstantSegmentId } from "@/lib/financials/segment-metrics";
import { completePeriodsOnly, periodLabels, segmentLines } from "@/lib/financials/statements";

import type { FinancialsTabProps } from "./financials-frame";

import { financialsFilterCount, FinancialsFrame, FISCAL_YEAR_FILTER } from "./financials-frame";
import { useFinancialsSearch } from "./financials-search";
import { FiscalYearRange } from "./fiscal-year-range";
import { SegmentSelect, toSegmentId } from "./segment-select";
import { SegmentedFinancialsTable } from "./segmented-financials-table";
import { segmentFilterOptions, SegmentsDetailedView, withAll } from "./segments-detailed";

/** Segment facts per page of `/v1/segments` (one row per fact, many per period: the maximum page). */
const SEGMENTS_PAGE = 200;

/**
 * The segments list (pure). Requests are narrowed by `segment_id` on the server; the defensive local filter also
 * keeps a stale response from showing another selection. A trailing partial period is withheld when other periods
 * are already loaded; a lone period remains visible while its remaining rows can be fetched.
 */
export function SegmentsView({
    pages,
    segmentId,
    ...state
}: MetricsListState & { pages: ReadonlyArray<V2SegmentsResponse>; segmentId: "all" | SegmentedFinancialsSegmentId }) {
    const loaded = React.useMemo(
        () => completePeriodsOnly(pages.flatMap(page => page.data), state.hasNextPage),
        [pages, state.hasNextPage],
    );

    const shown = React.useMemo(
        () => (segmentId === "all" ? loaded : loaded.filter(segment => segment.segment_id === segmentId)),
        [loaded, segmentId],
    );

    const labels = React.useMemo(() => periodLabels(shown), [shown]);

    const rows = React.useMemo(() => segmentLines(shown), [shown]);

    const hiddenAll = loaded.length > 0 && shown.length === 0;

    return (
        <MetricsListBody
            coverage={pages.at(0)?.meta.coverage}
            emptyText="No financial data available."
            hasRows={rows.length > 0 || hiddenAll}
            loadedPages={pages.length}
            state={state}
            title="Failed to load segmented financials"
        >
            {hiddenAll
                ? (
                        <PeriodTableFrame>
                            <div className="text-muted-foreground text-sm">
                                {state.hasNextPage
                                    ? "None of the loaded segment rows match this segment; load more periods to look further."
                                    : "No rows for this segment."}
                            </div>
                        </PeriodTableFrame>
                    )
                : <SegmentedFinancialsTable periodLabels={labels} rows={rows} />}
        </MetricsListBody>
    );
}

/** The two segment views: the summary table (`/v1/segments`) and the PRO lineage list (`/v1/segments/detailed`). */
const SEGMENT_VIEWS: Array<{ label: string; value: SegmentsLayout }> = [
    { label: "Standard", value: "summary" },
    { label: "Detailed", value: "detailed" },
];

type SegmentsLayout = "detailed" | "summary";

/** Segment facts per page of `/v1/segments/detailed` (one table row each). */
const SEGMENTS_DETAILED_PAGE = 100;

/** The page body of the Financials route's tab (`/$ticker/financials?view=`). */
export function SegmentsFinancials({ tabs, ticker }: FinancialsTabProps) {
    const [search, update] = useFinancialsSearch();

    const segmentId = toSegmentId(search.segment);

    const instant = isInstantSegmentId(segmentId);

    const requestedPeriod = search.period ?? "quarterly";

    const periodType = instant && (requestedPeriod === "ttm" || requestedPeriod === "ytd") ? "quarterly" : requestedPeriod;

    // `?layout=detailed` = the PRO lineage list; anything else (summary, a statement tab's presentation) the summary.
    const layout: SegmentsLayout = search.layout === "detailed" ? "detailed" : "summary";

    const [source, setSource] = React.useState<null | SecPanelTarget>(null);

    const openFiling = React.useCallback((accession: string) => setSource({ accession, kind: "filing" }), []);

    // Every selection participates in both the request and cache key; Standard never calls the PRO endpoint.
    const filters = {
        axis: search.axis ? [search.axis] : undefined,
        company: ticker,
        fiscalYearGte: search.fyFrom,
        fiscalYearLte: search.fyTo,
        followLinks: search.followLinks ? true : undefined,
        metric: search.metric ? [search.metric] : undefined,
        period: periodType,
        segmentIds: segmentId === "all" ? undefined : [segmentId],
    };

    // `/v1/segments?company=<ticker>&period=<type>[&metric=&axis=]`, newest first. Only the open view's hook asks
    // (`company` "" = idle).
    const summary = useV2SegmentsInfinite({ ...filters, company: layout === "summary" ? ticker : "", limit: SEGMENTS_PAGE });

    const detailed = useV2SegmentsDetailedInfinite({ ...filters, company: layout === "detailed" ? ticker : "", limit: SEGMENTS_DETAILED_PAGE });

    const loadedRows = React.useMemo(
        () => (layout === "summary" ? summary.data?.pages.flatMap(page => page.data) : detailed.data?.pages.flatMap(page => page.data)) ?? [],
        [detailed.data, layout, summary.data],
    );

    const options = React.useMemo(() => segmentFilterOptions(loadedRows, { axis: search.axis, metric: search.metric }), [loadedRows, search.axis, search.metric]);

    return (
        <FinancialsFrame
            activeCount={financialsFilterCount(search, [["segment"], ["metric"], ["axis"], ["followLinks"], FISCAL_YEAR_FILTER])}
            description={layout === "detailed"
                ? `Each segment fact with its reported concept, the filing's caption and the filing (${tierLabel("listSegmentsDetailed")}).`
                : "Segment values as reported, with each member kept separate. Reconciliation details are available in Detailed."}
            filters={(
                <>
                    <FilterField label="Segment">
                        <SegmentSelect
                            onValueChange={value => update({
                                chart: undefined,
                                period: isInstantSegmentId(value) && (requestedPeriod === "ttm" || requestedPeriod === "ytd") ? undefined : search.period,
                                segment: value === "all" ? undefined : value,
                            })}
                            value={segmentId}
                        />
                    </FilterField>
                    <FilterField label="Metric">
                        {id => (
                            <FilterSelect
                                aria-label="Metric"
                                className="w-full"
                                id={id}
                                onValueChange={value => update({ chart: undefined, metric: value === "all" ? undefined : value })}
                                options={withAll(options.metrics, "All metrics")}
                                value={search.metric ?? "all"}
                            />
                        )}
                    </FilterField>
                    <FilterField label="Axis">
                        {id => (
                            <FilterSelect
                                aria-label="Axis"
                                className="w-full"
                                id={id}
                                onValueChange={value => update({ axis: value === "all" ? undefined : value, chart: undefined })}
                                options={withAll(options.axes, "All axes")}
                                value={search.axis ?? "all"}
                            />
                        )}
                    </FilterField>
                    <FilterField label="Fiscal years">
                        <FiscalYearRange from={search.fyFrom} onChange={update} to={search.fyTo} />
                    </FilterField>
                    <FilterField label="Segment history">
                        <Button
                            aria-pressed={search.followLinks === true}
                            className="w-full"
                            onClick={() => update({ chart: undefined, followLinks: search.followLinks ? undefined : true })}
                            variant={search.followLinks ? "default" : "outline"}
                        >
                            Follow renamed segments
                        </Button>
                    </FilterField>
                </>
            )}
            onReset={() => update({ axis: undefined, chart: undefined, followLinks: undefined, fyFrom: undefined, fyTo: undefined, metric: undefined, segment: undefined })}
            tabs={tabs}
            what={(
                <>
                    <SegmentedButtons
                        aria-label="View"
                        onChange={value => update({ chart: undefined, layout: value === "summary" ? undefined : value })}
                        options={SEGMENT_VIEWS.map(option => ({ ...option, badge: option.value === "detailed" ? <PlanBadge operationId="listSegmentsDetailed" /> : undefined }))}
                        value={layout}
                    />
                    <PeriodTypeButtons allowedPeriods={instant ? ["quarterly", "annual"] : undefined} onValueChange={value => update({ chart: undefined, period: value === "quarterly" ? undefined : value })} value={periodType} />
                </>
            )}
        >
            {instant && <Notice title="Period-end balances">Assets and goodwill are shown only for filed quarterly or annual periods. They are never added into YTD or TTM values.</Notice>}
            {search.followLinks && <Notice title="Following proved member links">Earlier source members remain separate under their successor. Merge components are not summed; split links are not followed. The proof covers stated comparative periods, not numerical equivalence across all history.</Notice>}
            {layout === "detailed"
                ? (
                        <SegmentsDetailedView
                            error={detailed.error}
                            hasNextPage={detailed.hasNextPage}
                            isFetchingNextPage={detailed.isFetchingNextPage}
                            isLoading={detailed.isLoading}
                            onLoadMore={() => void detailed.fetchNextPage()}
                            onOpenFiling={openFiling}
                            pages={detailed.data?.pages ?? []}
                            segmentId={segmentId}
                            ticker={ticker}
                        />
                    )
                : (
                        <SegmentsView
                            error={summary.error}
                            hasNextPage={summary.hasNextPage}
                            isFetchingNextPage={summary.isFetchingNextPage}
                            isLoading={summary.isLoading}
                            onLoadMore={() => void summary.fetchNextPage()}
                            pages={summary.data?.pages ?? []}
                            segmentId={segmentId}
                        />
                    )}
            <SecSourceDialog onClose={() => setSource(null)} target={source} />
        </FinancialsFrame>
    );
}
