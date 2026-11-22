import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2InsiderSide, V2InsiderTrade, V2InsiderTradeDetail, V2InsiderTradesResponse } from "@/lib/api/types";

import { FactGrid } from "@/components/sec/ownership-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copyable } from "@/components/ui/copy-button";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsiderTrade, useV2InsiderTradesInfinite } from "@/lib/api/queries";
import { formatDay, formatInstant, formatMoney, formatShares } from "@/lib/format";
import { tickerHead } from "@/lib/layout";
import { insiderCodeLegend, insiderCodeText, yesNoText as yesNo } from "@/lib/sec/ownership";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalDay, optionalEnum, optionalText, orderedWindow } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const KINDS = ["derivative", "non_derivative"] as const;

type Kind = (typeof KINDS)[number];

/**
 * `?side=buy|sell`, `?from=&to=` (filed days), `?tfrom=&tto=` (transaction days), `?kind=derivative|non_derivative`,
 * `?sort=oldest` (oldest filed first; default newest), `?trade=<id>` (the open row detail).
 */
const insiderSearchSchema = z.object({
    from: optionalDay(),
    kind: optionalEnum(KINDS),
    side: optionalEnum(["buy", "sell"] as const satisfies ReadonlyArray<V2InsiderSide>),
    sort: optionalEnum(["oldest"]),
    tfrom: optionalDay(),
    to: optionalDay(),
    trade: optionalText(200),
    tto: optionalDay(),
});

type InsiderSearch = z.infer<typeof insiderSearchSchema>;

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

const KIND_OPTIONS: Array<{ label: string; value: Kind | typeof ALL }> = [
    { label: "Every line", value: ALL },
    { label: "Non-derivative (shares)", value: "non_derivative" },
    { label: "Derivative (options, RSUs)", value: "derivative" },
];

const NEWEST = "newest";

