import { ExternalLink, FileText, Search } from "lucide-react";
import * as React from "react";

import type { SecSearchHit, SecSearchMode, SecSearchResponse } from "@/lib/api/types";

import { HighlightedText, SearchCoverageNote, SpanHighlightedText } from "@/components/search/search-highlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecSearchInfinite } from "@/lib/api/queries";
import { MATCH_TYPE_LABELS, SEARCH_MODE_LABELS, SEARCH_MODES } from "@/lib/earnings/labels";
import { isGenuineEmpty } from "@/lib/sec/readiness";
import { pageLabel, toSecHitView } from "@/lib/sec/source";

import type { SecPanelTarget } from "./sec-source-panel";

import { SecReadinessNotice } from "./sec-readiness-notice";

const SEARCH_LIMIT = 10;

const MIN_QUERY_LENGTH = 2;

/** The lead of every SEC answer: cited passages, never facts or a prose answer. */
export const SEC_SEARCH_LEAD = "Passages from SEC filings as filed, cited by document version and block — not verified facts.";

/** 503 not_ready (`search_provider_not_registered`): search is off by owner decision until the index is built. */
export const SEC_SEARCH_OFF = "SEC filing search is not switched on yet";

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

function SecHitCard({ hit, mode, onOpen, query }: {
    hit: SecSearchHit;
    mode: SecSearchMode;
    onOpen: (target: SecPanelTarget) => void;
    query: string;
}) {
    const view = toSecHitView(hit);

    const spans = hit.match?.spans ?? [];

    const text = hit.text ?? "";

    const source = [
        view.filerName ?? (view.filerCik ? `CIK ${view.filerCik}` : null),
        view.form,
        view.filingDate,
        view.filename,
        // Search hits carry no quality block: the printed label is not trusted here, the ordinal is shown.
        pageLabel(view.page, false),
    ].filter(Boolean).join(" · ");

    const { blockId, versionId } = view;

    return (
        <li className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
                {hit.match && <Badge title="How the passage matched" variant="secondary">{MATCH_TYPE_LABELS[hit.match.type]}</Badge>}
                <span className="font-medium">{source}</span>
                {mode === "lexical" && typeof hit.score === "number" && (
                    <span className="text-muted-foreground ml-auto tabular-nums" title="Relevance score">{hit.score.toFixed(4)}</span>
                )}
            </div>
            {spans.length > 0 ? <SpanHighlightedText spans={spans} text={text} /> : <HighlightedText query={query} text={text} />}
            <div className="flex flex-wrap items-center gap-3">
                {versionId && blockId && (
                    <Button
                        onClick={() => onOpen({ blockId, kind: "citation", title: source, versionId })}
                        size="xs"
                        type="button"
                        variant="outline"
                    >
                        <FileText />
                        Open cited passage
                    </Button>
                )}
                {view.publicUrl
                    ? (
                            <a className={linkClass} href={view.publicUrl} rel="noopener noreferrer" target="_blank">
                                <ExternalLink className="size-3" />
                                Original
                            </a>
                        )
                    : <span className="text-muted-foreground text-xs">No public copy yet</span>}
                {versionId && blockId && (
                    <span className="text-muted-foreground text-[0.625rem]">{`version ${versionId} · block ${blockId}`}</span>
                )}
            </div>
        </li>
    );
}

/**
 * The answer body (pure): every loaded page's hits, the coverage note of the last page, a readiness notice for a
 * pending / partial answer, "No passages found" only for a ready answer with complete coverage, "More results"
 * while `next_cursor` is set. An error is its state (503 not_ready = search not switched on), never an empty list.
 */
