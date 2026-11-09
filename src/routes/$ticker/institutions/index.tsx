import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type {
    V2Holding,
    V2HoldingChange,
    V2HoldingChangesResponse,
    V2HoldingChangeType,
    V2HoldingsResponse,
} from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2ListTable } from "@/components/sec/v2-list-table";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useV2HoldingChangesInfinite, useV2HoldingsInfinite } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { latest13fPeriodEnd, recentQuarterEnds } from "@/lib/sec/source";
import { formatNumberEn } from "@/lib/utils";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/$ticker/institutions/")({
    component: InstitutionsPage,
});

/** 13F rows per page (the API allows up to 1 000). */
const THIRTEEN_F_PAGE = 100;

/** Quarter ends the period picker offers (newest due quarter first). */
const PICKER_QUARTERS = 8;

/** The picker's "server default" entry: no `period_end` sent (the newest quarter whose 13F deadline passed). */
const LATEST = "latest";

export const CHANGE_TYPE_LABELS: Record<V2HoldingChangeType, string> = {
    added: "Added",
    new: "New position",
    reduced: "Reduced",
    sold_out: "Sold out",
    unchanged: "Unchanged",
};

const currency = new Intl.NumberFormat("en", { currency: "USD", maximumFractionDigits: 2, style: "currency" });

const money = (value: null | number) => (value === null || !Number.isFinite(value) ? "—" : currency.format(value));

const count = (value: null | number) => (value === null || !Number.isFinite(value) ? "—" : formatNumberEn(value));

const day = (value: null | string) => (value ? formatEnDateTime(value, { hideTime: true }) : "—");

/** `change_shares_or_principal_amount_percent` is a fraction (+1 = a new position, −1 = sold out). */
export function changePercentText(fraction: number) {
    if (!Number.isFinite(fraction)) return "—";

    const percent = fraction * 100;

    return `${percent > 0 ? "+" : ""}${formatNumberEn(percent, { maximumFractionDigits: 2 })}%`;
}

const institutionCell = (row: { cik_institution: string; name_institution?: null | string }) => (
    <div className="truncate" title={`CIK ${row.cik_institution}`}>{row.name_institution ?? row.cik_institution}</div>
);

const right = (text: string) => <div className="text-right tabular-nums">{text}</div>;

const HOLDING_COLUMNS: Array<ColumnDef<V2Holding>> = [
    { accessorKey: "period_end", cell: ({ row }) => day(row.original.period_end), header: "Period End" },
    { accessorKey: "filing_date", cell: ({ row }) => day(row.original.filing_date), header: "Filed" },
    { accessorKey: "cik_institution", cell: ({ row }) => institutionCell(row.original), header: "Institution" },
    {
        accessorKey: "shares_or_principal_amount",
        cell: ({ row }) => right(count(row.original.shares_or_principal_amount)),
        header: () => <div className="text-right">Shares</div>,
    },
    {
        accessorKey: "shares_or_principal_amount_type",
        cell: ({ row }) => [row.original.shares_or_principal_amount_type, row.original.put_call].filter(Boolean).join(" · "),
        header: "Amount Type",
    },
    {
        accessorKey: "dollar_value",
        cell: ({ row }) => right(money(row.original.dollar_value)),
        header: () => <div className="text-right">Value</div>,
    },
];

const CHANGE_COLUMNS: Array<ColumnDef<V2HoldingChange>> = [
    { accessorKey: "period_end", cell: ({ row }) => day(row.original.period_end), header: "Period End" },
    { accessorKey: "filing_date", cell: ({ row }) => day(row.original.filing_date), header: "Filed" },
    { accessorKey: "type", cell: ({ row }) => CHANGE_TYPE_LABELS[row.original.type], header: "Type" },
    { accessorKey: "cik_institution", cell: ({ row }) => institutionCell(row.original), header: "Institution" },
    {
        accessorKey: "change_dollar_value",
        cell: ({ row }) => right(money(row.original.change_dollar_value)),
        header: () => <div className="text-right">Change $</div>,
    },
    {
        accessorKey: "change_shares_or_principal_amount_absolute",
        cell: ({ row }) => right(count(row.original.change_shares_or_principal_amount_absolute)),
        header: () => <div className="text-right">Change Shares</div>,
    },
    {
        accessorKey: "change_shares_or_principal_amount_percent",
        cell: ({ row }) => right(changePercentText(row.original.change_shares_or_principal_amount_percent)),
        header: () => <div className="text-right">Change %</div>,
    },
    {
        accessorKey: "shares_or_principal_amount_new",
        cell: ({ row }) => right(count(row.original.shares_or_principal_amount_new)),
        header: () => <div className="text-right">New Position</div>,
    },
    {
        accessorKey: "shares_or_principal_amount_old",
        cell: ({ row }) => right(count(row.original.shares_or_principal_amount_old)),
        header: () => <div className="text-right">Old Position</div>,
    },
    {
        accessorKey: "dollar_value",
        cell: ({ row }) => right(money(row.original.dollar_value)),
        header: () => <div className="text-right">Value</div>,
    },
];

