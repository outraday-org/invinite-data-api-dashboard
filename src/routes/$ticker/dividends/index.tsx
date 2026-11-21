import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Dividend } from "@/lib/api/types";

import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useV2DividendsInfinite } from "@/lib/api/queries";
import { formatDay, formatMoney } from "@/lib/format";
import { tickerHead } from "@/lib/layout";

export const Route = createFileRoute("/$ticker/dividends/")({
    component: DividendsPage,
    head: ({ params }) => tickerHead(params.ticker, "Dividends"),
});

const FREQUENCY_LABELS: Record<number, string> = {
    1: "Annual",
    2: "Semi-annual",
    4: "Quarterly",
    12: "Monthly",
};

/** The payment frequency per year in words ("Quarterly"); an undocumented count as "N× a year"; none = "—". */
export function dividendFrequencyLabel(frequency: null | number | undefined) {
    if (frequency === null || frequency === undefined || !Number.isFinite(frequency) || frequency <= 0) return "—";

    return FREQUENCY_LABELS[frequency] ?? `${frequency}× a year`;
}

const COLUMNS: Array<ColumnDef<V2Dividend>> = [
    { cell: ({ row }) => formatDay(row.original.ex_dividend_date), header: "Ex-Date", id: "ex_dividend_date" },
    { cell: ({ row }) => formatDay(row.original.declaration_date), header: "Declared", id: "declaration_date" },
    { cell: ({ row }) => formatDay(row.original.record_date), header: "Record", id: "record_date" },
    { cell: ({ row }) => formatDay(row.original.pay_date), header: "Payable", id: "pay_date" },
    { cell: ({ row }) => dividendFrequencyLabel(row.original.frequency), header: "Frequency", id: "frequency" },
    {
        // Per-share amounts keep up to 4 decimals ($0.2625).
        cell: ({ row }) => <div className="text-right tabular-nums">{formatMoney(row.original.cash_amount, { maximumFractionDigits: 4 })}</div>,
        header: () => <div className="text-right">Amount</div>,
        id: "cash_amount",
    },
];

function DividendsPage() {
    const { ticker } = Route.useParams();

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2DividendsInfinite({
        limit: 40,
        sort: "-ex_date",
        symbol: ticker,
    });

    const dividends = React.useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader description="Cash dividends, newest ex-dividend date first." title="Dividends" />
            <DataTable
                columns={COLUMNS}
                emptyText="No dividends available."
                errorState={error ? <ErrorState error={error} title="Failed to load dividends" /> : null}
                exportConfig={{ dataset: "dividends", scope: ticker }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => void fetchNextPage()}
                operationId="listDividends"
                rows={dividends}
            />
        </div>
    );
}
