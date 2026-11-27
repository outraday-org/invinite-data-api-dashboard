import type * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFilters, NewsSearch } from "@/lib/news/labels";

import { AlertEntryPoints, ENTRY_TYPES } from "@/components/alerts/create-alert-button";
import { LIVE_NEWS_PLAN_NOTE, LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useV2Company } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";
import { liveOn, liveParam, useLiveDefault } from "@/lib/live/live-default";
import { issuerLabels, validateNewsSearch } from "@/lib/news/labels";
import { useNewsCatalogLabels } from "@/lib/reference/catalog-labels";
import { IN_PLACE } from "@/lib/url-state";

import { AnnouncementsTab } from "./-components/announcements";
import { NewsEventFilter } from "./-components/news-event-filter";
import { NEWS_FILTER_RESET, NewsFilters as NewsFilterControls, newsFilterCount } from "./-components/news-filters";
import { NewsItemPanel } from "./-components/news-item-panel";
import { NewsView, useNewsSearchView } from "./-components/news-view";
import { useNewsList } from "./-components/use-news-list";

/** The pager control's state (its label is the page's). */

export const Route = createFileRoute("/$ticker/news/")({
    component: NewsPage,
    head: ({ params }) => tickerHead(params.ticker, "News"),
    validateSearch: validateNewsSearch,
});

function NewsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onFilterChange = (patch: Partial<NewsSearch>) => {
        void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });
    };

    // News | Announcements as line tabs under the header (ui-redesign task 11).
    const tabs = (
        <Tabs onValueChange={value => onFilterChange({ view: value === "announcements" ? "announcements" : undefined })} value={search.view ?? "news"}>
            <TabsList aria-label="News view" variant="line">
                {VIEW_OPTIONS.map(option => <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>)}
            </TabsList>
        </Tabs>
    );

    const alerts = <AlertEntryPoints symbol={ticker} types={ENTRY_TYPES.news} />;

    // The item panel (`?item=`); `title` = the list row's headline, shown before the item answers.
    const panel = (title?: string) => (
        <NewsItemPanel
            id={search.item ?? null}
            onClose={() => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, item: undefined }) })}
            title={title}
        />
    );

    if (search.view === "announcements") {
        return (
            <>
                <div className="flex flex-col gap-6">
                    <PageHeader actions={alerts} title="News" />
                    {tabs}
                    <AnnouncementsTab onChange={onFilterChange} search={search} ticker={ticker} />
                </div>
                {panel()}
            </>
        );
    }

    return <CompanyNews alerts={alerts} navigate={navigate} onFilterChange={onFilterChange} panel={panel} search={search} tabs={tabs} ticker={ticker} />;
}

const VIEW_OPTIONS = [{ label: "News", value: "news" }, { label: "Announcements", value: "announcements" }] as const;

/** The News view of one company: search box, filters, the paged list, the live switch. */
function CompanyNews({
    alerts,
    navigate,
    onFilterChange,
    panel,
    search,
    tabs,
    ticker,
}: {
    alerts: React.ReactNode;
    navigate: ReturnType<typeof Route.useNavigate>;
    onFilterChange: (patch: Partial<NewsSearch>) => void;
    panel: (title?: string) => React.ReactNode;
    search: NewsSearch;
    tabs: React.ReactNode;
    ticker: string;
}) {
    // "Company-published" keeps the items the company published itself (its verified publications, by CIK) among the
    // ones that mention it: v2 has no publisher filter, so it filters the loaded page (as source and earnings do).
    const labels = useNewsCatalogLabels();

    const company = useV2Company(ticker).data;

    const publisherCik = search.published ? company?.cik.replace(/^0+/, "") : undefined;

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

    const [stop, setStop] = useState<LiveNewsStop | null>(null);

    // Live is on by default when the key's plan reaches the stream (`useLiveDefault`); `?live=false` turns it off.
    // Oldest-first pauses it (live items join the newest-first list only) without rewriting the switch.
    const liveByDefault = useLiveDefault();

    const live = liveOn(search.live, liveByDefault) && search.sort !== "oldest";

    // React Compiler memoizes this (no manual useCallback): the live hook reads it through a ref anyway.
    const onLiveStop = (reason: LiveNewsStop) => {
        setStop(reason);

        void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, live: liveParam(false, liveByDefault) }) });
    };

    const searchView = useNewsSearchView(search, ticker);

    const news = useNewsList({ company: ticker, event: search.event, filters, liveTickers: [ticker], onLiveStop, search: { ...search, live }, visible: !searchView.showResults });

    const controls = (
        <NewsFilterControls
            activeCount={newsFilterCount(search) + (search.event ? 1 : 0)}
            categories={publisherCik ? issuerLabels(news.fetched, publisherCik, "categories") : []}
            eventFilter={id => <NewsEventFilter event={search.event} id={id} onChange={event => onFilterChange({ event })} ticker={ticker} />}
            labels={labels}
            onChange={onFilterChange}
            onReset={() => onFilterChange({ ...NEWS_FILTER_RESET, event: undefined })}
            search={search}
            tags={publisherCik ? issuerLabels(news.fetched, publisherCik, "tags") : []}
        />
    );

    // The live switch is a header action (it changes what the list is, not which rows it shows).
    const headerActions = (
        <>
            {alerts}
            <LiveToggle
                listening="Listening for new items"
                live={live}
                mode={news.liveMode}
                onChange={(on) => {
                    setStop(null);

                    // Live items join the newest-first list: switching it on drops `sort=oldest`.
                    onFilterChange(on ? { live: liveParam(true, liveByDefault), sort: undefined } : { live: liveParam(false, liveByDefault) });
                }}
            />
        </>
    );

    const notice = stop && <LiveStopNotice planNote={LIVE_NEWS_PLAN_NOTE} stop={stop} />;

    return (
        <>
            <NewsView
                company={ticker}
                controls={controls}
                description={`SEC filings and newsroom publications for ${ticker}.`}
                emptyText={search.from || search.to || search.event ? undefined : "No news yet."}
                exportScope={ticker}
                headerActions={headerActions}
                labels={labels}
                list={news}
                notice={notice}
                patch={onFilterChange}
                placeholder={`Search the news of ${ticker}`}
                query={search}
                scope={tabs}
                scopeText={ticker}
                search={searchView}
                submit={q => void navigate({ resetScroll: false, search: prev => ({ ...prev, q }) })}
                title="News"
            />
            {panel(news.items.find(item => item.id === search.item)?.title)}
        </>
    );
}
