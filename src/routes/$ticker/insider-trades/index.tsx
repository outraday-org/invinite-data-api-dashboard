import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2InsiderSide, V2InsiderTrade, V2InsiderTradesResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { Copyable } from "@/components/ui/copy-button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useV2InsiderTradesInfinite } from "@/lib/api/queries";
import { formatDay, formatInstant, formatMoney, formatShares } from "@/lib/format";
import { tickerHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalDay, optionalEnum } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

/** `?side=buy|sell&from=&to=` (filed day range, New York days as typed). */
const insiderSearchSchema = z.object({
    from: optionalDay(),
    side: optionalEnum(["buy", "sell"] as const satisfies ReadonlyArray<V2InsiderSide>),
    to: optionalDay(),
});

export const Route = createFileRoute("/$ticker/insider-trades/")({
    component: InsiderTradesPage,
    head: ({ params }) => tickerHead(params.ticker, "Insider Trades"),
    validateSearch: insiderSearchSchema,
});

/** Trades per page of `/v1/insider-trades` (one page per `next_cursor`). */
const INSIDER_PAGE = 50;

const ALL = "all";

type SideFilter = typeof ALL | V2InsiderSide;

const SIDE_OPTIONS: Array<{ label: string; value: SideFilter }> = [
    { label: "Buys and sells", value: ALL },
    { label: "Buys (acquired)", value: "buy" },
    { label: "Sells (disposed)", value: "sell" },
];

const SIDE_LABELS: Record<V2InsiderSide, string> = { buy: "Buy", sell: "Sell" };

const money = (value: null | number) => formatMoney(value);

const count = (value: null | number | undefined) => formatShares(value);

/** The insider's roles in words ("Officer (Chief Executive Officer)", "Director", "10% Owner", the other text). */
export function insiderRoles(trade: V2InsiderTrade) {
    const roles: Array<string> = [];

    if (trade.reporting_person_is_director) roles.push("Director");

    if (trade.reporting_person_is_officer) {
        const title = trade.reporting_person_officer_title?.trim();

        roles.push(title ? `Officer (${title})` : "Officer");
    }

    if (trade.reporting_person_is_ten_percent_owner) roles.push("10% Owner");

    if (trade.reporting_person_is_other) roles.push(trade.reporting_person_other_text?.trim() || "Other");

    return roles.length > 0 ? roles.join(", ") : "—";
}

const COLUMNS: Array<ColumnDef<V2InsiderTrade>> = [
    {
        accessorKey: "filed_at",
        cell: ({ row }) => formatInstant(row.original.filed_at),
        header: "Filed",
    },
    {
        // The Form 3/4/5 dataset's transaction date (release 5.7); realtime sec-api rows carry none.
        accessorKey: "transaction_date",
        cell: ({ row }) => formatDay(row.original.transaction_date),
        header: "Traded",
    },
    {
        accessorKey: "reporting_person_name",
        cell: ({ row }) => <div className="truncate">{row.original.reporting_person_name}</div>,
        header: "Insider",
    },
    {
        // One row per reporting owner of a joint filing; sec-api rows carry no owner CIK.
        accessorKey: "owner_cik",
        cell: ({ row }) => (row.original.owner_cik
            ? <Copyable className="tabular-nums" label="Copy owner CIK" value={row.original.owner_cik} />
            : <div className="tabular-nums">—</div>),
        header: "Owner CIK",
    },
    {
        cell: ({ row }) => <div className="truncate">{insiderRoles(row.original)}</div>,
        header: "Role",
        id: "role",
    },
    {
        accessorKey: "security_title",
        cell: ({ row }) => <div className="truncate">{row.original.security_title}</div>,
        header: "Security",
    },
    {
        accessorKey: "side",
        cell: ({ row }) => (
            <Badge variant={row.original.side === "buy" ? "secondary" : "outline"}>{SIDE_LABELS[row.original.side]}</Badge>
        ),
        header: "Side",
    },
    {
        accessorKey: "is_derivative",
        cell: ({ row }) => (row.original.is_derivative ? <Badge variant="outline">Derivative</Badge> : "—"),
        header: "Derivative",
    },
    {
        accessorKey: "coding_code",
        header: "Code",
    },
    {
        accessorKey: "shares",
        cell: ({ row }) => <div className="text-right tabular-nums">{count(row.original.shares)}</div>,
        header: () => <div className="text-right">Shares</div>,
    },
    {
        accessorKey: "share_price",
        cell: ({ row }) => <div className="text-right tabular-nums">{money(row.original.share_price)}</div>,
        header: () => <div className="text-right">Price</div>,
    },
    {
        accessorKey: "total",
        cell: ({ row }) => <div className="text-right tabular-nums">{money(row.original.total)}</div>,
        header: () => <div className="text-right">Total</div>,
    },
    {
        accessorKey: "shares_owned_following_transaction",
        cell: ({ row }) => <div className="text-right tabular-nums">{count(row.original.shares_owned_following_transaction)}</div>,
        header: () => <div className="text-right">Owned After</div>,
    },
];

/**
 * The insider trades list (pure): the request's honest state (404 `not_covered` = no trade ever stored for the
 * company, 403 `excluded`, 503 `unavailable`, plan gate), the coverage of the answer, the rows and "Load more".
 */
export function InsiderTradesView({
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onLoadMore,
    pages,
    symbol,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2InsiderTradesResponse>;
    /** The export's file-name scope (the page's ticker). */
    symbol?: string;
}) {
    const rows = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load insider trades" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <DataTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No insider trades for these filters."
                exportConfig={symbol ? { dataset: "insider-trades", scope: symbol } : undefined}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listInsiderTrades"
                rows={rows}
                stickyFirstColumn
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more insider trades" /> : null}
        </div>
    );
}

function InsiderTradesPage() {
    const { ticker } = Route.useParams();

    const { from = "", side = ALL, to = "" } = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: z.infer<typeof insiderSearchSchema>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    // `/v1/insider-trades?company=<ticker>`, newest filed first; the day range = `filed_at.gte` / `.lt` the next midnight.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2InsiderTradesInfinite({
        company: ticker,
        from: from || undefined,
        limit: INSIDER_PAGE,
        side: side === ALL ? undefined : side,
        to: to || undefined,
    });

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <FilterSelect className="w-[170px]" onValueChange={(value: SideFilter) => onChange({ side: value === ALL ? undefined : value })} options={SIDE_OPTIONS} value={side} />
                        <Input aria-label="Filed from" className="w-[150px]" onChange={e => onChange({ from: e.target.value || undefined })} type="date" value={from} />
                        <span className="text-muted-foreground">to</span>
                        <Input aria-label="Filed to" className="w-[150px]" onChange={e => onChange({ to: e.target.value || undefined })} type="date" value={to} />
                    </>
                )}
                description="Insider transactions, newest filing first."
                title="Insider Trades"
            />

            <InsiderTradesView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={data?.pages ?? []}
                symbol={ticker}
            />
        </div>
    );
}
