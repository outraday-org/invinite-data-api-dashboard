import { useVirtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { cn } from "@/lib/utils";

type ReactPdfModule = {
    Document: React.ComponentType<{
        file: string;
        loading?: React.ReactNode;
        onLoadError?: (e: unknown) => void;
        onLoadSuccess?: (args: { numPages: number }) => void;
        onSourceError?: (e: unknown) => void;
        children?: React.ReactNode;
    }>;
    Page: React.ComponentType<{
        loading?: React.ReactNode;
        pageNumber: number;
        renderAnnotationLayer?: boolean;
        renderTextLayer?: boolean;
        width?: number;
    }>;
    pdfjs: {
        GlobalWorkerOptions: {
            workerSrc: string;
        };
        version?: string;
    };
};

function getErrorMessage(err: unknown, fallback: string) {
    if (typeof err === "object" && err !== null && "message" in err) {
        const msg = (err as { message?: unknown }).message;

        if (typeof msg === "string" && msg.trim().length > 0) return msg;
    }

    return fallback;
}

/**
 * What the viewer shows when pdf.js cannot load the file (e.g. the storage host sends no CORS header for this origin):
 * the reason and the file itself in a new tab, never a bare error inside an empty frame.
 */
export function PdfViewerError({ message, url }: { message: string; url: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-md bg-muted/20 p-3 text-xs" role="status">
            <span>
                The PDF cannot be shown here
                <span className="text-muted-foreground">{` (${message}).`}</span>
            </span>
            <a className="w-fit underline underline-offset-4" href={url} rel="noopener noreferrer" target="_blank">
                Open the PDF in a new tab
            </a>
        </div>
    );
}

export function PdfViewer({
    className,
    url,
}: {
    url: string;
    className?: string;
}) {
    // This project SSRs on Netlify Functions. `react-pdf` imports `pdfjs-dist`, which expects
    // browser globals like `DOMMatrix`. So we only import `react-pdf` in the browser.
    const isBrowser = typeof window !== "undefined";

    const scrollRef = React.useRef<HTMLDivElement | null>(null);

    const [containerWidth, setContainerWidth] = React.useState<number>(0);

    const [numPages, setNumPages] = React.useState<number>(0);

    const [error, setError] = React.useState<null | string>(null);

    const [reactPdf, setReactPdf] = React.useState<null | ReactPdfModule>(null);

    const resizeObserverRef = React.useRef<null | ResizeObserver>(null);

    const setMeasureEl = React.useCallback((el: HTMLDivElement | null) => {
        resizeObserverRef.current?.disconnect();

        resizeObserverRef.current = null;

        if (!el) return;

        const ro = new ResizeObserver(() => {
            setContainerWidth(el.clientWidth);
        });

        ro.observe(el);

        resizeObserverRef.current = ro;

        // Initial measure (RO callback may be async)
        setContainerWidth(el.clientWidth);
    }, []);

    React.useEffect(() => {
        if (!isBrowser) return;

        let cancelled = false;

        void import("react-pdf").then((mod) => {
            if (cancelled) return;

            // Vite + react-pdf worker setup
            // Use a CDN worker to avoid Vite/pdfjs-dist export-path issues.
            // This also keeps the worker out of the SSR bundle.
            const pdfjs = (mod as unknown as ReactPdfModule).pdfjs;

            const version = pdfjs.version ?? "5";

            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

            setReactPdf(mod as unknown as ReactPdfModule);
        });

        return () => {
            cancelled = true;
        };
    }, [isBrowser]);

    React.useEffect(() => {
        return () => {
            resizeObserverRef.current?.disconnect();

            resizeObserverRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        // Reset on URL change
        setNumPages(0);

        setError(null);

        // Keep scroll position predictable when switching PDFs
        scrollRef.current?.scrollTo({ top: 0 });
    }, [url]);

    const virtualizer = useVirtualizer({
        count: numPages,
        estimateSize: () => 1100,
        getScrollElement: () => scrollRef.current,
        overscan: 2,
    });

    const virtualItems = virtualizer.getVirtualItems();

    if (!url) return null;

    if (!isBrowser) {
        return (
            <div className={cn("flex flex-col min-h-0", className)}>
                <div className="rounded-md bg-muted/20 p-3 text-muted-foreground text-xs">
                    PDF preview loads in the browser…
                </div>
            </div>
        );
    }

    if (!reactPdf) {
        return (
            <div className={cn("flex flex-col min-h-0", className)}>
                <div className="rounded-md bg-muted/20 p-3 text-muted-foreground text-xs">
                    Loading PDF viewer…
                </div>
            </div>
        );
    }

    const { Document, Page } = reactPdf;

    // No empty full-height frame around the error: just the reason and the link.
    if (error) return <PdfViewerError message={error} url={url} />;

    return (
        <div className={cn("flex flex-col min-h-0", className)}>
            <div
                className="relative h-full min-h-0 overflow-auto rounded-md bg-muted/20"
                ref={scrollRef}
            >
                <div className="p-3" ref={setMeasureEl}>
                    <Document
                        file={url}
                        loading={<div className="text-muted-foreground text-xs">Loading PDF…</div>}
                        onLoadError={e => setError(getErrorMessage(e, "Failed to load PDF"))}
                        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                        onSourceError={e => setError(getErrorMessage(e, "Failed to load PDF source"))}
                    >
                        <div
                            className="relative w-full"
                            style={{ height: `${virtualizer.getTotalSize()}px` }}
                        >
                            {virtualItems.map(virtualRow => (
                                <div
                                    className="absolute left-0 top-0 w-full"
                                    data-index={virtualRow.index}
                                    key={virtualRow.key}
                                    ref={virtualizer.measureElement}
                                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                                >
                                    <div className="flex justify-center">
                                        <div className="rounded-md bg-background shadow-sm ring-1 ring-foreground/10">
                                            <Page
                                                loading={<div className="p-6 text-muted-foreground text-xs">Loading page…</div>}
                                                pageNumber={virtualRow.index + 1}
                                                renderAnnotationLayer
                                                renderTextLayer
                                                width={Math.max(1, containerWidth)}
                                            />
                                        </div>
                                    </div>
                                    <div className="h-4" />
                                </div>
                            ))}
                        </div>
                    </Document>
                </div>
            </div>
        </div>
    );
}
