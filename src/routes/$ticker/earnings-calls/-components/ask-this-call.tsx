import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, FileText, ImageIcon, Play, Search, X } from "lucide-react";
import * as React from "react";

import type {
    HitMatch,
    SearchCoverage,
    SearchMode,
    V2TranscriptSearchHit,
    V2TranscriptSearchResponse,
    V2TranscriptSearchType,
} from "@/lib/api/types";

import { HighlightedText, SearchCoverageNote, SpanHighlightedText } from "@/components/search/search-highlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { useV2Participants, useV2TranscriptSearch } from "@/lib/api/queries";
import { formatFiscalPeriod, formatMs } from "@/lib/earnings/format";
import { MATCH_TYPE_LABELS } from "@/lib/earnings/labels";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { SpeakerImages } from "./tabs/transcript-turns";
import type { TurnSpeaker } from "./transcript/turn-block";

import { useCallAudio } from "./audio-context";
import { EventLink } from "./event-link";
import { Notice } from "./media-state";
import { useSpeakerImagesByName } from "./tabs/transcript-turns";
import { TurnHeader } from "./transcript/turn-block";

// Lifted to `src/components/search/search-highlight.tsx`; re-exported for this file's existing importers.
export { HighlightedText, SearchCoverageNote, SpanHighlightedText };

/** "Jump to transcript": `quiet` = no notice when the call has no transcript (a played hit jumps along by itself). */
export type JumpToTranscript = (startMs: number, options?: { quiet?: boolean }) => void;

/** One call (the call page) or one company (its calls list, hits link to their call). */
export type AskScope
    = | { eventId: string; kind: "event"; onJumpToTranscript: JumpToTranscript }
        | { identifier: string; kind: "company" };

const SEARCH_LIMIT = 8;

const MIN_QUERY_LENGTH = 2;

const TYPE_LABELS: Record<V2TranscriptSearchType, string> = {
    prepared: "Prepared remarks",
    presentation: "Slides",
    qa: "Q&A",
    transcript: "Transcript",
};

const TYPES = Object.keys(TYPE_LABELS) as Array<V2TranscriptSearchType>;

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

/** A hit's passage: the server's spans when it sent any, else the query's terms. */
export function HitPassage({ match, query, text }: { match: HitMatch; query: string; text: string }) {
    return match.spans.length > 0
        ? <SpanHighlightedText spans={match.spans} text={text} />
        : <HighlightedText query={query} text={text} />;
}

/**
 * How the hit matched: keyword (`lexical`) or exact (`literal`). With `score` its tooltip carries the relevance (the
 * transcript hits; a literal match has none — newest first).
 */
export function MatchBadge({ match, score }: { match: HitMatch; score?: number }) {
    const relevance = score !== undefined && match.type !== "literal" ? ` · relevance ${score.toFixed(4)}` : "";

    return <Badge title={`How the passage matched${relevance}`} variant="secondary">{MATCH_TYPE_LABELS[match.type]}</Badge>;
}

/**
 * The score of a mode: literal is always 0 (newest first, none shown); keyword ranks (BM25 / `ts_rank_cd`, often
 * < 0.01) need the API's 4 decimals.
 */
export function SearchScore({ mode, score }: { mode: SearchMode; score: number }) {
    if (mode === "literal") return null;

    return (
        <span className="text-muted-foreground ml-auto tabular-nums" title="Relevance score">
            {score.toFixed(4)}
        </span>
    );
}

/**
 * "No passages found" is a genuine no-result only with complete coverage; otherwise the coverage note says why. No
 * coverage in the answer (`meta.index` absent) = nothing to doubt.
 */
export function SearchEmptyState({ coverage }: { coverage: null | SearchCoverage }) {
    return coverage === null || coverage.completeness === "complete" ? <div className="text-muted-foreground">No passages found</div> : null;
}

function SlideLink({ slide }: { slide: V2TranscriptSearchHit["slide"] }) {
    if (!slide) return null;

    if (!slide.image_url) return <span className="text-muted-foreground">{`Slide ${slide.page}`}</span>;

    return (
        // A permanent public URL, never in the router search; no referrer.
        <a className={linkClass} href={slide.image_url} rel="noopener noreferrer" target="_blank">
            <ImageIcon className="size-3" />
            {`Open slide ${slide.page}`}
        </a>
    );
}

/**
 * Call page: play the hit (a loaded recording seeks; otherwise the hit's own URL, `#t=<sec>`, is loaded — no extra
 * `/audio` request) AND scroll the Transcript tab to its turn; null without audio.
 */
function useHitPlay(hit: V2TranscriptSearchHit, onJumpToTranscript: JumpToTranscript, onPlayed: () => void): (() => void) | null {
    const { loaded, playUrl, seekMs } = useCallAudio();

    const { audio_url: audioUrl, start_ms: startMs } = hit;

    if (!audioUrl) return null;

    return () => {
        if (loaded && startMs !== null) seekMs(startMs);
        else playUrl(audioUrl);

        if (startMs !== null) onJumpToTranscript(startMs, { quiet: true });

        onPlayed();
    };
}

