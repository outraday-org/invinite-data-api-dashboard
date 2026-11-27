import type { SegmentLine } from "@/lib/financials/statements";

import { PeriodTableFrame } from "@/components/financial-metrics/metrics-list-body";
import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERIOD_CELL, STATEMENT_LABEL_CELL, STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatMetricId, formatNumberEnCompact, formatSegmentId } from "@/lib/utils";

/** "Revenue Product · IPhone": the segment id in words, then its dimensions' members. */
export const formatSegmentLabel = (row: Partial<Pick<SegmentLine, "sourceMember" | "viaLink">> & Pick<SegmentLine, "details" | "segmentId">) => {
    const segmentLabel = formatSegmentId(row.segmentId) || row.segmentId;

    const label = row.details ? `${segmentLabel} · ${row.details}` : segmentLabel;

    return row.viaLink ? `${label} · from ${row.sourceMember ?? "earlier member"}` : label;
};

/** A chart retains the row's currency when its dialog covers the table. */
function chartLabel(row: SegmentLine): string {
    return [formatMetricId(row.metricId), formatSegmentLabel(row), row.currency].filter(Boolean).join(" · ");
}

/** One line per metric, target, source member and currency; periods are newest first. */
export function SegmentedFinancialsTable({ periodLabels, rows: lines }: { periodLabels: Array<string>; rows: Array<SegmentLine> }) {
    // Zero is a reported value too; do not hide a source component merely because every loaded value is zero.
    const rows = lines;

    const [selectedRow, setSelectedRow] = useChartSelection(rows, row => row.key, row => row.legacyChartKey);

    return (
        <>
            <PeriodTableFrame>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>Metric</TableHead>
                            <TableHead className="w-[200px] min-w-[200px] max-w-[200px] xl:w-[240px] xl:min-w-[240px] xl:max-w-[240px]">Segment</TableHead>
                            <TableHead>Currency</TableHead>
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
                                <TableCell className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>
                                    <div className="flex min-w-0 items-center gap-1">
                                        <div className="min-w-0 flex-1 truncate" title={formatMetricId(row.metricId)}>
                                            {formatMetricId(row.metricId)}
                                        </div>
                                        <MetricCatalogLink label={formatMetricId(row.metricId)} metricId={row.metricId} />
                                        <ChartRowButton label={chartLabel(row)} onOpen={() => setSelectedRow(row)} />
                                    </div>
                                </TableCell>
                                <TableCell className="w-[200px] min-w-[200px] max-w-[200px] xl:w-[240px] xl:min-w-[240px] xl:max-w-[240px]">
                                    <div className="truncate" title={formatSegmentLabel(row)}>
                                        {formatSegmentLabel(row)}
                                    </div>
                                </TableCell>
                                <TableCell>{row.currency ?? "—"}</TableCell>
                                {periodLabels.map((label) => {
                                    const val = row.values[label];

                                    return (
                                        <TableCell className={PERIOD_CELL} key={`${row.key}:${label}`}>
                                            <span className="tabular-nums" title={row.sourceRows[label] ? `Derived source row: ${row.sourceRows[label]}` : undefined}>
                                                {val === undefined
                                                    ? "—"
                                                    : formatNumberEnCompact(val)}
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
                formatValue={formatNumberEnCompact}
                metricLabel={selectedRow
                    ? chartLabel(selectedRow)
                    : ""}
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
