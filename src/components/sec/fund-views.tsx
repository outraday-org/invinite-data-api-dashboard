import type { ColumnDef } from "@tanstack/react-table";

import type { V2FundPosition, V2FundPositionsResponse, V2FundSource, V2FundWeightsResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { SecurityLink } from "@/components/sec/security-link";
import { Badge } from "@/components/ui/badge";
import { Copyable } from "@/components/ui/copy-button";
import { DataTable } from "@/components/ui/data-table";
import { Notice } from "@/components/ui/notice";
import {
    FUND_DIMENSION_LABELS,
    fundBasisNote,
    fundReasonText,
    fundSourceText,
    fundWeightsByDimension,
} from "@/lib/sec/fund";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { formatNumberEn } from "@/lib/utils";

/**
 * Views of a listed fund's composition (Data API 7.0): its positions (`/v1/funds/{fund}/holdings`) and the sector /
 * country / asset-class weights (`/v1/funds/{fund}/weights`). Every answer names its source and as-of date; pure (state
 * in, markup out). A position links its instrument or issuer (`SecurityLink`). Who holds a security is `holder-views.tsx`.
 */

export type FundListState<TPage> = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<TPage>;
};

export const currency = new Intl.NumberFormat("en", { currency: "USD", maximumFractionDigits: 0, style: "currency" });

export const money = (value: null | number | undefined) => (value == null || !Number.isFinite(value) ? "—" : currency.format(value));

export const count = (value: null | number | undefined) => (value == null || !Number.isFinite(value) ? "—" : formatNumberEn(value));

/** `weight_pct` is already percent (7.1 = 7.1 %). */
export const weightText = (value: null | number | undefined) =>
    value == null || !Number.isFinite(value) ? "—" : `${formatNumberEn(value, { maximumFractionDigits: 2 })}%`;

export const right = (text: string) => <div className="text-right tabular-nums">{text}</div>;

/** The "Issuer file · as of Nov 13, 2026" badge (nothing when the answer names no source). */
export function FundSourceBadge({ asOf, source }: { asOf: null | string | undefined; source: null | undefined | V2FundSource }) {
    const text = fundSourceText(source, asOf);

    if (!text) return null;

    return (
        <Badge data-testid="fund-source-badge" variant={source === "nport" ? "outline" : "secondary"}>
            {text}
        </Badge>
    );
}

const COMPOSITION_COLUMNS: Array<ColumnDef<V2FundPosition>> = [
    {
        cell: ({ row }) => (
            <div className="truncate">
                <SecurityLink security={row.original.security}>{row.original.security.name ?? row.original.security.symbol ?? "—"}</SecurityLink>
            </div>
        ),
        header: "Holding",
        id: "name",
    },
    { cell: ({ row }) => row.original.security.symbol ?? "—", header: "Ticker", id: "symbol" },
    {
        cell: ({ row }) => (row.original.security.cusip
            ? <Copyable className="tabular-nums" label="Copy CUSIP" value={row.original.security.cusip} />
            : "—"),
        header: "CUSIP",
        id: "cusip",
    },
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
const NOTIONAL_COLUMN: ColumnDef<V2FundPosition> = {
    accessorKey: "notional_value_usd",
    cell: ({ row }) => right(money(row.original.notional_value_usd)),
    header: () => <div className="text-right">Notional</div>,
};

/** Only derivative lines carry a notional: the column shows when one row of the answer has one (leveraged / inverse). */
const hasNotional = (rows: ReadonlyArray<V2FundPosition>) => rows.some(row => row.notional_value_usd != null);

/**
 * One fund's composition (`/v1/funds/{fund}/holdings`), largest weight first: the source badge, the reason of a partial or
 * deliberately empty answer (a single-asset trust is a notice, never an empty table), the rows and "Load more".
 */
export function FundCompositionList({ exportScope, state }: { exportScope?: string; state: FundListState<V2FundPositionsResponse> }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the fund holdings" />;

    const meta = pages.at(0)?.meta;

    const rows = pages.flatMap(page => page.data);

    const reason = fundReasonText(meta?.reason);

    const columns = hasNotional(rows) ? [...COMPOSITION_COLUMNS, NOTIONAL_COLUMN] : COMPOSITION_COLUMNS;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <FundSourceBadge asOf={meta?.as_of} source={meta?.source} />
            </div>
            {meta?.reason === "single_asset_trust"
                ? (
                        <Notice badge="Single asset" title={reason ?? ""} />
                    )
                : (
                        <>
                            {reason && <div className="text-muted-foreground text-xs">{reason}</div>}
                            <DataTable
                                columns={columns}
                                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                                emptyText="No positions in this composition."
                                exportConfig={exportScope ? { dataset: "fund-holdings", scope: exportScope } : undefined}
                                hasNextPage={hasNextPage}
                                isFetchingNextPage={isFetchingNextPage}
                                isLoading={isLoading}
                                onLoadMore={onLoadMore}
                                operationId="listFundPositions"
                                rows={rows}
                            />
                        </>
                    )}
            {error ? <SecReadinessNotice error={error} title="Failed to load the fund holdings" /> : null}
        </div>
    );
}

/**
 * The weights of the same composition (`/v1/funds/{fund}/weights`): one block per dimension, buckets as bars (largest first,
 * "Unclassified" / "Cash and other" shown as buckets), the basis in plain words under each block. Weights that do not
 * add up to 100 % (leveraged / inverse funds) are drawn as stated, never scaled.
 */
export function FundWeightsBlock({ state }: { state: FundListState<V2FundWeightsResponse> }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the fund weights" />;

    if (isLoading && pages.length === 0) return <div className="text-muted-foreground text-sm">Loading weights...</div>;

    const meta = pages.at(0)?.meta;

    const groups = fundWeightsByDimension(pages.flatMap(page => page.data));

    if (groups.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                <SecReadinessNotice coverage={meta?.coverage} />
                {isV2GenuineEmpty(meta?.coverage) && <div className="text-muted-foreground text-sm">No weights for this composition.</div>}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3" data-testid="fund-weights">
            <SecReadinessNotice coverage={meta?.coverage} />
            <div className="grid gap-4 md:grid-cols-3">
                {groups.map(group => (
                    <div className="flex flex-col gap-1" key={group.dimension}>
                        <div className="text-sm font-medium">{FUND_DIMENSION_LABELS[group.dimension]}</div>
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
                        <div className="text-muted-foreground text-xs">{`Basis: ${fundBasisNote(group.weights) ?? "—"}`}</div>
                    </div>
                ))}
            </div>
            {hasNextPage && (
                <button className="text-primary self-start text-xs underline" disabled={isFetchingNextPage} onClick={onLoadMore} type="button">
                    {isFetchingNextPage ? "Loading..." : "More buckets"}
                </button>
            )}
            {error ? <SecReadinessNotice error={error} title="Failed to load the fund weights" /> : null}
        </div>
    );
}
