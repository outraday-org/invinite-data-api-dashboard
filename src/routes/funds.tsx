import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";

import type { FundListState } from "@/components/sec/fund-views";
import type { V2FundListItem, V2FundsResponse, V2FundStructure, V2FundType } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2ListTable } from "@/components/sec/v2-list-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFunds } from "@/lib/api/queries";
import { FUND_STRUCTURE_LABELS, INSTRUMENT_TYPE_LABELS } from "@/lib/instruments";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { formatNumberEnCompact } from "@/lib/utils";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/funds")({
    component: FundsPage,
});

/** Funds per page of `/v1/funds` (one page per `next_cursor`). */
const FUNDS_PAGE = 50;

const ALL = "all";

const TYPE_OPTIONS = [
    { label: "All types", value: ALL },
    { label: INSTRUMENT_TYPE_LABELS.etf, value: "etf" },
    { label: INSTRUMENT_TYPE_LABELS.closed_end_fund, value: "closed_end_fund" },
] satisfies Array<{ label: string; value: typeof ALL | V2FundType }>;

const STRUCTURE_OPTIONS = [
    { label: "All structures", value: ALL },
    { label: FUND_STRUCTURE_LABELS.registered_fund, value: "registered_fund" },
    { label: FUND_STRUCTURE_LABELS.exchange_traded_trust, value: "exchange_traded_trust" },
] satisfies Array<{ label: string; value: typeof ALL | V2FundStructure }>;

const COLUMNS: Array<ColumnDef<V2FundListItem>> = [
    {
        cell: ({ row }) => (
            <Link className="font-medium underline-offset-4 hover:underline" params={{ ticker: row.original.symbol }} to="/$ticker">
                {row.original.symbol}
            </Link>
        ),
        header: "Symbol",
        id: "symbol",
    },
    { cell: ({ row }) => <div className="truncate">{row.original.name ?? "—"}</div>, header: "Name", id: "name" },
    {
        cell: ({ row }) => (
            <div className="flex gap-1">
                <Badge variant="secondary">{INSTRUMENT_TYPE_LABELS[row.original.type]}</Badge>
                {row.original.structure === "exchange_traded_trust" && <Badge variant="outline">Trust</Badge>}
            </div>
        ),
        header: "Type",
        id: "type",
    },
    { cell: ({ row }) => row.original.exchange ?? "—", header: "Exchange", id: "exchange" },
    {
        cell: ({ row }) => (
            <div className="text-right tabular-nums">{row.original.net_assets_usd == null ? "—" : `$${formatNumberEnCompact(row.original.net_assets_usd)}`}</div>
        ),
        header: () => <div className="text-right">Net assets</div>,
        id: "net_assets_usd",
    },
];

/** The fund list (pure): its state, the rows, "Load more". */
export function FundsList({ state }: { state: FundListState<V2FundsResponse> }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the funds" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2 h-full">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2ListTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No fund matches these filters."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                loadingText="Loading funds..."
                onLoadMore={onLoadMore}
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more funds" /> : null}
        </div>
    );
}

/**
 * The listed funds (Data API 7.0, `GET /v1/funds`): ETFs and closed-end funds with a ticker — an ETN is no fund and an
 * unlisted mutual fund is never a resource (owner decisions 4 and 13). Filters type, structure and a name / ticker
 * search; a row opens the fund's page.
 */
function FundsPage() {
    const [type, setType] = React.useState<typeof ALL | V2FundType>(ALL);

    const [structure, setStructure] = React.useState<typeof ALL | V2FundStructure>(ALL);

    const [draft, setDraft] = React.useState("");

    const [q, setQ] = React.useState("");

    React.useEffect(() => {
        const timer = window.setTimeout(() => setQ(draft.trim()), 250);

        return () => window.clearTimeout(timer);
    }, [draft]);

    const funds = useFunds({
        limit: FUNDS_PAGE,
        q,
        structure: structure === ALL ? undefined : [structure],
        type: type === ALL ? undefined : [type],
    });

    return (
        <div className="mx-auto flex w-full max-w-6xl grow flex-col gap-4 px-4 py-8 lg:px-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Funds</h1>
                <div className="text-muted-foreground text-sm">
                    Every listed ETF and closed-end fund. Exchange-traded trusts (gold, bitcoin, futures pools) file
                    no holdings report; the others show their holdings and weights.
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Search funds" className="w-[260px]" onChange={event => setDraft(event.target.value)} placeholder="Ticker or name" value={draft} />
                <FilterSelect className="w-[180px]" onValueChange={setType} options={TYPE_OPTIONS} value={type} />
                <FilterSelect className="w-[220px]" onValueChange={setStructure} options={STRUCTURE_OPTIONS} value={structure} />
            </div>
            <div className="relative flex h-[70vh] flex-col">
                <FundsList
                    state={{
                        error: funds.error,
                        hasNextPage: funds.hasNextPage,
                        isFetchingNextPage: funds.isFetchingNextPage,
                        isLoading: funds.isLoading,
                        onLoadMore: () => void funds.fetchNextPage(),
                        pages: funds.data?.pages ?? [],
                    }}
                />
            </div>
        </div>
    );
}
