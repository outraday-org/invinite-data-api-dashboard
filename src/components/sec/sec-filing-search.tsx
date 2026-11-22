import { ExternalLink, FileText } from "lucide-react";
import * as React from "react";

import type { SecSearchMode, V2FilingSearchHit, V2FilingSearchMatches, V2FilingSearchResponse } from "@/lib/api/types";

import { SearchChip, SearchCostNote, SearchModeChips, SearchQueryForm } from "@/components/search/search-box";
import { HighlightedText, SearchCoverageNote, SpanHighlightedText } from "@/components/search/search-highlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DayRange } from "@/components/ui/day-range";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2FilingSearchInfinite } from "@/lib/api/queries";
import { MATCH_TYPE_LABELS } from "@/lib/earnings/labels";
import { formatDay } from "@/lib/format";
import { isSearchGenuineEmpty } from "@/lib/sec/readiness";
import { toSecHitView } from "@/lib/sec/source";

import type { SecPanelTarget } from "./sec-source-panel";

import { SecReadinessNotice } from "./sec-readiness-notice";

const SEARCH_LIMIT = 10;

/** The lead of every SEC answer: cited passages, never facts or a prose answer. */
export const SEC_SEARCH_LEAD = "Passages from SEC filings as filed, cited by document version and block — not verified facts.";

/** 503 `unavailable`: search is off (or down) until the index is built. */
export const SEC_SEARCH_OFF = "SEC filing search is not switched on yet";

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

/** The filters of a search (all optional): `form`, `item` (section ids, comma list), `from` / `to` (filing days, inclusive). */
export type SecSearchFilters = { form?: string; from?: string; item?: string; to?: string };

/** "Examined 300 of at least 301 matching passages …": the selectivity cap of a search without a company (`meta.index.matches`). */
export function matchesText(matches: V2FilingSearchMatches): string {
    const total = matches.capped
        ? (matches.total_at_least === null ? "more" : `at least ${matches.total_at_least}`)
        : String(matches.total ?? matches.examined);

    const order = matches.order === "newest_first"
        ? (matches.complete_since ? `, newest filings first — complete since ${formatDay(matches.complete_since)}` : ", newest filings first")
        : "";

    const range = matches.filed_from && matches.filed_to ? ` Filed ${formatDay(matches.filed_from)} to ${formatDay(matches.filed_to)}.` : "";

    return `Examined ${matches.examined} of ${total} matching passages (cap ${matches.cap}${order}).${range}`;
}

const NARROW_LABELS: Partial<Record<string, string>> = { company: "a company", filed_at: "a filing date range", form: "a form" };

/** The completeness of a search without a company filter: what was examined of how many matches, and how to narrow it. */
export function SearchMatchesNote({ hint, matches }: { hint: null | string | undefined; matches: null | undefined | V2FilingSearchMatches }) {
    if (!matches) return null;

    const narrow = matches.narrow_with.map(value => NARROW_LABELS[value] ?? value);

    return (
        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs" data-testid="search-matches" role="status">
            <span>{matchesText(matches)}</span>
            {matches.capped && (hint ? <span>{hint}</span> : narrow.length > 0 && <span>{`For a complete answer narrow by ${narrow.join(", ")}.`}</span>)}
        </div>
    );
}

function SecHitCard({ hit, mode, onOpen, query, renderFilingLink }: {
    hit: V2FilingSearchHit;
    mode: SecSearchMode;
    onOpen: (target: SecPanelTarget) => void;
    query: string;
    renderFilingLink?: (accession: string) => React.ReactNode;
}) {
    const view = toSecHitView(hit);

    const spans = hit.match?.spans ?? [];

    const text = hit.text ?? "";

    const source = [view.form, view.filingDate && formatDay(view.filingDate), view.filename].filter(Boolean).join(" · ");

    // The relevance goes into the badge's tooltip, as on every other search (no visible score).
    const relevance = mode === "lexical" && typeof hit.score === "number" ? ` · relevance ${hit.score.toFixed(4)}` : "";

    const { blockId, versionId } = view;

    return (
        <li className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
                {hit.match && <Badge title={`How the passage matched${relevance}`} variant="secondary">{MATCH_TYPE_LABELS[hit.match.type]}</Badge>}
                <span className="font-medium">{source}</span>
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
                {renderFilingLink && view.accession && renderFilingLink(view.accession)}
                {versionId && blockId && (
                    <span className="text-muted-foreground text-[0.625rem]">{`version ${versionId} · block ${blockId}`}</span>
                )}
            </div>
        </li>
    );
}

