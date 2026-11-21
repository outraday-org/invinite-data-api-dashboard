import type { ColumnDef, Row } from "@tanstack/react-table";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import * as React from "react";

import type { ExportConfig } from "@/components/api/export-menu";
import type { OperationId } from "@/lib/api/operations.gen";

import { ExportMenu } from "@/components/api/export-menu";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LG_STICKY_TOP_CLASS } from "@/lib/layout";
import { cn } from "@/lib/utils";

/** Skeleton rows shown while the first page loads. */
const SKELETON_ROWS = 5;

/**
 * Whether the table fits its column (no horizontal scroller needed). A table wider than its column keeps the wrapper as
 * its horizontal scroller, so the page never scrolls sideways; only a table that fits lets its header stick to the window.
 * Without `ResizeObserver` (tests, SSR) the table counts as fitting.
 */
function useTableFits(wrapper: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
    const [fits, setFits] = React.useState(true);

    React.useEffect(() => {
        const element = wrapper.current;

        const table = element?.querySelector("table");

        if (!enabled || !element || !table || typeof ResizeObserver === "undefined") return;

        // +1: sub-pixel rounding of a table exactly as wide as its column.
        const measure = () => setFits(table.getBoundingClientRect().width <= element.clientWidth + 1);

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(element);

        observer.observe(table);

        return () => observer.disconnect();
    }, [enabled, wrapper]);

    return fits;
}

/**
 * The one table of the dashboard's lists (grown from `V2ListTable`): the page scrolls, not the table.
 *
 * - Header: sticks below the pinned top bar + ticker header (`LG_STICKY_TOP_CLASS`) from `lg` up while the table fits
 *   its column (`useTableFits`). Below `lg`, and for a table wider than its column, the wrapper scrolls sideways and the
 *   header scrolls with the page (a sticky header inside a horizontal scroller binds to the scroller — CSS cannot do
 *   both); the page itself never scrolls sideways.
 * - `stickyFirstColumn` (wide tables: insider trades): the wrapper scrolls sideways at every width, the first column
 *   stays; the header is then never window-sticky (same CSS limit).
 * - States: skeleton rows while the first page loads, `errorState` in a full-width row (first page or a failed next
 *   page), the empty row only for a genuine empty answer (`emptyIsGenuine`: a pending / partial coverage's notice
 *   stands above the table instead), "Load more" with "N loaded" by `next_cursor`.
 * - O6: `operationId` (the list's operation) puts its cost on "Load more"; `exportConfig` adds the "Export" menu above
 *   the table (CSV / JSON of the loaded rows, "load all" after a confirm naming the per-page cost).
 */
