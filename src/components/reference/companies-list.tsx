import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";

import type { V2CompaniesResponse, V2CompaniesSort, V2CompanyListItem } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { DataTable } from "@/components/ui/data-table";
import { DASH } from "@/lib/format";
import { EXCHANGE_LABELS } from "@/lib/instruments";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

/**
 * The Companies tab of `/instruments` (O7 group 7): `GET /v1/companies`, the operating companies with a US listing (an
 * instrument of type `stock`), with the fields the instruments list lacks — sector, fiscal year end, CIK — and the
 * API's own filters (`q` name / ticker prefix, `exchange`, `sector`).
 */

/**
 * The sectors `/v1/companies` answered on 2026-11-21 (the spec states no enum): the filter's choices. A sector the API
 * adds later is still served (no filter = every sector) and shown in its rows.
 */
export const COMPANY_SECTORS = [
    "Basic Materials",
    "Communication Services",
    "Consumer Cyclical",
    "Consumer Defensive",
    "Energy",
    "Financial Services",
    "Healthcare",
    "Industrials",
    "Real Estate",
    "Technology",
    "Utilities",
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `09-30` → "Sep 30"; anything else as answered, none = "—". */
export function fiscalYearEndText(value: null | string | undefined) {
    const match = value ? /^(\d{2})-(\d{2})$/.exec(value) : null;

    if (!match) return value || DASH;

    const month = MONTHS[Number(match[1]) - 1];

    return month ? `${month} ${Number(match[2])}` : value!;
}

/** The instruments page's sort (`symbol` / `name`, ±) as the companies list's (`ticker` / `name`, ±). */
export function companiesSort(sort: string | undefined): undefined | V2CompaniesSort {
    switch (sort) {
        case "-name": return "-name";
        case "-symbol": return "-ticker";
        case "name": return "name";
        default: return undefined;
    }
}

const COLUMNS: Array<ColumnDef<V2CompanyListItem>> = [
    {
        cell: ({ row }) => (
            <span className="flex items-center gap-2">
                {row.original.logo_url
                    ? <img alt="" className="bg-muted ring-border/60 size-5 rounded object-contain ring-1" loading="lazy" src={row.original.logo_url} />
                    : <span className="size-5" />}
                <Link className="font-medium underline-offset-4 hover:underline" params={{ ticker: row.original.ticker }} to="/$ticker">
                    {row.original.ticker}
                </Link>
            </span>
        ),
        header: "Ticker",
        id: "ticker",
    },
    { cell: ({ row }) => <div className="max-w-[320px] truncate">{row.original.name}</div>, header: "Name", id: "name" },
    {
        cell: ({ row }) => {
            const mic = row.original.exchange;

            return <span title={mic ?? undefined}>{mic ? EXCHANGE_LABELS[mic] ?? mic : DASH}</span>;
        },
        header: "Exchange",
        id: "exchange",
    },
    { cell: ({ row }) => row.original.sector ?? DASH, header: "Sector", id: "sector" },
    { cell: ({ row }) => fiscalYearEndText(row.original.fiscal_year_end), header: "Fiscal year end", id: "fiscal_year_end" },
    {
        cell: ({ row }) => (
            <Link className="font-mono text-xs underline-offset-4 hover:underline" params={{ cik: String(Number(row.original.cik)) }} to="/sec/$cik">
                {row.original.cik}
            </Link>
        ),
        header: "CIK",
        id: "cik",
    },
];

/** The companies list (pure): the request's state, the rows, export, "Load more". */
export function CompaniesList({ error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages, scope }: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2CompaniesResponse>;
    scope: string;
}) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the companies" />;

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(pages.at(0)?.meta.coverage)}
                emptyText="No company matches these filters."
                exportConfig={{ dataset: "companies", scope }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listCompanies"
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more companies" /> : null}
        </div>
    );
}
