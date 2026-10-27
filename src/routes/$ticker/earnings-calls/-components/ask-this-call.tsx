import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, ImageIcon, Play, Search } from "lucide-react";
import * as React from "react";

import type {
    EarningsSearchHit,
    EarningsSearchMode,
    EarningsSearchResponse,
    EarningsSearchType,
    HitMatch,
    MatchSpan,
    SearchCoverage,
} from "@/lib/api/types";
import type { HighlightPart } from "@/lib/earnings/labels";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { useEarningsSearch } from "@/lib/api/queries";
import { formatFiscalPeriod, formatMs } from "@/lib/earnings/format";
import { highlightSpans, highlightTerms, MATCH_TYPE_LABELS } from "@/lib/earnings/labels";

import { useCallAudio } from "./audio-context";
import { EventLink } from "./event-link";
import { Notice } from "./media-state";

/** One call (the call page) or one company (its calls list, hits link to their call). */
export type AskScope
    = | { eventId: string; kind: "event"; onJumpToTranscript: (startMs: number) => void }
        | { identifier: string; kind: "company" };

const SEARCH_LIMIT = 8;

const MIN_QUERY_LENGTH = 2;

const TYPE_LABELS: Record<EarningsSearchType, string> = {
    preparedRemarks: "Prepared remarks",
    presentation: "Slides",
    qa: "Q&A",
    transcript: "Transcript",
};

const TYPES = Object.keys(TYPE_LABELS) as Array<EarningsSearchType>;

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

function MarkedText({ parts }: { parts: Array<HighlightPart> }) {
    return (
        <p className="leading-relaxed">
            {parts.map((part, index) => (part.match
                // Parts have no id; their order within one text is stable.
                ? <mark className="bg-yellow-200/70 text-inherit dark:bg-yellow-500/30" key={index}>{part.text}</mark>
                : <React.Fragment key={index}>{part.text}</React.Fragment>))}
        </p>
    );
}

/** Client-side guess: the query's terms marked (semantic hits carry no spans). */
export function HighlightedText({ query, text }: { query: string; text: string }) {
    return <MarkedText parts={highlightTerms(text, query)} />;
}

/** The server's match spans marked exactly (code-point offsets into `text`). */
export function SpanHighlightedText({ spans, text }: { spans: ReadonlyArray<MatchSpan>; text: string }) {
    return <MarkedText parts={highlightSpans(text, spans)} />;
}

/** A hit's passage: the server's spans when it sent any, else the query's terms. */
export function HitPassage({ match, query, text }: { match: HitMatch; query: string; text: string }) {
    return match.spans.length > 0
        ? <SpanHighlightedText spans={match.spans} text={text} />
        : <HighlightedText query={query} text={text} />;
}

/** Which leg found the hit: keyword / exact / meaning, `both` for a hybrid hit both legs ranked. */
export function MatchBadge({ match }: { match: HitMatch }) {
    return <Badge title="How the passage matched" variant="secondary">{MATCH_TYPE_LABELS[match.type]}</Badge>;
}

/** The score of a mode: literal is always 0 (newest first, none shown); hybrid RRF scores (~0.016) need 4 decimals. */
export function SearchScore({ mode, score }: { mode: EarningsSearchMode; score: number }) {
    if (mode === "literal") return null;

    return (
        <span className="text-muted-foreground ml-auto tabular-nums" title="Relevance score">
            {score.toFixed(mode === "hybrid" ? 4 : 2)}
        </span>
    );
}

type CoverageReason = SearchCoverage["reasons"][number];

const STILL_BUILDING = "Search index is still being built for this company — results may be incomplete";

const COVERAGE_REASON_TEXT: Record<CoverageReason, string> = {
    lexical_backfill_pending: STILL_BUILDING,
    lexical_unavailable: "Keyword search is temporarily unavailable — results may be incomplete",
    projection_failed: "Some passages could not be indexed — results may be incomplete",
    semantic_backfill_pending: STILL_BUILDING,
    semantic_index_missing: "Meaning search is not available yet",
    semantic_unavailable: "Meaning search is temporarily unavailable — results may be incomplete",
};

