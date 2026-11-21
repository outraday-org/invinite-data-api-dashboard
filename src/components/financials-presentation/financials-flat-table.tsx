import * as React from "react";

import type { StatementColumn, StatementLine } from "@/lib/financials/statements";

import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatNumberEnCompact, formatPercentCompact } from "@/lib/utils";

import type { ExplainTarget } from "./fact-explain-dialog";

import { FactExplainDialog } from "./fact-explain-dialog";

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
 * (newest first). A derived value is italic (its tooltip says so); a click charts the line. A value with a fact id (the
 * standardized detailed view) is a button: "Explain this number" (`/v1/facts/{id}`), without charting the line.
 */
export function FinancialsFlatTable({ columns, lines }: { columns: Array<StatementColumn>; lines: Array<StatementLine> }) {
    const [selected, setSelected] = useChartSelection(lines, line => line.id);

    const [explaining, setExplaining] = React.useState<ExplainTarget | null>(null);

    return (
        <div className="flex flex-col gap-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={cn(STICKY_FIRST_CELL, "w-[160px] min-w-[160px] max-w-[160px] sm:w-[420px] sm:min-w-[420px] sm:max-w-[420px]")}>Metric</TableHead>
                        {columns.map(column => (
                            <TableHead className="text-right" key={column.label} title={column.title}>
                                {column.label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody className="divide-y-0">
                    {lines.map(line => (
                        <TableRow className="group h-[41px] leading-5 cursor-pointer hover:bg-muted/50" key={line.id} onClick={() => setSelected(line)}>
                            <TableCell className={cn(STICKY_FIRST_CELL, "w-[160px] min-w-[160px] max-w-[160px] sm:w-[420px] sm:min-w-[420px] sm:max-w-[420px]")}>
                                <div className="flex min-w-0 items-center gap-1">
                                    <div className="min-w-0 flex-1 truncate font-medium" title={line.title ?? line.label}>{line.label}</div>
                                    <MetricCatalogLink label={line.label} metricId={line.id} />
                                    <ChartRowButton label={line.label} onOpen={() => setSelected(line)} />
                                </div>
                            </TableCell>
                            {columns.map((column, index) => {
                                const cell = line.values[index];

                                return (
                                    <TableCell className="text-right" key={`${line.id}:${column.label}`}>
                                        {cell?.factId
                                            ? (
                                                    <button
                                                        aria-label={`Explain ${line.label}, ${column.label}`}
                                                        className={cn("tabular-nums rounded-sm underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring", cell.derived ? "italic text-muted-foreground" : null)}
                                                        onClick={(event) => {
                                                            event.stopPropagation();

                                                            setExplaining({ factId: cell.factId!, formula: cell.formula, period: `${line.label} · ${column.label}` });
                                                        }}
                                                        title={[cellTitle(cell), "Click: explain this number"].filter(Boolean).join("\n")}
                                                        type="button"
                                                    >
                                                        {formatterOf(line.id)(cell.value)}
                                                    </button>
                                                )
                                            : cell
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
            <MetricChartDialog
                data={selected ? columns.map((column, index) => ({ period: column.label, value: selected.values[index]?.value })) : []}
                formatValue={selected ? formatterOf(selected.id) : undefined}
                metricLabel={selected?.label ?? ""}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
                open={Boolean(selected)}
            />
            <FactExplainDialog onClose={() => setExplaining(null)} target={explaining} />
        </div>
    );
}
