import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatBytes } from "@/lib/earnings/format";
import { savePublicFile } from "@/lib/news/download";

/**
 * The browser's own PDF view of a URL that serves `inline` (a news original's short-lived URL, a branded PDF's permanent
 * one). `pdf-viewer.tsx` is the page-by-page view of the slides.
 */
export function PdfInlineViewer({ filename, url }: { filename: string; url: string }) {
    return (
        <div className="flex flex-col gap-1">
            <iframe
                className="h-[60vh] w-full rounded border"
                data-testid="news-pdf-viewer"
                referrerPolicy="no-referrer"
                src={url}
                title={filename}
            />
            <div className="text-muted-foreground">Not showing? Open it in a new tab.</div>
        </div>
    );
}

/**
 * The branded PDF of a transcript version or a news item (the API's `pdf`): size and page count, View (inline), a new tab
 * and Download. Nothing without a PDF; `url` is permanent and public, so a changed version just changes the frame.
 */
export function PdfDocumentSection({ filename, pdf }: { filename: string; pdf: null | undefined | { bytes: number; pages: number; url: string } }) {
    const [viewing, setViewing] = React.useState(false);

    if (!pdf) return null;

    return (
        <section className="flex flex-col gap-2 text-xs" data-testid="pdf-document">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">PDF</span>
                <span className="text-muted-foreground">{`${formatBytes(pdf.bytes)} · ${pdf.pages.toLocaleString("en-US")} ${pdf.pages === 1 ? "page" : "pages"}`}</span>
                <Button onClick={() => setViewing(!viewing)} size="sm" type="button" variant="outline">
                    {viewing ? "Hide" : "View"}
                </Button>
                <a className={buttonVariants({ size: "sm", variant: "outline" })} href={pdf.url} rel="noopener noreferrer" target="_blank">
                    <ExternalLinkIcon aria-hidden />
                    Open in new tab
                </a>
                <Button onClick={() => void savePublicFile(pdf.url, filename)} size="sm" type="button" variant="outline">
                    <DownloadIcon aria-hidden />
                    Download
                </Button>
            </div>
            {viewing && <PdfInlineViewer filename={filename} url={pdf.url} />}
        </section>
    );
}
