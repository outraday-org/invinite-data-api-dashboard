import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { MetricChartDialog } from "@/components/metric-chart/metric-chart-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatNumberEnCompact, formatPercentCompact } from "@/lib/utils";

import type { PresentationPeriod, TreeRow } from "./types";

import { ExpandCollapseButtons } from "./expand-collapse-buttons";
import { addFactTypes, buildTreeRows, flattenToValueMap } from "./utils";

export function FinancialsPresentationTable({
    isCollapsible = true,
    periods,
}: {
    isCollapsible?: boolean;
    periods: Array<PresentationPeriod>;
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

        buildTreeRows(typedPeriods[0]?.facts ?? [], 0, null, out);

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

    const [selectedRow, setSelectedRow] = React.useState<null | TreeRow>(null);

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

    const getFormatValue = React.useCallback(
        (metricId: string) => (metricId === "is_effective_tax_rate" ? formatPercentCompact : formatNumberEnCompact),
        [],
    );

    return (
        <div className="space-y-2 flex flex-col h-0 grow">
            {isCollapsible
                ? (
                        <ExpandCollapseButtons
                            onCollapseAll={() => setExpanded(new Set())}
                            onExpandAll={() => setExpanded(new Set(allExpandableIds))}
                        />
                    )
                : null}

            <ScrollArea className="grow h-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[420px] min-w-[420px] max-w-[420px]">
                                Metric
                            </TableHead>
                            {periods.map(period => (
                                <TableHead className="text-right" key={period.label} title={period.title}>
                                    {period.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y-0">
                        {rows.map((row, index) => {
                            const hasTotalAfter = index + 1 < rows.length
                                && rows[index + 1].isTotal;

                            return (
                                <TableRow
                                    className={cn(
                                        hasTotalAfter ? "border-b-foreground" : null,
                                        "h-[41px] leading-5 cursor-pointer hover:bg-muted/50",
                                    )}
                                    key={row.metricId}
                                    onClick={() => setSelectedRow(row)}
                                >
                                    <TableCell className="w-[420px] min-w-[420px] max-w-[420px]">
                                        <div className="flex items-center gap-1">
                                            {isCollapsible
                                                ? (
                                                        row.hasChildren
                                                            ? (
                                                                    <button
                                                                        className={cn(
                                                                            "text-muted-foreground hover:text-foreground inline-flex h-6 w-6 items-center justify-center rounded",
                                                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                                                        )}
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
                                                    "font-medium truncate",
                                                    row.isTotal ? "font-semibold" : null,
                                                )}
                                                style={{
                                                    maxWidth: `${420 - 24}px`,
                                                    paddingLeft: row.depth * 14,
                                                }}
                                                title={row.label}
                                            >
                                                {row.label}
                                            </div>
                                        </div>
                                    </TableCell>

                                    {periodLabels.map((label) => {
                                        const val = row.values[label];

                                        return (
                                            <TableCell className="text-right" key={`${row.metricId}:${label}`}>
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
            </ScrollArea>
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
        </div>
    );
}
