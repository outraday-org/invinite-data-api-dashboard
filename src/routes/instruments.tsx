import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { V2Instrument, V2InstrumentsResponse } from "@/lib/api/types";
import type { InstrumentTab } from "@/lib/instruments";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { TabStrip } from "@/components/navigation/tab-strip";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useInstrumentsInfinite } from "@/lib/api/queries";
import { formatDay } from "@/lib/format";
import { EXCHANGE_LABELS, FUND_STRUCTURE_LABELS, INSTRUMENT_TABS, INSTRUMENT_TYPE_PLURALS, instrumentBadges } from "@/lib/instruments";
import { titleHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const ALL = "all";

const SORTS = ["symbol", "-symbol", "name", "-name"] as const;

const instrumentsSearchSchema = z.object({
    active: z.enum(["listed", "delisted"]).optional().catch(undefined),
    exchange: z.string().regex(/^[A-Z]{4}$/).optional().catch(undefined),
    q: z.string().trim().min(1).max(100).optional().catch(undefined),
    sort: z.enum(SORTS).optional().catch(undefined),
    structure: z.enum(["registered_fund", "exchange_traded_trust"]).optional().catch(undefined),
    type: z.enum(INSTRUMENT_TABS).optional().catch(undefined),
});

export type InstrumentsSearch = z.infer<typeof instrumentsSearchSchema>;

export const Route = createFileRoute("/instruments")({
    component: InstrumentsPage,
    head: () => titleHead("Instruments"),
    validateSearch: instrumentsSearchSchema,
});

const TAB_OPTIONS = INSTRUMENT_TABS.map(tab => ({ label: tab === ALL ? "All" : INSTRUMENT_TYPE_PLURALS[tab], value: tab }));

const STRUCTURE_OPTIONS = [
    { label: "Any structure", value: ALL },
    { label: FUND_STRUCTURE_LABELS.registered_fund, value: "registered_fund" },
    { label: FUND_STRUCTURE_LABELS.exchange_traded_trust, value: "exchange_traded_trust" },
] satisfies Array<{ label: string; value: NonNullable<InstrumentsSearch["structure"]> | typeof ALL }>;

const EXCHANGE_OPTIONS = [{ label: "Every exchange", value: ALL }, ...Object.entries(EXCHANGE_LABELS).map(([mic, label]) => ({ label: `${label} (${mic})`, value: mic }))];

const ACTIVE_OPTIONS = [
    { label: "Listed and delisted", value: ALL },
    { label: "Listed today", value: "listed" },
    { label: "Delisted", value: "delisted" },
] satisfies Array<{ label: string; value: NonNullable<InstrumentsSearch["active"]> | typeof ALL }>;

const SORT_OPTIONS = [
    { label: "Symbol A–Z", value: "symbol" },
    { label: "Symbol Z–A", value: "-symbol" },
    { label: "Name A–Z", value: "name" },
    { label: "Name Z–A", value: "-name" },
] satisfies Array<{ label: string; value: (typeof SORTS)[number] }>;

const COLUMNS: Array<ColumnDef<V2Instrument>> = [
    {
        cell: ({ row }) => (
            <Link className="font-medium underline-offset-4 hover:underline" params={{ ticker: row.original.symbol }} to="/$ticker">
                {row.original.symbol}
            </Link>
        ),
        header: "Symbol",
        id: "symbol",
    },
    { cell: ({ row }) => <div className="max-w-[320px] truncate">{row.original.name}</div>, header: "Name", id: "name" },
    {
        cell: ({ row }) => (
            <div className="flex gap-1">
                {instrumentBadges(row.original).map(badge => <Badge key={badge} variant={badge === "Delisted" ? "outline" : "secondary"}>{badge}</Badge>)}
            </div>
        ),
        header: "Type",
        id: "type",
    },
    { cell: ({ row }) => <span title="Exchange (MIC)">{row.original.exchange ?? "—"}</span>, header: "Exchange", id: "exchange" },
    { cell: ({ row }) => formatDay(row.original.list_date), header: "Listed", id: "list_date" },
];

/** The instrument list (pure): the request's state, the rows, "Load more". */
export function InstrumentsList({ error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages }: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2InstrumentsResponse>;
}) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the instruments" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No instrument matches these filters."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more instruments" /> : null}
        </div>
    );
}

/** The request of a search state (`type` from the tab; the structure filter applies to funds only). */
export function instrumentsRequest(search: InstrumentsSearch) {
    const type = search.type && search.type !== ALL ? [search.type] : undefined;

    return {
        exchange: search.exchange,
        isActive: search.active === undefined ? undefined : search.active === "listed",
        limit: 50,
        q: search.q,
        sort: search.sort,
        // The structure is a fund's: sent only on the ETF / closed-end fund tabs.
        structure: search.structure && (search.type === "etf" || search.type === "closed_end_fund") ? [search.structure] : undefined,
        type,
    };
}

/**
 * Every exchange-traded US symbol (`GET /v1/instruments`): tabs All / Stocks / ETFs / Closed-end funds / ETNs, filters
 * structure, exchange and listed / delisted, a ticker / name search and the sort, all in the URL; a row opens its page.
 */
function InstrumentsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<InstrumentsSearch>) => void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, ...patch }) });

    const list = useInstrumentsInfinite(instrumentsRequest(search));

    const tab: InstrumentTab = search.type ?? ALL;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader
                description="Every exchange-traded US symbol the Data API knows: stocks, ETFs, closed-end funds and ETNs."
                title="Instruments"
            />
            <TabStrip aria-label="Instrument type" onSelect={value => onChange({ type: value === ALL ? undefined : value })} options={TAB_OPTIONS} value={tab} />
            <div className="flex flex-wrap items-center gap-2">
                <DebouncedInput aria-label="Search instruments" className="w-[240px]" onCommit={q => onChange({ q: q || undefined })} placeholder="Ticker or name" value={search.q ?? ""} />
                {(tab === "etf" || tab === "closed_end_fund") && (
                    <FilterSelect aria-label="Structure" className="w-[200px]" onValueChange={value => onChange({ structure: value === ALL ? undefined : value })} options={STRUCTURE_OPTIONS} value={search.structure ?? ALL} />
                )}
                <FilterSelect aria-label="Exchange" className="w-[200px]" onValueChange={value => onChange({ exchange: value === ALL ? undefined : value })} options={EXCHANGE_OPTIONS} value={search.exchange ?? ALL} />
                <FilterSelect aria-label="Listed" className="w-[180px]" onValueChange={value => onChange({ active: value === ALL ? undefined : value })} options={ACTIVE_OPTIONS} value={search.active ?? ALL} />
                <FilterSelect aria-label="Sort" className="w-[150px]" onValueChange={value => onChange({ sort: value === "symbol" ? undefined : value })} options={SORT_OPTIONS} value={search.sort ?? "symbol"} />
            </div>
            <InstrumentsList
                error={list.error}
                hasNextPage={list.hasNextPage}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                onLoadMore={() => void list.fetchNextPage()}
                pages={list.data?.pages ?? []}
            />
        </div>
    );
}
