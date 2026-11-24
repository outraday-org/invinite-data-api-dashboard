import * as React from "react";

import type { MetricsTableRow } from "@/components/financial-metrics/financial-metrics-table";
import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { V2GrowthBasis, V2GrowthPeriod, V2GrowthResponse } from "@/lib/api/types";

import { FinancialMetricsTable } from "@/components/financial-metrics/financial-metrics-table";
import { MetricsListBody } from "@/components/financial-metrics/metrics-list-body";
import { PeriodTypeButtons } from "@/components/financials-presentation/period-type-buttons";
import { FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { useV2GrowthInfinite } from "@/lib/api/queries";
import { completePeriodsOnly, periodLabel, periodLabels } from "@/lib/financials/statements";
import { formatFractionPercentCompact, formatMetricId } from "@/lib/utils";

import type { FinancialsTabProps } from "./financials-frame";

import { financialsFilterCount, FinancialsFrame, FISCAL_YEAR_FILTER } from "./financials-frame";
import { useFinancialsSearch } from "./financials-search";
import { FiscalYearRange } from "./fiscal-year-range";

/** Periods per page of `/v1/metrics/growth`: one row per period and basis (both bases = two rows per period). */
const GROWTH_PERIODS = 8;

const ALL = "all";

const basisOptions: Array<{ label: string; value: typeof ALL | V2GrowthBasis }> = [
    { label: "All Growth Types", value: ALL },
    { label: "Year over Year", value: "yoy" },
    { label: "Quarter over Quarter", value: "qoq" },
];

const BASIS_SHORT_LABELS: Record<V2GrowthBasis, string> = { qoq: "QoQ", yoy: "YoY" };

/** The growth table: one line per basis × metric (`facts.{metric_id}` of each row), one value per period. */
export function growthRows(periods: ReadonlyArray<V2GrowthPeriod>): Array<MetricsTableRow> {
    const rowMap = new Map<string, MetricsTableRow>();

    for (const period of periods) {
        const label = periodLabel(period);

        for (const [metricId, value] of Object.entries(period.facts)) {
            const key = `${period.basis}:${metricId}`;

            let row = rowMap.get(key);

            if (!row) {
                row = { key, label: `${formatMetricId(metricId)} (${BASIS_SHORT_LABELS[period.basis]})`, metricId, values: {} };

                rowMap.set(key, row);
            }

            row.values[label] = value;
        }
    }

    return [...rowMap.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** The growth list (pure): a column only once every row of its period is loaded (`completePeriodsOnly`). */
export function GrowthView({ pages, ...state }: MetricsListState & { pages: ReadonlyArray<V2GrowthResponse> }) {
    const periods = React.useMemo(
        () => completePeriodsOnly(pages.flatMap(page => page.data), state.hasNextPage),
        [pages, state.hasNextPage],
    );

    const labels = React.useMemo(() => periodLabels(periods), [periods]);

    const rows = React.useMemo(() => growthRows(periods), [periods]);

    return (
        <MetricsListBody
            coverage={pages.at(0)?.meta.coverage}
            emptyText="No financial data available."
            hasRows={rows.length > 0}
            loadedPages={pages.length}
            state={state}
            title="Failed to load growth financials"
        >
            <FinancialMetricsTable formatValue={formatFractionPercentCompact} periodLabels={labels} rows={rows} />
        </MetricsListBody>
    );
}

/** The page body of the Financials route's tab (`/$ticker/financials?view=`). */
export function GrowthFinancials({ tabs, ticker }: FinancialsTabProps) {
    const [search, update] = useFinancialsSearch();

    const periodType = search.period ?? "quarterly";

    const basis: typeof ALL | V2GrowthBasis = search.basis ?? ALL;

    // `/v1/metrics/growth?company=<ticker>&period=<type>[&basis=yoy|qoq]` (v1 `growth_type`), newest first.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2GrowthInfinite({
        basis: basis === ALL ? undefined : basis,
        company: ticker,
        fiscalYearGte: search.fyFrom,
        fiscalYearLte: search.fyTo,
        limit: basis === ALL ? GROWTH_PERIODS * 2 : GROWTH_PERIODS,
        period: periodType,
    });

    return (
        <FinancialsFrame
            activeCount={financialsFilterCount(search, [FISCAL_YEAR_FILTER])}
            description="Period-over-period growth metrics (YoY / QoQ)."
            filters={(
                <FilterField label="Fiscal years">
                    <FiscalYearRange from={search.fyFrom} onChange={update} to={search.fyTo} />
                </FilterField>
            )}
            onReset={() => update({ fyFrom: undefined, fyTo: undefined })}
            tabs={tabs}
            what={(
                <>
                    <FilterSelect aria-label="Growth basis" className="w-[190px]" onValueChange={value => update({ basis: value === ALL ? undefined : value })} options={basisOptions} value={basis} />
                    <PeriodTypeButtons onValueChange={value => update({ period: value === "quarterly" ? undefined : value })} value={periodType} />
                </>
            )}
        >
            <GrowthView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={data?.pages ?? []}
            />
        </FinancialsFrame>
    );
}
