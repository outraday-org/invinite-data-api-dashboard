import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { SearchMode, V2TranscriptSearchResponse, V2TranscriptSearchType } from "@/lib/api/types";

import { ExportMenu } from "@/components/api/export-menu";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { SearchChip, SearchModeChips, SearchQueryForm } from "@/components/search/search-box";
import { DayRange } from "@/components/ui/day-range";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useV2TranscriptSearch } from "@/lib/api/queries";
import { SEARCH_MODES } from "@/lib/earnings/labels";
import { formatDay } from "@/lib/format";
import { READING_COLUMN_CLASS, titleHead } from "@/lib/layout";
import { IN_PLACE, optionalDay, optionalEnum, optionalText } from "@/lib/url-state";
import { cn } from "@/lib/utils";
import { AskResults, TYPE_LABELS, TYPES } from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

/** The operation's page size: ONE page of at most 8 passages (`has_more` is always false). */
export const TRANSCRIPT_SEARCH_LIMIT = 8;

/** The API's scope rule (`LITERAL_MIN_UNSCOPED_CODE_POINTS`): an exact pattern shorter than this needs a company. */
export const EXACT_MIN_UNSCOPED = 3;

/** The `type` values in the URL (the operation's `type` enum; `TYPES` of the hit labels follows the same order). */
const TYPE_VALUES = ["transcript", "qa", "prepared", "presentation"] as const satisfies ReadonlyArray<V2TranscriptSearchType>;

/**
 * `/search` URL state: `q` = the submitted query (written on submit, never per keystroke: a search costs 10 credits),
 * `mode` (absent = keyword), `type` (absent = every type), `company` (one ticker or CIK), `from` / `to` (call days).
 */
const searchPageSchema = z.object({
    company: optionalText(20),
    from: optionalDay(),
    mode: optionalEnum(SEARCH_MODES),
    q: optionalText(500),
    to: optionalDay(),
    type: optionalEnum(TYPE_VALUES),
});

export type TranscriptSearchPageSearch = z.infer<typeof searchPageSchema>;

export const Route = createFileRoute("/search")({
    component: SearchPage,
    head: () => titleHead("Transcript search"),
    validateSearch: searchPageSchema,
});

/** An exact pattern the API refuses without a company (fewer than 3 code points). */
export const exactTooShort = (search: Pick<TranscriptSearchPageSearch, "company" | "mode" | "q">) =>
    search.mode === "literal" && !search.company && search.q !== undefined && Array.from(search.q).length < EXACT_MIN_UNSCOPED;

/** The call window in words: the API defaults to the last 365 days without a company (pure). */
export function windowText(search: Pick<TranscriptSearchPageSearch, "company" | "from" | "to">) {
    if (search.from && search.to) return `Calls from ${formatDay(search.from)} to ${formatDay(search.to)}`;

    if (search.from) return `Calls from ${formatDay(search.from)} on`;

    if (!search.company) {
        return search.to ? `Calls in the 365 days to ${formatDay(search.to)} (the API's default window)` : "Calls of the last 365 days (the API's default window)";
    }

    return search.to ? `Calls up to ${formatDay(search.to)}` : "Every call of the company";
}

/**
 * The answer (pure): the hits of every company with their call (`AskResults`, market scope), the one-page rule and, at
 * the cap, how to narrow. A page of 8 says so — the API pages no further.
 */
export function TranscriptSearchView({
    data,
    error,
    isLoading,
    search,
}: {
    data: null | V2TranscriptSearchResponse;
    error: unknown;
    isLoading: boolean;
    search: TranscriptSearchPageSearch;
}) {
    if (!search.q) return <Notice title="Search what was said on every company's earnings calls">Type a phrase and press Search.</Notice>;

    if (exactTooShort(search)) {
        return <Notice badge="Exact" title={`Exact search needs ${EXACT_MIN_UNSCOPED} characters or a company`}>Nothing was sent: the API refuses a shorter exact pattern without a company.</Notice>;
    }

    const capped = (data?.data.length ?? 0) >= TRANSCRIPT_SEARCH_LIMIT;

    return (
        <div className={cn("flex flex-col gap-2", READING_COLUMN_CLASS)}>
            <AskResults data={data} error={error} isLoading={isLoading} scope={{ kind: "market" }} />
            {data && capped && (
                <p className="text-muted-foreground" data-testid="search-narrow">
                    {`These are the top ${TRANSCRIPT_SEARCH_LIMIT} passages — the API answers one page and pages no further. To find more, narrow the search: a company, a shorter call window or one type (Q&A, prepared remarks, slides).`}
                </p>
            )}
        </div>
    );
}

