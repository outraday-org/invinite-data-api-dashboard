import * as React from "react";

import { cn } from "@/lib/utils";

import { useHtmlDocumentProcessing } from "../../hooks/use-html-document-processing";

/**
 * A filed HTML document, fetched, stripped of scripts and framed through `srcDoc` (same origin, so the page can reach
 * into it). `highlightId` = an element to mark green and scroll to the middle once loaded; `anchorId` = an element whose
 * table is outlined and scrolled to the top (a computed value: the filing's table, no cell marked). When the storage refuses the
 * fetch (no CORS header for this origin, e.g. localhost) the URL is framed directly: at `#<id>` the browser still scrolls
 * there, but nothing can be marked.
 */
export function HtmlViewer({
    anchorId = null,
    className,
    highlightId = null,
    title = "HTML preview",
    url,
}: {
    url: string;
    anchorId?: null | string;
    className?: string;
    highlightId?: null | string;
    title?: string;
}) {
    const { failed, srcDoc } = useHtmlDocumentProcessing({ anchorId, highlightId, url });

    const scrollToHighlight = React.useCallback((event: React.SyntheticEvent<HTMLIFrameElement>) => {
        const target = highlightId ?? anchorId;

        if (!target) return;

        try {
            const element = event.currentTarget.contentDocument?.getElementById(target);

            if (highlightId) element?.scrollIntoView({ block: "center" });
            else (element?.closest("table") ?? element)?.scrollIntoView({ block: "start" });
        }
        catch {
            // A cross-origin frame (the fallback) is not reachable: its `#<id>` scrolled it already.
        }
    }, [anchorId, highlightId]);

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
                                src={highlightId ?? anchorId ? `${url}#${encodeURIComponent((highlightId ?? anchorId)!)}` : url}
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
