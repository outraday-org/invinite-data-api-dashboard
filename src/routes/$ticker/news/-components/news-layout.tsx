import type * as React from "react";

import type { NewsItemPublic } from "@/lib/api/types";
import type { ExportColumn } from "@/lib/export";

import { ExportMenu } from "@/components/api/export-menu";
import { Button } from "@/components/ui/button";
import { tierLabel } from "@/components/ui/credit-hint";
import { KeysetPagerNav } from "@/components/ui/keyset-pager";
import { PageHeader } from "@/components/ui/page-header";
import { RequestErrorState } from "@/components/ui/request-error-state";

import { NewsTable } from "./news-table";

type PagerProps = Omit<React.ComponentProps<typeof KeysetPagerNav>, "label">;

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
export function NewsLayout({
    controls,
    description,
    emptyText = "No news in this window.",
    error,
    exportScope,
    flashing,
    headerActions,
    hiddenByFilters = 0,
    isLoading,
    items,
    liveIds,
    notice,
    pager,
    result,
    scopeLabel,
    search,
    skippedPages = 0,
    tabs,
    title = "News",
}: {
    /** The filter bar. */
    controls?: React.ReactNode;
    result?: React.ReactNode;
    flashing?: ReadonlySet<string>;
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

            {result ?? (error
                ? (
                        <>
                            {items.length > 0 && <NewsTable flashing={flashing} isLoading={false} items={items} liveIds={liveIds} />}
                            <ListError error={error} />
                        </>
                    )
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
                                            : <NewsTable flashing={flashing} isLoading={isLoading} items={items} liveIds={liveIds} />}
                                {!isLoading && items.length > 0 && hiddenByFilters > 0 && (
                                    <FilteredOut hidden={hiddenByFilters} pager={pager} shown={items.length} skippedPages={skippedPages} />
                                )}
                            </div>
                            <KeysetPagerNav {...pager} label="News pages" />
                        </>
                    ))}
        </div>
    );
}