/** Why an answer may be incomplete (`coverage.completeness` partial / unknown); nothing for a complete one. */
export function SearchCoverageNote({ coverage }: { coverage: SearchCoverage }) {
    if (coverage.completeness === "complete") return null;

    const lines = [...new Set(coverage.reasons.map(reason => COVERAGE_REASON_TEXT[reason]))];

    return (
        <div className="text-muted-foreground flex flex-col text-xs" role="status">
            {(lines.length > 0 ? lines : ["Results may be incomplete"]).map(line => <span key={line}>{line}</span>)}
        </div>
    );
}

/** "No passages found" is a genuine no-result only with complete coverage; otherwise the coverage note says why. */
export function SearchEmptyState({ coverage }: { coverage: SearchCoverage }) {
    return coverage.completeness === "complete" ? <div className="text-muted-foreground">No passages found</div> : null;
}

function SlideLink({ slide }: { slide: EarningsSearchHit["slide"] }) {
    if (!slide) return null;

    if (!slide.image_url) return <span className="text-muted-foreground">{`Slide ${slide.page}`}</span>;

    return (
        // Presigned: a bearer credential, never in the router search; no referrer.
        <a className={linkClass} href={slide.image_url} rel="noopener noreferrer" target="_blank">
            <ImageIcon className="size-3" />
            {`Open slide ${slide.page}`}
        </a>
    );
}

/** Call page: play the hit in the page's `<audio>`, else scroll the transcript to it. */
function EventHitActions({ hit, onJumpToTranscript }: { hit: EarningsSearchHit; onJumpToTranscript: (startMs: number) => void }) {
    const { loaded, playUrl, seekMs } = useCallAudio();

    const { audio_url: audioUrl, start_ms: startMs } = hit;

    return (
        <div className="flex flex-wrap items-center gap-3">
            {audioUrl
                ? (
                        <Button
                            // A loaded recording seeks; otherwise the hit's own URL (`#t=<sec>`) is
                            // loaded — no extra `/audio` request.
                            onClick={() => (loaded && seekMs && startMs !== null ? seekMs(startMs) : playUrl(audioUrl))}
                            size="xs"
                            type="button"
                            variant="outline"
                        >
                            <Play />
                            Play from here
                        </Button>
                    )
                : startMs !== null && (
                    <Button onClick={() => onJumpToTranscript(startMs)} size="xs" type="button" variant="outline">
                        <FileText />
                        Jump to transcript
                    </Button>
                )}
            <SlideLink slide={hit.slide} />
        </div>
    );
}

/** Company calls list: the hit's call page, the audio in a new tab. */
function CompanyHitActions({ hit }: { hit: EarningsSearchHit }) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {hit.audio_url
                ? (
                        <a className={linkClass} href={hit.audio_url} rel="noopener noreferrer" target="_blank">
                            <Play className="size-3" />
                            Play from here
                            <ExternalLink className="size-3" />
                        </a>
                    )
                : hit.start_ms !== null && (
                    <Link
                        className={linkClass}
                        params={{ eventId: hit.event_id, ticker: hit.symbol }}
                        search={{ tab: "transcript" }}
                        to="/$ticker/earnings-calls/$eventId"
                    >
                        <FileText className="size-3" />
                        Open transcript
                    </Link>
                )}
            <SlideLink slide={hit.slide} />
        </div>
    );
}

function HitCard({ hit, mode, query, scope }: { hit: EarningsSearchHit; mode: EarningsSearchMode; query: string; scope: AskScope }) {
    return (
        <li className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{TYPE_LABELS[hit.type]}</Badge>
                <MatchBadge match={hit.match} />
                {scope.kind === "company" && (
                    <EventLink className="font-medium underline-offset-4 hover:underline" event={hit}>
                        {`${hit.conference_date} · ${formatFiscalPeriod(hit)}`}
                    </EventLink>
                )}
                {hit.speaker.name && (
                    <span className="font-medium">
                        {hit.speaker.name}
                        {hit.speaker.title && <span className="text-muted-foreground font-normal">{` · ${hit.speaker.title}`}</span>}
                    </span>
                )}
                {hit.start_ms !== null && <span className="text-muted-foreground tabular-nums">{formatMs(hit.start_ms)}</span>}
                <SearchScore mode={mode} score={hit.score} />
            </div>
            <HitPassage match={hit.match} query={query} text={hit.text} />
            {scope.kind === "event"
                ? <EventHitActions hit={hit} onJumpToTranscript={scope.onJumpToTranscript} />
                : <CompanyHitActions hit={hit} />}
        </li>
    );
}

