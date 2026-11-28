import { History } from "lucide-react";
import * as React from "react";

import type { V2Event, V2Slide } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2EventsInfinite, useV2Slides } from "@/lib/api/queries";
import { formatFiscalPeriod } from "@/lib/earnings/format";
import { historicalSlideEvents, historicalSlideMatch } from "@/lib/earnings/slide-history";
import { cn } from "@/lib/utils";

import { MediaState, Notice } from "./media-state";

export type HistoricalSlideSelection = {
    deckUrl?: string;
    eventId: string;
    label: string;
    slide: V2Slide;
    slides: ReadonlyArray<V2Slide>;
};

type HistoryProps = {
    currentSlide: V2Slide;
    currentSlides: ReadonlyArray<V2Slide>;
    event: V2Event;
    onSelect: (selection: HistoricalSlideSelection) => void;
    onSelectionInvalidated?: () => void;
    selectedEventId?: string;
    selectedLabel?: string;
};

const historicalEventLabel = (event: V2Event) => event.fiscal_year === null ? event.scheduled_at.slice(0, 4) : formatFiscalPeriod(event);

const matchExplanation = {
    conflict: "The slide headings do not support this comparison.",
    insufficient: "There is not enough slide text to verify this comparison.",
    non_unique: "No unique matching slide title.",
};

/** Same query as the discovery card: cached/deduplicated, never a separate title-only read.
 * Re-derive on every current/historical refetch instead of trusting the selected array copy.
 */
export function VerifiedHistoricalSlides({ children, currentSlide, currentSlides, selection }: {
    children: (selection: HistoricalSlideSelection) => React.ReactNode;
    currentSlide: V2Slide;
    currentSlides: ReadonlyArray<V2Slide>;
    selection: HistoricalSlideSelection;
}) {
    const { data, error } = useV2Slides({ eventId: selection.eventId, include: ["markdown"] });

    if (error) return <MediaState error={error} operationId="getSlides" title="Failed to load historical slides" />;

    if (!data) return <Skeleton aria-label="Loading comparison slides" className="h-32 w-full" />;

    const result = historicalSlideMatch(currentSlide, currentSlides, data.slides);

    if (result.reason !== "match") return <Notice title={matchExplanation[result.reason]} />;

    if (result.slide.page !== selection.slide.page) return <Notice title="The historical slide changed. Select the comparison again." />;

    return children({ ...selection, deckUrl: data.deck?.origin !== "player" ? data.deck?.url : undefined, slide: result.slide, slides: data.slides });
}

function HistoricalDeck({ currentSlide, currentSlides, event, onSelect, selectedEventId }: HistoryProps) {
    const { data, error } = useV2Slides({ eventId: event.event_id, include: ["markdown"] });

    const [failedImage, setFailedImage] = React.useState("");

    const label = historicalEventLabel(event);

    if (error) {
        return (
            <div className="min-w-0 rounded-md border p-3">
                <div className="mb-2 text-xs font-medium">{label}</div>
                <MediaState error={error} notFound="No historical slides stored" operationId="getSlides" title="Failed to load historical slides" />
            </div>
        );
    }

    if (!data) return <Skeleton aria-label={`Loading ${label} slides`} className="h-32 w-full" />;

    const result = historicalSlideMatch(currentSlide, currentSlides, data.slides);

    if (result.reason !== "match") {
        return (
            <div className="flex min-h-24 flex-col justify-center gap-1 rounded-md border border-dashed p-3 text-xs">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">{data.slides.length === 0 ? "Slide images are not available yet." : matchExplanation[result.reason]}</span>
            </div>
        );
    }

    const match = result.slide;

    return (
        <button
            aria-label={`Compare ${label}, slide ${match.page}: ${match.title ?? "Untitled"}`}
            aria-pressed={selectedEventId === event.event_id}
            className={cn("group flex min-w-0 flex-col overflow-hidden rounded-md border text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", selectedEventId === event.event_id && "border-primary bg-primary/5")}
            onClick={() => onSelect({ deckUrl: data.deck?.origin !== "player" ? data.deck?.url : undefined, eventId: event.event_id, label, slide: match, slides: data.slides })}
            type="button"
        >
            {failedImage === match.image_url
                ? <span className="text-muted-foreground flex aspect-video items-center justify-center bg-muted/30 text-xs">Preview unavailable</span>
                : <img alt="" className="aspect-video w-full bg-muted/30 object-contain" loading="lazy" onError={() => setFailedImage(match.image_url)} src={match.image_url} />}
            <span className="flex w-full items-center justify-between gap-2 px-3 pt-2 text-xs font-medium">
                {label}
                <span className="text-muted-foreground font-normal">{`Slide ${match.page}`}</span>
            </span>
            <span className="text-muted-foreground block w-full truncate px-3 pt-1 pb-2 text-xs">{match.title}</span>
        </button>
    );
}

