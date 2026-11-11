import { ExternalLink } from "lucide-react";
import * as React from "react";

import type { V2InvestorDocument } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2InvestorDocument, useV2InvestorDocumentsInfinite } from "@/lib/api/queries";
import { useLoadAllPages } from "@/lib/api/use-load-all-pages";
import { formatBytes } from "@/lib/earnings/format";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";

/** The spec's `kind` enum (IDA `EVENT_DOCUMENT_KINDS`), in filter-chip order. */
export const EVENT_DOCUMENT_KINDS = [
    "cfo_commentary",
    "financial_data",
    "shareholder_letter",
    "fact_sheet",
    "company_transcript",
    "sec_filing",
    "infographic",
    "other",
] as const satisfies ReadonlyArray<V2InvestorDocument["kind"]>;

const kindLabel = (kind: string) => kind.replaceAll("_", " ");

/** Where a row links: an SEC filing to EDGAR (`source_url`), else the stored copy, else the source. */
function documentHref(doc: V2InvestorDocument) {
    if (doc.kind === "sec_filing") return doc.source_url;

    return doc.url ?? doc.source_url;
}

/** The call's SEC filing links (10-Q / 10-K), shown apart under "Filings": they are no call material. */
function FilingsTable({ filings }: { filings: Array<V2InvestorDocument> }) {
    return (
        <section aria-label="Filings" className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Filings</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Filed</TableHead>
                        <TableHead>Accession</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filings.map(doc => (
                        <TableRow key={doc.document_id}>
                            <TableCell className="max-w-xs truncate">{doc.title ?? "Untitled"}</TableCell>
                            <TableCell className="tabular-nums">{doc.filing_date ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground tabular-nums">{doc.accession_number ?? "—"}</TableCell>
                            <TableCell>
                                <div className="flex items-center justify-end">
                                    <a
                                        className="inline-flex items-center gap-1 underline underline-offset-4"
                                        href={documentHref(doc)}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >
                                        <ExternalLink className="size-3" />
                                        EDGAR
                                    </a>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </section>
    );
}

/** "Show text": the document by id (`/v1/investor-documents/{id}`: `body_text` is served on the member route only). */
function DocumentText({ doc }: { doc: V2InvestorDocument }) {
    const { data, error, isLoading } = useV2InvestorDocument(doc.document_id);

    if (error) return <MediaState error={error} notFound="This document is no longer available" title="Failed to load the document text" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    if (!data.body_text) return <Notice title="No text stored for this document" />;

    return (
        <ScrollArea className="h-[60vh] rounded-md border">
            <div className="whitespace-pre-wrap p-3 leading-relaxed">{data.body_text}</div>
        </ScrollArea>
    );
}

/** "Also on this call:" the call's press release and slides tabs, when it has them. */
function AlsoOnThisCall({ event, onTabChange }: Pick<CallTabProps, "event" | "onTabChange">) {
    const tabs = [
        ...(event.has_press_release ? [{ label: "Press release", tab: "press-release" as const }] : []),
        ...(event.has_slides ? [{ label: "Slides", tab: "slides" as const }] : []),
    ];

    if (tabs.length === 0) return null;

    return (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            Also on this call:
            {tabs.map(({ label, tab }) => (
                <Button className="h-auto p-0 text-xs" key={tab} onClick={() => onTabChange(tab)} type="button" variant="link">
                    {label}
                </Button>
            ))}
        </div>
    );
}

/**
 * Documents tab: the call's investor documents (`/v1/investor-documents?event=`, every page) with a kind filter, links
 * and their text. v2 lists no page count (`pages` is the inlined text of the member route), so there is no Pages column.
 */
export function DocumentsTab({ event, eventId, onTabChange }: CallTabProps) {
    const [kinds, setKinds] = React.useState<Array<V2InvestorDocument["kind"]>>([]);

    const [textOf, setTextOf] = React.useState<null | V2InvestorDocument>(null);

    const documentsQuery = useV2InvestorDocumentsInfinite({ event: eventId, kind: kinds.length > 0 ? kinds : undefined, limit: 200 });

    useLoadAllPages({ ...documentsQuery, hasNextPage: Boolean(documentsQuery.hasNextPage) });

    const { data, error, isLoading } = documentsQuery;

    const rows = data?.pages.flatMap(page => page.data) ?? [];

    const documents = rows.filter(doc => doc.kind !== "sec_filing");

    const filings = rows.filter(doc => doc.kind === "sec_filing");

    const toggleKind = (kind: V2InvestorDocument["kind"]) =>
        setKinds(current => (current.includes(kind) ? current.filter(k => k !== kind) : [...current, kind]));

    return (
        <div className="flex flex-col gap-3">
            <AlsoOnThisCall event={event} onTabChange={onTabChange} />

            <div className="flex flex-wrap items-center gap-1">
                {EVENT_DOCUMENT_KINDS.map(kind => (
                    <Button
                        aria-pressed={kinds.includes(kind)}
                        key={kind}
                        onClick={() => toggleKind(kind)}
                        size="xs"
                        type="button"
                        variant={kinds.includes(kind) ? "secondary" : "outline"}
                    >
                        {kindLabel(kind)}
                    </Button>
                ))}
                {kinds.length > 0 && (
                    <Button onClick={() => setKinds([])} size="xs" type="button" variant="ghost">
                        Clear
                    </Button>
                )}
            </div>

            {error
                ? <MediaState error={error} title="Failed to load the documents" />
                : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kind</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Producer / source</TableHead>
                                        <TableHead>Trust</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Size</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && (
                                        <TableRow>
                                            <TableCell colSpan={7}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {documents.map(doc => (
                                        <TableRow key={doc.document_id}>
                                            <TableCell>
                                                <Badge variant="outline">{kindLabel(doc.kind)}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">{doc.title ?? "Untitled"}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {[doc.producer, doc.source_label].filter(Boolean).join(" · ") || doc.origin}
                                            </TableCell>
                                            <TableCell>
                                                {doc.trust_tier ? <Badge variant="secondary">{doc.trust_tier}</Badge> : "—"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{doc.content_type ?? "—"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatBytes(doc.bytes)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-2">
                                                    <a
                                                        className="inline-flex items-center gap-1 underline underline-offset-4"
                                                        href={documentHref(doc)}
                                                        rel="noopener noreferrer"
                                                        target="_blank"
                                                    >
                                                        <ExternalLink className="size-3" />
                                                        {doc.kind === "sec_filing" ? "EDGAR" : "Open"}
                                                    </a>
                                                    <Button onClick={() => setTextOf(doc)} size="xs" type="button" variant="ghost">
                                                        Show text
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {!isLoading && documents.length === 0 && (
                                <div className="text-muted-foreground w-full p-2 text-center text-xs">
                                    {kinds.length > 0
                                        ? "No documents of these kinds."
                                        : filings.length > 0
                                            ? "No other documents stored for this call."
                                            : "No documents stored for this call."}
                                </div>
                            )}

                            {filings.length > 0 && <FilingsTable filings={filings} />}
                        </>
                    )}

            <Dialog onOpenChange={open => !open && setTextOf(null)} open={textOf !== null}>
                <DialogContent className="sm:max-w-3xl">
                    {textOf && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{textOf.title ?? kindLabel(textOf.kind)}</DialogTitle>
                                <DialogDescription>Text extracted from the document.</DialogDescription>
                            </DialogHeader>
                            <DocumentText doc={textOf} />
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