/**
 * A search request's state; `tier` overrides the plan-gate notice (document search names its own plan), `badRequest`
 * the 400 notice (else the API's own message: a stopword-only keyword query, a short exact pattern without a scope).
 */
export function SearchError({ badRequest, error, tier }: { badRequest?: string; error: unknown; tier?: { badge: string; title: string } }) {
    if (isTierError(error)) {
        return <Notice badge={tier?.badge ?? "PRO"} title={tier?.title ?? "Your plan does not include earnings-call search"} />;
    }

    if (error instanceof ApiRequestError) {
        if (error.code === "search_disabled") return <Notice badge="Disabled" title="Search is disabled on this environment" />;

        if (error.status === 400) return <Notice badge="Invalid query" title={badRequest ?? error.message} />;

        // 429 upstream_rate_limited and 503 search_unavailable: the API's own message.
        if (error.status === 429 || error.code === "search_unavailable") {
            return <Notice badge={error.status === 429 ? "Rate limited" : "Unavailable"} title={error.message} />;
        }
    }

    return <ErrorState error={error} title="Search failed" />;
}

/** The answer body (pure: data / error / loading in, list + coverage note out). */
export function AskResults({
    data,
    error,
    isLoading,
    scope,
}: {
    data: EarningsSearchResponse | null;
    error: unknown;
    isLoading: boolean;
    scope: AskScope;
}) {
    if (error) return <SearchError error={error} />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    return (
        <>
            {data.hits.length === 0
                ? <SearchEmptyState coverage={data.coverage} />
                : (
                        <ul className="flex flex-col gap-2">
                            {data.hits.map(hit => (
                                <HitCard
                                    hit={hit}
                                    // A hit has no id: call + position + type is unique within one answer.
                                    key={`${hit.event_id}:${hit.type}:${hit.start_ms ?? hit.slide?.page ?? ""}:${hit.text.slice(0, 32)}`}
                                    mode={data.mode}
                                    query={data.query}
                                    scope={scope}
                                />
                            ))}
                        </ul>
                    )}
            <SearchCoverageNote coverage={data.coverage} />
        </>
    );
}

/**
 * "Ask this call": hybrid (keyword + meaning) search over the call's (or the company's) transcripts
 * and slide text — questions, so no mode control. Runs on submit, never per keystroke; a type chip
 * re-runs the submitted question.
 */
export function AskThisCall({ scope }: { scope: AskScope }) {
    const [draft, setDraft] = React.useState("");

    const [query, setQuery] = React.useState("");

    const [type, setType] = React.useState<EarningsSearchType | undefined>(undefined);

    const { data, error, isFetching } = useEarningsSearch({
        eventId: scope.kind === "event" ? scope.eventId : undefined,
        identifier: scope.kind === "company" ? scope.identifier : undefined,
        limit: SEARCH_LIMIT,
        mode: "hybrid",
        q: query,
        type,
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
                    aria-label={scope.kind === "event" ? "Ask this call" : "Search this company's calls"}
                    maxLength={500}
                    onChange={event => setDraft(event.target.value)}
                    placeholder={scope.kind === "event" ? "Ask this call — e.g. what did they say about margins?" : "Search this company's calls"}
                    value={draft}
                />
                <Button disabled={!canSubmit || isFetching} type="submit">
                    <Search />
                    {isFetching ? "Searching…" : "Search"}
                </Button>
            </form>

            <div className="flex flex-wrap items-center gap-1">
                <Button
                    aria-pressed={type === undefined}
                    onClick={() => setType(undefined)}
                    size="xs"
                    type="button"
                    variant={type === undefined ? "secondary" : "outline"}
                >
                    All
                </Button>
                {TYPES.map(value => (
                    <Button
                        aria-pressed={type === value}
                        key={value}
                        onClick={() => setType(value)}
                        size="xs"
                        type="button"
                        variant={type === value ? "secondary" : "outline"}
                    >
                        {TYPE_LABELS[value]}
                    </Button>
                ))}
                <span className="text-muted-foreground ml-auto text-[0.625rem]">10 credits per search</span>
            </div>

            {query && <AskResults data={data} error={error} isLoading={isFetching} scope={scope} />}
        </section>
    );
}
