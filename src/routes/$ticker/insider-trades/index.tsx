import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import type { DetailFact } from "@/components/sec/ownership-views";
import type { V2InsiderHolding, V2InsiderHoldingsResponse, V2InsiderSide, V2InsiderTrade, V2InsiderTradeDetail, V2InsiderTradesResponse } from "@/lib/api/types";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { FactGrid, statedFacts } from "@/components/sec/ownership-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copyable } from "@/components/ui/copy-button";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInsiderTrade, useV2InsiderHoldingsInfinite, useV2InsiderTradesInfinite } from "@/lib/api/queries";
import { formatDay, formatInstant, formatMoney, formatShares } from "@/lib/format";
import { tickerHead, WRAPPING_TABS_LIST_CLASS } from "@/lib/layout";
import { ignoredCikTokens, insiderCodeLegend, insiderCodeText, parseCikList, yesNoText as yesNo } from "@/lib/sec/ownership";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalDay, optionalEnum, optionalText, orderedWindow } from "@/lib/url-state";

const KINDS = ["derivative", "non_derivative"] as const;

type Kind = (typeof KINDS)[number];

const TABS = ["trades", "holdings"] as const;

type Tab = (typeof TABS)[number];

/**
 * `?tab=holdings` (default trades), `?owner=<CIK list>` (reporting owners, both tabs), `?kind=derivative|non_derivative`
 * and `?sort=oldest` (both tabs: oldest filed / reported first; default newest); the trades tab's `?side=buy|sell`,
 * `?from=&to=` (filed days), `?tfrom=&tto=` (transaction days) and `?trade=<id>` (the open row detail).
 */
