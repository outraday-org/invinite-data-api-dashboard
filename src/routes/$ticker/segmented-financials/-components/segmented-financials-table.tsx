import * as React from "react";

import type { SegmentLine } from "@/lib/financials/statements";

import { MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMetricId, formatNumberEnCompact, formatSegmentId } from "@/lib/utils";

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
        <div className="space-y-2 flex flex-col h-0 grow">
            <ScrollArea className="grow h-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[260px] min-w-[260px] max-w-[260px]">Metric</TableHead>
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
                                className="h-[41px] leading-5 cursor-pointer hover:bg-muted/50"
                                key={row.key}
                                onClick={() => setSelectedRow(row)}
                            >
                                <TableCell className="w-[260px] min-w-[260px] max-w-[260px]">
                                    <div className="font-medium truncate" title={formatMetricId(row.metricId)}>
                                        {formatMetricId(row.metricId)}
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
            </ScrollArea>
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
