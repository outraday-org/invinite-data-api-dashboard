import * as React from "react";

/**
 * Loads every page of an infinite list (the API has no totals: counts and client-side filters need all rows): asks
 * for the next page while there is one and nothing is in flight; stops at a failed page. Its own module so the
 * component tests keep it while they mock `queries.ts` (and its server functions).
 */
export function useLoadAllPages(query: {
    fetchNextPage: () => Promise<unknown>;
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchNextPageError: boolean;
}) {
    const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = query;

    React.useEffect(() => {
        if (hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage();
    }, [fetchNextPage, hasNextPage, isFetching, isFetchNextPageError]);
}
