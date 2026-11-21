/**
 * The state a cursor list view renders (pure views take it as a prop): the pages loaded so far, "Load more" and the
 * request's error. `listState` builds it from an infinite query (`useEarningsInfinite` and the alerts' hooks), so a
 * page never spells the six fields out by hand.
 */
export type ListState<TPage> = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<TPage>;
};

export function listState<TPage>(query: {
    data: null | undefined | { pages: Array<TPage> };
    error: unknown;
    fetchNextPage: () => unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
}): ListState<TPage> {
    return {
        error: query.error,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        isLoading: query.isLoading,
        onLoadMore: () => void query.fetchNextPage(),
        pages: query.data?.pages ?? [],
    };
}
