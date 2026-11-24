import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { V2Coin } from "@/lib/api/types";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useCoinList } from "@/lib/api/coin-queries";
import { useKeyReady } from "@/lib/api/queries";
import { formatNumber } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalText } from "@/lib/url-state";

export const Route = createFileRoute("/spot-coins/")({
    component: CoinsPage,
    head: () => titleHead("Spot coins"),
    validateSearch: z.object({ q: optionalText(256) }),
});

const columns: Array<ColumnDef<V2Coin>> = [
    {
        accessorKey: "name",
        cell: ({ row: { original: coin } }) => (
            <Link className="font-medium underline-offset-4 hover:underline" params={{ coin: coin.slug }} to="/spot-coins/$coin">
                {coin.name}
            </Link>
        ),
        header: "Coin",
    },
    { accessorKey: "symbol", cell: ({ row }) => row.original.symbol ?? "—", header: "Symbol" },
    { accessorKey: "slug", header: "Coin ID" },
    { accessorKey: "market_cap_rank", cell: ({ row }) => formatNumber(row.original.market_cap_rank), header: "Market cap rank" },
    { accessorKey: "currency", header: "Quote currency" },
    { cell: ({ row }) => <Badge variant="outline">{row.original.is_active ? "Active" : "Inactive"}</Badge>, header: "Status", id: "status" },
];

function CoinsPage() {
    const { q = "" } = Route.useSearch();

    const navigate = Route.useNavigate();

    const query = useCoinList(q, useKeyReady());

    const rows = query.data?.pages.flatMap(page => page.data) ?? [];

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader description="Browse spot cryptocurrencies by name, symbol or coin ID." title="Spot coins" />
            <DebouncedInput aria-label="Search spot coins" className="w-full sm:w-72" onCommit={value => void navigate({ ...IN_PLACE, search: { q: value || undefined } })} placeholder="Name, symbol or coin ID" value={q} />
            {(!query.error || rows.length > 0) && (
                <DataTable
                    columns={columns}
                    emptyIsGenuine
                    emptyText={q ? "No coin matches this search." : "No spot coins are available."}
                    hasNextPage={query.hasNextPage}
                    isFetchingNextPage={query.isFetchingNextPage}
                    isLoading={query.isLoading}
                    onLoadMore={() => void query.fetchNextPage()}
                    operationId="listCoins"
                    rows={rows}
                />
            )}
            {query.error && <ErrorState error={query.error} title={rows.length ? "Failed to load more coins" : "Failed to load spot coins"} />}
        </div>
    );
}
