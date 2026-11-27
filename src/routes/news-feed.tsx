import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFeedSearch, NewsFilters } from "@/lib/news/labels";

import { LIVE_NEWS_PLAN_NOTE, LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { CompanyFilter } from "@/components/search/company-filter";
import { FilterField } from "@/components/ui/filter-bar";
import { PageContainer } from "@/components/ui/page-container";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { titleHead } from "@/lib/layout";
import { liveOn, liveParam, useLiveDefault } from "@/lib/live/live-default";
import { validateNewsFeedSearch } from "@/lib/news/labels";
import { useWatchlist, WATCHLIST_MAX } from "@/lib/news/watchlist";
import { IN_PLACE } from "@/lib/url-state";
import { NewsFilters as NewsFilterControls } from "@/routes/$ticker/news/-components/news-filters";
import { NewsItemPanel } from "@/routes/$ticker/news/-components/news-item-panel";
import { NewsSearchBox } from "@/routes/$ticker/news/-components/news-search";
import { useNewsList } from "@/routes/$ticker/news/-components/use-news-list";
import { NewsPageView } from "@/routes/$ticker/news/index";

export const Route = createFileRoute("/news-feed")({
    component: NewsFeedPage,
    head: () => titleHead("News feed"),
    validateSearch: validateNewsFeedSearch,
});

type FeedScope = "market" | "watchlist";

const SCOPE_OPTIONS = [{ label: "Watchlist", value: "watchlist" }, { label: "Whole market · live", value: "market" }] as const;

/** The page's description per scope: the API serves news per company, so the market has a live stream only. */
export function feedDescription(scope: FeedScope) {
    return scope === "market"
        ? "Every company's new items as they are published, from the moment Live is on. The API lists news per company (a list needs a company or an event), so there is no history of the whole market here: items published before you switched Live on are on each company's News page."
        : "The news of the companies on your watchlist in one list. The API serves news per company: the watchlist is read as one request per page over all its tickers (1 credit), merged by publication time. Funds have no news (a fund is not a company).";
}

/** The empty line of the list per state. */
export function feedEmptyText({ live, scope, tickers }: { live: boolean; scope: FeedScope; tickers: number }) {
    if (scope === "market") return live ? "Listening: new items appear here as they are published." : "Switch Live on to follow every company's new items.";

    return tickers === 0 ? "Add tickers above to see their news." : "No news for these companies in this window.";
}

/** The watchlist (pure: tested in `news-feed.test.tsx`): the company picker dialog over the stored tickers. */
export function WatchlistEditor({ list, onChange }: { list: ReadonlyArray<string>; onChange: (list: Array<string>) => void }) {
    return (
        <section aria-label="Watchlist" className="flex max-w-xl flex-col gap-1">
            <FilterField label="Watchlist">
                {id => <CompanyFilter id={id} label="Watchlist" max={WATCHLIST_MAX} onChange={onChange} placeholder="Add tickers" value={list} />}
            </FilterField>
            <span className="text-muted-foreground text-xs">{`${list.length} of ${WATCHLIST_MAX} companies, kept in this browser only.`}</span>
        </section>
    );
}

/**
 * The watchlist feed (`/news-feed`; not `/news`: the route-name rule of task 5). Scope "Watchlist" = the news of up
 * to 20 tickers in one list: `/v1/news?company=<comma list>` per keyset page (one request, not one per ticker) with
 * the News page's pager, filters and live stream (`tickers: [...]`); scope "Whole market" = the live stream without
 * tickers only (`/v1/news` refuses a list without a company or an event). The search box searches the watchlist or,
 * in the market scope, every company (`/v1/search/news` takes no company).
 */
function NewsFeedPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const watchlist = useWatchlist();

    const scope: FeedScope = search.scope === "market" ? "market" : "watchlist";

    const onChange = (patch: Partial<NewsFeedSearch>) => {
        void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });
    };

    const filters: NewsFilters = { earnings: search.earnings, kind: search.kind, source: search.source, topic: search.topic };

    const [stop, setStop] = React.useState<LiveNewsStop | null>(null);

    // Live is on by default when the key's plan reaches the stream (`useLiveDefault`); `?live=false` turns it off.
    const liveByDefault = useLiveDefault();

    const onLiveStop = (reason: LiveNewsStop) => {
        setStop(reason);

        void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, live: liveParam(false, liveByDefault) }) });
    };

    const company = scope === "watchlist" ? watchlist.list.join(",") : "";

    // An empty watchlist subscribes nothing (no tickers would mean the whole market): Live waits for a ticker.
    // Oldest-first pauses it (live items join the newest-first list only) without rewriting the switch.
    const live = liveOn(search.live, liveByDefault) && search.sort !== "oldest" && (scope === "market" || watchlist.list.length > 0);

    const news = useNewsList({
        company,
        filters,
        liveTickers: scope === "market" ? undefined : watchlist.list,
        onLiveStop,
        search: { ...search, live },
    });

    const controls = (
        <NewsFilterControls
            categories={[]}
            companyScope={false}
            onChange={onChange}
            search={search}
            tags={[]}
            windowFilters={scope === "watchlist"}
        />
    );

    const liveToggle = (
        <LiveToggle
            listening="Listening for new items"
            live={live}
            mode={news.liveMode}
            onChange={(on) => {
                setStop(null);

                onChange(on ? { live: liveParam(true, liveByDefault), sort: undefined } : { live: liveParam(false, liveByDefault) });
            }}
        />
    );

    const selectedTitle = news.items.find(item => item.id === search.item)?.title;

    return (
        <PageContainer>
            <NewsPageView
                controls={controls}
                description={feedDescription(scope)}
                emptyText={feedEmptyText({ live, scope, tickers: watchlist.list.length })}
                error={news.error}
                exportScope={scope}
                headerActions={liveToggle}
                hiddenByFilters={news.hidden}
                isLoading={!watchlist.ready || news.isLoading}
                items={news.items}
                liveIds={news.liveIds}
                notice={stop && <LiveStopNotice planNote={LIVE_NEWS_PLAN_NOTE} stop={stop} />}
                pager={news.pager}
                scopeLabel={scope === "market" ? "Every company" : "Your watchlist"}
                search={(
                    <>
                        {scope === "watchlist" && <WatchlistEditor list={watchlist.list} onChange={watchlist.set} />}
                        {(scope === "market" || watchlist.list.length > 0) && (
                            <NewsSearchBox
                                company={scope === "market" ? undefined : company}
                                from={search.from}
                                key={`${scope}:${company}`}
                                placeholder={scope === "market" ? "Search every company's news — e.g. share repurchase" : "Search your watchlist's news"}
                                to={search.to}
                            />
                        )}
                    </>
                )}
                skippedPages={news.skippedPages}
                tabs={(
                    <Tabs onValueChange={value => onChange({ scope: value === "market" ? "market" : undefined })} value={scope}>
                        <TabsList aria-label="Feed scope" variant="line">
                            {SCOPE_OPTIONS.map(option => <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>)}
                        </TabsList>
                    </Tabs>
                )}
                title="News feed"
            />
            <NewsItemPanel
                id={search.item ?? null}
                onClose={() => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, item: undefined }) })}
                title={selectedTitle}
            />
        </PageContainer>
    );
}
