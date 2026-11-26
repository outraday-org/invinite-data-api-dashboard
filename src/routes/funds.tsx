import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { ListState } from "@/lib/api/list-state";
import type { V2FundListItem, V2FundsResponse, V2FundStructure, V2FundType } from "@/lib/api/types";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { listState } from "@/lib/api/list-state";
import { useFunds } from "@/lib/api/queries";
import { formatMoneyCompact } from "@/lib/format";
import { activeFilterValue, EXCHANGE_LABELS, FUND_STRUCTURE_LABELS, INSTRUMENT_TYPE_LABELS, LISTED_FILTER_OPTIONS, LISTED_FILTERS, LISTED_TODAY } from "@/lib/instruments";
import { titleHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

const fundsSearchSchema = z.object({
    /** Absent = listed today (Data API 12.0's default); `all` = listed and delisted; `delisted` = delisted only. */
    active: z.enum(LISTED_FILTERS).optional().catch(undefined),
    exchange: z.string().regex(/^[A-Z]{4}$/).optional().catch(undefined),
    q: z.string().trim().min(1).max(100).optional().catch(undefined),
    sort: z.enum(["symbol", "-symbol", "name", "-name"]).optional().catch(undefined),
    structure: z.enum(["registered_fund", "exchange_traded_trust"]).optional().catch(undefined),
    type: z.enum(["etf", "closed_end_fund"]).optional().catch(undefined),
});

export type FundsSearch = z.infer<typeof fundsSearchSchema>;

export const Route = createFileRoute("/funds")({
    component: FundsPage,
    head: () => titleHead("Funds"),
    validateSearch: fundsSearchSchema,
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
    { label: `With holdings (${FUND_STRUCTURE_LABELS.registered_fund.toLowerCase()})`, value: "registered_fund" },
    { label: `No holdings report (${FUND_STRUCTURE_LABELS.exchange_traded_trust.toLowerCase()})`, value: "exchange_traded_trust" },
] satisfies Array<{ label: string; value: typeof ALL | V2FundStructure }>;

const EXCHANGE_OPTIONS = [{ label: "Every exchange", value: ALL }, ...Object.entries(EXCHANGE_LABELS).map(([mic, label]) => ({ label: `${label} (${mic})`, value: mic }))];

const SORT_OPTIONS = [
    { label: "Symbol A–Z", value: "symbol" },
    { label: "Symbol Z–A", value: "-symbol" },
    { label: "Name A–Z", value: "name" },
    { label: "Name Z–A", value: "-name" },
] satisfies Array<{ label: string; value: NonNullable<FundsSearch["sort"]> }>;

/** The request of a search state (`/v1/funds` sorts by symbol or name only: no net-assets sort in the contract). */
export function fundsRequest(search: FundsSearch) {
    return {
        exchange: search.exchange,
        isActive: activeFilterValue(search.active),
        limit: FUNDS_PAGE,
        q: search.q ?? "",
        sort: search.sort,
        structure: search.structure ? [search.structure] : undefined,
        type: search.type ? [search.type] : undefined,
    };
}

/**
 * The columns; `delisted` = every row is delisted (the "Delisted" filter). A fund row carries no `is_active` (unlike an
 * instrument), so under "Listed and delisted" a delisted fund cannot be badged.
 */
function fundColumns(delisted: boolean): Array<ColumnDef<V2FundListItem>> {
    return [
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
                    {delisted && <Badge variant="outline">Delisted</Badge>}
                </div>
            ),
            header: "Type",
            id: "type",
        },
        { cell: ({ row }) => row.original.exchange ?? "—", header: "Exchange", id: "exchange" },
        {
            cell: ({ row }) => (
                <div className="text-right tabular-nums">{formatMoneyCompact(row.original.net_assets_usd)}</div>
            ),
            header: () => <div className="text-right">Net assets</div>,
            id: "net_assets_usd",
        },
    ];
}

const COLUMNS = fundColumns(false);

const DELISTED_COLUMNS = fundColumns(true);

/** The fund list (pure): its state, the rows, "Load more"; `delisted` = the "Delisted" filter is on. */
export function FundsList({ delisted = false, state }: { delisted?: boolean; state: ListState<V2FundsResponse> }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the funds" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <DataTable
                columns={delisted ? DELISTED_COLUMNS : COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText={delisted ? "No delisted fund matches these filters." : "No fund matches these filters."}
                exportConfig={{ dataset: "funds", scope: "us" }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listFunds"
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more funds" /> : null}
        </div>
    );
}

/**
 * The funds (Data API 7.0, `GET /v1/funds`; listed today by default, the "Listed" filter adds the delisted ones, 12.0): ETFs and closed-end funds with a ticker — an ETN is no fund and an
 * unlisted mutual fund is never a resource (owner decisions 4 and 13). Filters type, structure ("with holdings" =
 * registered fund), exchange, listed, a name / ticker search and the sort, all in the URL; a row opens the fund's page.
 */
function FundsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<FundsSearch>) => void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, ...patch }) });

    const funds = useFunds(fundsRequest(search));

    return (
        <PageContainer>
            <PageHeader
                description={(
                    <>
                        Every ETF and closed-end fund listed today (the Listed filter adds the delisted ones). Exchange-traded trusts (gold, bitcoin, futures pools) file no
                        holdings report; the others show their holdings and weights. Sorted by symbol or name (the API offers no
                        net-assets sort).
                    </>
                )}
                title="Funds"
            />
            <FilterBar
                activeCount={[search.q, search.type, search.structure, search.exchange, search.active, search.sort].filter(value => value !== undefined).length}
                onReset={() => onChange({ active: undefined, exchange: undefined, q: undefined, sort: undefined, structure: undefined, type: undefined })}
            >
                <FilterField label="Search" span={2}>
                    {id => <DebouncedInput aria-label="Search funds" className="w-full" id={id} onCommit={q => onChange({ q: q || undefined })} placeholder="Ticker or name" value={search.q ?? ""} />}
                </FilterField>
                <FilterField label="Fund type">
                    {id => <FilterSelect aria-label="Fund type" className="w-full" id={id} onValueChange={value => onChange({ type: value === ALL ? undefined : value })} options={TYPE_OPTIONS} value={search.type ?? ALL} />}
                </FilterField>
                <FilterField label="Structure">
                    {id => <FilterSelect aria-label="Structure" className="w-full" id={id} onValueChange={value => onChange({ structure: value === ALL ? undefined : value })} options={STRUCTURE_OPTIONS} value={search.structure ?? ALL} />}
                </FilterField>
                <FilterField label="Exchange">
                    {id => <FilterSelect aria-label="Exchange" className="w-full" id={id} onValueChange={value => onChange({ exchange: value === ALL ? undefined : value })} options={EXCHANGE_OPTIONS} value={search.exchange ?? ALL} />}
                </FilterField>
                <FilterField label="Listed">
                    {id => <FilterSelect aria-label="Listed" className="w-full" id={id} onValueChange={value => onChange({ active: value === LISTED_TODAY ? undefined : value })} options={LISTED_FILTER_OPTIONS} value={search.active ?? LISTED_TODAY} />}
                </FilterField>
                <FilterField label="Sort">
                    {id => <FilterSelect aria-label="Sort" className="w-full" id={id} onValueChange={value => onChange({ sort: value === "symbol" ? undefined : value })} options={SORT_OPTIONS} value={search.sort ?? "symbol"} />}
                </FilterField>
            </FilterBar>
            <FundsList
                delisted={search.active === "delisted"}
                state={listState(funds)}
            />
        </PageContainer>
    );
}
