import { Link } from "@tanstack/react-router";
import { ExternalLink, Search } from "lucide-react";
import * as React from "react";

import type { SearchMode, V2InvestorDocumentSearchHit, V2InvestorDocumentSearchResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2InvestorDocumentSearch } from "@/lib/api/queries";
import { documentKindLabel, documentPageHref } from "@/lib/earnings/documents";
import { SEARCH_MODE_LABELS, SEARCH_MODES } from "@/lib/earnings/labels";
import {
    HitPassage,
    MatchBadge,
    SearchCoverageNote,
    SearchEmptyState,
    SearchError,
    SearchScore,
} from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

const SEARCH_LIMIT = 10;

const MIN_QUERY_LENGTH = 2;

/** The API's literal scope rule; the page always sends `identifier`, so this 400 should not occur. */
const EXACT_TOO_SHORT = "Exact search needs 3 characters or a company";

/** The wording rule: passages, never facts; every hit names its document, year and page. */
export const DOCUMENT_SEARCH_LEAD = "Passages from company-published documents, not verified facts.";

const DOCUMENT_SEARCH_TIER = { badge: "STANDARD", title: "Your plan does not include document search" };

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

function DocumentHitCard({ hit, mode, query }: { hit: V2InvestorDocumentSearchHit; mode: SearchMode; query: string }) {
    const source = [
        hit.title ?? "Untitled document",
        hit.year === null ? "undated" : String(hit.year),
        hit.page === null ? null : `p. ${hit.page}`,
    ].filter(Boolean).join(" · ");

    return (
        <li className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
                {hit.kind && <Badge variant="outline">{documentKindLabel(hit.kind)}</Badge>}
                <MatchBadge match={hit.match} />
                <span className="font-medium">{source}</span>
                {hit.heading && <span className="text-muted-foreground">{hit.heading}</span>}
                <SearchScore mode={mode} score={hit.score} />
            </div>
            <HitPassage match={hit.match} query={query} text={hit.text} />
            <div className="flex flex-wrap items-center gap-3">
                {hit.url
                    ? (
                            // A permanent public URL, only an href; no referrer.
                            <a className={linkClass} href={documentPageHref(hit.url, hit.page)} rel="noopener noreferrer" target="_blank">
                                <ExternalLink className="size-3" />
                                {hit.page === null ? "Open document" : "Open page"}
                            </a>
                        )
                    : <span className="text-muted-foreground">No stored file</span>}
                {hit.event_id && (
                    <Link
                        className={linkClass}
                        params={{ eventId: hit.event_id, ticker: hit.symbol }}
                        search={{ tab: "documents" }}
                        to="/$ticker/earnings-calls/$eventId"
                    >
                        Open event
                    </Link>
                )}
            </div>
        </li>
    );
}

/** The results body (pure: data / error / loading in, list + coverage note out); `mode` = the requested mode. */
export function DocumentSearchResults({
    data,
    error,
    isLoading,
    mode,
}: {
    data: null | V2InvestorDocumentSearchResponse;
    error: unknown;
    isLoading: boolean;
    mode: SearchMode;
}) {
    if (error) {
        return <SearchError badRequest={mode === "literal" ? EXACT_TOO_SHORT : undefined} error={error} tier={DOCUMENT_SEARCH_TIER} />;
    }

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    // v2: the hits are `data`, the index coverage `meta.index`, the query `meta.query`.
    const coverage = data.meta.index ?? null;

    return (
        <>
            {data.data.length === 0
                ? <SearchEmptyState coverage={coverage} />
                : (
                        <ul className="flex flex-col gap-2">
                            {data.data.map(hit => (
                                <DocumentHitCard
                                    hit={hit}
                                    // A hit has no id of its own: document + page + chunk start is unique within one answer.
                                    key={`${hit.document_id}:${hit.page ?? ""}:${hit.text.slice(0, 32)}`}
                                    mode={mode}
                                    query={data.meta.query ?? ""}
                                />
                            ))}
                        </ul>
                    )}
            {coverage && <SearchCoverageNote coverage={coverage} />}
        </>
    );
}

/**
 * Search over one company's documents (`/v1/search/investor-documents`, one page): its calls' documents and its IR
 * library, by keywords (default; every word must match) or exact text (the API's case-sensitive default: v2 has no
 * case switch, and no source filter). Runs on submit, never per keystroke; a mode chip re-runs the submitted query.
 */
export function DocumentSearch({ identifier }: { identifier: string }) {
    const [draft, setDraft] = React.useState("");

    const [query, setQuery] = React.useState("");

    const [mode, setMode] = React.useState<SearchMode>("lexical");

    const { data, error, isFetching } = useV2InvestorDocumentSearch({
        company: identifier,
        limit: SEARCH_LIMIT,
        mode,
        q: query,
    });

    const canSubmit = draft.trim().length >= MIN_QUERY_LENGTH;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (canSubmit) setQuery(draft.trim());
    };

    return (
        <section className="flex flex-col gap-2 rounded-md border p-3">
            <form className="flex items-center gap-2" onSubmit={submit}>
                <Input
                    aria-label="Search this company's documents"
                    maxLength={500}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="Search this company's documents — e.g. capital allocation"
                    value={draft}
                />
                <Button disabled={!canSubmit || isFetching} type="submit">
                    <Search />
                    {isFetching ? "Searching…" : "Search"}
                </Button>
            </form>

            <div className="flex flex-wrap items-center gap-1">
                {SEARCH_MODES.map(value => (
                    <Button
                        aria-pressed={mode === value}
                        key={value}
                        onClick={() => setMode(value)}
                        size="xs"
                        type="button"
                        variant={mode === value ? "secondary" : "outline"}
                    >
                        {SEARCH_MODE_LABELS[value]}
                    </Button>
                ))}
                <span className="text-muted-foreground ml-auto text-[0.625rem]">10 credits per search</span>
            </div>

            {query && (
                <>
                    <div className="text-muted-foreground text-xs">{DOCUMENT_SEARCH_LEAD}</div>
                    <DocumentSearchResults data={data} error={error} isLoading={isFetching} mode={mode} />
                </>
            )}
        </section>
    );
}
