import * as React from "react";

/** Pages a client-side filter may load by itself per filter change (every page is billed); then "Load more". */
export const FILL_PAGES_MAX = 10;

/**
 * THE rule of a list that loads its next page by itself: a next page exists, nothing is loading, the last page did not
 * fail (a failed page would be asked again at once, without end: the reader's "Load more" retries it) and fewer than
 * `max` pages count (unbounded by default: a list that needs every row).
 */
export function shouldLoadNextPage(state: { hasNextPage: boolean; isFetching: boolean; nextPageFailed: boolean; pagesLoaded: number }, max = Number.POSITIVE_INFINITY) {
    return state.hasNextPage && !state.isFetching && !state.nextPageFailed && state.pagesLoaded < max;
}

/**
 * Whether a list filtered client-side (no API parameter for the filter) should load its next page by itself: the
 * filter is on, it shows no row yet and `shouldLoadNextPage` holds for the pages loaded since the filter changed (at
 * most `max`).
 */
export function shouldFillPage(state: {
    filtering: boolean;
    hasNextPage: boolean;
    isFetching: boolean;
    nextPageFailed: boolean;
    pagesSinceChange: number;
    shownRows: number;
}, max = FILL_PAGES_MAX) {
    const { filtering, pagesSinceChange, shownRows, ...rest } = state;

    return filtering && shownRows === 0 && shouldLoadNextPage({ ...rest, pagesLoaded: pagesSinceChange }, max);
}

/**
 * Asks an infinite query for its next page by itself while `shouldLoadNextPage` holds and `enabled` (default on). Three
 * uses, one rule: every page (no `max`: the documents library and events, the documents tab, the guidance / KPI
 * histories, the catalog), the newer pages of an oldest-first event list (`max` = `EVENT_PAGES_AUTO` counted over every
 * loaded page) and a client-side filter that shows no row yet (`enabled` = filter on and nothing shown, `max` =
 * `FILL_PAGES_MAX` counted from the last `resetKey` change). Returns `capped`: enabled, a next page left and `max`
 * reached (the calendar says so). Its own module so the component tests keep it while they mock `queries.ts`.
 */
export function useAutoLoadPages(
    query: {
        fetchNextPage: () => unknown;
        hasNextPage: boolean;
        isFetching: boolean;
        /** The last `fetchNextPage` failed (React Query's `isFetchNextPageError`). */
        isFetchNextPageError: boolean;
        /** Loaded pages; only `max` reads it. */
        pageCount?: number;
    },
    options: {
        enabled?: boolean;
        max?: number;
        /** Count the pages from the last change of this key (a filter); absent = every loaded page counts. */
        resetKey?: string;
    } = {},
) {
    const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, pageCount = 0 } = query;

    const { enabled = true, max = Number.POSITIVE_INFINITY, resetKey } = options;

    // The page count when the key last changed (state, not a ref: render stays pure).
    const [base, setBase] = React.useState({ key: resetKey, pages: pageCount });

    if (base.key !== resetKey) setBase({ key: resetKey, pages: pageCount });

    const pagesLoaded = resetKey === undefined ? pageCount : base.key === resetKey ? pageCount - base.pages : 0;

    const load = enabled && shouldLoadNextPage({ hasNextPage, isFetching, nextPageFailed: isFetchNextPageError, pagesLoaded }, max);

    React.useEffect(() => {
        if (load) void fetchNextPage();
    }, [fetchNextPage, load, pageCount]);

    return { capped: enabled && hasNextPage && pagesLoaded >= max };
}
