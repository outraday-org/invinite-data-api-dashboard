import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERIOD_CELL, STATEMENT_LABEL_CELL, STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatNumberEnCompact } from "@/lib/utils";

import { PeriodTableFrame } from "./metrics-list-body";

export type MetricsTableRow = {
    group?: string;
    key: string;
    label: string;
    /** The catalog metric the row shows (its label links `/catalog`). */
    metricId?: string;
    formatValue?: (value: number) => string;
    values: Record<string, number | undefined>;
};

/** What a row's chart is named: the first column's text too when the table has one (ratios: the metric, then its category). */
export function chartName(row: MetricsTableRow) {
    return row.group ? `${row.group} · ${row.label}` : row.label;
}

export function FinancialMetricsTable({
    formatValue,
    groupLabel = "Category",
    labelHeader = "Metric",
    periodLabels,
    rows,
}: {
    formatValue?: (value: number) => string;
    groupLabel?: string;
    labelHeader?: string;
    periodLabels: Array<string>;
    rows: Array<MetricsTableRow>;
}) {
    const hasGroupColumn = rows.some(row => row.group);

    const [selectedRow, setSelectedRow] = useChartSelection(rows, row => row.key);

    return (
        <>
            <PeriodTableFrame>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {hasGroupColumn
                                ? (
                                        <TableHead className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>
                                            {groupLabel}
                                        </TableHead>
                                    )
                                : null}
                            <TableHead className={cn(hasGroupColumn ? "w-[120px] min-w-[120px] max-w-[120px]" : cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL))}>
                                {labelHeader}
                            </TableHead>
                            {periodLabels.map(label => (
                                <TableHead className={PERIOD_CELL} key={label}>
                                    {label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y-0">
                        {rows.map(row => (
                            <TableRow
                                className="group clickable-financial-row"
                                key={row.key}
                                onClick={() => setSelectedRow(row)}
                            >
                                {hasGroupColumn
                                    ? (
                                            <TableCell className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>
                                                <div className="flex min-w-0 items-center gap-1">
                                                    <div className="min-w-0 flex-1 truncate" title={row.group ?? ""}>
                                                        {row.group ?? "—"}
                                                    </div>
                                                    <MetricCatalogLink label={row.group ?? row.label} metricId={row.metricId} />
                                                </div>
                                            </TableCell>
                                        )
                                    : null}
                                <TableCell className={cn(hasGroupColumn ? "w-[120px] min-w-[120px] max-w-[120px]" : cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL))}>
                                    <div className="flex min-w-0 items-center gap-1">
                                        <div className="min-w-0 flex-1 truncate" title={row.label}>
                                            {row.label}
                                        </div>
                                        {!hasGroupColumn && <MetricCatalogLink label={row.label} metricId={row.metricId} />}
                                        <ChartRowButton label={chartName(row)} onOpen={() => setSelectedRow(row)} />
                                    </div>
                                </TableCell>
                                {periodLabels.map((label) => {
                                    const val = row.values[label];

                                    return (
                                        <TableCell className={PERIOD_CELL} key={`${row.key}:${label}`}>
                                            <span className="tabular-nums">
                                                {val === undefined
                                                    ? "—"
                                                    : ((row.formatValue ?? formatValue)
                                                            ? (row.formatValue ?? formatValue)!(val)
                                                            : formatNumberEnCompact(val))}
                                            </span>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </PeriodTableFrame>
            <MetricChartDialog
                data={selectedRow
                    ? periodLabels.map(period => ({
                            period,
                            value: selectedRow.values[period],
                        }))
                    : []}
                formatValue={selectedRow?.formatValue ?? formatValue}
                metricLabel={selectedRow ? chartName(selectedRow) : ""}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRow(null);
                    }
                }}
                open={Boolean(selectedRow)}
            />
        </>
    );
}
