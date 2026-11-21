import * as React from "react";

/** Pages a client-side filter may load by itself per filter change (every page is billed); then "Load more". */
export const FILL_PAGES_MAX = 10;

/**
 * Whether a list filtered client-side (no API parameter for the filter) should load its next page by itself: the
 * filter is on, it shows no row yet, a next page exists, nothing is loading and fewer than `max` pages were loaded
 * since the filter changed.
 */
export function shouldFillPage(state: {
    filtering: boolean;
    hasNextPage: boolean;
    isFetching: boolean;
    pagesSinceChange: number;
    shownRows: number;
}, max = FILL_PAGES_MAX) {
    return state.filtering && state.shownRows === 0 && state.hasNextPage && !state.isFetching && state.pagesSinceChange < max;
}

/**
 * Auto-loads further pages of a client-filtered list until it has a row or the window is exhausted, at most
 * `FILL_PAGES_MAX` pages per filter change (`resetKey`); after that the page's "Load more" takes over. Returns whether
 * the cap was reached with nothing shown (the page says so).
 */
export function useFillPages(options: {
    fetchNextPage: () => unknown;
    filtering: boolean;
    hasNextPage: boolean;
    isFetching: boolean;
    pageCount: number;
    resetKey: string;
    shownRows: number;
}) {
    const { fetchNextPage, filtering, hasNextPage, isFetching, pageCount, resetKey, shownRows } = options;

    // The page count when the filter last changed (state, not a ref: render stays pure).
    const [base, setBase] = React.useState({ key: resetKey, pages: pageCount });

    if (base.key !== resetKey) setBase({ key: resetKey, pages: pageCount });

    const pagesSinceChange = base.key === resetKey ? pageCount - base.pages : 0;

    const fill = shouldFillPage({ filtering, hasNextPage, isFetching, pagesSinceChange, shownRows });

    React.useEffect(() => {
        if (fill) void fetchNextPage();
    }, [fill, fetchNextPage, pageCount]);

    return { capped: filtering && shownRows === 0 && hasNextPage && pagesSinceChange >= FILL_PAGES_MAX };
}
