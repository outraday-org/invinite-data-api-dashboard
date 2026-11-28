import { ChevronLeft, ChevronRight, Expand, ExternalLink, FileText, Minus, Plus, Scan } from "lucide-react";
import * as React from "react";

import type { V2Slide } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SlidePageViewerProps = {
    children?: React.ReactNode;
    deckUrl?: string;
    label: string;
    onPageChange: (page: number) => void;
    selectedPage: number;
    showThumbnails?: boolean;
    slides: ReadonlyArray<V2Slide>;
};

/** A rendered deck page: public images work even when a PDF host refuses browser CORS requests. */
function SlideImage({ onSettled, slide, zoom }: { onSettled?: () => void; slide: V2Slide; zoom: number }) {
    const [failedUrl, setFailedUrl] = React.useState<null | string>(null);

    if (failedUrl === slide.image_url) {
        return (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-sm" role="status">
                <span>This slide image could not be loaded.</span>
                <a className="text-primary underline-offset-4 hover:underline" href={slide.image_url} rel="noreferrer" target="_blank">Open the slide in a new tab</a>
            </div>
        );
    }

    return (
        <div className="min-w-full" style={{ width: `${zoom}%` }}>
            <img
                alt={slide.title ?? `Slide ${slide.page}`}
                className={cn("mx-auto block w-full object-contain", zoom === 100 && "max-h-[65vh]")}
                decoding="async"
                draggable={false}
                fetchPriority="high"
                loading="eager"
                onError={() => {
                    setFailedUrl(slide.image_url);

                    onSettled?.();
                }}
                onLoad={onSettled}
                src={slide.image_url}
            />
        </div>
    );
}

