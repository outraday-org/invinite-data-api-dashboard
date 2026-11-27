import * as React from "react";

import type { NewsListInput } from "@/lib/api/queries";
import type { NewsItemPublic } from "@/lib/api/types";
import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFilters, NewsSearch } from "@/lib/news/labels";

import { ApiRequestError } from "@/lib/api/errors";
import { useApiBaseUrl, useNewsPage } from "@/lib/api/queries";
import { shouldFillPage } from "@/lib/api/use-auto-load-pages";
import { firstPage, nextPage, pageCursor, pageNumber, pagerFor, previousPage } from "@/lib/keyset-pager";
import { useArrivalFlash } from "@/lib/live/use-arrival-flash";
import { useLiveNews } from "@/lib/live/use-live-news";
import { matchesNewsFilters, mergeLiveItems } from "@/lib/news/labels";
import { inNewsWindow, marketToday, marketWindowAnchor, marketWindowProblem } from "@/lib/news/market-window";
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
 * change; then the page's "Load the next page" takes over). An empty company needs explicit market opt-in.
 */
export function useNewsList({
    company,
    event,
    filters,
    liveTickers,
    market,
    onLiveStop,
    search,
    visible = true,
}: {
    company?: string;
    market?: true;
    visible?: boolean;
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
        market,
        sort: search.sort === "oldest" ? "published_at" : undefined,
        to: search.to,
        topic: search.topic ? [search.topic] : undefined,
    };

    // Previous / Next over the keyset cursor: the visited cursors stack up; any request change is page 1.
    const anchor = marketWindowAnchor(search, market === true);

    const filterKey = JSON.stringify([listInput, anchor]);

    const [storedPager, setPager] = React.useState(() => firstPage(filterKey));

    const pager = pagerFor(storedPager, filterKey);

    const page = pageNumber(pager);

    const windowProblem = market ? marketWindowProblem(search) : null;

    const eligible = !windowProblem && Boolean(market || company?.trim());

    const canRead = visible && eligible;

    const [recovery, setRecovery] = React.useState(0);

    const list = useNewsPage({ ...listInput, cursor: pageCursor(pager), enabled: canRead, recovery });

    if (canRead && market && page > 1 && list.error instanceof ApiRequestError && list.error.code === "cursor_mismatch") {
        setPager(firstPage(filterKey));

        // Page one can still be fresh in the query cache with the rejected next cursor.
        setRecovery(version => version + 1);
    }

    const fetched = React.useMemo(() => list.data?.data ?? [], [list.data]);

    const nextCursor = list.data?.next_cursor ?? null;

    const listed = fetched.filter(item => matchesNewsFilters(item, filters));

    const { refetch } = list;

    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const baseUrl = useApiBaseUrl();

    const recover = React.useCallback(() => {
        if (!canRead) return;

        // A background tab can cross midnight without a render. Re-evaluate its cursor and date guard
        // before reconnect/visibility recovery can issue an old-window request.
        if (market && ((anchor !== null && anchor !== marketToday()) || marketWindowProblem({ from: search.from, to: search.to }))) {
            setPager(firstPage(filterKey));

            return;
        }

        if (page === 1) void refetch();
    }, [anchor, canRead, filterKey, market, page, refetch, search.from, search.to]);

    React.useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") recover();
        };

        document.addEventListener("visibilitychange", onVisible);

        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [recover]);

    const live = useLiveNews({
        apiKey,
        apiKeyUpdatedAt,
        baseUrl,
        enabled: search.live === true && eligible,
        // What the socket filters; topic, publisher and publication type are re-checked below.
        filters: {
            ciks: liveTickers?.filter(token => /^\d+$/.test(token)),
            earningsOnly: search.earnings === "true",
            kinds: search.kind ? [search.kind] : undefined,
            sources: search.source ? [search.source] : undefined,
            tickers: liveTickers?.filter(token => !/^\d+$/.test(token)),
        },
        onResubscribed: recover,
        onStop: onLiveStop,
    });

    // Live items land on top of the newest page only (the live switch clears `sort=oldest`).
    const liveItems: Array<NewsItemPublic> = page === 1 && search.sort !== "oldest" ? live.items.filter(item => !windowProblem && matchesNewsFilters(item, filters) && inNewsWindow(item.published_at, search, Boolean(market)) && (!event || listed.some(row => row.id === item.id))) : [];

    const flashing = useArrivalFlash(liveItems, { arrivedAt: item => live.arrivals.get(item.id) ?? null, enabled: search.live === true && eligible, idOf: item => item.id, ready: list.data !== null && !list.isLoading });

    // Auto-advance while a page-side filter hides the whole page (state, not a ref: render stays pure). "Previous"
    // pauses it (going back to an all-hidden page must not jump forward again); "Next" or a filter change resumes it.
    const fillKey = JSON.stringify([filterKey, filters]);

    const [filled, setFilled] = React.useState({ key: fillKey, pages: 0, paused: false });

    if (filled.key !== fillKey) setFilled({ key: fillKey, pages: 0, paused: false });

    const current = filled.key === fillKey ? filled : { pages: 0, paused: false };

    const pagesSinceChange = current.pages;

    const fill = canRead && !list.isLoading && !current.paused && shouldFillPage({
        filtering: hasPageFilters(filters),
        hasNextPage: nextCursor !== null,
        isFetching: list.isFetching,
        nextPageFailed: Boolean(list.error),
        pagesSinceChange,
        // Live items on page 1 count as shown: the page never skips away from them.
        shownRows: listed.length + liveItems.length,
    });

    React.useEffect(() => {
        if (!fill || nextCursor === null) return;

        setFilled(state => ({ ...state, pages: state.pages + 1 }));

        setPager(nextPage(pager, nextCursor));
    }, [fill, nextCursor, pager]);

    return {
        error: list.error,
        fetched,
        flashing,
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

                setPager(nextPage(pager, nextCursor));
            },
            onPrevious: () => {
                setFilled(state => ({ ...state, paused: true }));

                setPager(previousPage(pager));
            },
            page,
        },
        /** Pages skipped by themselves since the last filter change (the "hidden" line names them). */
        skippedPages: pagesSinceChange,
        windowProblem,
    };
}
