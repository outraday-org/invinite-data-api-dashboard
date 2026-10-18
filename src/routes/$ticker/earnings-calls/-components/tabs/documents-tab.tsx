import { ExternalLink } from "lucide-react";
import * as React from "react";

import type { EarningsEventSelector } from "@/lib/api/queries";
import type { EarningsDocument } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEarningsDocumentsInfinite } from "@/lib/api/queries";
import { earliestExpiry } from "@/lib/earnings/documents";
import { formatBytes } from "@/lib/earnings/format";
import { useMediaUrl } from "@/lib/earnings/use-media-url";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

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
] as const satisfies ReadonlyArray<EarningsDocument["kind"]>;

const kindLabel = (kind: string) => kind.replaceAll("_", " ");

/** Where a row links: an SEC filing to EDGAR (`source_url`), else the stored copy, else the source. */
function documentHref(doc: EarningsDocument) {
    if (doc.kind === "sec_filing") return doc.source_url;

    return doc.url ?? doc.source_url;
}

const TEXT_LOOKUP_LIMIT = 100;

/** "Show text": re-asks the document's kind with `include=body` and shows that row's text. */
function DocumentText({ doc, selector }: { doc: EarningsDocument; selector: EarningsEventSelector }) {
    const { data, error, isLoading } = useEarningsDocumentsInfinite({
        ...selector,
        include: "body",
        kind: [doc.kind],
        limit: TEXT_LOOKUP_LIMIT,
    });

    if (error) return <MediaState error={error} title="Failed to load the document text" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const match = data.pages.flatMap(page => page.documents).find(row => row.document_id === doc.document_id);

    if (!match?.body_text) return <Notice title="No text stored for this document" />;

    return (
        <ScrollArea className="h-[60vh] rounded-md border">
            <div className="whitespace-pre-wrap p-3 leading-relaxed">{match.body_text}</div>
        </ScrollArea>
    );
}

/** Documents tab: the call's investor documents with a kind filter, links and their text. */
export function DocumentsTab({ selector }: CallTabProps) {
    const [kinds, setKinds] = React.useState<Array<EarningsDocument["kind"]>>([]);

    const [textOf, setTextOf] = React.useState<EarningsDocument | null>(null);

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
    } = useEarningsDocumentsInfinite({ ...selector, kind: kinds.length > 0 ? kinds : undefined });

    const documents = data?.pages.flatMap(page => page.documents) ?? [];

    useMediaUrl({ expiresAt: earliestExpiry(documents), refetch });

    const toggleKind = (kind: EarningsDocument["kind"]) =>
        setKinds(current => (current.includes(kind) ? current.filter(k => k !== kind) : [...current, kind]));

    return (
        <div className="flex flex-col gap-3">
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
                                        <TableHead className="text-right">Pages</TableHead>
                                        <TableHead className="text-right">Size</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && (
                                        <TableRow>
                                            <TableCell colSpan={8}>
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
                                            <TableCell className="text-right tabular-nums">{doc.pages ?? "—"}</TableCell>
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

                            <LoadMoreButton
                                hasNextPage={Boolean(hasNextPage)}
                                isFetchingNextPage={isFetchingNextPage}
                                onLoadMore={() => fetchNextPage()}
                            />

                            {!isLoading && documents.length === 0 && (
                                <div className="text-muted-foreground w-full p-2 text-center text-xs">
                                    {kinds.length > 0 ? "No documents of these kinds." : "No documents stored for this call."}
                                </div>
                            )}
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
                            <DocumentText doc={textOf} selector={selector} />
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