const insiderSearchSchema = z.object({
    from: optionalDay(),
    kind: optionalEnum(KINDS),
    owner: optionalText(600),
    side: optionalEnum(["buy", "sell"] as const satisfies ReadonlyArray<V2InsiderSide>),
    sort: optionalEnum(["oldest"]),
    tab: optionalEnum(TABS),
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

const SORT_OPTIONS: Record<Tab, Array<{ label: string; value: "oldest" | typeof NEWEST }>> = {
    holdings: [
        { label: "Newest reported first", value: NEWEST },
        { label: "Oldest reported first", value: "oldest" },
    ],
    trades: [
        { label: "Newest filed first", value: NEWEST },
        { label: "Oldest filed first", value: "oldest" },
    ],
};

const SIDE_LABELS: Record<V2InsiderSide, string> = { buy: "Buy", sell: "Sell" };

const money = (value: null | number) => formatMoney(value);

const count = (value: null | number | undefined) => formatShares(value);

type InsiderRoleFields = Pick<
    V2InsiderTrade,
    | "reporting_person_is_director"
    | "reporting_person_is_officer"
    | "reporting_person_is_other"
    | "reporting_person_is_ten_percent_owner"
    | "reporting_person_officer_title"
    | "reporting_person_other_text"
>;

/** The insider's roles in words ("Officer (Chief Executive Officer)", "Director", "10% Owner", the other text). */
export function insiderRoles(trade: InsiderRoleFields) {
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
            // The day (the pinned first column stays narrow on a phone); the time in its title and in the row detail.
            accessorKey: "filed_at",
            cell: ({ row }) => <span title={formatInstant(row.original.filed_at)}>{formatDay(row.original.filed_at)}</span>,
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
            header: () => <div className="text-right">Owned after</div>,
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

/**
 * The legend of the loaded rows' codes and the derivative marker: a disclosure under the table ("Transaction codes"),
 * closed by default — each code's meaning is also the cell's title.
 */
export function InsiderCodeLegend({ rows }: { rows: ReadonlyArray<V2InsiderTrade> }) {
    const legend = insiderCodeLegend(rows.map(row => row.coding_code));

    if (legend.length === 0) return null;

    return (
        <details className="group text-muted-foreground text-xs">
            <summary className="hover:text-foreground flex min-h-9 w-fit cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
                {`Transaction codes (${legend.length})`}
            </summary>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-5" data-testid="insider-code-legend">
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
        </details>
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

/** "Indirect · By Trust" / "Direct"; not stated = "—". */
const ownershipText = (line: Pick<V2InsiderHolding, "direct_indirect" | "nature_of_ownership">) => {
    if (!line.direct_indirect) return "—";

    const form = OWNERSHIP_FORMS[line.direct_indirect];

    return line.nature_of_ownership ? `${form} · ${line.nature_of_ownership}` : form;
};

/** The holdings table's columns: what each insider held, as reported on its Form 3 / 4 / 5 (no transaction). */
export const INSIDER_HOLDING_COLUMNS: Array<ColumnDef<V2InsiderHolding>> = [
    {
        accessorKey: "as_of",
        cell: ({ row }) => formatDay(row.original.as_of),
        header: "As of",
    },
    {
        accessorKey: "reporting_person_name",
        cell: ({ row }) => <div className="truncate" title={row.original.owner_cik ? `Owner CIK ${row.original.owner_cik}` : undefined}>{row.original.reporting_person_name}</div>,
        header: "Insider",
    },
    {
        cell: ({ row }) => <div className="truncate">{insiderRoles(row.original)}</div>,
        header: "Role",
        id: "role",
    },
    {
        accessorKey: "security_title",
        cell: ({ row }) => (
            <div className="flex items-center gap-1">
                <span className="truncate">{row.original.security_title}</span>
                {row.original.is_derivative && <Badge title="A derivative security (option, RSU, warrant)" variant="outline">Deriv.</Badge>}
            </div>
        ),
        header: "Security",
    },
    {
        accessorKey: "shares_owned",
        // A filing that states a value instead of shares shows the value.
        cell: ({ row }) => (
            <div className="text-right tabular-nums">
                {row.original.shares_owned == null && row.original.value_owned != null ? money(row.original.value_owned) : count(row.original.shares_owned)}
            </div>
        ),
        header: () => <div className="text-right">Held</div>,
    },
    {
        cell: ({ row }) => <div className="truncate">{ownershipText(row.original)}</div>,
        header: "Ownership",
        id: "ownership",
    },
    {
        accessorKey: "conversion_exercise_price",
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.conversion_exercise_price == null ? "—" : money(row.original.conversion_exercise_price)}</div>,
        header: () => <div className="text-right">Exercise price</div>,
    },
    {
        accessorKey: "expiration_date",
        cell: ({ row }) => formatDay(row.original.expiration_date),
        header: "Expires",
    },
    {
        accessorKey: "form",
        cell: ({ row }) => <span title={`Filed ${formatInstant(row.original.filed_at)} · ${row.original.accession_number}`}>{row.original.form ?? "—"}</span>,
        header: "Form",
    },
];

/**
 * The insider holdings list (pure, `GET /v1/insider-holdings`): what each insider holds without a transaction on the
 * filing, newest reported first; the same honest states as the trades list.
 */
export function InsiderHoldingsView({
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
    pages: ReadonlyArray<V2InsiderHoldingsResponse>;
    /** The export's file-name scope (the page's ticker). */
    symbol?: string;
}) {
    const rows = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load insider holdings" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <DataTable
                columns={INSIDER_HOLDING_COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No insider holdings for these filters."
                exportConfig={symbol ? { dataset: "insider-holdings", scope: symbol } : undefined}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listInsiderHoldings"
                rows={rows}
                stickyFirstColumn
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more insider holdings" /> : null}
        </div>
    );
}

const SOURCE_LABELS: Record<V2InsiderTradeDetail["source"], string> = {
    f345: "SEC Form 3/4/5 data set",
    sec_api: "Realtime Form 4 feed",
};

/**
 * One insider transaction line in full (pure, `GET /v1/insider-trades/{id}`): the trade as a stat grid (side, code,
 * shares, price, total, holdings before / after), then sections for the insider (role, owner CIK, 10b5-1 plan,
 * ownership form and nature), the derivative's terms, the filing and its footnotes. A realtime-feed row leaves the
 * dataset's fields null: they are left out (no "—" cells, no empty section).
 */
export function InsiderTradeDetailView({ docsLink, trade }: { docsLink?: React.ReactNode; trade: V2InsiderTradeDetail }) {
    const ownership = trade.direct_indirect ? OWNERSHIP_FORMS[trade.direct_indirect] : null;

    const accession = (
        <span className="flex flex-wrap items-center gap-2">
            <Copyable label="Copy accession number" value={trade.accession_number} />
            {docsLink}
        </span>
    );

    const tradeFacts = statedFacts([
        ["Side", `${SIDE_LABELS[trade.side]} (${trade.acquired_disposed === "A" ? "acquired" : "disposed"})`],
        ["Code", insiderCodeText(trade.coding_code)],
        ["Traded", trade.transaction_date ? formatDay(trade.transaction_date) : null],
        ["Shares", count(trade.shares)],
        ["Price", trade.share_price == null ? null : money(trade.share_price)],
        ["Total", trade.total == null ? null : money(trade.total)],
        ["Owned before", trade.shares_owned_before_transaction == null ? null : count(trade.shares_owned_before_transaction)],
        ["Owned after", count(trade.shares_owned_following_transaction)],
    ]);

    const insiderFacts: Array<DetailFact> = [
        ["Role", insiderRoles(trade)],
        ["Owner CIK", trade.owner_cik ? <Copyable label="Copy owner CIK" value={trade.owner_cik} /> : null],
        ["Security", trade.security_title],
        ["10b5-1 plan", yesNo(trade.is_10b5_1)],
        ["Ownership", ownership && (trade.nature_of_ownership ? `${ownership} · ${trade.nature_of_ownership}` : ownership)],
        ["Deemed execution", trade.deemed_execution_date ? formatDay(trade.deemed_execution_date) : null],
    ];

    const derivativeFacts: Array<DetailFact> = [
        ["Derivative", yesNo(trade.is_derivative)],
        ["Exercise / conversion price", trade.conversion_exercise_price == null ? null : money(trade.conversion_exercise_price)],
        ["Exercisable from", trade.exercise_date ? formatDay(trade.exercise_date) : null],
        ["Expires", trade.expiration_date ? formatDay(trade.expiration_date) : null],
        ["Underlying", trade.underlying_security_title],
        ["Underlying shares", trade.underlying_shares == null ? null : count(trade.underlying_shares)],
    ];

    const filingFacts: Array<DetailFact> = [
        ["Period of report", trade.period_of_report ? formatDay(trade.period_of_report) : null],
        ["Filed", formatInstant(trade.filed_at)],
        ["Accession", accession],
        ["Source", SOURCE_LABELS[trade.source]],
    ];

    const derivativeShown = trade.is_derivative === true || statedFacts(derivativeFacts.slice(1)).length > 0;

    return (
        <div className="flex flex-col gap-6" data-testid="insider-trade-detail">
            {tradeFacts.length > 0 && (
                <StatGrid>
                    {tradeFacts.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
                </StatGrid>
            )}
            {statedFacts(insiderFacts).length > 0 && (
                <Section title="Insider">
                    <FactGrid facts={insiderFacts} />
                </Section>
            )}
            {derivativeShown && (
                <Section title="Derivative terms">
                    <FactGrid facts={derivativeFacts} />
                </Section>
            )}
            <Section title="Filing">
                <FactGrid facts={filingFacts} />
            </Section>
            {(trade.footnotes?.length ?? 0) > 0 && (
                <Section title="Footnotes">
                    <ol className="text-muted-foreground flex flex-col gap-1">
                        {trade.footnotes?.map(note => (
                            <li key={note.id}>
                                <span className="text-foreground font-medium">{`${note.id} `}</span>
                                {note.text}
                            </li>
                        ))}
                    </ol>
                </Section>
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
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{shown?.reporting_person_name ?? "Insider trade"}</DialogTitle>
                </DialogHeader>
                {shown
                    ? (
                            <InsiderTradeDetailView
                                docsLink={(
                                    <Link className="text-primary underline-offset-4 hover:underline" params={{ ticker }} search={{ docs: shown.accession_number }} to="/$ticker/filings">
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
        owner: ownerParam(search.owner),
        side: search.side,
        sort: search.sort === "oldest" ? ("filed_at" as const) : undefined,
        to,
        tradedFrom: traded.from,
        tradedTo: traded.to,
    };
}

/** `owner=` from the typed CIK list (digits only, ≤ 50, de-duplicated); nothing valid = undefined (every insider). */
export const ownerParam = (text: string | undefined) => parseCikList(text)?.join(",");

/** `/v1/insider-holdings?company=<ticker>` for a search state (owner, kind and order; the trade filters do not apply). */
export function insiderHoldingsRequest(ticker: string, search: InsiderSearch) {
    return {
        company: ticker,
        isDerivative: search.kind ? search.kind === "derivative" : undefined,
        limit: INSIDER_PAGE,
        owner: ownerParam(search.owner),
        sort: search.sort === "oldest" ? ("as_of" as const) : undefined,
    };
}

function InsiderTradesPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const { from = "", side = ALL, tfrom = "", to = "", tto = "" } = search;

    const kind = search.kind ?? ALL;

    const tab: Tab = search.tab ?? "trades";

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<InsiderSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    // Only the open tab's list is asked (the other hook is idle with an empty company and no owner).
    const tradesRequest = insiderTradesRequest(ticker, search);

    const trades = useV2InsiderTradesInfinite(tab === "trades" ? tradesRequest : { ...tradesRequest, company: "", owner: undefined });

    const holdingsRequest = insiderHoldingsRequest(ticker, search);

    const holdings = useV2InsiderHoldingsInfinite(tab === "holdings" ? holdingsRequest : { ...holdingsRequest, company: "", owner: undefined });

    const pages = React.useMemo(() => trades.data?.pages ?? [], [trades.data]);

    const holdingPages = React.useMemo(() => holdings.data?.pages ?? [], [holdings.data]);

    const openRow = React.useMemo(
        () => (search.trade ? (pages.flatMap(page => page.data).find(row => row.id === search.trade) ?? null) : null),
        [pages, search.trade],
    );

    const onOpen = React.useCallback((trade: V2InsiderTrade) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, trade: trade.id }) }), [navigate]);

    const tradesTab = tab === "trades";

    // Each day range counts once; the trade-only filters count on the trades tab only.
    const activeCount = [search.owner, search.kind, search.sort, ...(tradesTab ? [search.side, from || to, tfrom || tto] : [])].filter(Boolean).length;

    const onReset = () => onChange({ from: undefined, kind: undefined, owner: undefined, side: undefined, sort: undefined, tfrom: undefined, to: undefined, tto: undefined });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                description="Insider transactions and holdings from Forms 3, 4 and 5. A traded-day filter leaves out lines without a transaction date (the realtime feed's)."
                title="Insider trades"
            />

            <Tabs className="gap-4" onValueChange={value => onChange({ tab: value === "holdings" ? "holdings" : undefined, trade: undefined })} value={tab}>
                <TabsList aria-label="Insider data" className={WRAPPING_TABS_LIST_CLASS} variant="line">
                    <TabsTrigger value="trades">Trades</TabsTrigger>
                    <TabsTrigger value="holdings">Holdings</TabsTrigger>
                </TabsList>

                <FilterBar activeCount={activeCount} onReset={onReset}>
                    <FilterField label="Insider CIKs">
                        {id => (
                            <DebouncedInput
                                aria-label="Insider CIKs"
                                className="w-full"
                                id={id}
                                onCommit={value => onChange({ owner: value.trim() || undefined })}
                                placeholder="Reporting-owner CIK(s)"
                                value={search.owner ?? ""}
                            />
                        )}
                    </FilterField>
                    {tradesTab && (
                        <FilterField label="Side">
                            {id => <FilterSelect aria-label="Side" className="w-full" id={id} onValueChange={(value: SideFilter) => onChange({ side: value === ALL ? undefined : value })} options={SIDE_OPTIONS} value={side} />}
                        </FilterField>
                    )}
                    {tradesTab && (
                        <FilterField label="Filed" span={2}>
                            <DayRange from={from} labels={{ from: "Filed from", to: "Filed to" }} onChange={onChange} to={to} />
                        </FilterField>
                    )}
                    {tradesTab && (
                        <FilterField label="Traded" span={2}>
                            <DayRange
                                from={tfrom}
                                labels={{ from: "Traded from", to: "Traded to" }}
                                onChange={patch => onChange("from" in patch ? { tfrom: patch.from } : { tto: patch.to })}
                                to={tto}
                            />
                        </FilterField>
                    )}
                    <FilterField label="Kind">
                        {id => <FilterSelect aria-label="Line kind" className="w-full" id={id} onValueChange={value => onChange({ kind: value === ALL ? undefined : value })} options={KIND_OPTIONS} value={kind} />}
                    </FilterField>
                    <FilterField label="Order">
                        {id => <FilterSelect aria-label="Order" className="w-full" id={id} onValueChange={value => onChange({ sort: value === NEWEST ? undefined : value })} options={SORT_OPTIONS[tab]} value={search.sort ?? NEWEST} />}
                    </FilterField>
                </FilterBar>

                {search.owner && !ownerParam(search.owner) && <div className="text-muted-foreground text-xs">No CIK in this list: every insider is shown</div>}
                {ownerParam(search.owner) && ignoredCikTokens(search.owner).length > 0 && (
                    <div className="text-muted-foreground text-xs">
                        Ignored (no CIK):
                        {ignoredCikTokens(search.owner).join(", ")}
                    </div>
                )}

                <TabsContent value="trades">
                    <InsiderTradesView
                        error={trades.error}
                        hasNextPage={trades.hasNextPage}
                        isFetchingNextPage={trades.isFetchingNextPage}
                        isLoading={trades.isLoading}
                        onLoadMore={() => trades.fetchNextPage()}
                        onOpen={onOpen}
                        pages={pages}
                        symbol={ticker}
                    />
                </TabsContent>

                <TabsContent value="holdings">
                    <InsiderHoldingsView
                        error={holdings.error}
                        hasNextPage={holdings.hasNextPage}
                        isFetchingNextPage={holdings.isFetchingNextPage}
                        isLoading={holdings.isLoading}
                        onLoadMore={() => holdings.fetchNextPage()}
                        pages={holdingPages}
                        symbol={ticker}
                    />
                </TabsContent>
            </Tabs>

            <InsiderTradeDialog id={search.trade ?? null} onClose={() => onChange({ trade: undefined })} row={openRow} ticker={ticker} />
        </div>
    );
}
