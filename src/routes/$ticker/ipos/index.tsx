import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import type { Ipo } from "@/lib/api/types";

import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIposInfinite } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

export const Route = createFileRoute("/$ticker/ipos/")({
    component: IposPage,
});

function IposPage() {
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useIposInfinite({
        limit: 40,
        sort: "desc",
    });

    const ipos = React.useMemo(
        () => data?.pages.flatMap(page => page.ipos) ?? [],
        [data],
    );

    const formatCurrency = React.useCallback((value: number, currency: null | string | undefined) => {
        if (!Number.isFinite(value)) return "-";

        if (!currency) {
            return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
        }

        try {
            return new Intl.NumberFormat("en", {
                currency,
                maximumFractionDigits: 2,
                style: "currency",
            }).format(value);
        }
        catch {
            return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
        }
    }, []);

    const columns = React.useMemo<Array<ColumnDef<Ipo>>>(
        () => [
            {
                accessorKey: "listing_date",
                cell: ({ getValue }) => {
                    const raw = getValue();

                    if (!raw) return "-";

                    return formatEnDateTime(String(raw), { hideTime: true });
                },
                header: "Listing Date",
            },
            {
                accessorKey: "ticker",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? raw : "-";
                },
                header: "Ticker",
            },
            {
                accessorKey: "issuer_name",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? raw : "-";
                },
                header: "Issuer",
            },
            {
                accessorKey: "primary_exchange",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? raw : "-";
                },
                header: "Exchange",
            },
            {
                accessorKey: "ipo_status",
                cell: ({ getValue }) => {
                    const raw = String(getValue() ?? "").trim();

                    return raw.length > 0 ? raw : "-";
                },
                header: "Status",
            },
            {
                accessorKey: "final_issue_price",
                cell: ({ row }) => {
                    const raw = Number(row.original.final_issue_price);

                    return (
                        <div className="text-right tabular-nums">
                            {formatCurrency(raw, row.original.currency_code)}
                        </div>
                    );
                },
                header: () => <div className="text-right">Issue Price</div>,
            },
            {
                accessorKey: "total_offer_size",
                cell: ({ row }) => {
                    const raw = Number(row.original.total_offer_size);

                    return (
                        <div className="text-right tabular-nums">
                            {formatCurrency(raw, row.original.currency_code)}
                        </div>
                    );
                },
                header: () => <div className="text-right">Offer Size</div>,
            },
        ],
        [formatCurrency],
    );

    const table = useReactTable({
        columns,
        data: ipos,
        getCoreRowModel: getCoreRowModel(),
    });

    const getColumnClassName = (columnId: string) => {
        if (columnId === "final_issue_price" || columnId === "total_offer_size") {
            return "w-28 px-1";
        }

        return undefined;
    };

    if (error) {
        return (
            <div className="space-y-4 relative flex flex-col h-0 grow">
                <ErrorState error={error} title="Failed to load IPOs" />
            </div>
        );
    }

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col gap-1">
                <div>IPOs</div>
                <div className="text-muted-foreground text-sm">
                    IPO calendar sorted by listing date (future to past).
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

                    {!isLoading && ipos.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            No IPOs available.
                        </div>
                    )}

                    {isLoading && ipos.length === 0 && (
                        <div className="text-muted-foreground w-full text-center text-xs p-2">
                            Loading IPOs...
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}
