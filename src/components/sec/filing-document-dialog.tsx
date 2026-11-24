import { ExternalLink } from "lucide-react";

import type { V2FilingDetailResponse } from "@/lib/api/types";

import { HtmlViewer } from "@/components/html/html-viewer";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Filing } from "@/lib/api/queries";
import { primaryDocumentOf } from "@/lib/sec/parity";
import { toV2FilingDocuments } from "@/lib/sec/source";

/** A filing to show: its accession, the value's inline-XBRL element (null = open at the top) and what the reader clicked. */
export type FilingDocumentTarget = { accession: string; elementId: null | string; title: string };

/**
 * The filing's main document: the one whose type is the form (the 10-Q / 10-K itself; the filing answer names no
 * primary file), at its permanent public URL; null = no public HTML copy yet.
 */
export function filingDocumentUrl(data: null | undefined | V2FilingDetailResponse) {
    if (!data) return null;

    const url = primaryDocumentOf(toV2FilingDocuments(data.documents), null, data.form)?.publicUrl ?? null;

    return url && /\.html?$/iu.test(new URL(url).pathname) ? url : null;
}

/** The value's place as a link (`#<element>` scrolls there outside this app too). */
export const elementUrl = (url: string, elementId: null | string) => (elementId ? `${url}#${encodeURIComponent(elementId)}` : url);

/**
 * "Open the filing" of an explained value: the filing's document framed in a dialog — at the value, marked green, when
 * its element is known; at the top otherwise. Asks `/v1/filings/{accession}?expand=documents` (the cache the filings
 * page shares) while open.
 */
export function FilingDocumentDialog({ onClose, target }: { onClose: () => void; target: FilingDocumentTarget | null }) {
    const filing = useV2Filing(target?.accession ?? null, ["documents"]);

    const url = filingDocumentUrl(filing.data);

    return (
        <Dialog onOpenChange={open => !open && onClose()} open={target !== null}>
            <DialogContent className="sm:max-w-6xl h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] p-0">
                <div className="flex h-full min-h-0 flex-col">
                    <DialogHeader className="p-4 pb-2">
                        <DialogTitle className="flex items-start justify-between gap-3">
                            <span className="min-w-0 truncate">{filing.data ? `${filing.data.form} · ${target?.accession ?? ""}` : (target?.accession ?? "Filing")}</span>
                            {url && (
                                <a className="text-primary flex shrink-0 items-center gap-1 text-xs font-normal hover:underline" href={elementUrl(url, target?.elementId ?? null)} rel="noopener noreferrer" target="_blank">
                                    Open in new tab
                                    <ExternalLink className="size-3" />
                                </a>
                            )}
                        </DialogTitle>
                        <DialogDescription className="[overflow-wrap:anywhere]">
                            {target
                                ? (target.elementId ? `${target.title} · the value is marked in the document` : `${target.title} · no place in the document is stated for this value`)
                                : null}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 grow px-4 pb-4">
                        {filing.error
                            ? <SecReadinessNotice error={filing.error} title="Failed to load the filing" />
                            : filing.isLoading
                                ? <Skeleton className="h-full w-full" />
                                : url
                                    ? <HtmlViewer className="h-full" highlightId={target?.elementId ?? null} title={target?.title ?? "Filing"} url={url} />
                                    : <div className="text-muted-foreground text-sm">The filing has no public HTML copy yet.</div>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** The "Open the filing" button of an explained value (at the value when its element is known). */
export function OpenFilingButton({ elementId, onOpen }: { elementId: null | string; onOpen: () => void }) {
    return (
        <button className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline" onClick={onOpen} type="button">
            {elementId ? "Show the value in the filing" : "Open the filing"}
        </button>
    );
}
