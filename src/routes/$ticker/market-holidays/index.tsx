import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import * as React from "react";

import type { V2MarketHoliday } from "@/lib/api/types";

import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2MarketHolidaysInfinite } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

export const Route = createFileRoute("/$ticker/market-holidays/")({
    component: MarketHolidaysPage,
});

function MarketHolidaysPage() {
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2MarketHolidaysInfinite({
        limit: 40,
        sort: "-date",
    });

    const holidays = React.useMemo(
        () => data?.pages.flatMap(page => page.data) ?? [],
        [data],
    );

    const columns = React.useMemo<Array<ColumnDef<V2MarketHoliday>>>(
        () => [
            {
                accessorKey: "day",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? formatEnDateTime(raw, { hideTime: true }) : "-";
                },
                header: "Date",
            },
            {
                accessorKey: "event_name",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? raw : "-";
                },
                header: "Holiday",
            },
            {
                accessorKey: "start_time",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? raw : "-";
                },
                header: "Start Time",
            },
            {
                accessorKey: "end_time",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? raw : "-";
                },
                header: "End Time",
            },
        ],
        [],
    );

    const table = useReactTable({
        columns,
        data: holidays,
        getCoreRowModel: getCoreRowModel(),
    });

    if (error) {
        return (
            <div className="space-y-4 relative flex flex-col h-0 grow">
                <ErrorState error={error} title="Failed to load market holidays" />
            </div>
        );
    }

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col gap-1">
                <div>Market Holidays</div>
                <div className="text-muted-foreground text-sm">
                    Market holiday calendar sorted by date (future to past).
                </div>
            </div>

            <div className="flex flex-col h-0 grow">
                <ScrollArea className="h-0 grow">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map(headerGroup => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext(),
                                                    )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.map(row => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <LoadMoreButton
                        hasNextPage={Boolean(hasNextPage)}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={() => fetchNextPage()}
                    />

                    {!isLoading && holidays.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            No market holidays available.
                        </div>
                    )}

                    {isLoading && holidays.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            Loading market holidays...
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}
