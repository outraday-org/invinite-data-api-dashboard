import { ExternalLink, FileText } from "lucide-react";

import type { SecFilingManifestResponse } from "@/lib/api/types";
import type { FilingListRow } from "@/lib/sec/parity";

import { HtmlViewer } from "@/components/html/html-viewer";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { NO_PUBLIC_COPY } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecFilingManifest } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { primaryDocumentOf } from "@/lib/sec/parity";
import { toManifestDocuments } from "@/lib/sec/source";

import { fiscalPeriodLabel } from "./filing-item";

/** The filing whose primary document the dialog shows. */
export type FilingHtmlTarget = FilingListRow & { ticker: string };

/** The primary document's permanent public URL of a manifest; null = no public copy yet. */
export function primaryDocumentUrl(data: null | SecFilingManifestResponse, primaryFilename: null | string) {
    if (!data) return null;

    const doc = primaryDocumentOf(toManifestDocuments(data.documents), primaryFilename);

    return doc && !doc.tooLarge ? doc.publicUrl : null;
}

/**
 * The HTML view's body (pure): the primary document of the manifest at its permanent public URL, the manifest's
 * honest state while it loads / is pending / failed, or "No public copy yet" with the documents reader instead.
 */
export function FilingHtmlBody({
    data,
    error,
    isLoading,
    onOpenDocuments,
    primaryFilename,
    title,
}: {
    data: null | SecFilingManifestResponse;
    error: unknown;
    isLoading: boolean;
    onOpenDocuments: () => void;
    primaryFilename: null | string;
    title: string;
}) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the filing" />;

    if (isLoading && !data) return <Skeleton className="h-full w-full" />;

    if (!data) return null;

    const url = primaryDocumentUrl(data, primaryFilename);

    if (url) return <HtmlViewer className="h-full" title={title} url={url} />;

    return (
        <div className="flex flex-col items-start gap-3">
            <SecReadinessNotice readiness={data.readiness} />
            <div className="text-muted-foreground text-sm">{NO_PUBLIC_COPY}</div>
            <Button onClick={onOpenDocuments} size="sm" type="button" variant="outline">
                <FileText />
                Read in the SEC document store
            </Button>
        </div>
    );
}

export function HtmlDialog({
    dialog,
    onOpenChange,
    onOpenDocuments,
    ticker,
}: {
    dialog: FilingHtmlTarget | null;
    ticker: string;
    onOpenChange: (open: boolean) => void;
    /** Opens the filing in the SEC source panel (its documents and readable versions). */
    onOpenDocuments: (filing: FilingHtmlTarget) => void;
}) {
    // Loaded only while the dialog is open (a null accession keeps the query idle).
    const manifest = useSecFilingManifest(dialog?.accessionNumber ?? null);

    const url = primaryDocumentUrl(manifest.data, dialog?.primaryDocument ?? null);

    const period = dialog ? fiscalPeriodLabel(dialog) : null;

    return (
        <Dialog
            onOpenChange={onOpenChange}
            open={Boolean(dialog)}
        >
            <DialogContent className="sm:max-w-6xl h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] p-0">
                <div className="flex h-full min-h-0 flex-col">
                    <div className="p-4 pb-2 flex flex-col shrink-0">
                        <DialogHeader>
                            <DialogTitle className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="truncate">{dialog?.ticker ?? ticker}</span>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="truncate">{dialog?.formType ?? "HTML"}</span>
                                        {period
                                            ? (
                                                    <>
                                                        <span className="text-muted-foreground">•</span>
                                                        <span className="truncate">{period}</span>
                                                    </>
                                                )
                                            : null}
                                    </div>
                                </div>
                                {url && (
                                    <a
                                        className="text-primary flex items-center gap-1 hover:underline text-xs font-normal shrink-0"
                                        href={url}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >
                                        Open in new tab
                                        {" "}
                                        <ExternalLink className="size-3 mb-0.5" />
                                    </a>
                                )}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                HTML preview
                            </DialogDescription>
                        </DialogHeader>
                        <div className="shrink-0 text-muted-foreground text-xs mt-0.5 flex items-center gap-2 min-w-0">
                            <span className="truncate">{dialog?.accessionNumber ?? ""}</span>
                            {dialog?.filingDate
                                ? (
                                        <>
                                            <span>•</span>
                                            <span className="truncate">
                                                {formatEnDateTime(dialog.filingDate, { hideTime: true })}
                                            </span>
                                        </>
                                    )
                                : null}
                        </div>
                    </div>

                    <div className="px-4 pb-4 min-h-0 grow">
                        {dialog && (
                            <FilingHtmlBody
                                data={manifest.data}
                                error={manifest.error}
                                isLoading={manifest.isLoading}
                                onOpenDocuments={() => onOpenDocuments(dialog)}
                                primaryFilename={dialog.primaryDocument}
                                title={`${dialog.ticker} ${dialog.formType}`}
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
