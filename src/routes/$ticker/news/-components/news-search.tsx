import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import * as React from "react";

import type { SearchMode, V2NewsSearchField, V2NewsSearchHit, V2NewsSearchResponse } from "@/lib/api/types";

import { SearchCostNote, SearchModeChips, SearchQueryForm } from "@/components/search/search-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tierLabel } from "@/components/ui/credit-hint";
import { FilterSelect } from "@/components/ui/filter-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2NewsSearchInfinite } from "@/lib/api/queries";
import { formatInstant } from "@/lib/earnings/format";
import { HitPassage, MatchBadge, SearchCoverageNote, SearchEmptyState, SearchError } from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

/** Hits per page (10 credits a page whatever the size). */
const NEWS_SEARCH_LIMIT = 20;

const NEWS_SEARCH_TIER = { badge: tierLabel("searchNews") ?? "Plan", title: "Your plan does not include news search" };

/** The `field` choices (`any` = the API's default, never sent). */
export const NEWS_SEARCH_FIELD_LABELS: Record<V2NewsSearchField, string> = {
    any: "Headline, lede and summary",
    lede: "Lede only",
    summary: "Summary only",
    title: "Headline only",
};

const NEWS_SEARCH_FIELDS = Object.keys(NEWS_SEARCH_FIELD_LABELS) as Array<V2NewsSearchField>;

/** Where a hit matched: the headline, the lede or a passage of the summary (with its block's heading). */
export function hitFieldLabel(hit: Pick<V2NewsSearchHit, "block" | "field">): string {
    if (hit.field === "title") return "Headline";

    if (hit.field === "lede") return "Lede";

    return hit.block?.heading ? `Summary · ${hit.block.heading}` : "Summary";
}

/**
 * One hit in the shared hit layout (match badge with the relevance in its tooltip, where it matched, the passage with
 * the server's spans); the headline opens the item panel (`?item=`, as the list's headline does).
 */
function NewsHitCard({ hit, query }: { hit: V2NewsSearchHit; query: string }) {
    return (
        <li className="flex flex-col gap-1.5 rounded-md border p-3" data-testid="news-hit">
            <div className="flex flex-wrap items-center gap-2">
                <MatchBadge match={hit.match} score={hit.score} />
                <Badge variant="outline">{hitFieldLabel(hit)}</Badge>
                <span className="text-muted-foreground">{formatInstant(hit.item.published_at)}</span>
                {hit.item.symbols.length > 0 && <span className="text-muted-foreground">{hit.item.symbols.join(", ")}</span>}
            </div>
            <Link className="font-medium hover:underline" resetScroll={false} search={prev => ({ ...prev, item: hit.item.id })} to=".">
                {hit.item.title}
            </Link>
            {hit.field !== "title" && <HitPassage match={hit.match} query={query} text={hit.text} />}
        </li>
    );
}

/** The results body (pure: tested in `news-search.test.tsx`); "More results" follows `next_cursor`. */
export function NewsSearchResults({
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onLoadMore,
    pages,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2NewsSearchResponse>;
}) {
    if (error && pages.length === 0) return <SearchError error={error} tier={NEWS_SEARCH_TIER} />;

    if (isLoading && pages.length === 0) return <Skeleton className="h-24 w-full" />;

    if (pages.length === 0) return null;

    const hits = pages.flatMap(page => page.data);

    // The last page's coverage describes the whole answer so far (`meta.index`, absent = nothing to doubt).
    const coverage = pages.at(-1)?.meta.index ?? null;

    const query = pages[0].meta.query ?? "";

    return (
        <div className="flex flex-col gap-2">
            {hits.length === 0
                ? <SearchEmptyState coverage={coverage} />
                : (
                        <ul className="flex flex-col gap-2">
                            {hits.map(hit => (
                                // A hit has no id: item + passage position is unique within one answer.
                                <NewsHitCard hit={hit} key={`${hit.item.id}:${hit.field}:${hit.chunk_index}`} query={query} />
                            ))}
                        </ul>
                    )}
            {coverage && <SearchCoverageNote coverage={coverage} />}
            {error ? <SearchError error={error} tier={NEWS_SEARCH_TIER} /> : null}
            {hasNextPage && (
                <Button className="self-center" disabled={isFetchingNextPage} onClick={onLoadMore} size="sm" type="button" variant="outline">
                    {isFetchingNextPage ? "Loading…" : "More results (10 credits)"}
                </Button>
            )}
        </div>
    );
}

/** The search's cost line; the day window is named only when one is set (the market scope has none). */
export function newsSearchCostText(hasWindow: boolean) {
    return hasWindow ? "10 credits per page · the page's date window applies" : "10 credits per page";
}

/**
 * News search (`/v1/search/news`, STANDARD, 10 credits a page) over headlines, Invinite's ledes and summaries: one
 * company, a comma list (the watchlist) or — without `company` — the whole market, in the page's day window. Runs on
 * submit, never per keystroke (the typed query stays out of the URL, O6); a mode chip or the field re-runs it.
 */
export function NewsSearchBox({
    company,
    from,
    placeholder,
    to,
}: {
    /** A ticker or a comma list; omitted = every company. */
    company?: string;
    from?: string;
    placeholder: string;
    to?: string;
}) {
    const [draft, setDraft] = React.useState("");

    const [query, setQuery] = React.useState("");

    const [mode, setMode] = React.useState<SearchMode>("lexical");

    const [field, setField] = React.useState<V2NewsSearchField>("any");

    const search = useV2NewsSearchInfinite({
        company,
        field: field === "any" ? undefined : field,
        from,
        limit: NEWS_SEARCH_LIMIT,
        mode,
        q: query,
        to,
    });

    const clear = () => {
        setDraft("");

        setQuery("");
    };

    return (
        <section aria-label="News search" className="flex flex-col gap-2 rounded-md border p-3">
            <SearchQueryForm
                busy={search.isFetching}
                label="Search the news"
                onSubmit={setQuery}
                onValueChange={setDraft}
                placeholder={placeholder}
                searching={search.isFetching && !search.isFetchingNextPage}
                trailing={query && (
                    <Button aria-label="Clear the search" onClick={clear} size="icon" type="button" variant="ghost">
                        <X />
                    </Button>
                )}
                value={draft}
            />

            <div className="flex flex-wrap items-center gap-1">
                <SearchModeChips mode={mode} onModeChange={setMode} />
                <FilterSelect
                    aria-label="Search in"
                    className="h-6 w-[210px] text-xs"
                    onValueChange={setField}
                    options={NEWS_SEARCH_FIELDS.map(value => ({ label: NEWS_SEARCH_FIELD_LABELS[value], value }))}
                    value={field}
                />
                <SearchCostNote>{newsSearchCostText(Boolean(from || to))}</SearchCostNote>
            </div>

            {query && (
                <NewsSearchResults
                    error={search.error}
                    hasNextPage={search.hasNextPage}
                    isFetchingNextPage={search.isFetchingNextPage}
                    isLoading={search.isFetching}
                    onLoadMore={() => void search.fetchNextPage()}
                    pages={search.data?.pages ?? []}
                />
            )}
        </section>
    );
}