/** The hit's speaker for `TurnHeader` (a slide hit has none); the image matched by name, else initials. */
function hitSpeaker(hit: V2TranscriptSearchHit, imagesByName: SpeakerImages): null | TurnSpeaker {
    const { label, name, title } = hit.speaker;

    if (!name && !label) return null;

    return { detail: title, imageUrl: name ? imagesByName.get(name) : null, label: label ?? "", name };
}

type HitCardProps = {
    hit: V2TranscriptSearchHit;
    imagesByName: SpeakerImages;
    onPlayed: () => void;
    query: string;
    scope: AskScope;
};

/** One hit: `TurnHeader` (type + match badges, avatar, name, title, m:ss), the passage, the actions. */
function HitShell({
    actions,
    hit,
    imagesByName,
    query,
    timestamp,
    title,
}: Omit<HitCardProps, "onPlayed" | "scope"> & { actions: React.ReactNode; timestamp: React.ReactNode; title?: React.ReactNode }) {
    return (
        <li className="flex flex-col gap-1.5 rounded-md border p-2.5">
            <TurnHeader
                badge={(
                    <>
                        <Badge variant="outline">{TYPE_LABELS[hit.type]}</Badge>
                        <MatchBadge match={hit.match} score={hit.score} />
                        {title}
                    </>
                )}
                speaker={hitSpeaker(hit, imagesByName)}
                startMs={hit.start_ms}
                timestamp={timestamp}
            />
            <HitPassage match={hit.match} query={query} text={hit.text} />
            {actions}
        </li>
    );
}

const timeText = (startMs: null | number) => (startMs === null ? null : <span className="text-muted-foreground tabular-nums">{formatMs(startMs)}</span>);

