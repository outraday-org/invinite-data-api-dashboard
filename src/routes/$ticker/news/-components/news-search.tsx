import { Link } from "@tanstack/react-router";

import type { V2NewsSearchField, V2NewsSearchHit, V2NewsSearchResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { tierLabel } from "@/components/ui/credit-hint";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInstant } from "@/lib/earnings/format";
import { IN_PLACE } from "@/lib/url-state";
import { HitPassage, MatchBadge, SearchCoverageNote, SearchEmptyState, SearchError } from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

/** Hits per page (10 credits a page whatever the size). */
export const NEWS_SEARCH_LIMIT = 8;

const NEWS_SEARCH_TIER = { badge: tierLabel("searchNews") ?? "Plan", title: "Your plan does not include news search" };

/** The `field` choices (`any` = the API's default, never sent). */
export const NEWS_SEARCH_FIELD_LABELS: Record<V2NewsSearchField, string> = {
    any: "Headline, lede and summary",
    lede: "Lede only",
    summary: "Summary only",
    title: "Headline only",
};

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
            <Link className="font-medium hover:underline" {...IN_PLACE} search={prev => ({ ...prev, item: hit.item.id })} to=".">
                {hit.item.title}
            </Link>
            {hit.field !== "title" && <HitPassage match={hit.match} query={query} text={hit.text} />}
        </li>
    );
}

/** The results body (pure: tested in `news-search.test.tsx`); one page of up to eight hits. */
export function NewsSearchResults({
    error,

    isLoading,
    pages,
}: {
    error: unknown;
    isLoading: boolean;
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

        </div>
    );
}
