import type { ColumnDef } from "@tanstack/react-table";

import type { V2EtfHolding, V2EtfHoldingsResponse, V2EtfSource, V2EtfWeightsResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2ListTable } from "@/components/sec/v2-list-table";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import {
    ETF_DIMENSION_LABELS,
    etfBasisNote,
    etfReasonText,
    etfSourceText,
    etfWeightsByDimension,
} from "@/lib/sec/etf";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { formatNumberEn } from "@/lib/utils";

/**
 * Views of the ETF composition (Data API release 5.10): an ETF's positions (`/v1/etf-holdings?etf=`), the ETFs holding
 * a company (`?company=`) and the sector / country / asset-class weights (`/v1/etf-weights`). Every answer names its
 * source and as-of date; pure (state in, markup out) so the tests render them without a router.
 */

export type EtfListState<TPage> = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<TPage>;
};

const currency = new Intl.NumberFormat("en", { currency: "USD", maximumFractionDigits: 0, style: "currency" });

const money = (value: null | number | undefined) => (value == null || !Number.isFinite(value) ? "—" : currency.format(value));

const count = (value: null | number | undefined) => (value == null || !Number.isFinite(value) ? "—" : formatNumberEn(value));

/** `weight_pct` is already percent (7.1 = 7.1 %). */
export const weightText = (value: null | number | undefined) =>
    value == null || !Number.isFinite(value) ? "—" : `${formatNumberEn(value, { maximumFractionDigits: 2 })}%`;

const right = (text: string) => <div className="text-right tabular-nums">{text}</div>;

/** The "Issuer file · as of 2026-11-13" badge (nothing when the answer names no source). */
export function EtfSourceBadge({ asOf, source }: { asOf: null | string | undefined; source: null | undefined | V2EtfSource }) {
    const text = etfSourceText(source, asOf);

    if (!text) return null;

    return (
        <Badge data-testid="etf-source-badge" variant={source === "nport" ? "outline" : "secondary"}>
            {text}
        </Badge>
    );
}

const COMPOSITION_COLUMNS: Array<ColumnDef<V2EtfHolding>> = [
    { accessorKey: "name", cell: ({ row }) => <div className="truncate">{row.original.name ?? "—"}</div>, header: "Holding" },
    { accessorKey: "ticker", cell: ({ row }) => row.original.ticker ?? "—", header: "Ticker" },
    { accessorKey: "asset_class", cell: ({ row }) => row.original.asset_class ?? "—", header: "Asset Class" },
    {
        accessorKey: "weight_pct",
        cell: ({ row }) => right(weightText(row.original.weight_pct)),
        header: () => <div className="text-right">Weight</div>,
    },
    {
        accessorKey: "market_value_usd",
        cell: ({ row }) => right(money(row.original.market_value_usd)),
        header: () => <div className="text-right">Market Value</div>,
    },
    {
        accessorKey: "shares",
        cell: ({ row }) => right(count(row.original.shares)),
        header: () => <div className="text-right">Shares</div>,
    },
];

/** A derivative line's notional exposure (swaps, futures of leveraged / inverse funds; issuer files only). */
const NOTIONAL_COLUMN: ColumnDef<V2EtfHolding> = {
    accessorKey: "notional_value_usd",
    cell: ({ row }) => right(money(row.original.notional_value_usd)),
    header: () => <div className="text-right">Notional</div>,
};

const HOLDER_COLUMNS: Array<ColumnDef<V2EtfHolding>> = [
    {
        accessorKey: "etf_symbol",
        cell: ({ row }) => (
            <div className="truncate" title={row.original.etf_name ?? undefined}>
                {row.original.etf_symbol}
            </div>
        ),
        header: "ETF",
    },
    { accessorKey: "etf_name", cell: ({ row }) => <div className="truncate">{row.original.etf_name ?? "—"}</div>, header: "Name" },
    {
        accessorKey: "weight_pct",
        cell: ({ row }) => right(weightText(row.original.weight_pct)),
        header: () => <div className="text-right">Weight</div>,
    },
    {
        accessorKey: "market_value_usd",
        cell: ({ row }) => right(money(row.original.market_value_usd)),
        header: () => <div className="text-right">Market Value</div>,
    },
    {
        accessorKey: "shares",
        cell: ({ row }) => right(count(row.original.shares)),
        header: () => <div className="text-right">Shares</div>,
    },
    {
        accessorKey: "as_of",
        cell: ({ row }) => <EtfSourceBadge asOf={row.original.as_of} source={row.original.source} />,
        header: "Source",
    },
];

/** Only derivative lines carry a notional: the column shows when one row of the answer has one (leveraged / inverse). */
const hasNotional = (rows: ReadonlyArray<V2EtfHolding>) => rows.some(row => row.notional_value_usd != null);

/**
 * One ETF's composition (`/v1/etf-holdings?etf=`), largest weight first: the source badge, the reason of a partial or
 * deliberately empty answer (a single-asset trust is a notice, never an empty table), the rows and "Load more".
 */
