import type * as React from "react";

import type { V2MetaCoverage } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { ApiRequestError, errorDescription, isTierError } from "@/lib/api/errors";
import { isV2GenuineEmpty, secErrorState } from "@/lib/sec/readiness";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

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
            <Notice badge="PRO" title="Your plan does not include this view">
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

/**
 * The body of a v2 financials / metrics / segments page (statements, ratios, growth, CAGR, segments): the request's
 * state, the coverage notice (pending = being prepared), the table when rows are loaded, "No … available" only for a
 * complete empty last page, and "Load more" (older periods by `next_cursor`).
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
}: {
    children: React.ReactNode;
    coverage: null | Pick<V2MetaCoverage, "state" | "through"> | undefined;
    emptyText: string;
    hasRows: boolean;
    loadedPages: number;
    pendingTitle?: string;
    state: MetricsListState;
    title: string;
}) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore } = state;

    if (error && loadedPages === 0) return <FinancialsStateNotice error={error} pendingTitle={pendingTitle} title={title} />;

    if (isLoading && loadedPages === 0) return <div className="text-muted-foreground text-sm">Loading financials...</div>;

    return (
        <div className="flex flex-col gap-2 h-0 grow">
            <FinancialsStateNotice coverage={coverage} pendingTitle={pendingTitle} title={title} />
            {hasRows
                ? children
                : (isV2GenuineEmpty(coverage) && !hasNextPage ? <div className="text-muted-foreground text-sm">{emptyText}</div> : null)}
            <LoadMoreButton hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onLoadMore={onLoadMore} />
            {error ? <FinancialsStateNotice error={error} pendingTitle={pendingTitle} title="Failed to load more periods" /> : null}
        </div>
    );
}
