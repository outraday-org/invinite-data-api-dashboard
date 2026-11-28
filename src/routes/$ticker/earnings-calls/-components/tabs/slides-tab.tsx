import { Download, XIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Slides } from "@/lib/api/queries";
import { eventLabel } from "@/lib/earnings/format";
import { originCodeLabel, trustTierLabel } from "@/lib/earnings/labels";

import type { CallTabProps } from "../call-tabs";
import type { HistoricalSlideSelection } from "../slide-history";

import { useCallAudio } from "../audio-context";
import { MediaState, Notice } from "../media-state";
import { SlidePageViewer } from "../slide-deck-viewer";
import { HistorySlides, VerifiedHistoricalSlides } from "../slide-history";
import { SlideTimeline } from "../slide-timeline";

// `react-pdf` pulls its CSS and pdf.js; load it only when a deck is shown.
const PdfViewer = React.lazy(() => import("@/components/pdf/pdf-viewer").then(module => ({ default: module.PdfViewer })));

/** The deck PDF in the lazy pdf.js viewer. */
function DeckViewer({ url }: { url: string }) {
    return (
        <React.Suspense fallback={<Skeleton className="h-[75vh] w-full" />}>
            <PdfViewer className="h-[75vh]" url={url} />
        </React.Suspense>
    );
}

/** Slide pages with an optional historical comparison; the original PDF remains available to download. */
export function SlidesTab({ event, eventId, onSearchChange, search }: CallTabProps) {
    // `timeline` is opt-in in v2 (v1 always sent it).
    const { data, error } = useV2Slides({ eventId, include: ["markdown", "timeline"] });

    const page = search.slide ?? 1;

    const viewerRef = React.useRef<HTMLDivElement>(null);

    const [comparison, setComparison] = React.useState<HistoricalSlideSelection | null>(null);

    const [comparisonPage, setComparisonPage] = React.useState(1);

    const [comparisonFor, setComparisonFor] = React.useState("");

    React.useEffect(() => {
        setComparison(null);
    }, [eventId, page]);

    const { setSlideMarkers } = useCallAudio();

    // The slide changes become the seek bar's markers once this answer is in (kept when the tab closes).
    const timelineAnswer = data?.timeline;

    React.useEffect(() => {
        if (timelineAnswer && timelineAnswer.length > 0) {
            setSlideMarkers(timelineAnswer.map((entry, index) => ({ label: `Slide ${index + 1}`, ms: entry.at_ms })));
        }
    }, [setSlideMarkers, timelineAnswer]);

    React.useEffect(() => {
        if (search.slide !== undefined && data?.slides.some(slide => slide.page === search.slide)) {
            viewerRef.current?.scrollIntoView({ block: "start" });
        }
    }, [data?.slides, eventId, search.slide]);

    if (error) return <MediaState error={error} notFound="No slides stored for this call" operationId="getSlides" title="Failed to load the slides" />;

    if (!data) return <Skeleton className="h-40 w-full" />;

    const { deck, slides } = data;

    // `[]` without one: the field is opt-in (`include=timeline`) and nullable.
    const timeline = data.timeline ?? [];

    if (!deck && slides.length === 0 && timeline.length === 0) return <Notice title="No slides stored for this call" />;

    const selectedSlide = slides.find(slide => slide.page === page) ?? slides.at(0);

    const selectionKey = `${eventId}:${selectedSlide?.page ?? ""}`;

    const visibleComparison = comparisonFor === selectionKey ? comparison : null;

    const label = eventLabel(event);

    return (
        <div className="flex flex-col gap-4">
            {timeline.length > 0 && <SlideTimeline timeline={timeline} />}

            {deck && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {deck.origin !== "player" && (
                        <a
                            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                            download
                            href={deck.url}
                            rel="noreferrer"
                            target="_blank"
                        >
                            <Download className="size-3.5" />
                            Download deck
                        </a>
                    )}
                    <Badge variant="outline">{originCodeLabel(deck.origin)}</Badge>
                    {deck.trust_tier && <Badge variant="secondary">{trustTierLabel(deck.trust_tier)}</Badge>}
                </div>
            )}

            {selectedSlide
                ? (
                        <>
                            <div className="scroll-mt-24" ref={viewerRef}>
                                <SlidePageViewer
                                    deckUrl={deck?.origin !== "player" ? deck?.url : undefined}
                                    key={`viewer:${eventId}`}
                                    label={label}
                                    onPageChange={(nextPage) => {
                                        onSearchChange({ slide: nextPage });

                                        setComparison(null);
                                    }}
                                    selectedPage={selectedSlide.page}
                                    slides={slides}
                                />
                            </div>
                            {(event.symbol || event.cik) && (
                                <HistorySlides
                                    currentSlide={selectedSlide}
                                    currentSlides={slides}
                                    event={event}
                                    key={`history:${eventId}`}
                                    onSelect={(selection) => {
                                        setComparison(selection);

                                        setComparisonPage(selection.slide.page);

                                        setComparisonFor(selectionKey);
                                    }}
                                    onSelectionInvalidated={() => setComparison(null)}
                                    selectedEventId={visibleComparison?.eventId}
                                    selectedLabel={visibleComparison?.label}
                                />
                            )}
                            {visibleComparison && (
                                <VerifiedHistoricalSlides currentSlide={selectedSlide} currentSlides={slides} selection={visibleComparison}>
                                    {freshComparison => (
                                        <section aria-label="Historical comparison" className="border-primary/30 flex flex-col gap-3 border-t pt-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex flex-col gap-1">
                                                    <h3 className="text-sm font-semibold">{freshComparison.label}</h3>
                                                    <p className="text-muted-foreground text-xs">Compare with the current slide above. Both slide headings support this match.</p>
                                                </div>
                                                <Button onClick={() => setComparison(null)} size="sm" variant="ghost">
                                                    <XIcon />
                                                    Close comparison
                                                </Button>
                                            </div>
                                            <SlidePageViewer
                                                deckUrl={freshComparison.deckUrl}
                                                key={`${selectionKey}:${visibleComparison.eventId}`}
                                                label={visibleComparison.label}
                                                onPageChange={setComparisonPage}
                                                selectedPage={comparisonPage}
                                                slides={freshComparison.slides}
                                            />
                                        </section>
                                    )}
                                </VerifiedHistoricalSlides>
                            )}
                        </>
                    )
                : deck && deck.origin !== "player"
                    ? <DeckViewer url={deck.url} />
                    : null}
        </div>
    );
}
