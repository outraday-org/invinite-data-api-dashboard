import * as React from "react";

import type { StatementColumn, StatementLine } from "@/lib/financials/statements";

import { MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatNumberEnCompact, formatPercentCompact } from "@/lib/utils";

const formatterOf = (id: string) => (id === "is_effective_tax_rate" ? formatPercentCompact : formatNumberEnCompact);

/** A cell's tooltip: derivation, formula, unit and filing (the detailed view's lineage). */
function cellTitle(cell: NonNullable<StatementLine["values"][number]>) {
    const parts = [
        cell.derived ? "Computed by Invinite (Q4 / TTM / YTD derivation)" : null,
        cell.formula ? `Formula: ${cell.formula}` : null,
        cell.unit ? `Unit: ${cell.unit}` : null,
        cell.accession ? `Filing ${cell.accession}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join("\n") : undefined;
}

/**
 * The flat statement table of the summary / detailed views: one line per metric / concept, one column per period
 * (newest first). A derived value is italic (its tooltip says so); a click charts the line.
 */
export function FinancialsFlatTable({ columns, lines }: { columns: Array<StatementColumn>; lines: Array<StatementLine> }) {
    const [selected, setSelected] = React.useState<null | StatementLine>(null);

    return (
        <div className="space-y-2 flex flex-col h-0 grow">
            <ScrollArea className="grow h-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[420px] min-w-[420px] max-w-[420px]">Metric</TableHead>
                            {columns.map(column => (
                                <TableHead className="text-right" key={column.label} title={column.title}>
                                    {column.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y-0">
                        {lines.map(line => (
                            <TableRow className="h-[41px] leading-5 cursor-pointer hover:bg-muted/50" key={line.id} onClick={() => setSelected(line)}>
                                <TableCell className="w-[420px] min-w-[420px] max-w-[420px]">
                                    <div className="font-medium truncate" title={line.title ?? line.label}>{line.label}</div>
                                </TableCell>
                                {columns.map((column, index) => {
                                    const cell = line.values[index];

                                    return (
                                        <TableCell className="text-right" key={`${line.id}:${column.label}`}>
                                            {cell
                                                ? (
                                                        <span className={cn("tabular-nums", cell.derived ? "italic text-muted-foreground" : null)} title={cellTitle(cell)}>
                                                            {formatterOf(line.id)(cell.value)}
                                                        </span>
                                                    )
                                                : <span className="tabular-nums">—</span>}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
            <MetricChartDialog
                data={selected ? columns.map((column, index) => ({ period: column.label, value: selected.values[index]?.value })) : []}
                formatValue={selected ? formatterOf(selected.id) : undefined}
                metricLabel={selected?.label ?? ""}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
                open={Boolean(selected)}
            />
        </div>
    );
}
