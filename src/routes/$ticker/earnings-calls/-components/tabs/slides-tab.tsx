import { Download } from "lucide-react";
import * as React from "react";

import type { EarningsSlide } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEarningsSlides } from "@/lib/api/queries";
import { SIGNED_URL_DEFAULT_TTL_MS } from "@/lib/earnings/media-timing";
import { useMediaUrl } from "@/lib/earnings/use-media-url";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";
import { SlideTimeline } from "../slide-timeline";

// `react-pdf` pulls its CSS and pdf.js; load it only when a deck is shown.
const PdfViewer = React.lazy(() => import("@/components/pdf/pdf-viewer").then(module => ({ default: module.PdfViewer })));

/** The PDF viewer keeps the URL it opened with (pdf.js holds the document); a refreshed URL would reload it. */
function DeckViewer({ url }: { url: string }) {
    const [openedUrl] = React.useState(url);

    return (
        <React.Suspense fallback={<Skeleton className="h-[75vh] w-full" />}>
            <PdfViewer className="h-[75vh]" url={openedUrl} />
        </React.Suspense>
    );
}

/**
 * Slides tab: the deck PDF (unless the slides are captured player images, `origin: "player"`)
 * with a download link, and a page strip of the slide images with their extracted text. Above
 * them the player slides on the audio's clock (`timeline`, `SlideTimeline`), when there are any.
 * Presigned URLs are refreshed before they expire.
 */
export function SlidesTab({ selector }: CallTabProps) {
    const { data, dataUpdatedAt, error, refetch } = useEarningsSlides({ ...selector, include: "markdown" });

    const [openSlide, setOpenSlide] = React.useState<EarningsSlide | null>(null);

    // Slide images carry no expiry of their own; without a deck assume IDA's default lifetime.
    const expiresAt = data
        ? data.deck?.expires_at ?? new Date(dataUpdatedAt + SIGNED_URL_DEFAULT_TTL_MS).toISOString()
        : null;

    const { onMediaError } = useMediaUrl({ expiresAt, refetch });

    if (error) return <MediaState error={error} notFound="No slides stored for this call" title="Failed to load the slides" />;

    if (!data) return <Skeleton className="h-40 w-full" />;

    // Default `[]`: an API without the field (released before IDA's timeline) must not break the tab.
    const { deck, slides, timeline = [] } = data;

    if (!deck && slides.length === 0 && timeline.length === 0) return <Notice title="No slides stored for this call" />;

    // Reopened from the refreshed answer so the dialog's image URL is current.
    const shownSlide = openSlide ? slides.find(slide => slide.page === openSlide.page) ?? openSlide : null;

    return (
        <div className="flex flex-col gap-4">
            {timeline.length > 0 && <SlideTimeline onMediaError={onMediaError} timeline={timeline} />}

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
                        <span className="text-muted-foreground">
                            Signed link, valid until
                            {" "}
                            {new Date(deck.expires_at).toLocaleTimeString()}
                            {" "}
                            (renewed automatically)
                        </span>
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
                                onError={onMediaError}
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

            <Dialog onOpenChange={open => !open && setOpenSlide(null)} open={shownSlide !== null}>
                <DialogContent className="sm:max-w-4xl">
                    {shownSlide && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Slide
                                    {" "}
                                    {shownSlide.page}
                                    {shownSlide.title ? ` · ${shownSlide.title}` : ""}
                                </DialogTitle>
                            </DialogHeader>
                            <img
                                alt={shownSlide.title ?? `Slide ${shownSlide.page}`}
                                className="max-h-[60vh] w-full object-contain"
                                onError={onMediaError}
                                src={shownSlide.image_url}
                            />
                            {shownSlide.markdown && (
                                // Extracted markdown shown as plain text (no markdown renderer in this app).
                                <div className="max-h-[25vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2">
                                    {shownSlide.markdown}
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
