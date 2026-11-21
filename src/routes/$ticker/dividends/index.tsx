import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2Dividend, V2DividendsResponse, V2DividendsSort } from "@/lib/api/types";

import { AlertEntryPoints, ENTRY_TYPES } from "@/components/alerts/create-alert-button";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useV2DividendsInfinite } from "@/lib/api/queries";
import { DASH, formatDay, formatMoney } from "@/lib/format";
import { tickerHead } from "@/lib/layout";
import { IN_PLACE, optionalDay, optionalEnum } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const SORTS = ["-ex_date", "ex_date", "-pay_date", "pay_date"] as const satisfies ReadonlyArray<V2DividendsSort>;

const DEFAULT_SORT = "-ex_date";

/** `?from=&to=` = the ex-dividend day range (`ex_date.gte` / `.lte`), `?sort=` (absent = newest ex-date first). */
const dividendsSearchSchema = z.object({
    from: optionalDay(),
    sort: optionalEnum(SORTS),
    to: optionalDay(),
});

export type DividendsSearch = z.infer<typeof dividendsSearchSchema>;

export const Route = createFileRoute("/$ticker/dividends/")({
    component: DividendsPage,
    head: ({ params }) => tickerHead(params.ticker, "Dividends"),
    validateSearch: dividendsSearchSchema,
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

/** The dividend type codes of the market-data source the API passes through (the spec states the field as a code). */
const DIVIDEND_TYPE_LABELS: Record<string, string> = {
    CD: "Regular cash",
    LT: "Long-term capital gain",
    SC: "Special cash",
    ST: "Short-term capital gain",
};

/** "Regular cash" for `CD`; an unknown code as itself; none = "—". */
export function dividendTypeLabel(code: null | string | undefined) {
    if (!code) return DASH;

    return DIVIDEND_TYPE_LABELS[code] ?? code;
}

const SORT_OPTIONS = [
    { label: "Ex-date, newest first", value: "-ex_date" },
    { label: "Ex-date, oldest first", value: "ex_date" },
    { label: "Pay date, newest first", value: "-pay_date" },
    { label: "Pay date, oldest first", value: "pay_date" },
] satisfies Array<{ label: string; value: (typeof SORTS)[number] }>;

const COLUMNS: Array<ColumnDef<V2Dividend>> = [
    { cell: ({ row }) => formatDay(row.original.ex_dividend_date), header: "Ex-Date", id: "ex_dividend_date" },
    { cell: ({ row }) => formatDay(row.original.declaration_date), header: "Declared", id: "declaration_date" },
    { cell: ({ row }) => formatDay(row.original.record_date), header: "Record", id: "record_date" },
    { cell: ({ row }) => formatDay(row.original.pay_date), header: "Payable", id: "pay_date" },
    { cell: ({ row }) => <span title={row.original.dividend_type || undefined}>{dividendTypeLabel(row.original.dividend_type)}</span>, header: "Type", id: "dividend_type" },
    { cell: ({ row }) => dividendFrequencyLabel(row.original.frequency), header: "Frequency", id: "frequency" },
    {
        // Per-share amounts keep up to 4 decimals ($0.2625).
        cell: ({ row }) => <div className="text-right tabular-nums">{formatMoney(row.original.cash_amount, { maximumFractionDigits: 4 })}</div>,
        header: () => <div className="text-right">Amount</div>,
        id: "cash_amount",
    },
];

/** The request of a search state: the range as `ex_date.gte` / `.lte` (a swapped range is put in order), the sort. */
export function dividendsRequest(ticker: string, search: DividendsSearch) {
    const [from, to] = search.from && search.to && search.from > search.to ? [search.to, search.from] : [search.from, search.to];

    return { exDateGte: from, exDateLte: to, limit: 40, sort: search.sort ?? DEFAULT_SORT, symbol: ticker } as const;
}

/** The dividends list (pure). */
export function DividendsView({ error, filtered, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages, ticker }: {
    error: unknown;
    /** A day range is set: an empty answer means "none in this range". */
    filtered: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2DividendsResponse>;
    ticker: string;
}) {
    const dividends = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    return (
        <DataTable
            columns={COLUMNS}
            emptyText={filtered ? "No dividends with an ex-date in this range." : "No dividends available."}
            errorState={error ? <ErrorState error={error} title="Failed to load dividends" /> : null}
            exportConfig={{ dataset: "dividends", scope: ticker }}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isLoading}
            onLoadMore={onLoadMore}
            operationId="listDividends"
            rows={dividends}
        />
    );
}

function DividendsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<DividendsSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2DividendsInfinite(dividendsRequest(ticker, search));

    return (
        <div className="flex flex-col gap-4">
            <PageHeader actions={<AlertEntryPoints symbol={ticker} types={ENTRY_TYPES.dividends} />} description="Cash dividends; filter by ex-dividend date and sort by ex-date or pay date." title="Dividends" />
            <div className="flex flex-wrap items-center gap-2">
                <DayRange from={search.from} labels={{ from: "Ex-date from", to: "Ex-date to" }} lead="Ex-date" onChange={onChange} to={search.to} />
                <FilterSelect aria-label="Sort" className="w-[200px]" onValueChange={value => onChange({ sort: value === DEFAULT_SORT ? undefined : value })} options={SORT_OPTIONS} value={search.sort ?? DEFAULT_SORT} />
            </div>
            <DividendsView
                error={error}
                filtered={Boolean(search.from || search.to)}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => void fetchNextPage()}
                pages={data?.pages ?? []}
                ticker={ticker}
            />
        </div>
    );
}
