import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2InsiderSide, V2InsiderTrade, V2InsiderTradesResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2ListTable } from "@/components/sec/v2-list-table";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useV2InsiderTradesInfinite } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { formatNumberEn } from "@/lib/utils";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/$ticker/insider-trades/")({
    component: InsiderTradesPage,
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

const currency = new Intl.NumberFormat("en", { currency: "USD", style: "currency" });

const money = (value: null | number) => (value === null || !Number.isFinite(value) ? "—" : currency.format(value));

const count = (value: null | number | undefined) => (value === null || value === undefined || !Number.isFinite(value) ? "—" : formatNumberEn(value));

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
        cell: ({ row }) => formatEnDateTime(row.original.filed_at, { hideTime: false }),
        header: "Filed",
    },
    {
        accessorKey: "reporting_person_name",
        cell: ({ row }) => <div className="truncate">{row.original.reporting_person_name}</div>,
        header: "Insider",
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
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2InsiderTradesResponse>;
}) {
    const rows = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load insider trades" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2 h-0 grow">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <V2ListTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No insider trades for these filters."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                loadingText="Loading insider trades..."
                onLoadMore={onLoadMore}
                rows={rows}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more insider trades" /> : null}
        </div>
    );
}

function InsiderTradesPage() {
    const { ticker } = Route.useParams();

    const [side, setSide] = React.useState<SideFilter>(ALL);

    const [from, setFrom] = React.useState("");

    const [to, setTo] = React.useState("");

    // `/v1/insider-trades?company=<ticker>`, newest filed first; the day range = `filed_at.gte` / `.lt` the next midnight.
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2InsiderTradesInfinite({
        company: ticker,
        from: from || undefined,
        limit: INSIDER_PAGE,
        side: side === ALL ? undefined : side,
        to: to || undefined,
    });

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <div>Insider Trades</div>
                    <div className="text-muted-foreground text-sm">
                        Insider transactions sorted by filing time (newest first).
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <FilterSelect className="w-[170px]" onValueChange={setSide} options={SIDE_OPTIONS} value={side} />
                    <Input aria-label="Filed from" className="w-[150px]" onChange={e => setFrom(e.target.value)} type="date" value={from} />
                    <span className="text-muted-foreground text-xs">to</span>
                    <Input aria-label="Filed to" className="w-[150px]" onChange={e => setTo(e.target.value)} type="date" value={to} />
                </div>
            </div>

            <InsiderTradesView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                pages={data?.pages ?? []}
            />
        </div>
    );
}
