import type { InfiniteData } from "@tanstack/react-query";

import * as React from "react";

import type { AlertEventsListState } from "@/components/alerts/alert-events-view";
import type { AlertEvent, AlertEventsResponse } from "@/lib/api/types";

import { eventsNewestFirst, loadedEventsNote, shouldAutoLoad } from "@/lib/alerts/alert-view";

type EventsQuery = {
    data: InfiniteData<AlertEventsResponse, null | string> | null;
    error: unknown;
    fetchNextPage: () => unknown;
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchNextPageError: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
};

/**
 * An oldest-first event list shown newest first: loads its next (newer) pages by itself up to `EVENT_PAGES_AUTO`
 * (`shouldAutoLoad`), merges the live events, and states how far the loaded pages reach.
 */
export function useEventList(query: EventsQuery, live: ReadonlyArray<AlertEvent> = []) {
    const pages = React.useMemo(() => query.data?.pages ?? [], [query.data]);

    const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = query;

    const load = shouldAutoLoad({ hasNextPage, isFetching, nextPageFailed: isFetchNextPageError, pageCount: pages.length });

    React.useEffect(() => {
        if (load) void fetchNextPage();
    }, [fetchNextPage, load]);

    const events = React.useMemo(() => eventsNewestFirst(pages, live), [live, pages]);

    const state: AlertEventsListState = {
        error: query.error,
        hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        isLoading: query.isLoading,
        onLoadMore: () => void fetchNextPage(),
    };

    return { events, note: loadedEventsNote(pages.reduce((sum, page) => sum + page.data.length, 0), hasNextPage), pages, state };
}
