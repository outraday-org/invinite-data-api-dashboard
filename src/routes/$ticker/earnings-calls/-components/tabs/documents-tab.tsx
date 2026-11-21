import { ExternalLink } from "lucide-react";
import * as React from "react";

import type { V2InvestorDocument, V2InvestorDocumentResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2InvestorDocument, useV2InvestorDocumentsInfinite } from "@/lib/api/queries";
import { useLoadAllPages } from "@/lib/api/use-load-all-pages";
import { DOCUMENT_SORT_VALUES, pagesOf } from "@/lib/earnings/documents";
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

/**
 * The text of one document (pure): the per-page text of `expand=pages` (page by page, with the page's title), else the
 * whole `body_text`, else the public per-page JSON of a file too large to inline (`pages_url`), else a notice.
 */
export function DocumentTextView({ data, error, isLoading }: { data: null | undefined | V2InvestorDocumentResponse; error: unknown; isLoading: boolean }) {
    if (error) return <MediaState error={error} notFound="This document is no longer available" title="Failed to load the document text" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const pages = pagesOf(data.pages ?? undefined);

    if (pages.length > 0) {
        return (
            <ScrollArea className="h-[60vh] rounded-md border">
                <div className="flex flex-col gap-4 p-3">
                    {pages.map(page => (
                        <section aria-label={`Page ${page.n}`} key={page.n}>
                            <div className="text-muted-foreground text-xs">{page.title ? `Page ${page.n} · ${page.title}` : `Page ${page.n}`}</div>
                            <div className="whitespace-pre-wrap leading-relaxed">{page.text}</div>
                        </section>
                    ))}
                </div>
            </ScrollArea>
        );
    }

    if (data.body_text) {
        return (
            <ScrollArea className="h-[60vh] rounded-md border">
                <div className="whitespace-pre-wrap p-3 leading-relaxed">{data.body_text}</div>
            </ScrollArea>
        );
    }

    if (data.pages_url) {
        return (
            <Notice title="The text is too large to show here">
                {/* A permanent public URL, only an href; no referrer. */}
                <a className="underline underline-offset-4" href={data.pages_url} rel="noopener noreferrer" target="_blank">
                    Open the per-page text (JSON)
                </a>
            </Notice>
        );
    }

    return <Notice title="No text stored for this document" />;
}

/** "Show text": the document by id with its pages (`/v1/investor-documents/{id}?expand=pages`). */
function DocumentText({ doc }: { doc: V2InvestorDocument }) {
    const { data, error, isLoading } = useV2InvestorDocument(doc.document_id, { pages: true });

    return <DocumentTextView data={data} error={error} isLoading={isLoading} />;
}

/** The orders of `/v1/investor-documents` (`?docSort=`; the first is the API's default and never written). */
const SORT_LABELS: Record<(typeof DOCUMENT_SORT_VALUES)[number], string> = {
    "-event_date": "Call date, newest first",
    "-filing_date": "Filed, newest first",
    "event_date": "Call date, oldest first",
    "filing_date": "Filed, oldest first",
};

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
 * Documents tab: the call's investor documents (`/v1/investor-documents?event=`, every page) with a kind filter, the
 * order (`sort`, `?docSort=`), links and their text page by page (`expand=pages`). v2 lists no page count (`pages` is
 * the inlined text of the member route), so there is no Pages column.
 */
export function DocumentsTab({ event, eventId, onSearchChange, onTabChange, search }: CallTabProps) {
    const [kinds, setKinds] = React.useState<Array<V2InvestorDocument["kind"]>>([]);

    const [textOf, setTextOf] = React.useState<null | V2InvestorDocument>(null);

    const sort = search.docSort ?? DOCUMENT_SORT_VALUES[0];

    const documentsQuery = useV2InvestorDocumentsInfinite({
        event: eventId,
        kind: kinds.length > 0 ? kinds : undefined,
        limit: 200,
        sort: search.docSort,
    });

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
                <Select
                    onValueChange={value => onSearchChange({ docSort: value === DOCUMENT_SORT_VALUES[0] ? undefined : value ?? undefined })}
                    value={sort}
                >
                    <SelectTrigger aria-label="Order" className="ml-auto" size="sm">
                        <span>{SORT_LABELS[sort]}</span>
                    </SelectTrigger>
                    <SelectContent>
                        {DOCUMENT_SORT_VALUES.map(value => (
                            <SelectItem key={value} value={value}>{SORT_LABELS[value]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
