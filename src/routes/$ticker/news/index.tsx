import type * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import type { NewsListInput } from "@/lib/api/queries";
import type { NewsItemPublic } from "@/lib/api/types";
import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFilters, NewsSearch } from "@/lib/news/labels";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isTierError } from "@/lib/api/errors";
import { useApiBaseUrl, useCompanyDetails, useNewsPage } from "@/lib/api/queries";
import { useLiveNews } from "@/lib/live/use-live-news";
import { issuerLabels, matchesNewsFilters, mergeLiveItems, validateNewsSearch } from "@/lib/news/labels";
import { firstNewsPage, newsPageCursor, newsPageNumber, newsPagerFor, nextNewsPage, previousNewsPage } from "@/lib/news/pager";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { Notice } from "@/routes/$ticker/earnings-calls/-components/media-state";

import { NewsFilters as NewsFilterControls } from "./-components/news-filters";
import { NewsItemPanel } from "./-components/news-item-panel";
import { NewsLiveToggle } from "./-components/news-live-toggle";
import { NewsPager } from "./-components/news-pager";
import { NewsTable } from "./-components/news-table";

export const Route = createFileRoute("/$ticker/news/")({
    component: NewsPage,
    validateSearch: validateNewsSearch,
});

const PAGE_SIZE = 50;

/** The list's request state: `/v2/news` is FREE, so a plan gate is unexpected but still a notice, not an error. */
function ListError({ error }: { error: unknown }) {
    if (isTierError(error)) return <Notice badge="FREE" title="Your plan does not include news" />;

    return <ErrorState error={error} title="Failed to load the news" />;
}

/**
 * The list when the page-side filters hid rows of the loaded page: never an empty-looking list while older news
 * follows — every row hidden + a next page = a line saying so and a button to load it; some hidden = a count under
 * the table.
 */
function FilteredOut({ hidden, pager, shown }: { hidden: number; pager: React.ComponentProps<typeof NewsPager>; shown: number }) {
    if (shown > 0) {
        return (
            <div className="text-muted-foreground p-2 text-center text-xs" data-testid="news-filtered-out">
                {`${hidden.toLocaleString("en-US")} more ${hidden === 1 ? "item" : "items"} on this page hidden by the filters.`}
            </div>
        );
    }

    return (
        <div className="text-muted-foreground flex flex-col items-center gap-2 p-2 text-center text-xs" data-testid="news-filtered-out">
            {pager.hasNext
                ? `None of the ${hidden.toLocaleString("en-US")} items on this page match the filters; older news follows.`
                : "No news on this page matches the filters."}
            {pager.hasNext && (
                <Button disabled={pager.isFetching} onClick={pager.onNext} size="sm" type="button" variant="outline">
                    Load the next page
                </Button>
            )}
        </div>
    );
}

/** The News page body (pure: tested in `src/routes/-tests/news-page.test.tsx`). */
export function NewsPageView({
    controls,
    emptyText = "No news in this window.",
    error,
    hiddenByFilters = 0,
    isLoading,
    items,
    liveIds,
    notice,
    onOpen,
    pager,
    scopeLabel,
}: {
    controls?: React.ReactNode;
    /** The empty list's line. */
    emptyText?: string;
    error: unknown;
    /**
     * Rows of the loaded page the page-side filters hid (source, earnings, Company-published: `/v2/news` has no
     * parameter for them), so a page can show fewer rows than it loaded, or none.
     */
    hiddenByFilters?: number;
    isLoading: boolean;
    items: ReadonlyArray<NewsItemPublic>;
    liveIds?: ReadonlySet<string>;
    notice?: React.ReactNode;
    onOpen: (id: string) => void;
    /** The page shown and its neighbours (`NewsPager`, centred under the table). */
    pager: React.ComponentProps<typeof NewsPager>;
    scopeLabel: string;
}) {
    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col gap-3 shrink-0">
                <div className="flex flex-col gap-1">
                    <div>News</div>
                    <div className="text-muted-foreground text-sm">
                        {`${scopeLabel}: SEC filings and the companies' own newsroom publications, newest first. `}
                        Texts are the publishers&apos; own words, shown with their source and date; wire services are never a source.
                    </div>
                </div>
                {controls}
                {notice}
            </div>

            {error
                ? <ListError error={error} />
                : (
                        <>
                            {/* Keyed by page: a new page starts at the top of the table. */}
                            <ScrollArea className="h-0 grow" key={pager.page}>
                                {!isLoading && items.length === 0 && hiddenByFilters === 0
                                    ? <div className="text-muted-foreground w-full p-2 text-center text-xs">{emptyText}</div>
                                    : !isLoading && items.length === 0
                                            ? <FilteredOut hidden={hiddenByFilters} pager={pager} shown={0} />
                                            : <NewsTable isLoading={isLoading} items={items} liveIds={liveIds} onOpen={onOpen} />}
                                {!isLoading && items.length > 0 && hiddenByFilters > 0 && (
                                    <FilteredOut hidden={hiddenByFilters} pager={pager} shown={items.length} />
                                )}
                            </ScrollArea>
                            <NewsPager {...pager} />
                        </>
                    )}
        </div>
    );
}

function NewsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    // "Company-published" keeps the items the company published itself (its verified publications, by CIK) among the
    // ones that mention it: v2 has no publisher filter, so it filters the loaded page (as source and earnings do).
    const company = useCompanyDetails(ticker).data?.companies[0];

    const publisherCik = search.published ? company?.cik.replace(/^0+/, "") : undefined;

    // `/v2/news` filters by company, kind, topic and the published window; v2 has no market-wide feed (decision 15:
    // a company scope is required), so a stale `?scope=market` URL reads the company's news.
    const listInput: NewsListInput = {
        company: ticker,
        from: search.from,
        kind: search.kind ? [search.kind] : undefined,
        limit: PAGE_SIZE,
        to: search.to,
        topic: search.topic ? [search.topic] : undefined,
    };

    // Previous / Next over the keyset cursor: the visited cursors stack up; any filter or date change is page 1.
    const filterKey = JSON.stringify(listInput);

    const [storedPager, setPager] = useState(() => firstNewsPage(filterKey));

    const pager = newsPagerFor(storedPager, filterKey);

    const page = newsPageNumber(pager);

    const list = useNewsPage({ ...listInput, cursor: newsPageCursor(pager) });

    const fetched = list.data?.data ?? [];

    const nextCursor = list.data?.next_cursor ?? null;

    const filters: NewsFilters = {
        category: search.category,
        earnings: search.earnings,
        kind: search.kind,
        publicationType: search.pubType,
        publisherCik,
        source: search.source,
        tag: search.tag,
        topic: search.topic,
    };

    // The filters `/v2/news` has no parameter for (source, earnings, Company-published + its type / category / tag) are
    // applied to the loaded page; a page may then show fewer rows than PAGE_SIZE.
    const listed = fetched.filter(item => matchesNewsFilters(item, filters));

    const onFilterChange = (patch: Partial<NewsSearch>) => {
        void navigate({ search: prev => ({ ...prev, ...patch }) });
    };

    const [stop, setStop] = useState<LiveNewsStop | null>(null);

    // React Compiler memoizes these (no manual useCallback): the live hook reads them through a ref anyway.
    const onLiveStop = (reason: LiveNewsStop) => {
        setStop(reason);

        void navigate({ replace: true, search: prev => ({ ...prev, live: undefined }) });
    };

    const { refetch } = list;

    const onResubscribed = () => {
        void refetch();
    };

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
            tickers: [ticker],
        },
        onResubscribed,
        onStop: onLiveStop,
    });

    // Live items land on top of the newest page only.
    const liveItems = page === 1 ? live.items.filter(item => matchesNewsFilters(item, filters)) : [];

    const items = mergeLiveItems(liveItems, listed);

    const liveIds = new Set(liveItems.map(item => item.id));

    const openItem = (id: string) => void navigate({ search: prev => ({ ...prev, item: id }) });

    const selectedTitle = items.find(item => item.id === search.item)?.title;

    const controls = (
        <div className="flex flex-wrap items-start justify-between gap-2">
            <NewsFilterControls
                categories={publisherCik ? issuerLabels(fetched, publisherCik, "categories") : []}
                onChange={onFilterChange}
                search={search}
                tags={publisherCik ? issuerLabels(fetched, publisherCik, "tags") : []}
            />
            <NewsLiveToggle
                live={search.live === true}
                mode={live.mode}
                onChange={(on) => {
                    setStop(null);

                    onFilterChange({ live: on || undefined });
                }}
            />
        </div>
    );

    const notice = stop && (
        <Notice badge={stop.kind === "plan" ? "STANDARD" : undefined} title={stop.message}>
            {stop.kind === "plan" ? "The live news feed needs the STANDARD plan; the list above still works." : undefined}
        </Notice>
    );

    return (
        <>
            <NewsPageView
                controls={controls}
                emptyText={search.from || search.to ? undefined : "No news yet."}
                error={list.error}
                hiddenByFilters={fetched.length - listed.length}
                isLoading={list.isLoading}
                items={items}
                liveIds={liveIds}
                notice={notice}
                onOpen={openItem}
                pager={{
                    hasNext: nextCursor !== null,
                    isFetching: list.isFetching,
                    onNext: () => {
                        if (nextCursor !== null) setPager(nextNewsPage(pager, nextCursor));
                    },
                    onPrevious: () => setPager(previousNewsPage(pager)),
                    page,
                }}
                scopeLabel={search.published ? `Published by ${company?.name ?? ticker}` : `News about ${ticker}`}
            />
            <NewsItemPanel
                id={search.item ?? null}
                onClose={() => void navigate({ search: prev => ({ ...prev, item: undefined }) })}
                title={selectedTitle}
            />
        </>
    );
}