/** History reads start on demand. At most four decks are read, with explicit cursor paging for more calls. */
export function HistorySlides(props: HistoryProps) {
    const { currentSlide, currentSlides, event, onSelect, onSelectionInvalidated, selectedEventId, selectedLabel } = props;

    const [enabledEvent, setEnabledEvent] = React.useState("");

    const enabled = enabledEvent === event.event_id;

    const query = useV2EventsInfinite({
        company: event.symbol || event.cik,
        enabled,
        fiscalQuarter: event.event_type === "earnings_call" ? event.fiscal_quarter ?? undefined : undefined,
        limit: 50,
        scheduledAtLte: event.scheduled_at.slice(0, 10),
        sort: "-scheduled_at",
        toastErrors: false,
        type: event.event_type,
    });

    const events = query.data?.pages.flatMap(page => page.data) ?? [];

    const candidates = historicalSlideEvents(event, events);

    React.useEffect(() => {
        if (!enabled || !query.data || query.error || !selectedEventId) return;

        const selected = candidates.find(candidate => candidate.event_id === selectedEventId);

        if (!selected || (selectedLabel && historicalEventLabel(selected) !== selectedLabel)) onSelectionInvalidated?.();
    }, [candidates, enabled, onSelectionInvalidated, query.data, query.error, selectedEventId, selectedLabel]);

    return (
        <section aria-label="Historical slides" className="flex flex-col gap-3 rounded-lg border bg-muted/10 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                    <History aria-hidden className="text-muted-foreground mt-0.5 size-4" />
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium">This slide in earlier years</h3>
                        <p className="text-muted-foreground text-xs">
                            Same slide title, supported by both slide headings
                            {event.event_type === "earnings_call" && event.fiscal_quarter !== null ? ", same fiscal quarter" : ""}
                            . Select a slide to compare below.
                        </p>
                    </div>
                </div>
                {!enabled && <Button onClick={() => setEnabledEvent(event.event_id)} size="sm" type="button" variant="outline">Find historical slides</Button>}
            </div>
            {enabled && (
                <>
                    {query.error && <MediaState error={query.error} operationId="listEvents" title="Failed to load earlier calls" />}
                    {query.isLoading && <Skeleton aria-label="Loading earlier calls" className="h-24 w-full" />}
                    {candidates.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {candidates.map(candidate => (
                                <HistoricalDeck
                                    currentSlide={currentSlide}
                                    currentSlides={currentSlides}
                                    event={candidate}
                                    key={candidate.event_id}
                                    onSelect={onSelect}
                                    selectedEventId={selectedEventId}
                                />
                            ))}
                        </div>
                    )}
                    {!query.error && !query.isLoading && candidates.length === 0 && <p className="text-muted-foreground text-xs">No earlier-year decks in the loaded calls.</p>}
                    {query.hasNextPage && candidates.length < 4 && (
                        <Button className="self-start" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} size="sm" type="button" variant="ghost">
                            {query.isFetchingNextPage ? "Loading earlier calls…" : "Load more calls"}
                        </Button>
                    )}
                </>
            )}
        </section>
    );
}
