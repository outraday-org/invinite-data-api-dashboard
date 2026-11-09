import { Download } from "lucide-react";
import * as React from "react";

import type { V2Slide } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Slides } from "@/lib/api/queries";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";
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

/**
 * Slides tab: the deck PDF (unless the slides are captured player images, `origin: "player"`)
 * with a download link, and a page strip of the slide images with their extracted text. Above
 * them the player slides on the audio's clock (`timeline`, `SlideTimeline`), when there are any.
 * Every URL is a permanent public one, used as the API answered it (a failing image shows the
 * browser's broken image; nothing is refetched).
 */
export function SlidesTab({ eventId }: CallTabProps) {
    // `timeline` is opt-in in v2 (v1 always sent it).
    const { data, error } = useV2Slides({ eventId, include: ["markdown", "timeline"] });

    const [openSlide, setOpenSlide] = React.useState<null | V2Slide>(null);

    if (error) return <MediaState error={error} notFound="No slides stored for this call" title="Failed to load the slides" />;

    if (!data) return <Skeleton className="h-40 w-full" />;

    const { deck, slides } = data;

    // `[]` without one: the field is opt-in (`include=timeline`) and nullable.
    const timeline = data.timeline ?? [];

    if (!deck && slides.length === 0 && timeline.length === 0) return <Notice title="No slides stored for this call" />;

    return (
        <div className="flex flex-col gap-4">
            {timeline.length > 0 && <SlideTimeline timeline={timeline} />}

            {deck && (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {deck.origin !== "player" && (
                            <a
                                className="inline-flex items-center gap-1 underline underline-offset-4"
                                download
                                href={deck.url}
                                rel="noreferrer"
                                target="_blank"
                            >
                                <Download className="size-3.5" />
                                Download deck
                            </a>
                        )}
                        <span className="text-muted-foreground">
                            {deck.pages === null ? "Pages —" : `${deck.pages} pages`}
                        </span>
                        <Badge variant="outline">{deck.origin}</Badge>
                        {deck.trust_tier && <Badge variant="secondary">{deck.trust_tier}</Badge>}
                    </div>
                    {deck.origin !== "player" && <DeckViewer url={deck.url} />}
                </div>
            )}

            {slides.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {slides.map(slide => (
                        <button
                            className="flex flex-col gap-1 rounded-md border p-1 text-left hover:bg-muted/50"
                            key={slide.page}
                            onClick={() => setOpenSlide(slide)}
                            type="button"
                        >
                            <img
                                alt={slide.title ?? `Slide ${slide.page}`}
                                className="aspect-video w-full rounded-sm object-contain bg-muted/30"
                                loading="lazy"
                                src={slide.image_url}
                            />
                            <span className="truncate text-[0.625rem] text-muted-foreground">
                                {slide.page}
                                {". "}
                                {slide.title ?? "Untitled"}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <Dialog onOpenChange={open => !open && setOpenSlide(null)} open={openSlide !== null}>
                <DialogContent className="sm:max-w-4xl">
                    {openSlide && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Slide
                                    {" "}
                                    {openSlide.page}
                                    {openSlide.title ? ` · ${openSlide.title}` : ""}
                                </DialogTitle>
                            </DialogHeader>
                            <img
                                alt={openSlide.title ?? `Slide ${openSlide.page}`}
                                className="max-h-[60vh] w-full object-contain"
                                src={openSlide.image_url}
                            />
                            {openSlide.markdown && (
                                // Extracted markdown shown as plain text (no markdown renderer in this app).
                                <div className="max-h-[25vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2">
                                    {openSlide.markdown}
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