/** Call page: ▷ m:ss and "Play from here" play the hit and scroll the transcript to it; without audio "Jump to transcript". */
function EventHitCard({ onJumpToTranscript, onPlayed, ...props }: Omit<HitCardProps, "scope"> & { onJumpToTranscript: JumpToTranscript }) {
    const { hit } = props;

    const play = useHitPlay(hit, onJumpToTranscript, onPlayed);

    const startMs = hit.start_ms;

    const timestamp = play && startMs !== null
        ? (
                <button
                    aria-label={`Play from ${formatMs(startMs)}`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 tabular-nums underline-offset-4 hover:underline"
                    onClick={play}
                    type="button"
                >
                    <Play className="size-3" />
                    {formatMs(startMs)}
                </button>
            )
        : timeText(startMs);

    const actions = (
        <div className="flex flex-wrap items-center gap-3">
            {play
                ? (
                        <Button onClick={play} size="xs" type="button" variant="outline">
                            <Play />
                            Play from here
                        </Button>
                    )
                : startMs !== null && (
                    <Button
                        onClick={() => {
                            onJumpToTranscript(startMs);

                            onPlayed();
                        }}
                        size="xs"
                        type="button"
                        variant="outline"
                    >
                        <FileText />
                        Jump to transcript
                    </Button>
                )}
            <SlideLink slide={hit.slide} />
        </div>
    );

    return <HitShell {...props} actions={actions} timestamp={timestamp} />;
}

/** Company calls list: the hit's call page, the audio in a new tab. */
function CompanyHitCard(props: Omit<HitCardProps, "onPlayed" | "scope">) {
    const { hit } = props;

    const actions = (
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

    const title = (
        <EventLink className="font-medium underline-offset-4 hover:underline" event={hit}>
            {`${formatDay(hit.conference_date)} · ${formatFiscalPeriod(hit)}`}
        </EventLink>
    );

    return <HitShell {...props} actions={actions} timestamp={timeText(hit.start_ms)} title={title} />;
}

function HitCard({ onPlayed, scope, ...props }: HitCardProps) {
    return scope.kind === "event"
        ? <EventHitCard {...props} onJumpToTranscript={scope.onJumpToTranscript} onPlayed={onPlayed} />
        : <CompanyHitCard {...props} />;
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
        if (error.status === 400) return <Notice badge="Invalid query" title={badRequest ?? error.message} />;

        // 429 (rate limited) and 503 `unavailable` (search not switched on, or down): the API's own detail.
        if (error.status === 429 || error.code === "unavailable") {
            return <Notice badge={error.status === 429 ? "Rate limited" : "Unavailable"} title={error.message} />;
        }
    }

    return <ErrorState error={error} title="Search failed" />;
}

const NO_IMAGES: SpeakerImages = new Map();

/**
 * The answer body (pure: data / error / loading in; a results header, the list + coverage note out). The header ("8
 * results for "gross margin"") stays while the list collapses (`expanded`, a real button with `aria-expanded`); clear
 * drops the search.
 */
export function AskResults({
    data,
    error,
    expanded = true,
    imagesByName = NO_IMAGES,
    isLoading,
    onClear,
    onExpandedChange,
    onPlayed = () => {},
    scope,
}: {
    data: null | V2TranscriptSearchResponse;
    error: unknown;
    expanded?: boolean;
    /** Speaker name → image (`/v1/participants?event=`); missing = initials. */
    imagesByName?: SpeakerImages;
    isLoading: boolean;
    onClear?: () => void;
    onExpandedChange?: (expanded: boolean) => void;
    /** A hit was played or jumped to (the box then collapses). */
    onPlayed?: () => void;
    scope: AskScope;
}) {
    const bodyId = React.useId();

    if (error) return <SearchError error={error} />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    // v2: the hits are `data`, the index coverage `meta.index`, the query `meta.query`; the mode is each hit's match.
    const coverage = data.meta.index ?? null;

    const query = data.meta.query ?? "";

    const count = data.data.length;

    return (
        <>
            <div className="flex items-center gap-1">
                <Button
                    aria-controls={bodyId}
                    aria-expanded={expanded}
                    className="-ml-2 min-w-0"
                    onClick={() => onExpandedChange?.(!expanded)}
                    size="xs"
                    type="button"
                    variant="ghost"
                >
                    <ChevronDown className={cn("transition-transform", !expanded && "-rotate-90")} />
                    <span className="truncate">{`${count} ${count === 1 ? "result" : "results"} for “${query}”`}</span>
                </Button>
                {onClear && (
                    <Button aria-label="Clear the search" className="ml-auto" onClick={onClear} size="icon-xs" type="button" variant="ghost">
                        <X />
                    </Button>
                )}
            </div>
            <div className="flex flex-col gap-2" hidden={!expanded} id={bodyId}>
                {count === 0
                    ? <SearchEmptyState coverage={coverage} />
                    : (
                            <ul className="flex flex-col gap-2">
                                {data.data.map(hit => (
                                    <HitCard
                                        hit={hit}
                                        imagesByName={imagesByName}
                                        // A hit has no id: call + position + type is unique within one answer.
                                        key={`${hit.event_id}:${hit.type}:${hit.start_ms ?? hit.slide?.page ?? ""}:${hit.text.slice(0, 32)}`}
                                        onPlayed={onPlayed}
                                        query={query}
                                        scope={scope}
                                    />
                                ))}
                            </ul>
                        )}
                {coverage && <SearchCoverageNote coverage={coverage} />}
            </div>
        </>
    );
}

/**
 * "Search this call": keyword (`lexical`) search over the call's (or the company's) transcripts and slide text, no
 * mode control. Scoped, any word may match (BM25) and the management answer follows a matched analyst question.
 * Runs on submit, never per keystroke; a type chip re-runs the submitted query.
 */
export function AskThisCall({ scope }: { scope: AskScope }) {
    const [draft, setDraft] = React.useState("");

    const [query, setQuery] = React.useState("");

    const [type, setType] = React.useState<undefined | V2TranscriptSearchType>(undefined);

    const [expanded, setExpanded] = React.useState(true);

    const { data, error, isFetching } = useV2TranscriptSearch({
        company: scope.kind === "company" ? scope.identifier : undefined,
        event: scope.kind === "event" ? scope.eventId : undefined,
        limit: SEARCH_LIMIT,
        mode: "lexical",
        q: query,
        type,
    });

    // The call's speakers (the Transcript tab's own query, so usually cached): hit avatars, matched by name.
    const participants = useV2Participants(scope.kind === "event" && query ? scope.eventId : "");

    const imagesByName = useSpeakerImagesByName(participants.data);

    const canSubmit = draft.trim().length >= MIN_QUERY_LENGTH;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!canSubmit) return;

        setQuery(draft.trim());

        setExpanded(true);
    };

    const clear = () => {
        setQuery("");

        setDraft("");
    };

    return (
        <section className="flex flex-col gap-2 rounded-md border p-3 text-xs/relaxed">
            <form className="flex items-center gap-2" onSubmit={submit}>
                <Input
                    aria-label={scope.kind === "event" ? "Search this call" : "Search this company's calls"}
                    maxLength={500}
                    onChange={event => setDraft(event.target.value)}
                    placeholder={scope.kind === "event" ? "e.g. gross margin, data center revenue, \"free cash flow\"" : "Search this company's calls"}
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
                    onClick={() => {
                        setType(undefined);

                        setExpanded(true);
                    }}
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
                        onClick={() => {
                            setType(value);

                            setExpanded(true);
                        }}
                        size="xs"
                        type="button"
                        variant={type === value ? "secondary" : "outline"}
                    >
                        {TYPE_LABELS[value]}
                    </Button>
                ))}
                <span className="text-muted-foreground ml-auto text-[0.625rem]">10 credits per search</span>
            </div>

            {query && (
                <AskResults
                    data={data}
                    error={error}
                    expanded={expanded}
                    imagesByName={imagesByName}
                    isLoading={isFetching}
                    onClear={clear}
                    onExpandedChange={setExpanded}
                    onPlayed={() => setExpanded(false)}
                    scope={scope}
                />
            )}
        </section>
    );
}
