import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFeedSearch, NewsFilters } from "@/lib/news/labels";

import { LIVE_NEWS_PLAN_NOTE, LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { CompanyFilter } from "@/components/search/company-filter";
import { FilterField } from "@/components/ui/filter-bar";
import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { titleHead } from "@/lib/layout";
import { liveOn, liveParam, useLiveDefault } from "@/lib/live/live-default";
import { validateNewsFeedSearch } from "@/lib/news/labels";
import { useWatchlist, WATCHLIST_MAX } from "@/lib/news/watchlist";
import { IN_PLACE } from "@/lib/url-state";
import { NewsFilters as NewsFilterControls } from "@/routes/$ticker/news/-components/news-filters";
import { NewsItemPanel } from "@/routes/$ticker/news/-components/news-item-panel";
import { NewsView, useNewsSearchView } from "@/routes/$ticker/news/-components/news-view";
import { useNewsList } from "@/routes/$ticker/news/-components/use-news-list";

export const Route = createFileRoute("/news-feed")({
    component: NewsFeedPage,
    head: () => titleHead("News feed"),
    validateSearch: validateNewsFeedSearch,
});

export function feedEmptyText({ hasWindow, live, market}: { live: boolean; market: boolean; hasWindow: boolean }) {
    if (!market) return "No news for these companies in this window.";

    if (hasWindow) return "No news in this window.";

    return live ? "Listening: new items appear here as they are published." : "No news in the last 7 days.";
}
export function CompaniesField({ list, onChange}: { list: ReadonlyArray<string>; onChange: (list: Array<string>) => void }) {
    return (
        <section className="flex flex-col gap-1.5">
            <FilterField label="Companies">{id => <CompanyFilter id={id} label="Companies" max={WATCHLIST_MAX} onChange={onChange} placeholder="Every company" value={list} />}</FilterField>
            <span className="text-muted-foreground text-xs">{`Kept in this browser only · ${list.length} of ${WATCHLIST_MAX}`}</span>
            {list.length === 0 && <p className="text-muted-foreground text-sm">Without companies the list shows every company&apos;s last 7 days; pick companies to page back through their whole history.</p>}
        </section>
    );
}

function NewsFeedPage() {
    const watchlist = useWatchlist();

    return <PageContainer>{watchlist.ready ? <ReadyNewsFeed list={watchlist.list} set={watchlist.set} /> : <Skeleton className="h-40 w-full" />}</PageContainer>;
}

function ReadyNewsFeed({ list, set}: { list: Array<string>; set: (next: Array<string>) => void }) {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<NewsFeedSearch>) => {
        void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });
    };

    const market = list.length === 0;

    const company = market ? undefined : list.join(",");

    const searchView = useNewsSearchView(search, company);

    const filters: NewsFilters = { earnings: search.earnings, kind: search.kind, source: search.source, topic: search.topic };

    const [stop, setStop] = React.useState<LiveNewsStop | null>(null);

    // Live is on by default when the key's plan reaches the stream (`useLiveDefault`); `?live=false` turns it off.
    const liveByDefault = useLiveDefault();

    const onLiveStop = (reason: LiveNewsStop) => {
        setStop(reason);

        void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, live: liveParam(false, liveByDefault) }) });
    };

    const live = liveOn(search.live, liveByDefault) && search.sort !== "oldest";

    const news = useNewsList({ company, filters, liveTickers: market ? undefined : list, market: market ? true : undefined, onLiveStop, search: { ...search, live }, visible: !searchView.showResults });

    const controls = (
        <NewsFilterControls
            categories={[]}
            companyScope={false}
            onChange={onChange}
            search={search}
            tags={[]}
            windowProblem={news.windowProblem}
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
        <>
            <NewsView
                company={company}
                controls={controls}
                description="The newest news of the companies you pick, or of every company; new items arrive live on top."
                emptyText={feedEmptyText({ hasWindow: Boolean(search.from || search.to), live, market })}
                exportScope={company ?? "all-companies"}
                headerActions={liveToggle}
                list={news}
                notice={stop && <LiveStopNotice planNote={LIVE_NEWS_PLAN_NOTE} stop={stop} />}
                patch={onChange}
                placeholder={market ? "Search every company's news — e.g. share repurchase" : "Search the news of these companies"}
                query={search}
                scope={<CompaniesField list={list} onChange={set} />}
                scopeText={market ? "every company" : list.length === 1 ? list[0] : `${list.length} companies`}
                search={searchView}
                submit={q => void navigate({ resetScroll: false, search: prev => ({ ...prev, q }) })}
                title="News feed"
            />
            <NewsItemPanel
                id={search.item ?? null}
                onClose={() => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, item: undefined }) })}
                title={selectedTitle}
            />
        </>
    );
}