const SORT_OPTIONS: Array<{ label: string; value: "oldest" | typeof NEWEST }> = [
    { label: "Newest filed first", value: NEWEST },
    { label: "Oldest filed first", value: "oldest" },
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

/** The transaction code and the derivative marker in one cell (the legend under the table says what each means). */
function CodeCell({ trade }: { trade: V2InsiderTrade }) {
    return (
        <div className="flex items-center gap-1">
            <span className="font-medium" title={insiderCodeText(trade.coding_code) ?? undefined}>{trade.coding_code}</span>
            {trade.is_derivative && <Badge title="A derivative-security line (option, RSU, warrant)" variant="outline">Deriv.</Badge>}
        </div>
    );
}

/** The table's columns; `onOpen` adds the row detail button. */
export function insiderColumns(onOpen?: (trade: V2InsiderTrade) => void): Array<ColumnDef<V2InsiderTrade>> {
    const columns: Array<ColumnDef<V2InsiderTrade>> = [
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
            cell: ({ row }) => <CodeCell trade={row.original} />,
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

    if (onOpen) {
        columns.push({
            cell: ({ row }) => (
                <Button aria-label={`Details of ${row.original.reporting_person_name}'s line`} onClick={() => onOpen(row.original)} size="xs" type="button" variant="outline">
                    Details
                </Button>
            ),
            header: "",
            id: "details",
        });
    }

    return columns;
}

/** The legend of the loaded rows' codes and the derivative marker. */
export function InsiderCodeLegend({ rows }: { rows: ReadonlyArray<V2InsiderTrade> }) {
    const legend = insiderCodeLegend(rows.map(row => row.coding_code));

    if (legend.length === 0) return null;

    return (
        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs" data-testid="insider-code-legend">
            {legend.map(({ code, label }) => (
                <span key={code}>
                    <span className="text-foreground font-medium">{code}</span>
                    {` ${label}`}
                </span>
            ))}
            {rows.some(row => row.is_derivative) && (
                <span>
                    <span className="text-foreground font-medium">Deriv.</span>
                    {" a derivative-security line (option, RSU, warrant)"}
                </span>
            )}
        </div>
    );
}

/**
 * The insider trades list (pure): the request's honest state (404 `not_covered` = no trade ever stored for the
 * company, 403 `excluded`, 503 `unavailable`, plan gate), the coverage of the answer, the rows, the code legend and
 * "Load more".
 */
export function InsiderTradesView({
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onLoadMore,
    onOpen,
    pages,
    symbol,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    /** Opens a row's detail (`/v1/insider-trades/{id}`). */
    onOpen?: (trade: V2InsiderTrade) => void;
    pages: ReadonlyArray<V2InsiderTradesResponse>;
    /** The export's file-name scope (the page's ticker). */
    symbol?: string;
}) {
    const rows = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    const columns = React.useMemo(() => insiderColumns(onOpen), [onOpen]);

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load insider trades" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <DataTable
                columns={columns}
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
            <InsiderCodeLegend rows={rows} />
            {error ? <SecReadinessNotice error={error} title="Failed to load more insider trades" /> : null}
        </div>
    );
}

const OWNERSHIP_FORMS: Record<NonNullable<V2InsiderTradeDetail["direct_indirect"]>, string> = { D: "Direct", I: "Indirect" };

const SOURCE_LABELS: Record<V2InsiderTradeDetail["source"], string> = {
    f345: "SEC Form 3/4/5 data set",
    sec_api: "Realtime Form 4 feed",
};

/**
 * One insider transaction line in full (pure, `GET /v1/insider-trades/{id}`): the 10b5-1 plan flag, the ownership form
 * and nature, the derivative's terms, holdings before / after, the filing's footnotes. A realtime-feed row leaves the
 * dataset's fields null (dash-free: they are left out).
 */
export function InsiderTradeDetailView({ docsLink, trade }: { docsLink?: React.ReactNode; trade: V2InsiderTradeDetail }) {
    const ownership = trade.direct_indirect ? OWNERSHIP_FORMS[trade.direct_indirect] : null;

    const accession = (
        <span className="flex flex-wrap items-center gap-2">
            <Copyable label="Copy accession number" value={trade.accession_number} />
            {docsLink}
        </span>
    );

    const facts: Array<readonly [string, React.ReactNode]> = [
        ["Insider", trade.reporting_person_name],
        ["Role", insiderRoles(trade)],
        ["Owner CIK", trade.owner_cik ? <Copyable label="Copy owner CIK" value={trade.owner_cik} /> : null],
        ["Security", trade.security_title],
        ["Side", `${SIDE_LABELS[trade.side]} (${trade.acquired_disposed === "A" ? "acquired" : "disposed"})`],
        ["Code", insiderCodeText(trade.coding_code)],
        ["10b5-1 plan", yesNo(trade.is_10b5_1)],
        ["Ownership", ownership && (trade.nature_of_ownership ? `${ownership} · ${trade.nature_of_ownership}` : ownership)],
        ["Traded", trade.transaction_date ? formatDay(trade.transaction_date) : null],
        ["Deemed execution", trade.deemed_execution_date ? formatDay(trade.deemed_execution_date) : null],
        ["Shares", count(trade.shares)],
        ["Price", trade.share_price == null ? null : money(trade.share_price)],
        ["Total", trade.total == null ? null : money(trade.total)],
        ["Owned before", trade.shares_owned_before_transaction == null ? null : count(trade.shares_owned_before_transaction)],
        ["Owned after", count(trade.shares_owned_following_transaction)],
        ["Derivative", yesNo(trade.is_derivative)],
        ["Exercise / conversion price", trade.conversion_exercise_price == null ? null : money(trade.conversion_exercise_price)],
        ["Exercisable from", trade.exercise_date ? formatDay(trade.exercise_date) : null],
        ["Expires", trade.expiration_date ? formatDay(trade.expiration_date) : null],
        ["Underlying", trade.underlying_security_title],
        ["Underlying shares", trade.underlying_shares == null ? null : count(trade.underlying_shares)],
        ["Period of report", trade.period_of_report ? formatDay(trade.period_of_report) : null],
        ["Filed", formatInstant(trade.filed_at)],
        ["Accession", accession],
        ["Source", SOURCE_LABELS[trade.source]],
    ];

    return (
        <div className="flex flex-col gap-3 text-sm" data-testid="insider-trade-detail">
            <FactGrid facts={facts} />
            {(trade.footnotes?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="text-xs font-medium">Footnotes</div>
                    <ol className="text-muted-foreground flex flex-col gap-1 text-xs">
                        {trade.footnotes?.map(note => (
                            <li key={note.id}>
                                <span className="text-foreground font-medium">{`${note.id} `}</span>
                                {note.text}
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}

/** The row detail dialog: the loaded row at once, then the line as `/v1/insider-trades/{id}` answers it. */
function InsiderTradeDialog({ id, onClose, row, ticker }: { id: null | string; onClose: () => void; row: null | V2InsiderTrade; ticker: string }) {
    const { data, error, isLoading } = useInsiderTrade(id ?? "");

    const shown = data ?? row;

    return (
        <Dialog onOpenChange={open => !open && onClose()} open={id !== null}>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{shown?.reporting_person_name ?? "Insider trade"}</DialogTitle>
                </DialogHeader>
                {shown
                    ? (
                            <InsiderTradeDetailView
                                docsLink={(
                                    <Link className="text-primary text-xs underline-offset-4 hover:underline" params={{ ticker }} search={{ docs: shown.accession_number }} to="/$ticker/filings">
                                        Open the filing
                                    </Link>
                                )}
                                trade={shown}
                            />
                        )
                    : isLoading && <Skeleton className="h-40 w-full" />}
                {error ? <SecReadinessNotice error={error} title="Failed to load the trade" /> : null}
            </DialogContent>
        </Dialog>
    );
}

/**
 * `/v1/insider-trades?company=<ticker>` for a search state: the day filters are sent as days (`filed_at.gte` / `.lte`,
 * `transaction_date.gte` / `.lte`), each range put in order.
 */
export function insiderTradesRequest(ticker: string, search: InsiderSearch) {
    const { from, to } = orderedWindow({ from: search.from, to: search.to });

    const traded = orderedWindow({ from: search.tfrom, to: search.tto });

    return {
        company: ticker,
        from,
        isDerivative: search.kind ? search.kind === "derivative" : undefined,
        limit: INSIDER_PAGE,
        side: search.side,
        sort: search.sort === "oldest" ? ("filed_at" as const) : undefined,
        to,
        tradedFrom: traded.from,
        tradedTo: traded.to,
    };
}

function InsiderTradesPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const { from = "", side = ALL, tfrom = "", to = "", tto = "" } = search;

    const kind = search.kind ?? ALL;

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<InsiderSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2InsiderTradesInfinite(insiderTradesRequest(ticker, search));

    const pages = React.useMemo(() => data?.pages ?? [], [data]);

    const openRow = React.useMemo(
        () => (search.trade ? (pages.flatMap(page => page.data).find(row => row.id === search.trade) ?? null) : null),
        [pages, search.trade],
    );

    const onOpen = React.useCallback((trade: V2InsiderTrade) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, trade: trade.id }) }), [navigate]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <FilterSelect aria-label="Side" className="w-[170px]" onValueChange={(value: SideFilter) => onChange({ side: value === ALL ? undefined : value })} options={SIDE_OPTIONS} value={side} />
                        <FilterSelect aria-label="Line kind" className="w-[200px]" onValueChange={value => onChange({ kind: value === ALL ? undefined : value })} options={KIND_OPTIONS} value={kind} />
                        <FilterSelect aria-label="Order" className="w-[170px]" onValueChange={value => onChange({ sort: value === NEWEST ? undefined : value })} options={SORT_OPTIONS} value={search.sort ?? NEWEST} />
                        <DayRange from={from} group labels={{ from: "Filed from", to: "Filed to" }} lead="Filed" onChange={onChange} titled to={to} />
                        <DayRange
                            from={tfrom}
                            group
                            labels={{ from: "Traded from", to: "Traded to" }}
                            lead="Traded"
                            onChange={patch => onChange("from" in patch ? { tfrom: patch.from } : { tto: patch.to })}
                            titled
                            to={tto}
                        />
                    </>
                )}
                description="Insider transactions from Forms 3, 4 and 5. A traded-day filter leaves out lines without a transaction date (the realtime feed's)."
                title="Insider Trades"
            />

            <InsiderTradesView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => fetchNextPage()}
                onOpen={onOpen}
                pages={pages}
                symbol={ticker}
            />

            <InsiderTradeDialog id={search.trade ?? null} onClose={() => onChange({ trade: undefined })} row={openRow} ticker={ticker} />
        </div>
    );
}
