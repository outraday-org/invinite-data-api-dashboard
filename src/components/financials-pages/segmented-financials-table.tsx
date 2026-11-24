import * as React from "react";

import type { SegmentLine } from "@/lib/financials/statements";

import { PeriodTableFrame } from "@/components/financial-metrics/metrics-list-body";
import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERIOD_CELL, STATEMENT_LABEL_CELL, STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatMetricId, formatNumberEnCompact, formatSegmentId } from "@/lib/utils";

/** "Revenue Product · IPhone": the segment id in words, then its dimensions' members. */
export const formatSegmentLabel = (row: Pick<SegmentLine, "details" | "segmentId">) => {
    const segmentLabel = formatSegmentId(row.segmentId) || row.segmentId;

    return row.details ? `${segmentLabel} · ${row.details}` : segmentLabel;
};

/** The segments table: one line per metric × segment × dimensions, one column per period (newest first). */
export function SegmentedFinancialsTable({ periodLabels, rows: lines }: { periodLabels: Array<string>; rows: Array<SegmentLine> }) {
    const rows = React.useMemo(
        () => lines.filter(row => !periodLabels.every(label => (row.values[label] ?? 0) === 0)),
        [lines, periodLabels],
    );

    const [selectedRow, setSelectedRow] = useChartSelection(rows, row => row.key);

    return (
        <>
            <PeriodTableFrame>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>Metric</TableHead>
                            <TableHead className="w-[200px] min-w-[200px] max-w-[200px] xl:w-[240px] xl:min-w-[240px] xl:max-w-[240px]">Segment</TableHead>
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
                                        <ChartRowButton label={`${formatMetricId(row.metricId)} · ${formatSegmentLabel(row)}`} onOpen={() => setSelectedRow(row)} />
                                    </div>
                                </TableCell>
                                <TableCell className="w-[200px] min-w-[200px] max-w-[200px] xl:w-[240px] xl:min-w-[240px] xl:max-w-[240px]">
                                    <div className="truncate" title={formatSegmentLabel(row)}>
                                        {formatSegmentLabel(row)}
                                    </div>
                                </TableCell>
                                {periodLabels.map((label) => {
                                    const val = row.values[label];

                                    return (
                                        <TableCell className={PERIOD_CELL} key={`${row.key}:${label}`}>
                                            <span className="tabular-nums">
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
                    ? `${formatMetricId(selectedRow.metricId)} · ${formatSegmentLabel(selectedRow)}`
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
