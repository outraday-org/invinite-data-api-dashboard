import type { ColumnDef } from "@tanstack/react-table";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

/**
 * The table of a v2 cursor list (holdings, holding changes, insider trades, IPOs): rows, "Load more" by
 * `next_cursor`, and an empty line only when the answer's coverage is complete (`emptyIsGenuine`) — a pending /
 * partial answer's notice stands above the table instead.
 */
export function V2ListTable<TRow>({
    columns,
    emptyIsGenuine,
    emptyText,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    loadingText,
    onLoadMore,
    rows,
}: {
    columns: Array<ColumnDef<TRow>>;
    emptyIsGenuine: boolean;
    emptyText: string;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    loadingText: string;
    onLoadMore: () => void;
    rows: Array<TRow>;
}) {
    const table = useReactTable({ columns, data: rows, getCoreRowModel: getCoreRowModel() });

    return (
        <ScrollArea className="h-0 grow">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map(headerGroup => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map(row => (
                        <TableRow key={row.id}>
                            {row.getVisibleCells().map(cell => (
                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <LoadMoreButton hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onLoadMore={onLoadMore} />

            {!isLoading && emptyIsGenuine && rows.length === 0 && (
                <div className="text-muted-foreground w-full text-center text-xs p-2">{emptyText}</div>
            )}

            {isLoading && rows.length === 0 && (
                <div className="text-muted-foreground w-full text-center text-xs p-2">{loadingText}</div>
            )}
        </ScrollArea>
    );
}
