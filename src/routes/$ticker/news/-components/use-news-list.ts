import * as React from "react";

import type { NewsListInput } from "@/lib/api/queries";
import type { NewsItemPublic } from "@/lib/api/types";
import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFilters, NewsSearch } from "@/lib/news/labels";

import { useApiBaseUrl, useNewsPage } from "@/lib/api/queries";
import { shouldFillPage } from "@/lib/api/use-fill-pages";
import { useLiveNews } from "@/lib/live/use-live-news";
import { matchesNewsFilters, mergeLiveItems } from "@/lib/news/labels";
import { firstNewsPage, newsPageCursor, newsPageNumber, newsPagerFor, nextNewsPage, previousNewsPage } from "@/lib/news/pager";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

export const NEWS_PAGE_SIZE = 50;

/** What the list asks and filters: the route's search params both pages share. */
export type NewsListSearch = Pick<NewsSearch, "earnings" | "from" | "kind" | "live" | "sort" | "source" | "to" | "topic">;

/** Whether a filter `/v1/news` has no parameter for is on (the loaded page is filtered in the browser). */
export function hasPageFilters(filters: NewsFilters) {
    return Boolean(filters.source || filters.earnings || filters.publisherCik);
}

/**
 * The news list of a page (the News page: one company; `/news-feed`: the watchlist as one comma list): one page per
 * keyset cursor with the pager, the page-side filters, the live stream merged on top of page 1, and — while a page-side
 * filter hides every row of a page — the next page asked by itself (`shouldFillPage`: at most 10 pages per filter
 * change; then the page's "Load the next page" takes over). `company: ""` = no REST list (the live-only market scope).
 */
export function useNewsList({
    company,
    event,
    filters,
    liveTickers,
    onLiveStop,
    search,
}: {
    company: string;
    event?: string;
    filters: NewsFilters;
    /** The live subscription's tickers; `undefined` = the whole market. */
    liveTickers: ReadonlyArray<string> | undefined;
    onLiveStop: (stop: LiveNewsStop) => void;
    search: NewsListSearch;
}) {
    const listInput: NewsListInput = {
        company,
        event,
        from: search.from,
        kind: search.kind ? [search.kind] : undefined,
        limit: NEWS_PAGE_SIZE,
        sort: search.sort === "oldest" ? "published_at" : undefined,
        to: search.to,
        topic: search.topic ? [search.topic] : undefined,
    };

    // Previous / Next over the keyset cursor: the visited cursors stack up; any request change is page 1.
    const filterKey = JSON.stringify(listInput);

    const [storedPager, setPager] = React.useState(() => firstNewsPage(filterKey));

    const pager = newsPagerFor(storedPager, filterKey);

    const page = newsPageNumber(pager);

    const list = useNewsPage({ ...listInput, cursor: newsPageCursor(pager) });

    const fetched = React.useMemo(() => list.data?.data ?? [], [list.data]);

    const nextCursor = list.data?.next_cursor ?? null;

    const listed = fetched.filter(item => matchesNewsFilters(item, filters));

    // Auto-advance while a page-side filter hides the whole page (state, not a ref: render stays pure). "Previous"
    // pauses it (going back to an all-hidden page must not jump forward again); "Next" or a filter change resumes it.
    const fillKey = JSON.stringify([filterKey, filters]);

    const [filled, setFilled] = React.useState({ key: fillKey, pages: 0, paused: false });

    if (filled.key !== fillKey) setFilled({ key: fillKey, pages: 0, paused: false });

    const current = filled.key === fillKey ? filled : { pages: 0, paused: false };

    const pagesSinceChange = current.pages;

    const fill = !list.isLoading && !current.paused && shouldFillPage({
        filtering: hasPageFilters(filters),
        hasNextPage: nextCursor !== null,
        isFetching: list.isFetching,
        nextPageFailed: Boolean(list.error),
        pagesSinceChange,
        shownRows: listed.length,
    });

    React.useEffect(() => {
        if (!fill || nextCursor === null) return;

        setFilled(state => ({ ...state, pages: state.pages + 1 }));

        setPager(nextNewsPage(pager, nextCursor));
    }, [fill, nextCursor, pager]);

    const { refetch } = list;

    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const baseUrl = useApiBaseUrl();

    const live = useLiveNews({
        apiKey,
        apiKeyUpdatedAt,
        baseUrl,
        enabled: search.live === true,
        // What the socket filters; topic, publisher and publication type are re-checked below.
        filters: {
            earningsOnly: search.earnings === "true",
            kinds: search.kind ? [search.kind] : undefined,
            sources: search.source ? [search.source] : undefined,
            tickers: liveTickers ? [...liveTickers] : undefined,
        },
        onResubscribed: () => {
            void refetch();
        },
        onStop: onLiveStop,
    });

    // Live items land on top of the newest page only (the live switch clears `sort=oldest`).
    const liveItems: Array<NewsItemPublic> = page === 1 && search.sort !== "oldest" ? live.items.filter(item => matchesNewsFilters(item, filters)) : [];

    return {
        error: list.error,
        fetched,
        hidden: fetched.length - listed.length,
        isLoading: list.isLoading,
        items: mergeLiveItems(liveItems, listed),
        liveIds: new Set(liveItems.map(item => item.id)),
        liveMode: live.mode,
        page,
        pager: {
            hasNext: nextCursor !== null,
            isFetching: list.isFetching,
            onNext: () => {
                if (nextCursor === null) return;

                setFilled(state => ({ ...state, paused: false }));

                setPager(nextNewsPage(pager, nextCursor));
            },
            onPrevious: () => {
                setFilled(state => ({ ...state, paused: true }));

                setPager(previousNewsPage(pager));
            },
            page,
        },
        /** Pages skipped by themselves since the last filter change (the "hidden" line names them). */
        skippedPages: pagesSinceChange,
    };
}
