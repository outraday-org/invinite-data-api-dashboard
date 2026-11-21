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
    sortDirection,
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
    sortDirection: "asc" | "desc";
    onSortToggle: () => void;
}) {
    return (
        <DataTable
            columns={filingColumns({ onOpenHtml, onOpenSecDocuments, onSortToggle, sortDirection })}
            emptyIsGenuine={emptyIsGenuine}
            emptyText="No filings found."
            errorState={errorState}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isLoading}
            onLoadMore={onFetchNextPage}
            rows={[...displayFilings]}
        />
    );
}
