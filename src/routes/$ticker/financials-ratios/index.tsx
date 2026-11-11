import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { MetricsTableRow } from "@/components/financial-metrics/financial-metrics-table";
import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { FiscalPeriodType, V2RatioCategory, V2RatioPeriod, V2RatiosResponse } from "@/lib/api/types";

import { FinancialMetricsTable } from "@/components/financial-metrics/financial-metrics-table";
import { MetricsListBody } from "@/components/financial-metrics/metrics-list-body";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { useV2RatiosInfinite } from "@/lib/api/queries";
import { periodLabel, periodLabels } from "@/lib/financials/statements";
import { formatMetricId, formatNumberEnCompact } from "@/lib/utils";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/$ticker/financials-ratios/")({
    component: FinancialRatiosPage,
});

/** Periods per page of `/v1/metrics/ratios` (one row per period). */
const RATIOS_PAGE = 8;

const ALL = "all";

const ratioCategoryOptions: Array<{ label: string; value: typeof ALL | V2RatioCategory }> = [
    { label: "All Categories", value: ALL },
    { label: "Valuation", value: "valuation" },
    { label: "Profitability", value: "profitability" },
    { label: "Liquidity", value: "liquidity" },
    { label: "Leverage", value: "leverage" },
    { label: "Efficiency", value: "efficiency" },
];

const formatCategoryLabel = (category: string) =>
    category
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());

const percentText = (value: number) => `${formatNumberEnCompact(value)}%`;

/** The ratios table: one line per metric × category (`ratios.{category}.{metric_id}`), one value per period. */
export function ratioRows(periods: ReadonlyArray<V2RatioPeriod>): Array<MetricsTableRow> {
    const rowMap = new Map<string, MetricsTableRow>();

    for (const period of periods) {
        const label = periodLabel(period);

        for (const [category, facts] of Object.entries(period.ratios)) {
            for (const [metricId, value] of Object.entries(facts)) {
                const key = `${metricId}:${category}`;

                let row = rowMap.get(key);

                if (!row) {
                    row = {
                        formatValue: metricId.endsWith("_pct") ? percentText : undefined,
                        group: formatMetricId(metricId),
                        key,
                        label: formatCategoryLabel(category),
                        values: {},
                    };

                    rowMap.set(key, row);
                }

                row.values[label] = value;
            }
        }
    }

    return [...rowMap.values()].sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.label.localeCompare(b.label));
}

/** The ratios list (pure): state, coverage, the table over the loaded periods and "Load more". */
export function RatiosView({ pages, ...state }: MetricsListState & { pages: ReadonlyArray<V2RatiosResponse> }) {
    const periods = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    const labels = React.useMemo(() => periodLabels(periods), [periods]);

    const rows = React.useMemo(() => ratioRows(periods), [periods]);

    return (
        <MetricsListBody
            coverage={pages.at(0)?.meta.coverage}
            emptyText="No financial data available."
            hasRows={rows.length > 0}
            loadedPages={pages.length}
            state={state}
            title="Failed to load ratio financials"
        >
            <FinancialMetricsTable groupLabel="Metric" labelHeader="Category" periodLabels={labels} rows={rows} />
        </MetricsListBody>
    );
}

function FinancialRatiosPage() {
    const { ticker } = Route.useParams();

    const [periodType, setPeriodType] = React.useState<FiscalPeriodType>("quarterly");

    const [category, setCategory] = React.useState<typeof ALL | V2RatioCategory>(ALL);

    // `/v1/metrics/ratios?company=<ticker>&period=<type>[&category=<one>]`, newest first.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2RatiosInfinite({
        category: category === ALL ? undefined : [category],
        company: ticker,
        limit: RATIOS_PAGE,
        period: periodType,
    });

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col shrink-0 gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div>Ratio Financials</div>
                    <div>Financial ratios grouped by category.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <FilterSelect className="w-[220px]" onValueChange={setCategory} options={ratioCategoryOptions} value={category} />
                    <PeriodTypeButtons onValueChange={setPeriodType} value={periodType} />
                </div>
            </div>
            <RatiosView
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
