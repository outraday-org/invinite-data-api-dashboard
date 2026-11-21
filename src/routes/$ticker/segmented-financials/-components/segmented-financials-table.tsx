import * as React from "react";

import type { SegmentLine } from "@/lib/financials/statements";

import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatMetricId, formatNumberEnCompact, formatSegmentId } from "@/lib/utils";

/** "Revenue Product · IPhone": the segment id in words, then its dimensions' members. */
export const formatSegmentLabel = (row: Pick<SegmentLine, "details" | "segmentId">) => {
    const segmentLabel = formatSegmentId(row.segmentId) || row.segmentId;

    return row.details ? `${segmentLabel} · ${row.details}` : segmentLabel;
};

/** The segments table: one line per metric × segment × dimensions, one column per period (newest first). */
export function SegmentedFinancialsTable({ periodLabels, rows: lines }: { periodLabels: Array<string>; rows: Array<SegmentLine> }) {
    const [selectedRow, setSelectedRow] = React.useState<null | SegmentLine>(null);

    const rows = React.useMemo(
        () => lines.filter(row => !periodLabels.every(label => (row.values[label] ?? 0) === 0)),
        [lines, periodLabels],
    );

    return (
        <div className="flex flex-col gap-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={cn(STICKY_FIRST_CELL, "w-[140px] min-w-[140px] max-w-[140px] sm:w-[260px] sm:min-w-[260px] sm:max-w-[260px]")}>Metric</TableHead>
                        <TableHead className="w-[300px] min-w-[300px] max-w-[300px]">Segment</TableHead>
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
                            <TableCell className={cn(STICKY_FIRST_CELL, "w-[140px] min-w-[140px] max-w-[140px] sm:w-[260px] sm:min-w-[260px] sm:max-w-[260px]")}>
                                <div className="flex min-w-0 items-center gap-1">
                                    <div className="min-w-0 flex-1 truncate font-medium" title={formatMetricId(row.metricId)}>
                                        {formatMetricId(row.metricId)}
                                    </div>
                                    <ChartRowButton label={`${formatMetricId(row.metricId)} · ${formatSegmentLabel(row)}`} onOpen={() => setSelectedRow(row)} />
                                </div>
                            </TableCell>
                            <TableCell className="w-[300px] min-w-[300px] max-w-[300px]">
                                <div className="truncate" title={formatSegmentLabel(row)}>
                                    {formatSegmentLabel(row)}
                                </div>
                            </TableCell>
                            {periodLabels.map((label) => {
                                const val = row.values[label];

                                return (
                                    <TableCell className="text-right" key={`${row.key}:${label}`}>
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
        </div>
    );
}
