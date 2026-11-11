import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { MetricsTableRow } from "@/components/financial-metrics/financial-metrics-table";
import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { V2CagrHorizon, V2CagrPeriod, V2CagrResponse } from "@/lib/api/types";

import { FinancialMetricsTable } from "@/components/financial-metrics/financial-metrics-table";
import { MetricsListBody } from "@/components/financial-metrics/metrics-list-body";
import { useV2CagrInfinite } from "@/lib/api/queries";
import { completePeriodsOnly, periodLabel, periodLabels } from "@/lib/financials/statements";
import { formatFractionPercentCompact, formatMetricId } from "@/lib/utils";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/$ticker/financials-cagr/")({
    component: FinancialCagrPage,
});

/** Periods per page of `/v1/metrics/cagr`: one row per period and horizon (every horizon = three rows per period). */
const CAGR_PERIODS = 8;

type HorizonFilter = "3" | "5" | "10" | "all";

/** The select's value → `horizon=` (`all` = not sent: every horizon). */
const HORIZONS: Record<HorizonFilter, undefined | V2CagrHorizon> = { 3: 3, 5: 5, 10: 10, all: undefined };

const cagrPeriodOptions: Array<{ label: string; value: HorizonFilter }> = [
    { label: "All Periods", value: "all" },
    { label: "3 Year CAGR", value: "3" },
    { label: "5 Year CAGR", value: "5" },
    { label: "10 Year CAGR", value: "10" },
];

/** The CAGR table: one line per metric × horizon (longest horizon first within a metric), one value per period. */
export function cagrRows(periods: ReadonlyArray<V2CagrPeriod>): Array<MetricsTableRow> {
    const rowMap = new Map<string, MetricsTableRow & { horizon: number; metricId: string }>();

    for (const period of periods) {
        const label = periodLabel(period);

        for (const [metricId, value] of Object.entries(period.facts)) {
            const key = `${metricId}:${period.horizon}`;

            let row = rowMap.get(key);

            if (!row) {
                row = { horizon: period.horizon, key, label: `${formatMetricId(metricId)} (${period.horizon}Y CAGR)`, metricId, values: {} };

                rowMap.set(key, row);
            }

            row.values[label] = value;
        }
    }

    return [...rowMap.values()]
        .sort((a, b) => a.metricId.localeCompare(b.metricId) || b.horizon - a.horizon)
        .map(({ horizon: _horizon, metricId: _metricId, ...row }) => row);
}

/** The CAGR list (pure): a column only once every horizon of its period is loaded (`completePeriodsOnly`). */
export function CagrView({ pages, ...state }: MetricsListState & { pages: ReadonlyArray<V2CagrResponse> }) {
    const periods = React.useMemo(
        () => completePeriodsOnly(pages.flatMap(page => page.data), state.hasNextPage),
        [pages, state.hasNextPage],
    );

    const labels = React.useMemo(() => periodLabels(periods), [periods]);

    const rows = React.useMemo(() => cagrRows(periods), [periods]);

    return (
        <MetricsListBody
            coverage={pages.at(0)?.meta.coverage}
            emptyText="No financial data available."
            hasRows={rows.length > 0}
            loadedPages={pages.length}
            state={state}
            title="Failed to load CAGR financials"
        >
            <FinancialMetricsTable formatValue={formatFractionPercentCompact} periodLabels={labels} rows={rows} />
        </MetricsListBody>
    );
}

function FinancialCagrPage() {
    const { ticker } = Route.useParams();

    const [horizon, setHorizon] = React.useState<HorizonFilter>("all");

    // `/v1/metrics/cagr?company=<ticker>&period=annual[&horizon=3|5|10]` (v1 `period_years`; CAGR is annual only).
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2CagrInfinite({
        company: ticker,
        horizon: HORIZONS[horizon],
        limit: horizon === "all" ? CAGR_PERIODS * 3 : CAGR_PERIODS,
        period: "annual",
    });

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col shrink-0 gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div>CAGR Financials</div>
                    <div>Compound annual growth rates by metric.</div>
                </div>
                <FilterSelect className="w-[200px]" onValueChange={setHorizon} options={cagrPeriodOptions} value={horizon} />
            </div>
            <CagrView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={data?.pages ?? []}
            />
        </div>
    );
}
