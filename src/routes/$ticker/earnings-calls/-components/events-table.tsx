import type { ColumnDef } from "@tanstack/react-table";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import type { EarningsEvent } from "@/lib/api/types";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 8;

/** The calendar's and the company page's table: `Skeleton` rows while the first page loads. */
export function EventsTable<T extends EarningsEvent>({
    columns,
    events,
    isLoading,
    rowClassName,
}: {
    columns: Array<ColumnDef<T>>;
    events: Array<T>;
    isLoading: boolean;
    rowClassName?: (event: T) => string | undefined;
}) {
    const table = useReactTable({
        columns,
        data: events,
        getCoreRowModel: getCoreRowModel(),
        getRowId: event => event.event_id,
    });

    return (
        <Table>
            <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                            <TableHead key={header.id}>
                                {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                        ))}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {isLoading && events.length === 0
                    ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                            <TableRow key={index}>
                                {columns.map((_column, cellIndex) => (
                                    <TableCell key={cellIndex}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    : table.getRowModel().rows.map(row => (
                            <TableRow className={rowClassName?.(row.original)} key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
            </TableBody>
        </Table>
    );
}