/** The query box: typed text stays local until Search (a search is billed), then becomes `?q=`. */
function SearchBox({ initial, isFetching, onSubmit }: { initial: string; isFetching: boolean; onSubmit: (q: string) => void }) {
    const [draft, setDraft] = React.useState(initial);

    return (
        <SearchQueryForm
            busy={isFetching}
            label="Search every call"
            onSubmit={onSubmit}
            onValueChange={setDraft}
            placeholder="e.g. gross margin, tariffs, &quot;free cash flow&quot;"
            size="lg"
            value={draft}
        />
    );
}

/**
 * Cross-company transcript search (`/v1/search/transcripts` without `company` / `event`, 10 credits a search): keyword
 * (BM25, any word may match) or exact text, the call window (`conference_date.gte` / `.lte`; none = the API's last 365
 * days), a type and optionally one company. ONE page of ≤ 8 passages: the page says so and offers narrowing, not
 * paging. Every hit names its company and call and opens the call page.
 */
function SearchPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<TranscriptSearchPageSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const blocked = exactTooShort(search);

    const { data, error, isFetching } = useV2TranscriptSearch({
        company: search.company,
        conferenceDateGte: search.from,
        conferenceDateLte: search.to,
        limit: TRANSCRIPT_SEARCH_LIMIT,
        mode: search.mode ?? "lexical",
        // An exact pattern the API would refuse is never sent ("" keeps the query idle).
        q: blocked ? "" : search.q ?? "",
        type: search.type,
    });

    // A new search is a history entry (Back returns to the previous one); filters change in place.
    const submit = (q: string) => void navigate({ resetScroll: false, search: prev => ({ ...prev, q }) });

    const setMode = (mode: SearchMode) => onChange({ mode: mode === "lexical" ? undefined : mode });

    const hits = data?.data ?? [];

    // Every set filter counts once (the call window as one).
    const activeCount = [search.mode, search.type, search.company, search.from ?? search.to].filter(value => value !== undefined).length;

    return (
        <PageContainer width="narrow">
            <PageHeader
                description={`What was said on every company's earnings calls: transcripts, Q&A and slide text. One page of at most ${TRANSCRIPT_SEARCH_LIMIT} passages per search (10 credits); narrow it to find more.`}
                title="Transcript search"
            />

            {/* Keyed by the submitted query: Back / a link with another `?q=` refills the box. */}
            <SearchBox initial={search.q ?? ""} isFetching={isFetching} key={search.q ?? ""} onSubmit={submit} />

            <FilterBar activeCount={activeCount} onReset={() => onChange({ company: undefined, from: undefined, mode: undefined, to: undefined, type: undefined })}>
                <FilterField label="Match">
                    <div className="flex flex-wrap gap-1">
                        <SearchModeChips mode={search.mode ?? "lexical"} onModeChange={setMode} />
                    </div>
                </FilterField>
                <FilterField label="In" span={2}>
                    <div className="flex flex-wrap gap-1">
                        <SearchChip onClick={() => onChange({ type: undefined })} pressed={search.type === undefined}>All</SearchChip>
                        {TYPES.map(type => (
                            <SearchChip key={type} onClick={() => onChange({ type })} pressed={search.type === type}>
                                {TYPE_LABELS[type]}
                            </SearchChip>
                        ))}
                    </div>
                </FilterField>
                <FilterField label="Company">
                    {id => (
                        <DebouncedInput
                            aria-label="Company (ticker or CIK)"
                            className="w-full"
                            id={id}
                            onCommit={company => onChange({ company: company.toUpperCase() || undefined })}
                            placeholder="One company"
                            value={search.company ?? ""}
                        />
                    )}
                </FilterField>
                <FilterField label="Calls" span={2}>
                    <DayRange from={search.from} labels={{ from: "Calls from", to: "Calls to" }} onChange={onChange} to={search.to} />
                </FilterField>
            </FilterBar>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs" data-testid="search-window">{windowText(search)}</span>
                {hits.length > 0 && (
                    <ExportMenu
                        config={{ dataset: "transcript-search", scope: search.company ?? "all-companies" }}
                        failed={false}
                        hasNextPage={false}
                        isFetchingNextPage={false}
                        operationId="searchTranscripts"
                        rows={hits}
                    />
                )}
            </div>

            <TranscriptSearchView data={data} error={error} isLoading={isFetching} search={search} />
        </PageContainer>
    );
}
