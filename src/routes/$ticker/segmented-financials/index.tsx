import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { FiscalPeriodType, SegmentedFinancialsSegmentId, V2SegmentsResponse } from "@/lib/api/types";

import { MetricsListBody } from "@/components/financial-metrics/metrics-list-body";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { useV2SegmentsInfinite } from "@/lib/api/queries";
import { completePeriodsOnly, periodLabels, segmentLines } from "@/lib/financials/statements";
import { SegmentSelect } from "@/routes/$ticker/segmented-financials/-components/segment-select";
import { SegmentedFinancialsTable } from "@/routes/$ticker/segmented-financials/-components/segmented-financials-table";

export const Route = createFileRoute("/$ticker/segmented-financials/")({
    component: SegmentedFinancialsPage,
});

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

function SegmentedFinancialsPage() {
    const { ticker } = Route.useParams();

    const [periodType, setPeriodType] = React.useState<FiscalPeriodType>("quarterly");

    const [segmentId, setSegmentId] = React.useState<"all" | SegmentedFinancialsSegmentId>("all");

    // `/v1/segments?company=<ticker>&period=<type>`, newest first; the segment picker filters the loaded rows.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2SegmentsInfinite({
        company: ticker,
        limit: SEGMENTS_PAGE,
        period: periodType,
    });

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col shrink-0 gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div>Segmented Financials</div>
                    <div>Financial data broken out by business segment in tabular format.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SegmentSelect onValueChange={setSegmentId} value={segmentId} />
                    <PeriodTypeButtons onValueChange={setPeriodType} value={periodType} />
                </div>
            </div>
            <SegmentsView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={data?.pages ?? []}
                segmentId={segmentId}
            />
        </div>
    );
}
