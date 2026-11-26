import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";

import type { V2BeneficialOwnershipFiling, V2BeneficialOwnershipResponse, V2InsiderSaleNotice, V2InsiderSaleNoticesResponse } from "@/lib/api/types";

import { FilingLink } from "@/components/sec/holder-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { filerCikParam } from "@/components/sec/security-link";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { formatDay, formatInstant, formatMoney, formatShares } from "@/lib/format";
import { chainStatus, noticeChainMarkers, PARSE_STATE_NOTES, percentOfClassText, SCHEDULE_LABELS } from "@/lib/sec/ownership-forms";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

type CompanyFields = { company: { cik: string; ticker?: null | string }; company_name?: null | string };

/** The subject company: its instrument page by ticker, else its filer page by CIK; the name as filed below. */
function CompanyCell({ row }: { row: CompanyFields }) {
    const cik = filerCikParam(row.company.cik);

    const ticker = row.company.ticker;

    return (
        <div className="flex min-w-0 flex-col">
            {ticker
                ? <Link className="font-medium underline-offset-4 hover:underline" params={{ ticker }} to="/$ticker">{ticker}</Link>
                : cik
                    ? <Link className="font-medium underline-offset-4 hover:underline" params={{ cik }} to="/sec/$cik">{`CIK ${cik}`}</Link>
                    : <span>{row.company.cik}</span>}
            {row.company_name && <span className="text-muted-foreground truncate text-xs" title={row.company_name}>{row.company_name}</span>}
        </div>
    );
}

/** A person by name, linked to its filer page when it has an EDGAR CIK. */
function PersonName({ cik, name }: { cik: null | string | undefined; name: null | string | undefined }) {
    const param = filerCikParam(cik);

    const text = name?.trim() || (param ? `CIK ${param}` : "—");

    return param
        ? <Link className="underline-offset-4 hover:underline" params={{ cik: param }} to="/sec/$cik">{text}</Link>
        : <span>{text}</span>;
}

/** The filed day, the EDGAR acceptance instant in its title. */
function FiledCell({ acceptedAt, filedAt }: { acceptedAt: null | string | undefined; filedAt: string }) {
    return <span title={acceptedAt ? `Accepted ${formatInstant(acceptedAt)}` : undefined}>{formatDay(filedAt)}</span>;
}

/** Every reporting person of the cover pages: name (filer page), shares beneficially owned and percent of class. */
function HoldersCell({ filing }: { filing: V2BeneficialOwnershipFiling }) {
    const note = PARSE_STATE_NOTES[filing.parse_state];

    if (filing.holders.length === 0) return <span className="text-muted-foreground text-xs">{note ?? "No reporting person stated"}</span>;

    return (
        <ul className="flex flex-col gap-0.5" data-testid="beneficial-holders">
            {filing.holders.map((holder, index) => (
                <li className="flex flex-wrap items-baseline gap-x-2" key={`${holder.filer_cik ?? holder.name}-${index}`}>
                    <PersonName cik={holder.filer_cik} name={holder.name} />
                    <span className="text-muted-foreground text-xs tabular-nums">
                        {`${formatShares(holder.aggregate_amount)} sh · ${percentOfClassText(holder.percent_of_class)}`}
                    </span>
                    {holder.is_group_member && <Badge title="Reports as a member of a group" variant="outline">Group</Badge>}
                </li>
            ))}
        </ul>
    );
}

/** Latest / superseded and the filing this one amends (the chain is read through `supersedes_accession`). */
function ChainCell({ filing }: { filing: V2BeneficialOwnershipFiling }) {
    const { label, supersedes } = chainStatus(filing);

    return (
        <div className="flex flex-col items-start gap-0.5">
            <Badge variant={filing.is_current ? "secondary" : "outline"}>{label}</Badge>
            {supersedes && <span className="text-muted-foreground font-mono text-xs" title="The previous filing of the same company, primary holder and class">{`after ${supersedes}`}</span>}
        </div>
    );
}

/** The columns of the 13D / 13G list (the filed day first, pinned on a phone). */
export const BENEFICIAL_OWNERSHIP_COLUMNS: Array<ColumnDef<V2BeneficialOwnershipFiling>> = [
    { accessorKey: "filed_at", cell: ({ row }) => <FiledCell acceptedAt={row.original.accepted_at} filedAt={row.original.filed_at} />, header: "Filed" },
    { cell: ({ row }) => <CompanyCell row={row.original} />, header: "Company", id: "company" },
    {
        accessorKey: "schedule",
        cell: ({ row }) => <Badge variant={row.original.schedule === "13D" ? "secondary" : "outline"}>{SCHEDULE_LABELS[row.original.schedule]}</Badge>,
        header: "Schedule",
    },
    {
        accessorKey: "form",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="whitespace-nowrap">{row.original.form}</span>
                {row.original.amendment_no != null && <span className="text-muted-foreground text-xs">{`Amendment ${row.original.amendment_no}`}</span>}
            </div>
        ),
        header: "Form",
    },
    {
        accessorKey: "class_title",
        cell: ({ row }) => <div className="truncate" title={row.original.cusip ? `CUSIP ${row.original.cusip}` : undefined}>{row.original.class_title ?? "—"}</div>,
        header: "Class",
    },
    { cell: ({ row }) => <HoldersCell filing={row.original} />, header: "Holders · shares · % of class", id: "holders" },
    { cell: ({ row }) => <ChainCell filing={row.original} />, header: "Chain", id: "chain" },
    { cell: ({ row }) => <FilingLink url={row.original.filing_url} />, header: "Filing", id: "filing_url" },
];

