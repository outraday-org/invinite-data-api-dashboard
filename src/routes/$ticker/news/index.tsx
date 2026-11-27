import type * as React from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import type { NewsItemPublic } from "@/lib/api/types";
import type { ExportColumn } from "@/lib/export";
import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFilters, NewsSearch } from "@/lib/news/labels";

import { AlertEntryPoints, ENTRY_TYPES } from "@/components/alerts/create-alert-button";
import { ExportMenu } from "@/components/api/export-menu";
import { LIVE_NEWS_PLAN_NOTE, LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { Button } from "@/components/ui/button";
import { tierLabel } from "@/components/ui/credit-hint";
import { KeysetPagerNav } from "@/components/ui/keyset-pager";
import { PageHeader } from "@/components/ui/page-header";
import { RequestErrorState } from "@/components/ui/request-error-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useV2Company } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";
import { issuerLabels, validateNewsSearch } from "@/lib/news/labels";
import { IN_PLACE } from "@/lib/url-state";

import { AnnouncementsTab } from "./-components/announcements";
import { NewsEventFilter } from "./-components/news-event-filter";
import { NEWS_FILTER_RESET, NewsFilters as NewsFilterControls, newsFilterCount } from "./-components/news-filters";
import { NewsItemPanel } from "./-components/news-item-panel";
import { NewsSearchBox } from "./-components/news-search";
import { NewsTable } from "./-components/news-table";
import { useNewsList } from "./-components/use-news-list";

/** The pager control's state (its label is the page's). */
type PagerProps = Omit<React.ComponentProps<typeof KeysetPagerNav>, "label">;

export const Route = createFileRoute("/$ticker/news/")({
    component: NewsPage,
    head: ({ params }) => tickerHead(params.ticker, "News"),
    validateSearch: validateNewsSearch,
});

/** The list's request state: `/v1/news` is FREE, so a plan gate is unexpected but still a notice, not an error. */
function ListError({ error }: { error: unknown }) {
    return <RequestErrorState error={error} tier={{ badge: tierLabel("listNews") ?? "Plan", title: "Your plan does not include news" }} title="Failed to load the news" />;
}

/** The export's columns of a news row (the shown page; the pager has no "load all"). */
export const NEWS_EXPORT_COLUMNS: ReadonlyArray<ExportColumn<NewsItemPublic>> = [
    { header: "published_at", value: item => item.published_at },
    { header: "title", value: item => item.title },
    { header: "kind", value: item => item.kind },
    { header: "topics", value: item => item.topics },
    { header: "is_earnings_news", value: item => item.is_earnings_news },
    { header: "source", value: item => item.source.id },
    { header: "publisher", value: item => item.attribution.publisher },
    { header: "symbols", value: item => item.symbols },
    { header: "url", value: item => item.url },
    { header: "id", value: item => item.id },
];

/**
 * The list when the page-side filters hid rows of the loaded page: never an empty-looking list while older news
 * follows. Every row hidden: the page asks the next pages by itself (≤ 10 per filter change, `useNewsList`); once that
 * stops with a next page left, a line saying so and a button to load it. Some hidden = a count under the table.
 */
function FilteredOut({ hidden, pager, shown, skippedPages }: { hidden: number; pager: PagerProps; shown: number; skippedPages: number }) {
    if (shown > 0) {
        return (
            <div className="text-muted-foreground p-2 text-center text-xs" data-testid="news-filtered-out">
                {`${hidden.toLocaleString("en-US")} more ${hidden === 1 ? "item" : "items"} on this page hidden by the filters.`}
            </div>
        );
    }

    const scanned = skippedPages > 0 ? ` (${skippedPages.toLocaleString("en-US")} earlier ${skippedPages === 1 ? "page" : "pages"} skipped, none matched)` : "";

    return (
        <div className="text-muted-foreground flex flex-col items-center gap-2 p-2 text-center text-xs" data-testid="news-filtered-out">
            {pager.hasNext
                ? `None of the ${hidden.toLocaleString("en-US")} items on this page match the filters${scanned}; older news follows.`
                : `No news on this page matches the filters${scanned}.`}
            {pager.hasNext && (
                <Button disabled={pager.isFetching} onClick={pager.onNext} size="sm" type="button" variant="outline">
                    Load the next page
                </Button>
            )}
        </div>
    );
}

/** The News page body (pure: tested in `src/routes/-tests/news-page.test.tsx`); the watchlist feed renders it too. */
export function NewsPageView({
    controls,
    description,
    emptyText = "No news in this window.",
    error,
    exportScope,
    headerActions,
    hiddenByFilters = 0,
    isLoading,
    items,
    liveIds,
    notice,
    pager,
    scopeLabel,
    search,
    skippedPages = 0,
    tabs,
    title = "News",
}: {
    /** The filter bar. */
    controls?: React.ReactNode;
    /** Replaces the default description (the watchlist feed's). */
    description?: React.ReactNode;
    /** The empty list's line. */
    emptyText?: string;
    error: unknown;
    /** The export file's scope (the ticker, `watchlist`); none = no export menu. */
    exportScope?: string;
    /** The header's actions (the alert entry point, the live switch). */
    headerActions?: React.ReactNode;
    /**
     * Rows of the loaded page the page-side filters hid (source, earnings, Company-published: `/v1/news` has no
     * parameter for them), so a page can show fewer rows than it loaded, or none.
     */
    hiddenByFilters?: number;
    isLoading: boolean;
    items: ReadonlyArray<NewsItemPublic>;
    liveIds?: ReadonlySet<string>;
    notice?: React.ReactNode;
    /** The page shown and its neighbours (`KeysetPagerNav`, centred under the table). */
    pager: PagerProps;
    scopeLabel: string;
    /** The news search box (above the filters). */
    search?: React.ReactNode;
    /** Pages the auto-advance skipped since the last filter change (all hidden). */
    skippedPages?: number;
    /** The line tabs under the header (News | Announcements, the feed's scope). */
    tabs?: React.ReactNode;
    title?: string;
}) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                actions={headerActions}
                description={description ?? (
                    <>
                        {`${scopeLabel}: SEC filings and the companies' own newsroom publications. `}
                        Each item is Invinite&apos;s summary of the publication, shown with its source and date; wire services are never a source.
                    </>
                )}
                title={title}
            />
            {tabs}
            {search}
            {(controls || notice) && (
                <div className="flex flex-col gap-3">
                    {controls}
                    {notice}
                </div>
            )}

            {error
                ? <ListError error={error} />
                : (
                        <>
                            <div className="flex flex-col gap-2">
                                {exportScope && (
                                    <div className="flex justify-end">
                                        <ExportMenu
                                            config={{ columns: NEWS_EXPORT_COLUMNS, dataset: "news", scope: exportScope }}
                                            failed={false}
                                            hasNextPage={false}
                                            isFetchingNextPage={false}
                                            operationId="listNews"
                                            rows={items}
                                        />
                                    </div>
                                )}
                                {!isLoading && items.length === 0 && hiddenByFilters === 0
                                    ? <div className="text-muted-foreground w-full p-6 text-center text-sm">{emptyText}</div>
                                    : !isLoading && items.length === 0
                                            ? <FilteredOut hidden={hiddenByFilters} pager={pager} shown={0} skippedPages={skippedPages} />
                                            : <NewsTable isLoading={isLoading} items={items} liveIds={liveIds} />}
                                {!isLoading && items.length > 0 && hiddenByFilters > 0 && (
                                    <FilteredOut hidden={hiddenByFilters} pager={pager} shown={items.length} skippedPages={skippedPages} />
                                )}
                            </div>
                            <KeysetPagerNav {...pager} label="News pages" />
                        </>
                    )}
        </div>
    );
}

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

    // React Compiler memoizes this (no manual useCallback): the live hook reads it through a ref anyway.
    const onLiveStop = (reason: LiveNewsStop) => {
        setStop(reason);

        void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, live: undefined }) });
    };

    // `/v1/news` needs a company or an event (a 400 without both: no market-wide list), so the page asks per company.
    const news = useNewsList({ company: ticker, event: search.event, filters, liveTickers: [ticker], onLiveStop, search });

    const controls = (
        <NewsFilterControls
            activeCount={newsFilterCount(search) + (search.event ? 1 : 0)}
            categories={publisherCik ? issuerLabels(news.fetched, publisherCik, "categories") : []}
            eventFilter={id => <NewsEventFilter event={search.event} id={id} onChange={event => onFilterChange({ event })} ticker={ticker} />}
            onChange={patch => onFilterChange(patch.sort === "oldest" ? { ...patch, live: undefined } : patch)}
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
                live={search.live === true}
                mode={news.liveMode}
                onChange={(on) => {
                    setStop(null);

                    // Live items join the newest-first list: switching it on drops `sort=oldest`.
                    onFilterChange(on ? { live: true, sort: undefined } : { live: undefined });
                }}
            />
        </>
    );

    const notice = stop && <LiveStopNotice planNote={LIVE_NEWS_PLAN_NOTE} stop={stop} />;

    return (
        <>
            <NewsPageView
                controls={controls}
                emptyText={search.from || search.to || search.event ? undefined : "No news yet."}
                error={news.error}
                exportScope={ticker}
                headerActions={headerActions}
                hiddenByFilters={news.hidden}
                isLoading={news.isLoading}
                items={news.items}
                liveIds={news.liveIds}
                notice={notice}
                pager={news.pager}
                scopeLabel={search.published ? `Published by ${company?.name ?? ticker}` : `News about ${ticker}`}
                search={<NewsSearchBox company={ticker} from={search.from} placeholder={`Search ${ticker}'s news — e.g. data center, buyback`} to={search.to} />}
                skippedPages={news.skippedPages}
                tabs={tabs}
            />
            {panel(news.items.find(item => item.id === search.item)?.title)}
        </>
    );
}
