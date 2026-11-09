import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import type { V2Split } from "@/lib/api/types";

import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2SplitsInfinite } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

export const Route = createFileRoute("/$ticker/stock-splits/")({
    component: StockSplitsPage,
});

function StockSplitsPage() {
    const { ticker } = Route.useParams();

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2SplitsInfinite({
        company: ticker,
        limit: 40,
        sort: "-execution_date",
    });

    const splits = React.useMemo(
        () => data?.pages.flatMap(page => page.data) ?? [],
        [data],
    );

    const columns = React.useMemo<Array<ColumnDef<V2Split>>>(
        () => [
            {
                accessorKey: "execution_date",
                cell: ({ getValue }) => {
                    const raw = getValue();

                    if (!raw) {
                        return "-";
                    }

                    return formatEnDateTime(String(raw), { hideTime: true });
                },
                header: "Execution Date",
            },
            {
                accessorKey: "split_from",
                cell: ({ getValue }) => {
                    const raw = Number(getValue());

                    return <div className="text-right tabular-nums">{Number.isFinite(raw) ? raw : "-"}</div>;
                },
                header: () => <div className="text-right">Split From</div>,
            },
            {
                accessorKey: "split_to",
                cell: ({ getValue }) => {
                    const raw = Number(getValue());

                    return <div className="text-right tabular-nums">{Number.isFinite(raw) ? raw : "-"}</div>;
                },
                header: () => <div className="text-right">Split To</div>,
            },
            {
                cell: ({ row }) => {
                    const splitFrom = Number(row.original.split_from);

                    const splitTo = Number(row.original.split_to);

                    const ratio = Number.isFinite(splitFrom) && Number.isFinite(splitTo)
                        ? `${splitTo}:${splitFrom}`
                        : "-";

                    return <div className="text-right tabular-nums">{ratio}</div>;
                },
                header: () => <div className="text-right">Ratio</div>,
                id: "split_ratio",
            },
        ],
        [],
    );

    const table = useReactTable({
        columns,
        data: splits,
        getCoreRowModel: getCoreRowModel(),
    });

    if (error) {
        return (
            <div className="space-y-4 relative flex flex-col h-0 grow">
                <ErrorState error={error} title="Failed to load stock splits" />
            </div>
        );
    }

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col gap-1">
                <div>Stock Splits</div>
                <div className="text-muted-foreground text-sm">
                    Stock split history sorted by execution date.
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

                    {!isLoading && splits.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            No stock splits available.
                        </div>
                    )}

                    {isLoading && splits.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            Loading stock splits...
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}