/** One line per security of a notice (a notice may name several classes). */
function SecurityLines({ notice, value }: { notice: V2InsiderSaleNotice; value: (security: V2InsiderSaleNotice["securities"][number]) => string }) {
    if (notice.securities.length === 0) return <span className="text-muted-foreground">—</span>;

    return (
        <div className="flex flex-col">
            {notice.securities.map((security, index) => <span key={index}>{value(security)}</span>)}
        </div>
    );
}

/** The form and its amendment links: "Replaces <accession>" / "Replaced by <accession>". */
function NoticeFormCell({ notice }: { notice: V2InsiderSaleNotice }) {
    const markers = noticeChainMarkers(notice);

    return (
        <div className="flex flex-col items-start gap-0.5">
            <span className="whitespace-nowrap">{notice.form}</span>
            {markers.map(marker => (
                <Badge className="font-mono" data-testid="notice-chain-marker" key={marker.kind} variant={marker.kind === "replaced_by" ? "outline" : "secondary"}>
                    {marker.text}
                </Badge>
            ))}
        </div>
    );
}

/** The columns of the Form 144 list. */
export const INSIDER_SALE_NOTICE_COLUMNS: Array<ColumnDef<V2InsiderSaleNotice>> = [
    { accessorKey: "filed_at", cell: ({ row }) => <FiledCell acceptedAt={row.original.accepted_at} filedAt={row.original.filed_at} />, header: "Filed" },
    { cell: ({ row }) => <CompanyCell row={row.original} />, header: "Company", id: "company" },
    { cell: ({ row }) => <PersonName cik={row.original.filer.cik} name={row.original.filer.name} />, header: "Seller", id: "seller" },
    { cell: ({ row }) => <div className="truncate">{row.original.relationships.length > 0 ? row.original.relationships.join(", ") : "—"}</div>, header: "Relationships", id: "relationships" },
    {
        cell: ({ row }) => <div className="text-right tabular-nums"><SecurityLines notice={row.original} value={security => formatShares(security.shares_to_sell)} /></div>,
        header: () => <div className="text-right">Shares to sell</div>,
        id: "shares_to_sell",
    },
    {
        cell: ({ row }) => <div className="text-right tabular-nums"><SecurityLines notice={row.original} value={security => formatMoney(security.market_value, { maximumFractionDigits: 0 })} /></div>,
        header: () => <div className="text-right">Market value</div>,
        id: "market_value",
    },
    { cell: ({ row }) => <SecurityLines notice={row.original} value={security => formatDay(security.approximate_sale_date)} />, header: "Approx. sale date", id: "approximate_sale_date" },
    { cell: ({ row }) => <SecurityLines notice={row.original} value={security => security.broker ?? "—"} />, header: "Broker", id: "broker" },
    { cell: ({ row }) => <NoticeFormCell notice={row.original} />, header: "Form", id: "form" },
    { cell: ({ row }) => <FilingLink url={row.original.filing_url} />, header: "Filing", id: "filing_url" },
];

type ListProps<TPage> = {
    error: unknown;
    /** The export file's scope word (the company list or "filer"). */
    exportScope: string;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<TPage>;
};

/** The 13D / 13G list (pure): the request's state, coverage, rows, "Load more", export. */
export function BeneficialOwnershipList({ error, exportScope, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages }: ListProps<V2BeneficialOwnershipResponse>) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} operationId="listBeneficialOwnershipFilings" title="Failed to load the 13D / 13G filings" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <DataTable
                columns={BENEFICIAL_OWNERSHIP_COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No Schedule 13D / 13G filing matches these filters."
                exportConfig={{ dataset: "beneficial-ownership", scope: exportScope }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listBeneficialOwnershipFilings"
                rows={pages.flatMap(page => page.data)}
                stickyFirstColumn
                toolbarMeta={<V2MetaLine meta={meta} />}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more 13D / 13G filings" /> : null}
        </div>
    );
}

/** The Form 144 list (pure): the request's state, coverage, rows, "Load more", export. */
export function InsiderSaleNoticesList({ error, exportScope, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages }: ListProps<V2InsiderSaleNoticesResponse>) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} operationId="listInsiderSaleNotices" title="Failed to load the Form 144 notices" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <DataTable
                columns={INSIDER_SALE_NOTICE_COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No Form 144 notice matches these filters."
                exportConfig={{ dataset: "insider-sale-notices", scope: exportScope }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listInsiderSaleNotices"
                rows={pages.flatMap(page => page.data)}
                stickyFirstColumn
                toolbarMeta={<V2MetaLine meta={meta} />}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more Form 144 notices" /> : null}
        </div>
    );
}
