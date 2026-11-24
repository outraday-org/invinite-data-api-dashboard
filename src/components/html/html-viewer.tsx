import * as React from "react";

import { cn } from "@/lib/utils";

import { useHtmlDocumentProcessing } from "../../hooks/use-html-document-processing";

/**
 * A filed HTML document, fetched, stripped of scripts and framed through `srcDoc` (same origin, so the page can reach
 * into it). `highlightId` = an element to mark green and scroll to the middle once loaded. When the storage refuses the
 * fetch (no CORS header for this origin, e.g. localhost) the URL is framed directly: at `#<id>` the browser still scrolls
 * there, but nothing can be marked.
 */
export function HtmlViewer({
    className,
    highlightId = null,
    title = "HTML preview",
    url,
}: {
    url: string;
    className?: string;
    highlightId?: null | string;
    title?: string;
}) {
    const { failed, srcDoc } = useHtmlDocumentProcessing({ highlightId, url });

    const scrollToHighlight = React.useCallback((event: React.SyntheticEvent<HTMLIFrameElement>) => {
        if (!highlightId) return;

        try {
            event.currentTarget.contentDocument?.getElementById(highlightId)?.scrollIntoView({ block: "center" });
        }
        catch {
            // A cross-origin frame (the fallback) is not reachable: its `#<id>` scrolled it already.
        }
    }, [highlightId]);

    if (!url) return null;

    return (
        <div className={cn("flex flex-col min-h-0", className)}>
            <div className="relative h-full min-h-0 overflow-hidden rounded-md bg-muted/20 ring-1 ring-foreground/10">
                {failed
                    ? (
                            // Fallback: if fetching fails (CORS), try embedding directly.
                            <iframe
                                className="h-full w-full border-0 bg-white"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                src={highlightId ? `${url}#${encodeURIComponent(highlightId)}` : url}
                                title={title}
                            />
                        )
                    : srcDoc
                        ? (
                                <iframe
                                    className="h-full w-full border-0 bg-white"
                                    loading="lazy"
                                    onLoad={scrollToHighlight}
                                    referrerPolicy="no-referrer"
                                    srcDoc={srcDoc}
                                    title={title}
                                />
                            )
                        : (
                                <div className="text-muted-foreground flex h-full w-full items-center justify-center p-6 text-sm">
                                    Loading HTML…
                                </div>
                            )}
            </div>
        </div>
    );
}
