import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Ipo, V2IposResponse, V2IpoStage } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2ListTable } from "@/components/sec/v2-list-table";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { useV2IposInfinite } from "@/lib/api/queries";
import { V2_IPO_STAGES } from "@/lib/api/v2";
import { formatEnDateTime } from "@/lib/date";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { formatNumberEn } from "@/lib/utils";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/$ticker/ipos/")({
    component: IposPage,
});

/** Offerings per page of `/v2/ipos` (one page per `next_cursor`). */
const IPOS_PAGE = 50;

const ALL = "all";

type StageFilter = typeof ALL | V2IpoStage;

/** One vocabulary for the registration stages and the listing calendar's status. */
export const IPO_STAGE_LABELS: Record<V2IpoStage, string> = {
    announced: "Announced",
    effective: "Effective",
    exchange_approved: "Exchange approved",
    postponed: "Postponed",
    price_range: "Price range",
    priced: "Priced",
    registered: "Registered",
    trading: "Trading",
    withdrawn: "Withdrawn",
};

const STAGE_OPTIONS: Array<{ label: string; value: StageFilter }> = [
    { label: "Every stage", value: ALL },
    ...V2_IPO_STAGES.map(stage => ({ label: IPO_STAGE_LABELS[stage], value: stage as StageFilter })),
];

/** An amount in the offering's currency (plain number when the currency is missing or unknown). */
export function formatOfferAmount(value: null | number, currency: null | string) {
    if (value === null || !Number.isFinite(value)) return "—";

    if (currency) {
        try {
            return new Intl.NumberFormat("en", { currency, maximumFractionDigits: 2, style: "currency" }).format(value);
        }
        catch {
            // An unknown currency code: the plain number below.
        }
    }

    return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

/** The offer price: the final price, else the range ("$16 – $18"), else "—". */
export function offerPriceText(ipo: Pick<V2Ipo, "currency" | "final_price" | "price_range_high" | "price_range_low">) {
    if (ipo.final_price !== null) return formatOfferAmount(ipo.final_price, ipo.currency);

    const { price_range_high: high, price_range_low: low } = ipo;

    if (low !== null && high !== null && low !== high) {
        return `${formatOfferAmount(low, ipo.currency)} – ${formatOfferAmount(high, ipo.currency)}`;
    }

    return formatOfferAmount(low ?? high, ipo.currency);
}

/** The listed ticker, else the proposed symbols (marked as proposed), else "—". */
export function ipoSymbolText(ipo: Pick<V2Ipo, "company" | "proposed_symbols" | "sources">) {
    const listed = ipo.company?.ticker ?? ipo.sources.listing?.ticker;

    if (listed) return listed;

    return ipo.proposed_symbols.length > 0 ? `${ipo.proposed_symbols.join(", ")} (proposed)` : "—";
}

const COLUMNS: Array<ColumnDef<V2Ipo>> = [
    {
        accessorKey: "listing_date",
        cell: ({ row }) => (row.original.listing_date ? formatEnDateTime(row.original.listing_date, { hideTime: true }) : "—"),
        header: "Listing Date",
    },
    {
        cell: ({ row }) => ipoSymbolText(row.original),
        header: "Symbol",
        id: "symbol",
    },
    {
        accessorKey: "issuer_name",
        cell: ({ row }) => (
            <div className="flex items-center gap-1">
                <span className="truncate">{row.original.issuer_name || "—"}</span>
                {row.original.is_spac && <Badge variant="outline">SPAC</Badge>}
            </div>
        ),
        header: "Issuer",
    },
    {
        accessorKey: "stage",
        cell: ({ row }) => <Badge variant="outline">{IPO_STAGE_LABELS[row.original.stage]}</Badge>,
        header: "Stage",
    },
    {
        accessorKey: "exchange",
        cell: ({ row }) => <span title="Exchange (MIC)">{row.original.exchange ?? "—"}</span>,
        header: "Exchange",
    },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{offerPriceText(row.original)}</div>,
        header: () => <div className="text-right">Price</div>,
        id: "price",
    },
    {
        accessorKey: "shares_offered",
        cell: ({ row }) => (
            <div className="text-right tabular-nums">
                {row.original.shares_offered === null ? "—" : formatNumberEn(row.original.shares_offered)}
            </div>
        ),
        header: () => <div className="text-right">Shares</div>,
    },
    {
        accessorKey: "total_offer_size",
        cell: ({ row }) => (
            <div className="text-right tabular-nums">{formatOfferAmount(row.original.total_offer_size, row.original.currency)}</div>
        ),
        header: () => <div className="text-right">Offer Size</div>,
    },
    {
        cell: ({ row }) => {
            const { listing, registration } = row.original.sources;

            return (
                <div className="flex flex-wrap gap-1">
                    {registration && (
                        <Badge title={`SEC registration ${registration.form_family} · ${registration.track_key}`} variant="secondary">
                            Registration
                        </Badge>
                    )}
                    {listing && <Badge title="Listing calendar" variant="secondary">Listing</Badge>}
                </div>
            );
        },
        header: "Sources",
        id: "sources",
    },
];

/** The offerings list (pure): the request's honest state, the answer's coverage, the rows and "Load more". */
export function IposView({
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
    pages: ReadonlyArray<V2IposResponse>;
}) {
    const rows = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load IPOs" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2 h-0 grow">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <V2ListTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No IPOs for this stage."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                loadingText="Loading IPOs..."
                onLoadMore={onLoadMore}
                rows={rows}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more IPOs" /> : null}
        </div>
    );
}

function IposPage() {
    const [stage, setStage] = React.useState<StageFilter>(ALL);

    // `/v2/ipos` market-wide (no `company`): one row per offering, newest listing first (`-listing_date`).
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2IposInfinite({
        limit: IPOS_PAGE,
        sort: "-listing_date",
        stage: stage === ALL ? undefined : [stage],
    });

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <div>IPOs</div>
                    <div className="text-muted-foreground text-sm">
                        Offerings from SEC registration to listing, sorted by listing date (future to past).
                    </div>
                </div>
                <FilterSelect className="w-[180px]" onValueChange={setStage} options={STAGE_OPTIONS} value={stage} />
            </div>

            <IposView
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
