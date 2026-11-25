import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { FinancialsTableToolbar, PeriodTableFrame } from "@/components/financial-metrics/metrics-list-body";
import { ChartRowButton, MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { useChartSelection } from "@/components/metric-chart/use-chart-selection";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERIOD_CELL, STATEMENT_LABEL_CELL, STICKY_FIRST_CELL } from "@/lib/layout";
import { cn, formatNumberEnCompact, formatPercentCompact } from "@/lib/utils";

import type { PresentationPeriod, TreeRow } from "./types";

import { ExpandCollapseButtons } from "./expand-collapse-buttons";
import { PeriodHeadLabel } from "./period-head";
import { addFactTypes, buildTreeRows, flattenToValueMap } from "./utils";

/**
 * The presentation tree of a statement (one column per period, newest first): group rows medium weight, totals
 * semibold with a hairline above, 12 px indentation per level; a standardized tree collapses (Expand / Collapse all in
 * the toolbar row beside `toolbar`, the currency and hint line).
 */
export function FinancialsPresentationTable({
    isCollapsible = true,
    periods,
    toolbar,
}: {
    isCollapsible?: boolean;
    periods: Array<PresentationPeriod>;
    toolbar?: React.ReactNode;
}) {
    const periodLabels = React.useMemo(() => periods.map(p => p.label), [periods]);

    const typedPeriods = React.useMemo(() => {
        return periods.map(period => ({
            ...period,
            facts: addFactTypes(period.facts),
        }));
    }, [periods]);

    const canonicalTree = React.useMemo(() => {
        const out: Array<Omit<TreeRow, "values">> = [];

        // The tree of the newest period that states one: an as-reported Q4 (filed only inside the 10-K) is empty (F037).
        buildTreeRows(typedPeriods.find(period => period.facts.length > 0)?.facts ?? [], 0, null, out);

        return out;
    }, [typedPeriods]);

    const parentById = React.useMemo(() => {
        const m = new Map<string, null | string>();

        for (const row of canonicalTree) {
            m.set(row.metricId, row.parentId);
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
        return new Set(canonicalTree.filter(r => r.hasChildren).map(r => r.metricId));
    }, [canonicalTree]);

    const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(allExpandableIds));

    React.useEffect(() => {
        // keep expanded set in sync when switching statement/period type/ticker
        setExpanded(new Set(allExpandableIds));
    }, [allExpandableIds]);

    const isVisible = React.useCallback((row: Omit<TreeRow, "values">) => {
        if (!isCollapsible) return true;

        let p = row.parentId;

        while (p) {
            if (!expanded.has(p)) return false;

            const nextParent = parentById.get(p);

            p = nextParent === undefined ? null : nextParent;
        }

        return true;
    }, [expanded, isCollapsible, parentById]);

    const rows: Array<TreeRow> = React.useMemo(() => {
        return canonicalTree
            .filter(isVisible)
            .map(r => ({
                ...r,
                values: Object.fromEntries(
                    periodLabels.map((label, idx) => [label, valueMaps[idx]?.get(r.metricId)]),
                ),
            }))
            .filter(row => !Object.values(row.values).every(value => value === 0));
    }, [canonicalTree, isVisible, periodLabels, valueMaps]);

    // A chart's key is the metric id (`?chart=` on the Financials route).
    const [selectedRow, setSelectedRow] = useChartSelection(rows, row => row.metricId);

    const getFormatValue = React.useCallback(
        (metricId: string) => (metricId === "is_effective_tax_rate" ? formatPercentCompact : formatNumberEnCompact),
        [],
    );

    return (
        <>
            {(toolbar || isCollapsible) && (
                <FinancialsTableToolbar>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3">{toolbar}</div>
                    {isCollapsible && (
                        <ExpandCollapseButtons
                            onCollapseAll={() => setExpanded(new Set())}
                            onExpandAll={() => setExpanded(new Set(allExpandableIds))}
                        />
                    )}
                </FinancialsTableToolbar>
            )}
            <PeriodTableFrame>
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
                            return (
                                <TableRow
                                    className={cn("group clickable-financial-row border-b-0", row.isTotal && "border-border border-t")}
                                    key={row.metricId}
                                    onClick={() => setSelectedRow(row)}
                                >
                                    <TableCell className={cn(STICKY_FIRST_CELL, STATEMENT_LABEL_CELL)}>
                                        <div className="flex min-w-0 items-center gap-1">
                                            {isCollapsible
                                                ? (
                                                        row.hasChildren
                                                            ? (
                                                                    <button
                                                                        aria-expanded={expanded.has(row.metricId)}
                                                                        aria-label={`${expanded.has(row.metricId) ? "Collapse" : "Expand"} ${row.label}`}
                                                                        className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();

                                                                            setExpanded((prev) => {
                                                                                const next = new Set(prev);

                                                                                if (next.has(row.metricId)) {
                                                                                    next.delete(row.metricId);
                                                                                }
                                                                                else {
                                                                                    next.add(row.metricId);
                                                                                }

                                                                                return next;
                                                                            });
                                                                        }}
                                                                        type="button"
                                                                    >
                                                                        {expanded.has(row.metricId)
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
                                                title={row.label}
                                            >
                                                {row.label}
                                            </div>
                                            <MetricCatalogLink label={row.label} metricId={row.metricId} />
                                            <ChartRowButton label={row.label} onOpen={() => setSelectedRow(row)} />
                                        </div>
                                    </TableCell>

                                    {periodLabels.map((label) => {
                                        const val = row.values[label];

                                        return (
                                            <TableCell className={PERIOD_CELL} key={`${row.metricId}:${label}`}>
                                                <span className={cn("tabular-nums", row.isTotal ? "font-semibold" : null)}>
                                                    {val === undefined || val === null
                                                        ? (row.hasChildren ? "" : "—")
                                                        : row.metricId === "is_effective_tax_rate"
                                                            ? formatPercentCompact(val)
                                                            : formatNumberEnCompact(val)}
                                                </span>
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
        </>
    );
}