export function DataTable<TRow>({
    columnClassName,
    columns,
    emptyIsGenuine = true,
    emptyText,
    errorState,
    exportConfig,
    groupHeading,
    groupOf,
    hasNextPage = false,
    isFetchingNextPage = false,
    isLoading,
    onLoadMore,
    operationId,
    rowClassName,
    rows,
    stickyFirstColumn = false,
}: {
    /** Extra classes per column id (widths, alignment). */
    columnClassName?: (columnId: string) => string | undefined;
    columns: Array<ColumnDef<TRow>>;
    emptyIsGenuine?: boolean;
    emptyText: string;
    /** A rendered error (`ErrorState`, `SecReadinessNotice`) for a failed request; null / undefined = none. */
    errorState?: React.ReactNode;
    /** The "Export" menu above the table (rows as given; columns default to every field, flattened). */
    exportConfig?: ExportConfig<TRow>;
    /** The heading row of a group (its key and its rows); rendered with `groupOf`. */
    groupHeading?: (group: string, rows: ReadonlyArray<TRow>) => React.ReactNode;
    /**
     * Groups consecutive rows (the rows come sorted by group, e.g. the calendar's New York day): a full-width heading row
     * before each group that sticks below the pinned header from `lg` up (the column header then scrolls with the page).
     */
    groupOf?: (row: TRow) => string;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    isLoading: boolean;
    onLoadMore?: () => void;
    /** The list's operation: its cost on "Load more" and in the export's "load all". */
    operationId?: OperationId;
    rowClassName?: (row: TRow) => string | undefined;
    rows: Array<TRow>;
    stickyFirstColumn?: boolean;
}) {
    const table = useReactTable({ columns, data: rows, getCoreRowModel: getCoreRowModel() });

    const columnCount = Math.max(1, columns.length);

    const wrapper = React.useRef<HTMLDivElement>(null);

    const fits = useTableFits(wrapper, !stickyFirstColumn);

    const stickyHeader = !stickyFirstColumn && fits && !groupOf;

    const groupRows = React.useMemo(() => {
        const groups = new Map<string, Array<TRow>>();

        if (!groupOf) return groups;

        for (const row of rows) groups.set(groupOf(row), [...(groups.get(groupOf(row)) ?? []), row]);

        return groups;
    }, [groupOf, rows]);

    const firstColumn = (index: number) => (stickyFirstColumn && index === 0 ? "sticky left-0 z-10 bg-background" : undefined);

    const showSkeleton = isLoading && rows.length === 0 && !errorState;

    const showEmpty = !isLoading && rows.length === 0 && emptyIsGenuine && !errorState;

    return (
        <div className="flex min-w-0 flex-col" data-slot="data-table" ref={wrapper}>
            {exportConfig && (
                <div className="flex justify-end pb-2">
                    <ExportMenu
                        config={exportConfig}
                        failed={!!errorState}
                        hasNextPage={hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={onLoadMore}
                        operationId={operationId}
                        rows={rows}
                    />
                </div>
            )}
            <Table containerClassName={stickyHeader || (groupOf && fits) ? "lg:overflow-x-visible" : undefined}>
                <TableHeader className={cn(stickyHeader && cn("bg-background lg:sticky lg:z-20", LG_STICKY_TOP_CLASS))}>
                    {table.getHeaderGroups().map(headerGroup => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header, index) => (
                                <TableHead className={cn(firstColumn(index), columnClassName?.(header.column.id))} key={header.id}>
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map((row: Row<TRow>, rowIndex, all) => {
                        const group = groupOf?.(row.original);

                        const startsGroup = group !== undefined && (rowIndex === 0 || groupOf?.(all[rowIndex - 1].original) !== group);

                        return (
                            <React.Fragment key={row.id}>
                                {startsGroup && (
                                    <TableRow className="hover:bg-transparent" data-testid="data-table-group">
                                        <TableCell
                                            className={cn("bg-muted/95 supports-backdrop-filter:backdrop-blur py-1.5 font-medium lg:sticky lg:z-10", fits && LG_STICKY_TOP_CLASS)}
                                            colSpan={columnCount}
                                        >
                                            {groupHeading ? groupHeading(group, groupRows.get(group) ?? []) : group}
                                        </TableCell>
                                    </TableRow>
                                )}
                                <TableRow className={rowClassName?.(row.original)}>
                                    {row.getVisibleCells().map((cell, index) => (
                                        <TableCell className={cn(firstColumn(index), columnClassName?.(cell.column.id))} key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </React.Fragment>
                        );
                    })}

                    {showSkeleton && Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                        <TableRow data-testid="data-table-skeleton" key={`skeleton-${rowIndex}`}>
                            {Array.from({ length: columnCount }, (__, cellIndex) => (
                                <TableCell key={cellIndex}><Skeleton className="h-4 w-full min-w-8" /></TableCell>
                            ))}
                        </TableRow>
                    ))}

                    {showEmpty && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell className="text-muted-foreground text-center whitespace-normal" colSpan={columnCount}>{emptyText}</TableCell>
                        </TableRow>
                    )}

                    {errorState && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell className="whitespace-normal" colSpan={columnCount}>{errorState}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {onLoadMore && (
                <LoadMoreButton
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    loadedCount={rows.length}
                    onLoadMore={onLoadMore}
                    operationId={operationId}
                />
            )}
        </div>
    );
}
