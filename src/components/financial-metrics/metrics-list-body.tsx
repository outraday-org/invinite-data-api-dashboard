import * as React from "react";

import type { V2MetaCoverage } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { ErrorState } from "@/components/ui/error-state";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, errorDescription, isTierError } from "@/lib/api/errors";
import { isV2GenuineEmpty, secErrorState } from "@/lib/sec/readiness";

export const METRICS_PENDING_TITLE = "Metrics are being prepared — asked again in 30 s";

/**
 * The honest state of a financials / metrics request: the plan gate of a PRO view (403 `plan_required`), the
 * problems (404 `not_covered`, 503 `unavailable`, …; any other problem with its code and request id) and a 200's
 * `meta.coverage` (pending = being prepared, asked again every 30 s; partial). Renders nothing for a complete answer.
 */
export function FinancialsStateNotice({
    coverage,
    error,
    pendingTitle,
    title,
}: {
    coverage?: null | Pick<V2MetaCoverage, "state" | "through">;
    error?: unknown;
    pendingTitle: string;
    title: string;
}) {
    if (error && isTierError(error)) {
        return (
            // Shared by STANDARD and PRO operations: the API's own message below names the plan, the badge does not.
            <Notice badge="Plan" title="Your plan does not include this view">
                {error instanceof Error && error.message ? error.message : undefined}
            </Notice>
        );
    }

    // A problem that is no page state (500, 402, 429, …): its detail, code and request id (`errorDescription`).
    if (error instanceof ApiRequestError && secErrorState(error).kind === "error") {
        return <ErrorState message={errorDescription(error)} title={title} />;
    }

    return (
        <SecReadinessNotice
            coverage={coverage}
            error={error}
            title={title}
            titles={{
                not_ready: "Not switched on yet",
                pending: pendingTitle,
                unknown: "No data for this company",
            }}
        />
    );
}

/** The cursor-list state every financials / metrics page passes to its pure view. */
export type MetricsListState = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
};

/** What the surrounding `MetricsListBody` hands its period table: "Load older periods" (null = last page) and the toolbar. */
const PeriodListContext = React.createContext<{ loadOlder: React.ReactNode; toolbar: React.ReactNode }>({ loadOlder: null, toolbar: null });

/** The line above a period table: the currency, a hint (left), the tree's Expand / Collapse all and "Load older periods" (right). */
export function FinancialsTableToolbar({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="text-muted-foreground flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs" data-slot="financials-table-toolbar">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3">{children}</div>
            {actions && <div className="text-foreground ml-auto flex shrink-0 items-center gap-3">{actions}</div>}
        </div>
    );
}

/**
 * A period table with its toolbar line above it: the next page adds COLUMNS, so "Load older periods" sits at the right
 * end of that line, outside the table's sideways scroll, and the table takes the full width. The button and the
 * page's toolbar come from the surrounding `MetricsListBody` (context); a table with its own line (the presentation
 * tree's Expand / Collapse all) passes `toolbar` / `actions`.
 */
export function PeriodTableFrame({
    actions,
    children,
    toolbar,
}: {
    actions?: React.ReactNode;
    children: React.ReactNode;
    toolbar?: React.ReactNode;
}) {
    const list = React.use(PeriodListContext);

    const left = toolbar ?? list.toolbar;

    const right = actions || list.loadOlder
        ? (
                <>
                    {actions}
                    {list.loadOlder}
                </>
            )
        : null;

    return (
        <div className="flex min-w-0 flex-col gap-2" data-slot="period-table-frame">
            {(left || right) && <FinancialsTableToolbar actions={right}>{left}</FinancialsTableToolbar>}
            {children}
        </div>
    );
}

/**
 * The body of a v2 financials / metrics / segments page (statements, ratios, growth, CAGR, segments): the request's
 * state, the coverage notice (pending = being prepared), the table when rows are loaded, "No … available" only for a
 * complete empty last page, and "Load older periods" (older periods by `next_cursor`) — beside the table through
 * `PeriodTableFrame`'s toolbar line, or under the empty state when no table shows. `toolbar` = the left of that line
 * (the currency, a hint).
 */
export function MetricsListBody({
    children,
    coverage,
    emptyText,
    hasRows,
    loadedPages,
    pendingTitle = METRICS_PENDING_TITLE,
    state,
    title,
    toolbar,
}: {
    children: React.ReactNode;
    coverage: null | Pick<V2MetaCoverage, "state" | "through"> | undefined;
    emptyText: string;
    hasRows: boolean;
    loadedPages: number;
    pendingTitle?: string;
    state: MetricsListState;
    title: string;
    toolbar?: React.ReactNode;
}) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore } = state;

    if (error && loadedPages === 0) return <FinancialsStateNotice error={error} pendingTitle={pendingTitle} title={title} />;

    if (isLoading && loadedPages === 0) return <Skeleton className="h-64 w-full" />;

    const loadOlder = <LoadMoreButton className="pt-0" direction="right" hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onLoadMore={onLoadMore} />;

    return (
        <div className="flex flex-col gap-2">
            <FinancialsStateNotice coverage={coverage} pendingTitle={pendingTitle} title={title} />
            {hasRows
                ? (
                        <>
                            <PeriodListContext value={{ loadOlder: hasNextPage ? loadOlder : null, toolbar: toolbar ?? null }}>{children}</PeriodListContext>
                        </>
                    )
                : (
                        <>
                            {isV2GenuineEmpty(coverage) && !hasNextPage ? <div className="text-muted-foreground">{emptyText}</div> : null}
                            {loadOlder}
                        </>
                    )}
            {error ? <FinancialsStateNotice error={error} pendingTitle={pendingTitle} title="Failed to load more periods" /> : null}
        </div>
    );
}
