import * as React from "react";

import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { SegmentedFinancialsSegmentId, V2SegmentsResponse } from "@/lib/api/types";

import { MetricsListBody } from "@/components/financial-metrics/metrics-list-body";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/ui/credit-hint";
import { PageHeader } from "@/components/ui/page-header";
import { useV2SegmentsDetailedInfinite, useV2SegmentsInfinite } from "@/lib/api/queries";
import { completePeriodsOnly, periodLabels, segmentLines } from "@/lib/financials/statements";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import { useFinancialsSearch } from "./financials-search";
import { FiscalYearRange } from "./fiscal-year-range";
import { SegmentSelect, toSegmentId } from "./segment-select";
import { SegmentedFinancialsTable } from "./segmented-financials-table";
import { segmentFilterOptions, SegmentsDetailedView, withAll } from "./segments-detailed";

/** Segment facts per page of `/v1/segments` (one row per fact, many per period: the maximum page). */
const SEGMENTS_PAGE = 200;

/**
 * The segments list (pure). `/v1/segments` has no `segment_id` filter (v1 had one): the segment picker filters the
 * loaded rows and says when it hid them all. A column is shown only once every fact of its period is loaded.
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
                        <div className="text-muted-foreground text-sm">
                            {state.hasNextPage
                                ? "None of the loaded segment rows match this segment; load more periods to look further."
                                : "No rows for this segment."}
                        </div>
                    )
                : <SegmentedFinancialsTable periodLabels={labels} rows={rows} />}
        </MetricsListBody>
    );
}

/** The two segment views: the summary table (`/v1/segments`) and the PRO lineage list (`/v1/segments/detailed`). */
const SEGMENT_VIEWS: Array<{ label: string; value: SegmentsLayout }> = [
    { label: "Summary", value: "summary" },
    { label: "Detailed", value: "detailed" },
];

type SegmentsLayout = "detailed" | "summary";

/** Segment facts per page of `/v1/segments/detailed` (one table row each). */
const SEGMENTS_DETAILED_PAGE = 100;

/** The page body of the Financials route's tab (`/$ticker/financials?view=`). */
export function SegmentsFinancials({ ticker }: { ticker: string }) {
    const [search, update] = useFinancialsSearch();

    const periodType = search.period ?? "quarterly";

    const segmentId = toSegmentId(search.segment);

    // `?layout=detailed` = the PRO lineage list; anything else (summary, a statement tab's presentation) the summary.
    const layout: SegmentsLayout = search.layout === "detailed" ? "detailed" : "summary";

    const [source, setSource] = React.useState<null | SecPanelTarget>(null);

    const openFiling = React.useCallback((accession: string) => setSource({ accession, kind: "filing" }), []);

    // `metric` / `axis` are sent to the API (both operations take them, any of); the segment picker filters the loaded rows.
    const filters = {
        axis: search.axis ? [search.axis] : undefined,
        company: ticker,
        fiscalYearGte: search.fyFrom,
        fiscalYearLte: search.fyTo,
        metric: search.metric ? [search.metric] : undefined,
        period: periodType,
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
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <div aria-label="View" className="flex gap-1" role="group">
                            {SEGMENT_VIEWS.map(option => (
                                <Button
                                    aria-pressed={layout === option.value}
                                    key={option.value}
                                    onClick={() => update({ chart: undefined, layout: option.value === "summary" ? undefined : option.value })}
                                    variant={layout === option.value ? "default" : "outline"}
                                >
                                    {option.label}
                                    {option.value === "detailed" && <PlanBadge operationId="listSegmentsDetailed" />}
                                </Button>
                            ))}
                        </div>
                        <SegmentSelect onValueChange={value => update({ chart: undefined, segment: value === "all" ? undefined : value })} value={segmentId} />
                        <FilterSelect
                            aria-label="Metric"
                            className="w-[220px]"
                            onValueChange={value => update({ chart: undefined, metric: value === "all" ? undefined : value })}
                            options={withAll(options.metrics, "All metrics")}
                            value={search.metric ?? "all"}
                        />
                        <FilterSelect
                            aria-label="Axis"
                            className="w-[220px]"
                            onValueChange={value => update({ axis: value === "all" ? undefined : value, chart: undefined })}
                            options={withAll(options.axes, "All axes")}
                            value={search.axis ?? "all"}
                        />
                        <PeriodTypeButtons onValueChange={value => update({ period: value === "quarterly" ? undefined : value })} value={periodType} />
                        <FiscalYearRange from={search.fyFrom} onChange={update} to={search.fyTo} />
                    </>
                )}
                description={layout === "detailed"
                    ? "Each segment fact with its reported concept, the filing's caption and the filing (PRO)."
                    : "Financial data broken out by business segment in tabular format."}
                title="Segmented Financials"
            />
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
        </div>
    );
}
