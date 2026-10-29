import type * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import type { NewsItemPublic } from "@/lib/api/types";
import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFilters, NewsSearch } from "@/lib/news/labels";

import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isTierError } from "@/lib/api/errors";
import { useApiBaseUrl, useCompanyDetails, useNewsInfinite } from "@/lib/api/queries";
import { useLiveNews } from "@/lib/live/use-live-news";
import { issuerLabels, matchesNewsFilters, mergeLiveItems, validateNewsSearch } from "@/lib/news/labels";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { Notice } from "@/routes/$ticker/earnings-calls/-components/media-state";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

import { NewsFilters as NewsFilterControls } from "./-components/news-filters";
import { NewsItemPanel } from "./-components/news-item-panel";
import { NewsLiveToggle } from "./-components/news-live-toggle";
import { NewsTable } from "./-components/news-table";

export const Route = createFileRoute("/$ticker/news/")({
    component: NewsPage,
    validateSearch: validateNewsSearch,
});

const PAGE_SIZE = 50;

/** The list's request state: `/v1/news` is FREE, so a plan gate is unexpected but still a notice, not an error. */
function ListError({ error }: { error: unknown }) {
    if (isTierError(error)) return <Notice badge="FREE" title="Your plan does not include news" />;

    return <ErrorState error={error} title="Failed to load the news" />;
}

/** The News page body (pure: tested in `src/routes/-tests/news-page.test.tsx`). */
export function NewsPageView({
    controls,
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    items,
    liveIds,
    notice,
    onLoadMore,
    onOpen,
    scopeLabel,
}: {
    controls?: React.ReactNode;
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    items: ReadonlyArray<NewsItemPublic>;
    liveIds?: ReadonlySet<string>;
    notice?: React.ReactNode;
    onLoadMore: () => void;
    onOpen: (id: string) => void;
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
                        <ScrollArea className="h-0 grow">
                            {!isLoading && items.length === 0
                                ? <div className="text-muted-foreground w-full p-2 text-center text-xs">No news in this window.</div>
                                : <NewsTable isLoading={isLoading} items={items} liveIds={liveIds} onOpen={onOpen} />}
                            <LoadMoreButton hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} onLoadMore={onLoadMore} />
                        </ScrollArea>
                    )}
        </div>
    );
}

function NewsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const market = search.scope === "market";

    // "Company-published" filters by the publisher's CIK (verified issuer publications), not the ticker it mentions.
    const company = useCompanyDetails(ticker).data?.companies[0];

    const publisherCik = search.published ? company?.cik.replace(/^0+/, "") : undefined;

    const list = useNewsInfinite({
        earnings: search.earnings,
        from: search.from,
        issuerCategory: search.category ? [search.category] : undefined,
        issuerTag: search.tag ? [search.tag] : undefined,
        kind: search.kind ? [search.kind] : undefined,
        limit: PAGE_SIZE,
        paused: search.published === true && !publisherCik,
        publicationType: search.pubType ? [search.pubType] : undefined,
        publisher: publisherCik ? [publisherCik] : undefined,
        // A publisher filter replaces the mention filter: the company's own items, whoever they mention.
        scope: market || publisherCik ? "market" : "company",
        source: search.source ? [search.source] : undefined,
        ticker,
        to: search.to,
        topic: search.topic ? [search.topic] : undefined,
    });

    const listed = list.data?.pages.flatMap(page => page.items) ?? [];

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
            tickers: market ? undefined : [ticker],
        },
        onResubscribed,
        onStop: onLiveStop,
    });

    const liveItems = live.items.filter(item => matchesNewsFilters(item, filters));

    const items = mergeLiveItems(liveItems, listed);

    const liveIds = new Set(liveItems.map(item => item.id));

    const openItem = (id: string) => void navigate({ search: prev => ({ ...prev, item: id }) });

    const selectedTitle = items.find(item => item.id === search.item)?.title;

    const controls = (
        <div className="flex flex-wrap items-start justify-between gap-2">
            <NewsFilterControls
                categories={publisherCik ? issuerLabels(listed, publisherCik, "categories") : []}
                onChange={onFilterChange}
                search={search}
                tags={publisherCik ? issuerLabels(listed, publisherCik, "tags") : []}
                ticker={ticker}
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
                error={list.error}
                hasNextPage={Boolean(list.hasNextPage)}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                items={items}
                liveIds={liveIds}
                notice={notice}
                onLoadMore={() => void list.fetchNextPage()}
                onOpen={openItem}
                scopeLabel={market ? "Every company" : search.published ? `Published by ${company?.name ?? ticker}` : `News about ${ticker}`}
            />
            <NewsItemPanel
                id={search.item ?? null}
                onClose={() => void navigate({ search: prev => ({ ...prev, item: undefined }) })}
                onOpen={openItem}
                title={selectedTitle}
            />
        </>
    );
}
