import type { ColumnDef, Row } from "@tanstack/react-table";
import type * as React from "react";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LG_STICKY_TOP_CLASS } from "@/lib/layout";
import { cn } from "@/lib/utils";

/** Skeleton rows shown while the first page loads. */
const SKELETON_ROWS = 5;

/**
 * The one table of the dashboard's lists (grown from `V2ListTable`): the page scrolls, not the table.
 *
 * - Header: sticks below the pinned top bar + ticker header (`STICKY_TOP_CLASS`) from `lg` up, where the table never
 *   needs a horizontal scroller. Below `lg` the wrapper scrolls sideways and the header scrolls with the page (a
 *   sticky header inside a horizontal scroller binds to the scroller — CSS cannot do both).
 * - `stickyFirstColumn` (wide tables: insider trades): the wrapper scrolls sideways at every width, the first column
 *   stays; the header is then never window-sticky (same CSS limit).
 * - States: skeleton rows while the first page loads, `errorState` in a full-width row (first page or a failed next
 *   page), the empty row only for a genuine empty answer (`emptyIsGenuine`: a pending / partial coverage's notice
 *   stands above the table instead), "Load more" with "N loaded" by `next_cursor`.
 */
export function DataTable<TRow>({
    columnClassName,
    columns,
    emptyIsGenuine = true,
    emptyText,
    errorState,
    hasNextPage = false,
    isFetchingNextPage = false,
    isLoading,
    onLoadMore,
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
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    isLoading: boolean;
    onLoadMore?: () => void;
    rowClassName?: (row: TRow) => string | undefined;
    rows: Array<TRow>;
    stickyFirstColumn?: boolean;
}) {
    const table = useReactTable({ columns, data: rows, getCoreRowModel: getCoreRowModel() });

    const columnCount = Math.max(1, columns.length);

    const firstColumn = (index: number) => (stickyFirstColumn && index === 0 ? "sticky left-0 z-10 bg-background" : undefined);

    const showSkeleton = isLoading && rows.length === 0 && !errorState;

    const showEmpty = !isLoading && rows.length === 0 && emptyIsGenuine && !errorState;

    return (
        <div className="flex flex-col" data-slot="data-table">
            <Table containerClassName={stickyFirstColumn ? undefined : "lg:overflow-x-visible"}>
                <TableHeader
                    className={cn(!stickyFirstColumn && cn("bg-background lg:sticky lg:z-20", LG_STICKY_TOP_CLASS))}
                >
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
                    {table.getRowModel().rows.map((row: Row<TRow>) => (
                        <TableRow className={rowClassName?.(row.original)} key={row.id}>
                            {row.getVisibleCells().map((cell, index) => (
                                <TableCell className={cn(firstColumn(index), columnClassName?.(cell.column.id))} key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}

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
                />
            )}
        </div>
    );
}