/** Controlled deck navigation, zoom and page previews; independent instances can compare two periods. */
export function SlidePageViewer({
    children,
    deckUrl,
    label,
    onPageChange,
    selectedPage,
    showThumbnails = true,
    slides,
}: SlidePageViewerProps) {
    const [zoom, setZoom] = React.useState(100);

    const [expanded, setExpanded] = React.useState(false);

    const [showText, setShowText] = React.useState(false);

    const [settledImageUrl, setSettledImageUrl] = React.useState("");

    const [previewDeck, setPreviewDeck] = React.useState("");

    const warmedImages = React.useRef(new Set<string>());

    const selectedIndex = Math.max(0, slides.findIndex(slide => slide.page === selectedPage));

    const slide = slides.at(selectedIndex);

    const deckKey = slides.at(0)?.image_url ?? "";

    // The active page gets the connection first. Warm only its two neighbors after it settles.
    React.useEffect(() => {
        if (!slide || settledImageUrl !== slide.image_url) return;

        if ("connection" in navigator && typeof navigator.connection === "object" && navigator.connection !== null) {
            const connection = navigator.connection;

            if (("saveData" in connection && connection.saveData === true)
                || ("effectiveType" in connection && (connection.effectiveType === "2g" || connection.effectiveType === "slow-2g"))) return;
        }

        const neighbors = [selectedIndex > 0 ? slides.at(selectedIndex - 1) : undefined, slides.at(selectedIndex + 1)];

        for (const neighbor of neighbors) {
            if (!neighbor || neighbor.image_url === slide.image_url || warmedImages.current.has(neighbor.image_url)) continue;

            warmedImages.current.add(neighbor.image_url);

            const image = new Image();

            image.decoding = "async";

            image.fetchPriority = "low";

            image.src = neighbor.image_url;
        }
    }, [selectedIndex, settledImageUrl, slide, slides]);

    const changePage = (index: number) => {
        const next = index >= 0 ? slides.at(index) : undefined;

        if (!next) return;

        setZoom(100);

        onPageChange(next.page);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Only the focused viewer responds; typing and modified browser shortcuts stay untouched.
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

        if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();

            changePage(selectedIndex + (event.key === "ArrowRight" ? 1 : -1));
        }
    };

    if (!slide) return null;

    const controls = (
        <div aria-label={`Controls for ${label}`} className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3 py-2" onKeyDown={handleKeyDown} role="toolbar">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex items-center gap-0.5">
                    <Button aria-label={`Previous slide in ${label}`} disabled={selectedIndex === 0} onClick={() => changePage(selectedIndex - 1)} size="icon-sm" type="button" variant="ghost">
                        <ChevronLeft aria-hidden />
                    </Button>
                    <span aria-live="polite" className="min-w-14 text-center text-xs tabular-nums">{`${selectedIndex + 1} / ${slides.length}`}</span>
                    <Button aria-label={`Next slide in ${label}`} disabled={selectedIndex === slides.length - 1} onClick={() => changePage(selectedIndex + 1)} size="icon-sm" type="button" variant="ghost">
                        <ChevronRight aria-hidden />
                    </Button>
                </div>
                <div className="min-w-0">
                    <div className="text-muted-foreground text-[0.625rem]">{label}</div>
                    <div className="max-w-64 truncate text-xs font-medium" title={slide.title ?? undefined}>{slide.title ?? `Slide ${slide.page}`}</div>
                </div>
            </div>
            <div className="flex items-center gap-0.5">
                <Button aria-label={`Zoom out in ${label}`} disabled={zoom <= 100} onClick={() => setZoom(value => Math.max(100, value - 25))} size="icon-sm" type="button" variant="ghost">
                    <Minus aria-hidden />
                </Button>
                <Button aria-label={`Fit slide in ${label}`} className="min-w-14 gap-1 tabular-nums" onClick={() => setZoom(100)} size="sm" title="Fit slide" type="button" variant="ghost">
                    {zoom === 100 ? <Scan aria-hidden /> : null}
                    {zoom === 100 ? "Fit" : `${zoom}%`}
                </Button>
                <Button aria-label={`Zoom in on ${label}`} disabled={zoom >= 250} onClick={() => setZoom(value => Math.min(250, value + 25))} size="icon-sm" type="button" variant="ghost">
                    <Plus aria-hidden />
                </Button>
                <span aria-hidden className="bg-border mx-1 h-4 w-px" />
                {slide.markdown && (
                    <Button aria-label={`Show slide text in ${label}`} aria-pressed={showText} onClick={() => setShowText(value => !value)} size="icon-sm" title="Slide text" type="button" variant={showText ? "secondary" : "ghost"}>
                        <FileText aria-hidden />
                    </Button>
                )}
                <Button aria-label={`Expand ${label}`} onClick={() => setExpanded(true)} size="icon-sm" title="Expand slide" type="button" variant="ghost">
                    <Expand aria-hidden />
                </Button>
                {deckUrl && (
                    <Button aria-label={`Open PDF for ${label}`} render={<a aria-label={`Open PDF for ${label}`} href={`${deckUrl}#page=${slide.page}`} rel="noreferrer" target="_blank" />} size="icon-sm" title="Open PDF" variant="ghost">
                        <ExternalLink aria-hidden />
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <div aria-label={label} className="overflow-hidden rounded-lg border bg-background" role="group">
            {controls}
            <div className="max-h-[70vh] overflow-auto bg-muted/20 p-2 sm:p-3">
                <SlideImage
                    key={slide.image_url}
                    onSettled={() => {
                        setSettledImageUrl(slide.image_url);

                        setPreviewDeck(deckKey);
                    }}
                    slide={slide}
                    zoom={zoom}
                />
            </div>
            {showText && slide.markdown && (
                <div aria-label="Slide text" className="text-muted-foreground max-h-48 overflow-auto border-t px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap">{slide.markdown}</div>
            )}
            {children}
            {showThumbnails && slides.length > 1 && (
                <div aria-label={`Slides in ${label}`} className="flex gap-2 overflow-x-auto border-t bg-muted/10 p-3">
                    {slides.map(item => (
                        <button
                            aria-label={`Show slide ${item.page}: ${item.title ?? "Untitled"}`}
                            aria-pressed={item.page === slide.page}
                            className={cn("group flex w-28 shrink-0 flex-col gap-1 rounded-md border p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", item.page === slide.page ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/50")}
                            key={item.page}
                            onClick={() => changePage(slides.indexOf(item))}
                            type="button"
                        >
                            <img alt="" className="bg-muted/30 aspect-video w-full rounded-sm object-contain" decoding="async" fetchPriority="low" loading="lazy" src={previewDeck === deckKey ? item.image_url : undefined} />
                            <span className={cn("w-full truncate px-0.5 text-[0.625rem]", item.page === slide.page ? "text-primary" : "text-muted-foreground")}>{`${item.page}. ${item.title ?? "Untitled"}`}</span>
                        </button>
                    ))}
                </div>
            )}
            <Dialog onOpenChange={setExpanded} open={expanded}>
                <DialogContent className="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] flex-col gap-2 p-3 sm:max-w-[calc(100vw-2rem)]">
                    <DialogHeader className="shrink-0 pr-8">
                        <DialogTitle className="text-sm">{slide.title ?? `Slide ${slide.page}`}</DialogTitle>
                        <DialogDescription>{`${label} · Slide ${slide.page}`}</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 grow overflow-auto rounded-md bg-muted/20">
                        <SlideImage slide={slide} zoom={zoom} />
                    </div>
                    <div className="flex shrink-0 items-center justify-center gap-3">
                        <Button aria-label="Previous expanded slide" disabled={selectedIndex === 0} onClick={() => changePage(selectedIndex - 1)} size="sm" type="button" variant="ghost">
                            <ChevronLeft aria-hidden />
                            Previous
                        </Button>
                        <span className="text-muted-foreground text-xs tabular-nums">{`${selectedIndex + 1} / ${slides.length}`}</span>
                        <Button aria-label="Next expanded slide" disabled={selectedIndex === slides.length - 1} onClick={() => changePage(selectedIndex + 1)} size="sm" type="button" variant="ghost">
                            Next
                            <ChevronRight aria-hidden />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
