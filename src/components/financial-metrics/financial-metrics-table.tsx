import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatNumberEnCompact } from "@/lib/utils";

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
        <div className="flex flex-col gap-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        {hasGroupColumn
                            ? (
                                    <TableHead className={cn(STICKY_FIRST_CELL, "w-[140px] min-w-[140px] max-w-[140px] sm:w-[320px] sm:min-w-[320px] sm:max-w-[320px]")}>
                                        {groupLabel}
                                    </TableHead>
                                )
                            : null}
                        <TableHead className={cn(!hasGroupColumn && STICKY_FIRST_CELL, "w-[160px] min-w-[160px] max-w-[160px]")}>
                            {labelHeader}
                        </TableHead>
                        {periodLabels.map(label => (
                            <TableHead className="text-right" key={label}>
                                {label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody className="divide-y-0">
                    {rows.map(row => (
                        <TableRow
                            className="group h-[41px] leading-5 cursor-pointer hover:bg-muted/50"
                            key={row.key}
                            onClick={() => setSelectedRow(row)}
                        >
                            {hasGroupColumn
                                ? (
                                        <TableCell className={cn(STICKY_FIRST_CELL, "w-[140px] min-w-[140px] max-w-[140px] sm:w-[320px] sm:min-w-[320px] sm:max-w-[320px]")}>
                                            <div className="flex min-w-0 items-center gap-1">
                                                <div className="min-w-0 flex-1 truncate" title={row.group ?? ""}>
                                                    {row.group ?? "—"}
                                                </div>
                                                <MetricCatalogLink label={row.group ?? row.label} metricId={row.metricId} />
                                            </div>
                                        </TableCell>
                                    )
                                : null}
                            <TableCell className={cn(!hasGroupColumn && STICKY_FIRST_CELL, "w-[160px] min-w-[160px] max-w-[160px]")}>
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
                                    <TableCell className="text-right" key={`${row.key}:${label}`}>
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
        </div>
    );
}
