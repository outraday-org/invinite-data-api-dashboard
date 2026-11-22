import type { ColumnDef } from "@tanstack/react-table";
import type * as React from "react";

import type { ExportConfig } from "@/components/api/export-menu";
import type { ListState } from "@/lib/api/list-state";
import type { OperationId } from "@/lib/api/operations.gen";
import type { V2MetaCoverage } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { DataTable } from "@/components/ui/data-table";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

/** A v2 SEC list page: rows in `data`, `meta.coverage` and (holders) `counting` / `pinned_at`. */
export type SecListPage<TRow> = { data: Array<TRow>; meta: Record<string, unknown> & { coverage?: V2MetaCoverage } };

const textOf = (value: unknown) => (typeof value === "string" ? value : null);

/**
 * One v2 SEC cursor list (pure), shared by the filing page's tabs (`filing-detail-views.tsx`) and the holder lists
 * (`holder-views.tsx`): the request's honest state (403 `excluded`, 404 `not_covered`, 503 `unavailable`, plan gate),
 * the answer's coverage (`pending` = still being filled, `partial`), its provenance (`pinned_at`, `counting`), an
 * optional note, the rows with "Load more" / export, and a failed next page under the table.
 */
export function SecListFrame<TRow>({
    columns,
    emptyText,
    errorTitle,
    exportConfig,
    note,
    operationId,
    state,
}: {
    columns: Array<ColumnDef<TRow>>;
    emptyText: string;
    errorTitle: string;
    exportConfig?: ExportConfig<TRow>;
    note?: React.ReactNode;
    operationId: OperationId;
    state: ListState<SecListPage<TRow>>;
}) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} operationId={operationId} title={errorTitle} />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta && { counting: textOf(meta.counting), coverage: meta.coverage, pinned_at: textOf(meta.pinned_at) }} />
            {note}
            <DataTable
                columns={columns}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText={emptyText}
                exportConfig={exportConfig}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId={operationId}
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} operationId={operationId} title={errorTitle} /> : null}
        </div>
    );
}