type ListState<TPage> = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<TPage>;
};

/**
 * One 13F list (pure): the request's honest state (403 `excluded`, 404 `not_covered`, 503 `unavailable`, plan gate),
 * the answer's coverage (`pending` = still being filled, `partial`), its provenance (`pinned_at`, `counting`,
 * `meta.source`), the rows and "Load more".
 */
export function ThirteenFList<TRow, TPage extends V2HoldingChangesResponse | V2HoldingsResponse>({
    columns,
    emptyText,
    errorTitle,
    loadingText,
    rowsOf,
    state,
}: {
    columns: Array<ColumnDef<TRow>>;
    emptyText: string;
    errorTitle: string;
    loadingText: string;
    rowsOf: (page: TPage) => Array<TRow>;
    state: ListState<TPage>;
}) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title={errorTitle} />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2 h-full">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <V2ListTable
                columns={columns}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText={emptyText}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                loadingText={loadingText}
                onLoadMore={onLoadMore}
                rows={pages.flatMap(rowsOf)}
            />
            {error ? <SecReadinessNotice error={error} title={errorTitle} /> : null}
        </div>
    );
}

export function HoldingsList({ state }: { state: ListState<V2HoldingsResponse> }) {
    return (
        <ThirteenFList
            columns={HOLDING_COLUMNS}
            emptyText="No institutional holders reported for this quarter."
            errorTitle="Failed to load institutional ownership"
            loadingText="Loading institutional ownership..."
            rowsOf={page => page.data}
            state={state}
        />
    );
}

export function HoldingChangesList({ state }: { state: ListState<V2HoldingChangesResponse> }) {
    return (
        <ThirteenFList
            columns={CHANGE_COLUMNS}
            emptyText="No position changes for this quarter."
            errorTitle="Failed to load institutional transactions"
            loadingText="Loading institutional transactions..."
            rowsOf={page => page.data}
            state={state}
        />
    );
}

function InstitutionsPage() {
    const { ticker } = Route.useParams();

    // The picker's quarters, from the newest one whose 13F reports are due (taken once per mount).
    const [quarters] = React.useState(() => recentQuarterEnds(latest13fPeriodEnd(new Date()), PICKER_QUARTERS));

    const [period, setPeriod] = React.useState<string>(LATEST);

    const periodEnd = period === LATEST ? undefined : period;

    const periodOptions = React.useMemo(
        () => [{ label: "Latest due quarter", value: LATEST }, ...quarters.map(quarter => ({ label: `Quarter ending ${quarter}`, value: quarter }))],
        [quarters],
    );

    // `/v2/holdings?company=` and `/v2/holding-changes?company=`, both for the picked quarter (none = server default).
    const holdings = useV2HoldingsInfinite({ company: ticker, limit: THIRTEEN_F_PAGE, periodEnd });

    const changes = useV2HoldingChangesInfinite({ company: ticker, limit: THIRTEEN_F_PAGE, periodEnd });

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <div>Institutions</div>
                    <div className="text-muted-foreground text-sm">
                        13F holders of this company and their position changes vs the prior quarter.
                    </div>
                </div>
                <FilterSelect className="w-[220px]" onValueChange={setPeriod} options={periodOptions} value={period} />
            </div>

            <Tabs className="grow" defaultValue="ownership">
                <TabsList variant="line">
                    <TabsTrigger className="h-[34px] text-sm" value="ownership">Ownership</TabsTrigger>
                    <TabsTrigger className="h-[34px] text-sm" value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent className="grow relative mt-2" value="ownership">
                    <HoldingsList
                        state={{
                            error: holdings.error,
                            hasNextPage: holdings.hasNextPage,
                            isFetchingNextPage: holdings.isFetchingNextPage,
                            isLoading: holdings.isLoading,
                            onLoadMore: () => holdings.fetchNextPage(),
                            pages: holdings.data?.pages ?? [],
                        }}
                    />
                </TabsContent>

                <TabsContent className="grow relative mt-2" value="transactions">
                    <HoldingChangesList
                        state={{
                            error: changes.error,
                            hasNextPage: changes.hasNextPage,
                            isFetchingNextPage: changes.isFetchingNextPage,
                            isLoading: changes.isLoading,
                            onLoadMore: () => changes.fetchNextPage(),
                            pages: changes.data?.pages ?? [],
                        }}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