export function SecSearchResults({
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onMore,
    onOpen,
    pages,
    query,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onMore: () => void;
    onOpen: (target: SecPanelTarget) => void;
    pages: ReadonlyArray<SecSearchResponse>;
    query: string;
}) {
    if (error && pages.length === 0) {
        return <SecReadinessNotice error={error} title="SEC filing search failed" titles={{ not_ready: SEC_SEARCH_OFF }} />;
    }

    if (isLoading && pages.length === 0) return <Skeleton className="h-24 w-full" />;

    const last = pages.at(-1);

    if (!last) return null;

    const hits = pages.flatMap(page => page.hits ?? []);

    const coverage = last.coverage ?? null;

    const mode = last.mode ?? "lexical";

    return (
        <>
            <SecReadinessNotice readiness={last.readiness} titles={{ not_ready: SEC_SEARCH_OFF }} />
            {hits.length === 0
                ? (isGenuineEmpty(last.readiness, coverage ?? { completeness: "unknown" }) && <div className="text-muted-foreground">No passages found</div>)
                : (
                        <ul className="flex flex-col gap-2">
                            {hits.map((hit, index) => (
                                <SecHitCard
                                    hit={hit}
                                    // A hit has no id of its own: version + page position is unique within one search.
                                    key={`${hit.version_id ?? ""}:${index}`}
                                    mode={mode}
                                    onOpen={onOpen}
                                    query={query}
                                />
                            ))}
                        </ul>
                    )}
            <SearchCoverageNote coverage={coverage ?? { completeness: "unknown", reasons: [] }} />
            {error ? <SecReadinessNotice error={error} title="Failed to load more results" /> : null}
            {hasNextPage && (
                <Button className="self-center" disabled={isFetchingNextPage} onClick={onMore} size="sm" type="button" variant="outline">
                    {isFetchingNextPage ? "Loading…" : "More results"}
                </Button>
            )}
        </>
    );
}

/**
 * SEC filing search over one filer (`/v1/sec/search?cik=`, 100 credits a page): keywords (`lexical`, default) or exact
 * text (`literal`, + "Match case"). Runs on submit; a mode chip re-runs the submitted query. A hit opens its cited
 * version / block in the source panel.
 */
export function SecFilingSearch({ cik, onOpen }: { cik: null | string; onOpen: (target: SecPanelTarget) => void }) {
    const [draft, setDraft] = React.useState("");

    const [query, setQuery] = React.useState("");

    const [mode, setMode] = React.useState<SecSearchMode>("lexical");

    const [matchCase, setMatchCase] = React.useState(true);

    const result = useSecSearchInfinite({
        caseSensitive: mode === "literal" ? (matchCase ? "true" : "false") : undefined,
        cik: cik ?? undefined,
        limit: SEARCH_LIMIT,
        mode,
        // No CIK = no request (a search must stay scoped to this company).
        q: cik ? query : "",
    });

    const canSubmit = draft.trim().length >= MIN_QUERY_LENGTH && Boolean(cik);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (canSubmit) setQuery(draft.trim());
    };

    return (
        <section className="flex flex-col gap-2 rounded-md border p-3">
            <form className="flex items-center gap-2" onSubmit={submit}>
                <Input
                    aria-label="Search this company's SEC filings"
                    maxLength={500}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="Search this company's SEC filings — e.g. supply chain risk"
                    value={draft}
                />
                <Button disabled={!canSubmit || result.isFetching} type="submit">
                    <Search />
                    {result.isFetching ? "Searching…" : "Search"}
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
                {mode === "literal" && (
                    <Button
                        aria-pressed={matchCase}
                        onClick={() => setMatchCase(value => !value)}
                        size="xs"
                        type="button"
                        variant={matchCase ? "secondary" : "outline"}
                    >
                        Match case
                    </Button>
                )}
                <span className="text-muted-foreground ml-auto text-[0.625rem]">100 credits per search page</span>
            </div>
            {!cik && <div className="text-muted-foreground text-xs">Looking up the company&apos;s CIK…</div>}
            {query && (
                <>
                    <div className="text-muted-foreground text-xs">{SEC_SEARCH_LEAD}</div>
                    <SecSearchResults
                        error={result.error}
                        hasNextPage={Boolean(result.hasNextPage)}
                        isFetchingNextPage={result.isFetchingNextPage}
                        isLoading={result.isFetching}
                        onMore={() => void result.fetchNextPage()}
                        onOpen={onOpen}
                        pages={result.data?.pages ?? []}
                        query={query}
                    />
                </>
            )}
        </section>
    );
}
