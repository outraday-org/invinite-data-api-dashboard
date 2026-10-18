import type { EarningsCompanyDocument } from "@/lib/api/types";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useEarningsCompanyDocument } from "@/lib/api/queries";
import { documentKindLabel, pagesOf } from "@/lib/earnings/documents";
import { MediaState, Notice } from "@/routes/$ticker/earnings-calls/-components/media-state";

/** The per-page text of one document (detail route, `include=pages`); a file over 2 MB links its pages file instead. */
function DocumentPages({ documentId }: { documentId: string }) {
    const { data, error, isLoading } = useEarningsCompanyDocument(documentId, { pages: true });

    if (error) return <MediaState error={error} notFound="This document is no longer available" title="Failed to load the document text" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const pages = pagesOf(data.document.pages_json);

    if (pages.length === 0) {
        return data.document.pages_url
            ? (
                    <Notice title="The text is too large to show here">
                        {/* Presigned: a bearer credential, only an href; no referrer. */}
                        <a className="underline underline-offset-4" href={data.document.pages_url} rel="noopener noreferrer" target="_blank">
                            Open the per-page text (JSON)
                        </a>
                    </Notice>
                )
            : <Notice title="No text extracted for this document yet" />;
    }

    return (
        <ScrollArea className="h-[60vh] rounded-md border">
            <div className="flex flex-col gap-4 p-3">
                {pages.map(page => (
                    <section key={page.n}>
                        <div className="text-muted-foreground text-xs">{page.title ? `Page ${page.n} · ${page.title}` : `Page ${page.n}`}</div>
                        <div className="whitespace-pre-wrap leading-relaxed">{page.text}</div>
                    </section>
                ))}
            </div>
        </ScrollArea>
    );
}

/** "Show text" dialog of the Documents page; `doc: null` = closed (no request). */
export function DocumentTextDialog({ doc, onClose }: { doc: EarningsCompanyDocument | null; onClose: () => void }) {
    return (
        <Dialog onOpenChange={open => !open && onClose()} open={doc !== null}>
            <DialogContent className="sm:max-w-3xl">
                {doc && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{doc.title ?? documentKindLabel(doc.kind)}</DialogTitle>
                            <DialogDescription>Text extracted from the company-published document, page by page.</DialogDescription>
                        </DialogHeader>
                        <DocumentPages documentId={doc.document_id} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
