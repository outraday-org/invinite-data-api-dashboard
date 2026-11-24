import * as React from "react";

import type { V2StatementPeriod } from "@/lib/api/types";
import type { StatementColumn, StatementLine } from "@/lib/financials/statements";

import { PeriodTableFrame } from "@/components/financial-metrics/metrics-list-body";
import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERIOD_CELL, STATEMENT_LABEL_CELL, STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatNumberEnCompact, formatPercentCompact } from "@/lib/utils";

import type { AsReportedExplainTarget } from "./as-reported-explain-dialog";
import type { ExplainTarget } from "./fact-explain-dialog";

import { AsReportedExplainDialog } from "./as-reported-explain-dialog";
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
 * (newest first). A derived value is italic (its tooltip says so); a click charts the line. A detailed value is a
 * button: "Explain this number" without charting the line — a standardized one by its fact id (`/v1/facts/{id}`), an
 * as-reported one from the fact itself (formula, operands, filing; `cik` = the company's, for the EDGAR links; `rows` =
 * the loaded periods, where a formula member's own filing is looked up first).
 */
export function FinancialsFlatTable({ cik = null, columns, lines, rows }: {
    cik?: null | string;
    columns: Array<StatementColumn>;
    lines: Array<StatementLine>;
    rows?: ReadonlyArray<V2StatementPeriod>;
}) {
    const [selected, setSelected] = useChartSelection(lines, line => line.id);

    const [explaining, setExplaining] = React.useState<ExplainTarget | null>(null);

    const [explainingReported, setExplainingReported] = React.useState<AsReportedExplainTarget | null>(null);

    return (
        <>
            <PeriodTableFrame>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>Metric</TableHead>
                            {columns.map(column => (
                                <TableHead className={PERIOD_CELL} key={column.label} title={column.title}>
                                    {column.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y-0">
                        {lines.map(line => (
                            <TableRow className="group clickable-financial-row" key={line.id} onClick={() => setSelected(line)}>
                                <TableCell className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>
                                    <div className="flex min-w-0 items-center gap-1">
                                        <div className="min-w-0 flex-1 truncate" title={line.title ?? line.label}>{line.label}</div>
                                        <MetricCatalogLink label={line.label} metricId={line.id} />
                                        <ChartRowButton label={line.label} onOpen={() => setSelected(line)} />
                                    </div>
                                </TableCell>
                                {columns.map((column, index) => {
                                    const cell = line.values[index];

                                    return (
                                        <TableCell className={PERIOD_CELL} key={`${line.id}:${column.label}`}>
                                            {cell?.factId || cell?.reported
                                                ? (
                                                        <button
                                                            aria-label={`Explain ${line.label}, ${column.label}`}
                                                            className={cn("tabular-nums rounded-sm focus-visible:outline-2 focus-visible:outline-ring", cell.derived ? "italic" : null)}
                                                            onClick={(event) => {
                                                                event.stopPropagation();

                                                                const period = `${line.label} · ${column.label}`;

                                                                if (cell.factId) setExplaining({ accession: cell.accession ?? null, factId: cell.factId, formula: cell.formula, htmlTagId: cell.htmlTagId ?? null, period });
                                                                else if (cell.reported) setExplainingReported({ cik, concept: line.id, fact: cell.reported, period, rows });
                                                            }}
                                                            title={[cellTitle(cell), "Click: explain this number"].filter(Boolean).join("\n")}
                                                            type="button"
                                                        >
                                                            {formatterOf(line.id)(cell.value)}
                                                        </button>
                                                    )
                                                : cell
                                                    ? (
                                                            <span className={cn("tabular-nums", cell.derived ? "italic" : null)} title={cellTitle(cell)}>
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
            </PeriodTableFrame>
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
            <AsReportedExplainDialog onClose={() => setExplainingReported(null)} target={explainingReported} />
        </>
    );
}
