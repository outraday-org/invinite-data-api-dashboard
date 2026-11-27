import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import type { AsReportedDetailedPeriodTarget, AsReportedPageScope } from "@/lib/api/queries";
import type { StatementType } from "@/lib/api/types";

import { PeriodTableFrame } from "@/components/financial-metrics/metrics-list-body";
import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERIOD_CELL, STATEMENT_LABEL_CELL, STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatNumberEnCompact, formatPercentCompact } from "@/lib/utils";

import type { AsReportedExplainTarget } from "./as-reported-explain-dialog";
import type { PresentationPeriod, TreeRow } from "./types";

import { AsReportedExplainDialog } from "./as-reported-explain-dialog";
import { ExpandCollapseButtons } from "./expand-collapse-buttons";
import { filedValuesTarget } from "./filed-values";
import { PeriodHeadLabel } from "./period-head";
import { reportedTreeRows } from "./reported-tree";
import { addFactTypes, buildTreeRows, flattenToValueMap } from "./utils";

/**
 * The presentation tree of a statement (one column per period, newest first): group rows medium weight, totals
 * semibold with a hairline above, 12 px indentation per level; a standardized tree collapses (Expand / Collapse all in
 * the toolbar row beside `toolbar`, the currency and hint line).
 */
export function FinancialsPresentationTable({
    asReported = false,
    periods,
    reportedScope,
    statement,
    toolbar,
}: {
    asReported?: boolean;
    periods: Array<PresentationPeriod>;
    reportedScope?: AsReportedPageScope;
    statement: StatementType;
    toolbar?: React.ReactNode;
}) {
    const periodLabels = React.useMemo(() => periods.map(p => p.label), [periods]);

    const typedPeriods = React.useMemo(() => {
        return periods.map(period => ({
            ...period,
            facts: addFactTypes(period.facts),
        }));
    }, [periods]);

    const reportedRows = React.useMemo(() => asReported ? reportedTreeRows(periods) : [], [asReported, periods]);

    const isCollapsible = !asReported || reportedRows.some(row => row.preserve && row.hasChildren);

    const rowId = (row: Omit<TreeRow, "values">) => row.id ?? row.metricId;

    const canonicalTree = React.useMemo(() => {
        if (asReported) return reportedRows;

        const out: Array<Omit<TreeRow, "values">> = [];

        // The tree of the newest period that states one: an as-reported Q4 (filed only inside the 10-K) is empty (F037).
        buildTreeRows(typedPeriods.find(period => period.facts.length > 0)?.facts ?? [], 0, null, out);

        return out;
    }, [asReported, reportedRows, typedPeriods]);

    const parentById = React.useMemo(() => {
        const m = new Map<string, null | string>();

        for (const row of canonicalTree) {
            m.set(rowId(row), row.parentId);
        }

        return m;
    }, [canonicalTree]);

    const valueMaps = React.useMemo(() => {
        return typedPeriods.map((p) => {
            const m = new Map<string, null | number>();

            flattenToValueMap(p.facts, m);

            return m;
        });
    }, [typedPeriods]);

    const allExpandableIds = React.useMemo(() => {
        return new Set(canonicalTree.filter(r => r.hasChildren && (!asReported || r.preserve)).map(rowId));
    }, [asReported, canonicalTree]);

    const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(allExpandableIds));

    React.useEffect(() => {
        // keep expanded set in sync when switching statement/period type/ticker
        if (!asReported) setExpanded(new Set(allExpandableIds));
    }, [allExpandableIds, asReported]);

    // A new reported group starts expanded, including one found on a later page.
    const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());

    const isExpanded = (id: string) => asReported ? !collapsed.has(id) : expanded.has(id);

    const isVisible = React.useCallback((row: Omit<TreeRow, "values">) => {
        if (!isCollapsible) return true;

        let p = row.parentId;

        while (p) {
            if (asReported ? collapsed.has(p) : !expanded.has(p)) return false;

            const nextParent = parentById.get(p);

            p = nextParent === undefined ? null : nextParent;
        }

        return true;
    }, [asReported, collapsed, expanded, isCollapsible, parentById]);

    const rows: Array<TreeRow> = React.useMemo(() => {
        if (asReported) return reportedRows.filter(isVisible).filter(row => row.preserve || !Object.values(row.values).every(value => value === 0));

        return canonicalTree
            .filter(isVisible)
            .map(r => ({
                ...r,
                values: Object.fromEntries(
                    periodLabels.map((label, idx) => [label, valueMaps[idx]?.get(r.metricId)]),
                ),
            }))
            .filter(row => row.preserve || !Object.values(row.values).every(value => value === 0));
    }, [asReported, canonicalTree, isVisible, periodLabels, reportedRows, valueMaps]);

    // A chart's key is the metric id (`?chart=` on the Financials route).
    const chartable = (row: TreeRow) => !asReported || !row.preserve || Object.values(row.values).some(value => value != null);

    const [selectedRow, setSelectedRow] = useChartSelection(rows.filter(chartable), row => row.chartId ?? row.metricId);

    const [explaining, setExplaining] = React.useState<AsReportedExplainTarget | null>(null);

    const [detailedPeriod, setDetailedPeriod] = React.useState<AsReportedDetailedPeriodTarget | null>(null);

    const explain = (row: TreeRow, index: number) => {
        const node = row.nodes?.get(index);

        const period = periods[index]?.reportedPeriod;

        if (!node || !period || typeof node.value !== "number") return;

        const scope = reportedScope ?? { company: period.company.cik, period: period.period, statement };

        const cik = period.company.cik;

        const selectedPeriod = node.derived
            ? {
                    ...scope,
                    accession: period.source.accession,
                    cik,
                    filedAt: period.source.filed_at,
                    fiscalQuarter: period.fiscal_quarter,
                    fiscalYear: period.fiscal_year,
                    periodEnd: period.period_end,
                    periodStart: period.period_start,
                }
            : undefined;

        if (selectedPeriod) setDetailedPeriod(selectedPeriod);

        setExplaining({
            cik,
            concept: node.concept,
            detailedPeriod: selectedPeriod,
            dimensions: node.dimensions,
            fact: { ...node, value: node.value },
            memberKey: node.dimensions?.length ? node.key : undefined,
            period: `${row.label} · ${periods[index].label}`,
            scope,
            vintages: filedValuesTarget(cik, node.concept, period.period_end, statement === "balance-sheet" ? null : period.period_start, node.dimensions),
        });
    };

    const getFormatValue = React.useCallback(
        (metricId: string) => (metricId === "is_effective_tax_rate" ? formatPercentCompact : formatNumberEnCompact),
        [],
    );

    return (
        <>
            <PeriodTableFrame
                actions={isCollapsible
                    ? (
                            <ExpandCollapseButtons
                                onCollapseAll={() => asReported ? setCollapsed(new Set(allExpandableIds)) : setExpanded(new Set())}
                                onExpandAll={() => asReported ? setCollapsed(new Set()) : setExpanded(new Set(allExpandableIds))}
                            />
                        )
                    : undefined}
                toolbar={toolbar}
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>
                                Metric
                            </TableHead>
                            {periods.map(period => (
                                <TableHead className={PERIOD_CELL} key={period.label} title={period.title}>
                                    <PeriodHeadLabel label={period.label} preliminary={period.preliminary} />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y-0">
                        {rows.map((row) => {
                            const id = rowId(row);

                            const canChart = chartable(row);

                            return (
                                <TableRow
                                    className={cn("group border-b-0", canChart && "clickable-financial-row", row.isTotal && "border-border border-t")}
                                    key={id}
                                    onClick={canChart ? () => setSelectedRow(row) : undefined}
                                >
                                    <TableCell className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>
                                        <div className="flex min-w-0 items-center gap-1">
                                            {isCollapsible
                                                ? (
                                                        allExpandableIds.has(id)
                                                            ? (
                                                                    <button
                                                                        aria-expanded={isExpanded(id)}
                                                                        aria-label={`${isExpanded(id) ? "Collapse" : "Expand"} ${row.label}`}
                                                                        className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();

                                                                            const toggle = (prev: Set<string>) => {
                                                                                const next = new Set(prev);

                                                                                if (next.has(id)) next.delete(id);
                                                                                else next.add(id);

                                                                                return next;
                                                                            };

                                                                            if (asReported) setCollapsed(toggle);
                                                                            else setExpanded(toggle);
                                                                        }}
                                                                        type="button"
                                                                    >
                                                                        {isExpanded(id)
                                                                            ? <ChevronDown className="h-4 w-4" />
                                                                            : <ChevronRight className="h-4 w-4" />}
                                                                    </button>
                                                                )
                                                            : <span className="inline-block h-6 w-6" />
                                                    )
                                                : null}

                                            <div
                                                className={cn(
                                                    "min-w-0 flex-1 truncate",
                                                    row.isTotal ? "font-semibold" : row.hasChildren ? "font-medium" : null,
                                                )}
                                                style={{ paddingLeft: row.depth * 12 }}
                                                title={row.title ? `${row.label} · ${row.title}` : row.label}
                                            >
                                                {row.label}
                                            </div>
                                            {!asReported && <MetricCatalogLink label={row.label} metricId={row.metricId} />}
                                            {canChart && <ChartRowButton label={row.label} onOpen={() => setSelectedRow(row)} />}
                                        </div>
                                    </TableCell>

                                    {periodLabels.map((label, index) => {
                                        const val = row.values[label];

                                        const text = val == null ? (row.hasChildren ? "" : "—") : getFormatValue(row.metricId)(val);

                                        const className = cn("tabular-nums", row.isTotal && "font-semibold");

                                        return (
                                            <TableCell className={PERIOD_CELL} key={label}>
                                                {row.nodes?.get(index) && val != null && periods[index].reportedPeriod
                                                    ? (
                                                            <button
                                                                aria-label={`Explain ${row.label}, ${label}`}
                                                                className={cn(className, "rounded-sm focus-visible:outline-2 focus-visible:outline-ring")}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();

                                                                    explain(row, index);
                                                                }}
                                                                type="button"
                                                            >
                                                                {text}
                                                            </button>
                                                        )
                                                    : <span className={className}>{text}</span>}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            );
                        })}
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
                formatValue={selectedRow ? getFormatValue(selectedRow.metricId) : undefined}
                metricLabel={selectedRow?.label ?? ""}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRow(null);
                    }
                }}
                open={Boolean(selectedRow)}
            />
            {asReported && <AsReportedExplainDialog onClose={() => setExplaining(null)} retainedPeriod={detailedPeriod} target={explaining} />}
        </>
    );
}
