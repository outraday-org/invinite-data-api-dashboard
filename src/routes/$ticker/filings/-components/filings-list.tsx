import type * as React from "react";

import type { FilingListRow } from "@/lib/sec/parity";

import { DataTable } from "@/components/ui/data-table";

import { filingColumns } from "./filing-columns";

/** The filings table: one row per accession (`DataTable`), "Load more" by `next_cursor`. */
export function FilingsList({
    displayFilings,
    emptyIsGenuine = true,
    errorState,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onFetchNextPage,
    onOpenHtml,
    onOpenSecDocuments,
    onSortToggle,
    renderDetailsLink,
    sortDirection,
    ticker,
}: {
    displayFilings: ReadonlyArray<FilingListRow>;
    /** false while the answer's coverage is pending / partial: no rows is then not "No filings found". */
    emptyIsGenuine?: boolean;
    /** A failed next page (the first page's failure replaces the table). */
    errorState?: React.ReactNode;
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onFetchNextPage: () => void;
    onOpenHtml: (filing: FilingListRow) => void;
    onOpenSecDocuments?: (filing: FilingListRow) => void;
    /** The filing page link of a row (`/filings/$accession`). */
    renderDetailsLink?: (filing: FilingListRow) => React.ReactNode;
    sortDirection: "asc" | "desc";
    onSortToggle: () => void;
    /** The export's file-name scope; none = no Export menu. */
    ticker?: string;
}) {
    return (
        <DataTable
            columns={filingColumns({ onOpenHtml, onOpenSecDocuments, onSortToggle, renderDetailsLink, sortDirection })}
            emptyIsGenuine={emptyIsGenuine}
            emptyText="No filings found."
            errorState={errorState}
            exportConfig={ticker ? { dataset: "filings", scope: ticker } : undefined}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isLoading}
            onLoadMore={onFetchNextPage}
            operationId="listFilings"
            rows={[...displayFilings]}
        />
    );
}