export function EtfCompositionList({ state }: { state: EtfListState<V2EtfHoldingsResponse> }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the ETF holdings" />;

    const meta = pages.at(0)?.meta;

    const rows = pages.flatMap(page => page.data);

    const reason = etfReasonText(meta?.reason);

    const columns = hasNotional(rows) ? [...COMPOSITION_COLUMNS, NOTIONAL_COLUMN] : COMPOSITION_COLUMNS;

    return (
        <div className="flex flex-col gap-2 h-full">
            <SecReadinessNotice coverage={meta?.coverage} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <EtfSourceBadge asOf={meta?.as_of} source={meta?.source} />
            </div>
            {meta?.reason === "single_asset_trust"
                ? (
                        <Notice badge="Single asset" title={reason ?? ""} />
                    )
                : (
                        <>
                            {reason && <div className="text-muted-foreground text-xs">{reason}</div>}
                            <V2ListTable
                                columns={columns}
                                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                                emptyText="No positions in this composition."
                                hasNextPage={hasNextPage}
                                isFetchingNextPage={isFetchingNextPage}
                                isLoading={isLoading}
                                loadingText="Loading ETF holdings..."
                                onLoadMore={onLoadMore}
                                rows={rows}
                            />
                        </>
                    )}
            {error ? <SecReadinessNotice error={error} title="Failed to load the ETF holdings" /> : null}
        </div>
    );
}

/**
 * The ETFs holding a company (`/v1/etf-holdings?company=`, daily, from the ETFs' head issuer files, largest market value
 * first). Never presented as complete: only the ETFs with an issuer file are listed (`meta.issuer_sourced_etfs`).
 */
export function EtfHoldersList({ state }: { state: EtfListState<V2EtfHoldingsResponse> }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the ETF holders" />;

    const meta = pages.at(0)?.meta;

    const issuerSourced = meta?.issuer_sourced_etfs;

    return (
        <div className="flex flex-col gap-2 h-full">
            <SecReadinessNotice coverage={meta?.coverage} />
            <div className="text-muted-foreground text-xs" data-testid="etf-holders-scope">
                {`Daily, from the issuer holdings files of ${issuerSourced == null ? "the ETFs in scope" : `${formatNumberEn(issuerSourced)} ETFs`} — not every ETF. The Funds tab lists the funds known from their N-PORT reports.`}
            </div>
            <V2ListTable
                columns={HOLDER_COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No ETF with an issuer holdings file holds this company."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                loadingText="Loading ETF holders..."
                onLoadMore={onLoadMore}
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load the ETF holders" /> : null}
        </div>
    );
}

/**
 * The weights of the same composition (`/v1/etf-weights`): one block per dimension, buckets as bars (largest first,
 * "Unclassified" / "Cash and other" shown as buckets), the basis in plain words under each block. Weights that do not
 * add up to 100 % (leveraged / inverse funds) are drawn as stated, never scaled.
 */
export function EtfWeightsBlock({ state }: { state: EtfListState<V2EtfWeightsResponse> }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the ETF weights" />;

    if (isLoading && pages.length === 0) return <div className="text-muted-foreground text-sm">Loading weights...</div>;

    const meta = pages.at(0)?.meta;

    const groups = etfWeightsByDimension(pages.flatMap(page => page.data));

    if (groups.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                <SecReadinessNotice coverage={meta?.coverage} />
                {isV2GenuineEmpty(meta?.coverage) && <div className="text-muted-foreground text-sm">No weights for this composition.</div>}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3" data-testid="etf-weights">
            <SecReadinessNotice coverage={meta?.coverage} />
            <div className="grid gap-4 md:grid-cols-3">
                {groups.map(group => (
                    <div className="flex flex-col gap-1" key={group.dimension}>
                        <div className="text-sm font-medium">{ETF_DIMENSION_LABELS[group.dimension]}</div>
                        {group.weights.map(weight => (
                            <div className="flex flex-col gap-0.5" key={weight.bucket}>
                                <div className="flex justify-between gap-2 text-xs">
                                    <span className="truncate">{weight.bucket}</span>
                                    <span className="tabular-nums">{weightText(weight.weight_pct)}</span>
                                </div>
                                <div className="bg-muted h-1.5 rounded">
                                    <div className="bg-primary h-1.5 rounded" style={{ width: `${Math.max(0, Math.min(100, weight.weight_pct))}%` }} />
                                </div>
                            </div>
                        ))}
                        <div className="text-muted-foreground text-xs">{`Basis: ${etfBasisNote(group.weights) ?? "—"}`}</div>
                    </div>
                ))}
            </div>
            {hasNextPage && (
                <button className="text-primary self-start text-xs underline" disabled={isFetchingNextPage} onClick={onLoadMore} type="button">
                    {isFetchingNextPage ? "Loading..." : "More buckets"}
                </button>
            )}
            {error ? <SecReadinessNotice error={error} title="Failed to load the ETF weights" /> : null}
        </div>
    );
}
