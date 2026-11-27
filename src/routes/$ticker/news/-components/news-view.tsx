import type { ReactNode } from "react";

import { X } from "lucide-react";
import { useState } from "react";

import type { V2NewsSearchField, V2NewsSearchHit } from "@/lib/api/types";
import type { ExportColumn } from "@/lib/export";
import type { NewsSearch } from "@/lib/news/labels";

import { ExportMenu } from "@/components/api/export-menu";
import { SearchModeChips, SearchQueryForm } from "@/components/search/search-box";
import { SearchNarrowHint, SearchTimeoutNotice } from "@/components/search/search-timeout-notice";
import { Button } from "@/components/ui/button";
import { DayRange } from "@/components/ui/day-range";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { Notice } from "@/components/ui/notice";
import { ApiRequestError, isSearchTimeout } from "@/lib/api/errors";
import { useV2NewsSearchInfinite } from "@/lib/api/queries";
import { newsSearchWindowProblem } from "@/lib/news/market-window";

import type { useNewsList } from "./use-news-list";

import { NewsLayout } from "./news-layout";
import { NEWS_SEARCH_FIELD_LABELS, NEWS_SEARCH_LIMIT, NewsSearchResults } from "./news-search";

type Query = Pick<NewsSearch, "field" | "from" | "mode" | "q" | "to">;

const fields = (Object.keys(NEWS_SEARCH_FIELD_LABELS) as Array<V2NewsSearchField>).map(value => ({ label: NEWS_SEARCH_FIELD_LABELS[value], value }));

const hitColumns: Array<ExportColumn<V2NewsSearchHit>> = [
    { header: "Headline", value: hit => hit.item.title }, { header: "Symbols", value: hit => hit.item.symbols },
    { header: "Published", value: hit => hit.item.published_at }, { header: "Field", value: hit => hit.field },
    { header: "Passage", value: hit => hit.text }, { header: "Score", value: hit => hit.score },
];

const shortExact = (q: string, query: Query, company?: string) => Boolean(q && query.mode === "literal" && !company && Array.from(q.trim()).length < 3);

/** Both routes resolve eligibility before running list/search hooks so recovery can reveal only a valid list. */
export function useNewsSearchView(query: Query, company?: string) {
    const q = query.q ?? "";

    const windowProblem = newsSearchWindowProblem(query);

    const short = shortExact(q, query, company);

    const result = useV2NewsSearchInfinite({ ...query, company, limit: NEWS_SEARCH_LIMIT, mode: query.mode ?? "lexical", q: short || windowProblem ? "" : q });

    const error = result.error;

    const disabled = error instanceof ApiRequestError && error.code === "unavailable" && error.status === 503 && !isSearchTimeout(error);

    const badRequest = error instanceof ApiRequestError && error.status === 400 ? error.message : undefined;

    return { badRequest, disabled, result, short, showResults: Boolean(q && !disabled && !badRequest && !short && q.trim().length >= 2), windowProblem };
}

