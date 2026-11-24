import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Split } from "@/lib/api/types";

import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useV2SplitsInfinite } from "@/lib/api/queries";
import { DASH, formatDay, formatNumber } from "@/lib/format";
import { tickerHead } from "@/lib/layout";

export const Route = createFileRoute("/$ticker/stock-splits/")({
    component: StockSplitsPage,
    head: ({ params }) => tickerHead(params.ticker, "Splits"),
});

/** "4:1" (post-split : pre-split shares), "—" when either side is missing. */
export function splitRatioText(split: Pick<V2Split, "split_from" | "split_to">) {
    const { split_from: from, split_to: to } = split;

    return Number.isFinite(from) && Number.isFinite(to) ? `${formatNumber(to)}:${formatNumber(from)}` : DASH;
}

const COLUMNS: Array<ColumnDef<V2Split>> = [
    { cell: ({ row }) => formatDay(row.original.execution_date), header: "Execution date", id: "execution_date" },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{formatNumber(row.original.split_from)}</div>,
        header: () => <div className="text-right">Split from</div>,
        id: "split_from",
    },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{formatNumber(row.original.split_to)}</div>,
        header: () => <div className="text-right">Split to</div>,
        id: "split_to",
    },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{splitRatioText(row.original)}</div>,
        header: () => <div className="text-right">Ratio</div>,
        id: "split_ratio",
    },
];

function StockSplitsPage() {
    const { ticker } = Route.useParams();

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2SplitsInfinite({
        limit: 40,
        sort: "-execution_date",
        symbol: ticker,
    });

    const splits = React.useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

    return (
        <div className="flex flex-col gap-6">
            {/* Splits of any instrument (a stock, an ETF, an ETN): never "stock split" ([FU2870]). */}
            <PageHeader description="Split history, newest execution date first." title="Splits" />
            <DataTable
                columns={COLUMNS}
                emptyText="No splits available."
                errorState={error ? <ErrorState error={error} title="Failed to load splits" /> : null}
                exportConfig={{ dataset: "splits", scope: ticker }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => void fetchNextPage()}
                operationId="listSplits"
                rows={splits}
            />
        </div>
    );
}
