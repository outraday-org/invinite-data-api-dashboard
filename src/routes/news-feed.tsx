import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import * as React from "react";

import type { LiveNewsStop } from "@/lib/live/use-live-news";
import type { NewsFeedSearch, NewsFilters } from "@/lib/news/labels";

import { TabStrip } from "@/components/navigation/tab-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { titleHead } from "@/lib/layout";
import { validateNewsFeedSearch } from "@/lib/news/labels";
import { parseTickers, useWatchlist, WATCHLIST_MAX } from "@/lib/news/watchlist";
import { IN_PLACE } from "@/lib/url-state";
import { NewsFilters as NewsFilterControls } from "@/routes/$ticker/news/-components/news-filters";
import { NewsItemPanel } from "@/routes/$ticker/news/-components/news-item-panel";
import { NewsLiveToggle } from "@/routes/$ticker/news/-components/news-live-toggle";
import { NewsSearchBox } from "@/routes/$ticker/news/-components/news-search";
import { useNewsList } from "@/routes/$ticker/news/-components/use-news-list";
import { LiveStopNotice, NewsPageView } from "@/routes/$ticker/news/index";

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

    return tickers === 0 ? "Add tickers to your watchlist to see their news." : "No news for these companies in this window.";
}

/** The watchlist editor (pure: tested in `news-feed.test.tsx`): chips with a remove button and the add field. */
export function WatchlistEditor({ list, onAdd, onRemove }: { list: ReadonlyArray<string>; onAdd: (tickers: Array<string>) => void; onRemove: (ticker: string) => void }) {
    const [draft, setDraft] = React.useState("");

    const typed = parseTickers(draft);

    const full = list.length >= WATCHLIST_MAX;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (typed.length === 0 || full) return;

        onAdd(typed);

        setDraft("");
    };

    return (
        <section aria-label="Watchlist" className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-1" data-testid="watchlist">
                {list.length === 0 && <span className="text-muted-foreground text-xs">No tickers yet.</span>}
                {list.map(ticker => (
                    <Badge className="gap-1 pr-0.5" key={ticker} variant="secondary">
                        {ticker}
                        <Button aria-label={`Remove ${ticker}`} onClick={() => onRemove(ticker)} size="icon-xs" type="button" variant="ghost">
                            <X />
                        </Button>
                    </Badge>
                ))}
            </div>
            <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
                <Input
                    aria-label="Add tickers"
                    className="w-full sm:w-[260px]"
                    disabled={full}
                    maxLength={200}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="Add tickers — e.g. AAPL, MSFT"
                    value={draft}
                />
                <Button disabled={typed.length === 0 || full} type="submit" variant="outline">
                    <Plus />
                    Add
                </Button>
                <span className="text-muted-foreground text-xs">
                    {`${list.length} of ${WATCHLIST_MAX} tickers, kept in this browser only.`}
                </span>
            </form>
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

    const onLiveStop = (reason: LiveNewsStop) => {
        setStop(reason);

        void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, live: undefined }) });
    };

    const company = scope === "watchlist" ? watchlist.list.join(",") : "";

    // An empty watchlist subscribes nothing (no tickers would mean the whole market): Live waits for a ticker.
    const live = search.live === true && (scope === "market" || watchlist.list.length > 0);

    const news = useNewsList({
        company,
        filters,
        liveTickers: scope === "market" ? undefined : watchlist.list,
        onLiveStop,
        search: { ...search, live },
    });

    const controls = (
        <div className="flex flex-wrap items-start justify-between gap-2">
            <NewsFilterControls
                categories={[]}
                companyScope={false}
                onChange={patch => onChange(patch.sort === "oldest" ? { ...patch, live: undefined } : patch)}
                search={search}
                tags={[]}
                windowFilters={scope === "watchlist"}
            />
            <NewsLiveToggle
                live={live}
                mode={news.liveMode}
                onChange={(on) => {
                    setStop(null);

                    onChange(on ? { live: true, sort: undefined } : { live: undefined });
                }}
            />
        </div>
    );

    const selectedTitle = news.items.find(item => item.id === search.item)?.title;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <NewsPageView
                controls={controls}
                description={feedDescription(scope)}
                emptyText={feedEmptyText({ live, scope, tickers: watchlist.list.length })}
                error={news.error}
                exportScope={scope}
                headerActions={(
                    <TabStrip
                        aria-label="Feed scope"
                        onSelect={value => onChange({ scope: value === "market" ? "market" : undefined })}
                        options={SCOPE_OPTIONS}
                        value={scope}
                    />
                )}
                hiddenByFilters={news.hidden}
                isLoading={!watchlist.ready || news.isLoading}
                items={news.items}
                liveIds={news.liveIds}
                notice={stop && <LiveStopNotice stop={stop} />}
                pager={news.pager}
                scopeLabel={scope === "market" ? "Every company" : "Your watchlist"}
                search={(
                    <>
                        {scope === "watchlist" && <WatchlistEditor list={watchlist.list} onAdd={watchlist.add} onRemove={watchlist.remove} />}
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
                title="News feed"
            />
            <NewsItemPanel
                id={search.item ?? null}
                onClose={() => void navigate({ resetScroll: false, search: prev => ({ ...prev, item: undefined }) })}
                title={selectedTitle}
            />
        </div>
    );
}
