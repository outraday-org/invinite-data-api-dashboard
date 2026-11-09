import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import {

    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import type { V2Dividend } from "@/lib/api/types";

import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2DividendsInfinite } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

export const Route = createFileRoute("/$ticker/dividends/")({
    component: DividendsPage,
});

function DividendsPage() {
    const { ticker } = Route.useParams();

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2DividendsInfinite({
        company: ticker,
        limit: 40,
        sort: "-ex_date",
    });

    const dividends = React.useMemo(
        () => data?.pages.flatMap(page => page.data) ?? [],
        [data],
    );

    const currencyFormatter = React.useMemo(
        () => new Intl.NumberFormat("en", { currency: "USD", style: "currency" }),
        [],
    );

    const columns = React.useMemo<Array<ColumnDef<V2Dividend>>>(
        () => [
            {
                accessorKey: "ex_dividend_date",
                cell: ({ getValue }) => formatEnDateTime(String(getValue()), { hideTime: true }),
                header: "Ex-Date",
            },
            {
                accessorKey: "declaration_date",
                cell: ({ getValue }) => formatEnDateTime(String(getValue()), { hideTime: true }),
                header: "Declared",
            },
            {
                accessorKey: "record_date",
                cell: ({ getValue }) => formatEnDateTime(String(getValue()), { hideTime: true }),
                header: "Record",
            },
            {
                accessorKey: "pay_date",
                cell: ({ getValue }) => formatEnDateTime(String(getValue()), { hideTime: true }),
                header: "Payable",
            },
            {
                accessorKey: "frequency",
                cell: ({ getValue }) => {
                    const raw = Number(getValue());

                    const label = raw === 4
                        ? "Quarterly"
                        : raw === 2
                            ? "Semi-annual"
                            : raw === 1
                                ? "Annual"
                                : "-";

                    return <div>{label}</div>;
                },
                header: "Frequency",
            },
            {
                accessorKey: "cash_amount",
                cell: ({ getValue }) => {
                    const raw = Number(getValue());

                    const formatted = Number.isFinite(raw)
                        ? currencyFormatter.format(raw)
                        : "-";

                    return <div className="text-right tabular-nums">{formatted}</div>;
                },
                header: () => <div className="text-right">Amount</div>,
            },

        ],
        [currencyFormatter],
    );

    const table = useReactTable({
        columns,
        data: dividends,
        getCoreRowModel: getCoreRowModel(),
    });

    const getColumnClassName = (columnId: string) => {
        if (columnId === "cash_amount") {
            return "w-20 px-1";
        }

        if (columnId === "frequency") {
            return "w-24 px-1";
        }

        return undefined;
    };

    if (error) {
        return (
            <div className="space-y-4 relative flex flex-col h-0 grow">
                <ErrorState error={error} title="Failed to load dividends" />
            </div>
        );
    }

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col gap-1">
                <div>Dividends</div>
                <div className="text-muted-foreground text-sm">
                    Cash dividends sorted by ex-dividend date.
                </div>
            </div>

            <div className="flex flex-col h-0 grow">
                <ScrollArea className="h-0 grow">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map(headerGroup => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <TableHead
                                            className={getColumnClassName(header.column.id)}
                                            key={header.id}
                                        >
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
                                        <TableCell
                                            className={getColumnClassName(cell.column.id)}
                                            key={cell.id}
                                        >
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

                    {!isLoading && dividends.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            No dividends available.
                        </div>
                    )}

                    {isLoading && dividends.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            Loading dividends...
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}
