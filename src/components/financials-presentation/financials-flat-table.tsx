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
import type { FiledValuesDialogTarget } from "./filed-values";

import { AsReportedExplainDialog } from "./as-reported-explain-dialog";
import { FactExplainDialog } from "./fact-explain-dialog";
import { FiledValuesDialog } from "./filed-values";
import { PeriodHeadLabel } from "./period-head";

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
 * (newest first). A derived value looks like a filed one (its tooltip says it is derived); a click charts the line. A detailed value is a
 * button: "Explain this number" without charting the line — a standardized one by its fact id (`/v1/facts/{id}`), an
 * as-reported one from the fact itself (formula, operands, filing; `cik` = the company's, for the EDGAR links; `rows` =
 * the loaded periods, where a formula member's own filing is looked up first). `filedValues` (the as-reported summary,
 * whose lines are filed concepts): a filed value is a button that opens its "Filed values" (`/v1/financials/vintages`
 * for the concept and the column's period); a period whose values are preliminary carries its badge.
 */
export function FinancialsFlatTable({ cik = null, columns, filedValues = false, lines, rows }: {
    cik?: null | string;
    columns: Array<StatementColumn>;
    filedValues?: boolean;
    lines: Array<StatementLine>;
    rows?: ReadonlyArray<V2StatementPeriod>;
}) {
    const [selected, setSelected] = useChartSelection(lines, line => line.id);

    const [explaining, setExplaining] = React.useState<ExplainTarget | null>(null);

    const [explainingReported, setExplainingReported] = React.useState<AsReportedExplainTarget | null>(null);

    const [filed, setFiled] = React.useState<FiledValuesDialogTarget | null>(null);

    // The "Filed values" request of a concept in a column: a company (CIK) and the period's end are needed.
    const vintagesOf = (concept: string, column: StatementColumn) => (cik && column.periodEnd
        ? { company: cik, concept, periodEnd: column.periodEnd, periodStart: column.periodStart ?? null }
        : null);

    return (
        <>
            <PeriodTableFrame>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>Metric</TableHead>
                            {columns.map(column => (
                                <TableHead className={PERIOD_CELL} key={column.label} title={column.title}>
                                    <PeriodHeadLabel label={column.label} preliminary={column.preliminary} />
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

                                    // A filed (not derived) as-reported summary value opens its filed values.
                                    const vintages = filedValues && cell && !cell.derived && !cell.factId && !cell.reported ? vintagesOf(line.id, column) : null;

                                    return (
                                        <TableCell className={PERIOD_CELL} key={`${line.id}:${column.label}`}>
                                            {cell?.factId || cell?.reported
                                                ? (
                                                        <button
                                                            aria-label={`Explain ${line.label}, ${column.label}`}
                                                            className="tabular-nums rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                                                            onClick={(event) => {
                                                                event.stopPropagation();

                                                                const period = `${line.label} · ${column.label}`;

                                                                if (cell.factId) setExplaining({ accession: cell.accession ?? null, factId: cell.factId, formula: cell.formula, htmlTagId: cell.htmlTagId ?? null, period });
                                                                else if (cell.reported) setExplainingReported({ cik, concept: line.id, fact: cell.reported, period, rows, vintages: vintagesOf(line.id, column) });
                                                            }}
                                                            title={[cellTitle(cell), "Click: explain this number"].filter(Boolean).join("\n")}
                                                            type="button"
                                                        >
                                                            {formatterOf(line.id)(cell.value)}
                                                        </button>
                                                    )
                                                : cell && vintages
                                                    ? (
                                                            <button
                                                                aria-label={`Filed values of ${line.label}, ${column.label}`}
                                                                className="tabular-nums rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();

                                                                    setFiled({ ...vintages, title: `${line.label} · ${column.label}` });
                                                                }}
                                                                title={[cellTitle(cell), "Click: every filing that stated this value"].filter(Boolean).join("\n")}
                                                                type="button"
                                                            >
                                                                {formatterOf(line.id)(cell.value)}
                                                            </button>
                                                        )
                                                    : cell
                                                        ? (
                                                                <span className="tabular-nums" title={cellTitle(cell)}>
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
            <FiledValuesDialog onClose={() => setFiled(null)} target={filed} />
        </>
    );
}