function NewsQueryForm({ busy, clear, company, placeholder, query, submit}: { query: Query; company?: string; placeholder: string; busy: boolean; clear: () => void; submit: (q: string) => void }) {
    const [draft, setDraft] = useState(query.q ?? "");

    const blocked = shortExact(draft, query, company);

    return (
        <div className="flex flex-col gap-2">
            <SearchQueryForm
                busy={busy}
                canSubmit={!blocked}
                label="Search the news"
                onSubmit={submit}
                onValueChange={setDraft}
                placeholder={placeholder}
                size="lg"
                trailing={(draft || query.q) && (
                    <Button
                        aria-label="Clear the search"
                        onClick={() => {
                            setDraft("");

                            clear();
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                    >
                        <X />
                    </Button>
                )}
                value={draft}
            />
            {blocked && <p className="text-muted-foreground text-sm" role="status">Exact search needs at least 3 characters or a company.</p>}
        </div>
    );
}

function SearchFilters({ patch, problem, query}: { query: Query; patch: (patch: Partial<Query>) => void; problem: null | string }) {
    return (
        <FilterBar activeCount={[query.mode, query.field, query.from ?? query.to].filter(Boolean).length} onReset={() => patch({ field: undefined, from: undefined, mode: undefined, to: undefined })}>
            <FilterField label="Match"><div className="flex h-8 items-center gap-1"><SearchModeChips mode={query.mode ?? "lexical"} onModeChange={mode => patch({ mode: mode === "literal" ? "literal" : undefined })} /></div></FilterField>
            <FilterField label="Search in">{id => <FilterSelect aria-label="Search in" className="w-full" id={id} onValueChange={field => patch({ field: field === "any" ? undefined : field })} options={fields} value={query.field ?? "any"} />}</FilterField>
            <FilterField label="Published" span={2}>
                <div>
                    <DayRange from={query.from} labels={{ from: "From", to: "To" }} onChange={patch} to={query.to} />
                    {problem && <p className="text-muted-foreground text-xs" role="status">{problem}</p>}
                </div>
            </FilterField>
            <p className="text-muted-foreground text-xs">Kind, topic, source and order filter the list, not the search.</p>
        </FilterBar>
    );
}

export function NewsView({ company, controls, description, emptyText, exportScope, headerActions, list, notice, patch, placeholder, query, scope, scopeText, search, submit, title}: {
    title: string; description: ReactNode; headerActions: ReactNode; scope: ReactNode; scopeText: string; placeholder: string; exportScope: string; query: Query; company?: string; submit: (q: string) => void; patch: (patch: Partial<Query>) => void;
    list: ReturnType<typeof useNewsList>; controls: ReactNode; emptyText?: string; notice?: ReactNode; search: ReturnType<typeof useNewsSearchView>;
}) {
    const clear = () => patch({ field: undefined, mode: undefined, q: undefined });

    const pages = search.result.data?.pages ?? [];

    const hits = pages.flatMap(page => page.data);

    const searching = search.showResults;

    const result = searching
        ? (
                <section aria-label="News search results" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{search.result.data && !search.windowProblem ? `${hits.length} ${hits.length === 1 ? "result" : "results"} for “${query.q}” in ${scopeText}` : `Search in ${scopeText}`}</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground text-xs">10 credits per search</span>
                            {!!hits.length && !search.windowProblem && <ExportMenu config={{ columns: hitColumns, dataset: "news-search", scope: exportScope }} failed={false} hasNextPage={false} isFetchingNextPage={false} operationId="searchNews" rows={hits} />}
                            <Button onClick={clear} size="sm" type="button" variant="outline">Back to the list</Button>
                        </div>
                    </div>
                    {!search.windowProblem && (isSearchTimeout(search.result.error)
                        ? <SearchTimeoutNotice narrowBy="a company, a shorter window or one field" scoped={Boolean(company)} />
                        : <NewsSearchResults error={search.result.error} isLoading={search.result.isLoading} pages={pages} />)}
                    {!search.windowProblem && hits.length >= NEWS_SEARCH_LIMIT && <SearchNarrowHint limit={NEWS_SEARCH_LIMIT} narrowBy="company, date or field" />}
                </section>
            )
        : list.windowProblem ? <div /> : undefined;

    return (
        <NewsLayout
            controls={searching ? <SearchFilters patch={patch} problem={search.windowProblem} query={query} /> : controls}
            description={description}
            emptyText={emptyText}
            error={list.error}
            exportScope={exportScope}
            flashing={list.flashing}
            headerActions={headerActions}
            hiddenByFilters={list.hidden}
            isLoading={list.isLoading}
            items={list.items}
            liveIds={list.liveIds}
            notice={notice}
            pager={list.pager}
            result={result}
            scopeLabel={scopeText}
            search={(
                <>
                    <NewsQueryForm busy={search.result.isFetching} clear={clear} company={company} key={query.q ?? ""} placeholder={placeholder} query={query} submit={submit} />
                    {search.disabled && <Notice title="News search isn't switched on right now." tone="neutral" />}
                    {search.badRequest && <p role="status">{search.badRequest}</p>}
                </>
            )}
            skippedPages={list.skippedPages}
            tabs={scope}
            title={title}
        />
    );
}