/**
 * The answer body (pure): every loaded page's hits, the index coverage note of the last page (`meta.index`), a notice
 * for a pending / partial page (`meta.coverage`), "No passages found" only for a complete answer with a complete
 * index, "More results" while `next_cursor` is set. An error is its state (503 `unavailable` = search not switched
 * on), never an empty list. A search without a company states its cap (`meta.index.matches`, `SearchMatchesNote`).
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
    renderFilingLink,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onMore: () => void;
    onOpen: (target: SecPanelTarget) => void;
    pages: ReadonlyArray<V2FilingSearchResponse>;
    query: string;
    /** A hit's link to its filing (the market-wide search: a hit names no company). */
    renderFilingLink?: (accession: string) => React.ReactNode;
}) {
    if (error && pages.length === 0) {
        return <SecReadinessNotice error={error} title="SEC filing search failed" titles={{ not_ready: SEC_SEARCH_OFF }} />;
    }

    if (isLoading && pages.length === 0) return <Skeleton className="h-24 w-full" />;

    const last = pages.at(-1);

    if (!last) return null;

    const hits = pages.flatMap(page => page.data);

    const searchIndex = last.meta.index ?? null;

    const mode = last.meta.mode ?? "lexical";

    return (
        <>
            <SecReadinessNotice coverage={last.meta.coverage} />
            {hits.length === 0
                ? (isSearchGenuineEmpty(last.meta.coverage, searchIndex) && <div className="text-muted-foreground">No passages found</div>)
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
                                    renderFilingLink={renderFilingLink}
                                />
                            ))}
                        </ul>
                    )}
            <SearchMatchesNote hint={searchIndex?.hint} matches={searchIndex?.matches} />
            <SearchCoverageNote coverage={searchIndex ?? { completeness: "unknown", reasons: [] }} />
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
 * SEC filing search (`/v1/search/filings`, 100 credits a page): keywords (`lexical`, default) or exact text (`literal`,
 * + "Match case"), with form, section items and a filing-date range. Over one instrument (`symbol` = a ticker, fund key
 * or CIK: stocks and funds alike) or, with `marketWide` and no symbol, over every filer (capped, `SearchMatchesNote`).
 * The query and the filters run on submit only (each request is billed); a mode chip re-runs the submitted query. A
 * hit opens its cited version / block in the source panel. `filters` = the filters the box starts with (the page's URL);
 * `onFiltersChange` mirrors the submitted ones back (the URL), the search itself reads only what was submitted.
 */
export function SecFilingSearch({
    filters: committedFilters,
    marketWide = false,
    onFiltersChange,
    onOpen,
    renderFilingLink,
    symbol,
}: {
    filters?: SecSearchFilters;
    marketWide?: boolean;
    onFiltersChange?: (filters: SecSearchFilters) => void;
    onOpen: (target: SecPanelTarget) => void;
    renderFilingLink?: (accession: string) => React.ReactNode;
    symbol: string;
}) {
    const [draft, setDraft] = React.useState("");

    // The query and the filters as submitted, together: the hook reads only this, so one Search is one billed request
    // (the page's URL copy of the filters arrives a render later and an outside URL change starts no search).
    const [submitted, setSubmitted] = React.useState<{ filters: SecSearchFilters; query: string }>({ filters: {}, query: "" });

    const [mode, setMode] = React.useState<SecSearchMode>("lexical");

    const [matchCase, setMatchCase] = React.useState(true);

    const [filterDraft, setFilterDraft] = React.useState<SecSearchFilters>(committedFilters ?? {});

    const { filters, query } = submitted;

    const result = useV2FilingSearchInfinite({
        caseSensitive: mode === "literal" ? matchCase : undefined,
        form: filters.form,
        from: filters.from,
        item: filters.item,
        limit: SEARCH_LIMIT,
        marketWide,
        mode,
        q: query,
        // No symbol = no request unless the page searches every filer.
        symbol,
        to: filters.to,
    });

    const scoped = symbol.trim().length > 0;

    const submit = (trimmed: string) => {
        const next = cleanFilters(filterDraft);

        setSubmitted({ filters: next, query: trimmed });

        onFiltersChange?.(next);
    };

    const label = scoped || !marketWide ? "Search this company's SEC filings" : "Search every filer's SEC filings";

    const setFilter = (patch: SecSearchFilters) => setFilterDraft(prev => ({ ...prev, ...patch }));

    return (
        <section className="flex flex-col gap-2 rounded-md border p-3">
            <SearchQueryForm
                busy={result.isFetching}
                canSubmit={scoped || marketWide}
                label={label}
                onSubmit={submit}
                onValueChange={setDraft}
                placeholder={`${label} — e.g. supply chain risk`}
                value={draft}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        aria-label="Form"
                        className="w-[110px]"
                        maxLength={20}
                        onChange={event => setFilter({ form: event.target.value })}
                        placeholder="Form, e.g. 10-K"
                        value={filterDraft.form ?? ""}
                    />
                    <Input
                        aria-label="Section items"
                        className="w-[150px]"
                        maxLength={200}
                        onChange={event => setFilter({ item: event.target.value })}
                        placeholder="Items, e.g. 1A,7"
                        title="Section ids, comma list"
                        value={filterDraft.item ?? ""}
                    />
                    <DayRange from={filterDraft.from} labels={{ from: "Search filed from", to: "Search filed to" }} onChange={setFilter} to={filterDraft.to} />
                </div>
            </SearchQueryForm>
            <div className="flex flex-wrap items-center gap-1">
                <SearchModeChips mode={mode} onModeChange={setMode} />
                {mode === "literal" && <SearchChip onClick={() => setMatchCase(value => !value)} pressed={matchCase}>Match case</SearchChip>}
                <SearchCostNote>100 credits per search page; filters apply on Search</SearchCostNote>
            </div>
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
                        renderFilingLink={renderFilingLink}
                    />
                </>
            )}
        </section>
    );
}

/** The filters as sent: trimmed, an empty value dropped (the plain search sends none). */
export function cleanFilters(filters: SecSearchFilters): SecSearchFilters {
    const clean = (value: string | undefined) => value?.trim() || undefined;

    return { form: clean(filters.form), from: clean(filters.from), item: clean(filters.item), to: clean(filters.to) };
}
