import { ChevronLeft, ChevronRight, ExternalLink, FileText, ImageIcon } from "lucide-react";
import * as React from "react";

import type { V2DocumentFigureResponse, V2DocumentVersionResponse, V2FilingDetailResponse } from "@/lib/api/types";
import type { SecBlock, V2FilingDocumentView } from "@/lib/sec/source";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2DocumentFigure, useV2DocumentVersion, useV2Filing } from "@/lib/api/queries";
import { READINESS_TEXT, reasonText } from "@/lib/sec/readiness";
import {
    blocksBefore,
    blocksFrom,
    blocksLeadingTo,
    citationText,
    numberOf,
    pageLabel,
    printedLabelsTrusted,
    publicUrlOf,
    recordOf,
    secUrlOf,
    textOf,
    toBlocks,
    toSelection,
    toV2FilingDocuments,
    versionIdOf,
} from "@/lib/sec/source";

import { SecReadinessNotice } from "./sec-readiness-notice";

/** Blocks per "Previous blocks" range of the reader. */
export const SEC_BLOCK_PAGE = 40;

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

/** "No public copy yet" for a null `source` — never a fabricated link, never a sec.gov download. */
export const NO_PUBLIC_COPY = "No public copy yet";

/** A figure (`/v1/document-versions/…/figures/…`): its permanent public image, or "no public copy yet". */
export function SecFigureView({ data, error, isLoading }: { data: null | V2DocumentFigureResponse; error: unknown; isLoading: boolean }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the figure" />;

    if (isLoading && !data) return <Skeleton className="h-32 w-full" />;

    if (!data) return null;

    const imageUrl = publicUrlOf(data.image);

    const figure = recordOf(data.figure);

    const caption = textOf(figure, "caption") ?? textOf(figure, "alt");

    return (
        <figure className="flex flex-col gap-1">
            {imageUrl
                ? (
                        <>
                            <img alt={caption ?? "Figure"} className="max-h-96 w-auto self-start rounded border" src={imageUrl} />
                            <a className={linkClass} href={imageUrl} rel="noopener noreferrer" target="_blank">
                                <ExternalLink className="size-3" />
                                Open image
                            </a>
                        </>
                    )
                : <Notice badge={READINESS_TEXT.not_ready.badge} title={reasonText("image_not_public") ?? "The image has no public copy yet"} />}
            {caption && <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>}
        </figure>
    );
}

function BlockRow({
    block,
    focused,
    footnotes,
    onGoTo,
    renderFigure,
    trusted,
}: {
    block: SecBlock;
    focused: boolean;
    footnotes: Map<string, SecBlock>;
    onGoTo: (blockId: string) => void;
    renderFigure: (block: SecBlock) => React.ReactNode;
    trusted: boolean;
}) {
    const [figureOpen, setFigureOpen] = React.useState(false);

    const page = pageLabel(block.page, trusted);

    const isFigure = block.kind === "figure" || block.figure !== null;

    return (
        <li
            className={`flex flex-col gap-1 rounded-md border p-2 ${focused ? "border-primary bg-primary/5" : ""}`}
            data-block-id={block.id}
        >
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[0.6875rem]">
                <Badge variant="outline">{block.kind}</Badge>
                {page && <span>{page}</span>}
                <span className="tabular-nums">{block.id}</span>
            </div>
            {block.text && (
                <p className={block.kind === "heading" ? "font-medium" : "leading-relaxed whitespace-pre-wrap"}>{block.text}</p>
            )}
            {block.footnoteRefs.length > 0 && (
                <div className="flex flex-col gap-0.5 text-xs">
                    {block.footnoteRefs.map((ref) => {
                        const footnote = footnotes.get(ref);

                        return (
                            <div className="flex items-start gap-2" key={ref}>
                                <Button onClick={() => onGoTo(ref)} size="xs" type="button" variant="ghost">
                                    {`Footnote ${ref}`}
                                </Button>
                                {footnote && <span className="text-muted-foreground">{footnote.text}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
            {isFigure && (
                <div className="flex flex-col gap-1">
                    <Button className="self-start" onClick={() => setFigureOpen(open => !open)} size="xs" type="button" variant="outline">
                        <ImageIcon />
                        {figureOpen ? "Hide figure" : "Open figure"}
                    </Button>
                    {figureOpen && renderFigure(block)}
                </div>
            )}
            {block.citation && (
                <div className="text-muted-foreground text-[0.625rem]" title="Citation: immutable version + block">
                    {citationText(block.citation, trusted)}
                </div>
            )}
        </li>
    );
}

/**
 * The selected blocks of one pinned version (pure): printed label (only when trusted) or the ordinal, footnotes,
 * figures, the citation of every block, and paging inside the same version (`onSelect` takes a `blocks` selector).
 */
export function SecBlocksView({
    data,
    error,
    focusBlockId,
    isLoading,
    onSelect,
    renderFigure,
}: {
    data: null | V2DocumentVersionResponse;
    error: unknown;
    focusBlockId?: string;
    isLoading: boolean;
    onSelect: (blocks: string) => void;
    renderFigure: (block: SecBlock, versionId: string) => React.ReactNode;
}) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the document" />;

    if (isLoading && !data) return <Skeleton className="h-40 w-full" />;

    if (!data) return null;

    const blocks = toBlocks(data.blocks);

    const footnotes = new Map(toBlocks(data.footnotes).map(block => [block.id, block]));

    const trusted = printedLabelsTrusted(data.quality);

    const selection = toSelection(data.selection);

    const versionId = versionIdOf(data.version);

    const secUrl = secUrlOf(data.source);

    const first = blocks.at(0);

    const previous = first ? blocksBefore(first.id, SEC_BLOCK_PAGE) : null;

    const pageCount = numberOf(recordOf(data.version), "page_count");

    return (
        <section aria-label="Document text" className="flex flex-col gap-2">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                {versionId && <span>{`Version ${versionId}`}</span>}
                {pageCount !== null && <span>{`${pageCount} pages`}</span>}
                <span>{trusted ? "Printed page labels trusted" : "Printed page labels not trusted — page ordinals shown"}</span>
                {secUrl && (
                    // An outbound link to EDGAR; this app never fetches sec.gov.
                    <a className={linkClass} href={secUrl} rel="noopener noreferrer" target="_blank">
                        <ExternalLink className="size-3" />
                        View on EDGAR
                    </a>
                )}
            </div>
            {blocks.length === 0
                ? <div className="text-muted-foreground text-xs">No blocks in this selection.</div>
                : (
                        <ol className="flex flex-col gap-1.5">
                            {blocks.map(block => (
                                <BlockRow
                                    block={block}
                                    focused={block.id === focusBlockId}
                                    footnotes={footnotes}
                                    key={block.id}
                                    onGoTo={blockId => onSelect(blocksFrom(blockId))}
                                    renderFigure={figureBlock => (versionId ? renderFigure(figureBlock, versionId) : null)}
                                    trusted={trusted}
                                />
                            ))}
                        </ol>
                    )}
            <div className="flex items-center justify-between gap-2">
                <Button disabled={!previous} onClick={() => previous && onSelect(previous)} size="xs" type="button" variant="outline">
                    <ChevronLeft />
                    Previous blocks
                </Button>
                <Button
                    disabled={!selection.truncated || !selection.nextBlock}
                    onClick={() => selection.nextBlock && onSelect(blocksFrom(selection.nextBlock))}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    Next blocks
                    <ChevronRight />
                </Button>
            </div>
        </section>
    );
}

/** A filing's documents (pure): filename, EDGAR type, description, public copy, "Read" for a readable version. */
export function V2FilingDocumentsView({
    data,
    error,
    isLoading,
    onRead,
    selectedFilename,
}: {
    data: null | V2FilingDetailResponse;
    error: unknown;
    isLoading: boolean;
    onRead: (doc: V2FilingDocumentView) => void;
    selectedFilename: null | string;
}) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the filing's documents" />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    const documents = toV2FilingDocuments(data.documents);

    return (
        <section aria-label="Filing documents" className="flex flex-col gap-2">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{data.form}</Badge>
                <span>{`Filed ${data.filing_date}`}</span>
                {data.report_date && <span>{`Period ${data.report_date}`}</span>}
                {data.edgar_index_url.startsWith("https://www.sec.gov/") && (
                    // An outbound link to EDGAR; this app never fetches sec.gov.
                    <a className={linkClass} href={data.edgar_index_url} rel="noopener noreferrer" target="_blank">
                        <ExternalLink className="size-3" />
                        EDGAR index
                    </a>
                )}
            </div>
            {documents.length === 0
                ? <div className="text-muted-foreground text-xs">This filing lists no documents.</div>
                : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="text-muted-foreground text-left">
                                    <tr>
                                        <th className="p-1 font-normal">Document</th>
                                        <th className="p-1 font-normal">Description</th>
                                        <th className="p-1 font-normal">Public copy</th>
                                        <th className="p-1" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {documents.map(doc => (
                                        <tr
                                            className={doc.filename === selectedFilename ? "bg-muted/50" : undefined}
                                            data-filename={doc.filename}
                                            key={doc.filename}
                                        >
                                            <td className="p-1 font-medium">
                                                {doc.filename}
                                                {doc.type && <span className="text-muted-foreground font-normal">{` · ${doc.type}`}</span>}
                                            </td>
                                            <td className="p-1">{doc.description ?? "—"}</td>
                                            <td className="p-1">
                                                {doc.publicUrl
                                                    ? (
                                                            <a className={linkClass} href={doc.publicUrl} rel="noopener noreferrer" target="_blank">
                                                                <ExternalLink className="size-3" />
                                                                Original
                                                            </a>
                                                        )
                                                    : <span className="text-muted-foreground">{NO_PUBLIC_COPY}</span>}
                                            </td>
                                            <td className="p-1 text-right">
                                                {doc.currentVersionId
                                                    ? (
                                                            <Button onClick={() => onRead(doc)} size="xs" type="button" variant="outline">
                                                                <FileText />
                                                                Read
                                                            </Button>
                                                        )
                                                    : <span className="text-muted-foreground">No readable version</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        </section>
    );
}

function V2FigureLoader({ blockId, versionId }: { blockId: string; versionId: string }) {
    const { data, error, isLoading } = useV2DocumentFigure({ blockId, versionId });

    return <SecFigureView data={data} error={error} isLoading={isLoading} />;
}

/**
 * The reader over `/v1/document-versions/{id}`: one immutable version, paged by block ranges inside it. A citation
 * (`focusBlockId`) opens at its block with a little context before it.
 */
export function V2DocumentReader({ focusBlockId, versionId }: { focusBlockId?: string; versionId: string }) {
    const [blocks, setBlocks] = React.useState(() => (focusBlockId ? blocksLeadingTo(focusBlockId, 3) : undefined));

    const { data, error, isLoading } = useV2DocumentVersion(versionId, { blocks, footnotes: true });

    return (
        <SecBlocksView
            data={data}
            error={error}
            focusBlockId={focusBlockId}
            isLoading={isLoading}
            onSelect={setBlocks}
            renderFigure={(block, figureVersionId) => <V2FigureLoader blockId={block.id} versionId={figureVersionId} />}
        />
    );
}

/** A filing: its documents, then the reader of the chosen document's current version. */
function V2FilingPanel({ accession }: { accession: string }) {
    const [reading, setReading] = React.useState<null | V2FilingDocumentView>(null);

    const filing = useV2Filing(accession, ["documents"]);

    return (
        <div className="flex flex-col gap-4">
            <V2FilingDocumentsView
                data={filing.data}
                error={filing.error}
                isLoading={filing.isLoading}
                onRead={setReading}
                selectedFilename={reading?.filename ?? null}
            />
            {reading?.currentVersionId && <V2DocumentReader key={reading.currentVersionId} versionId={reading.currentVersionId} />}
        </div>
    );
}

/**
 * What the panel opens: a filing (`/v1/filings/{accession}?expand=documents`, then a document's current version) or a
 * citation (one version `/v1/document-versions/{id}`, at one block).
 */
export type SecPanelTarget
    = | { accession: string; kind: "filing"; title?: string }
        | { blockId: string; kind: "citation"; title?: string; versionId: string };

/** The reusable source / citation panel: a filing's documents → document reader, or a cited version at its block. */
export function SecSourcePanel({ target }: { target: SecPanelTarget }) {
    if (target.kind === "filing") return <V2FilingPanel accession={target.accession} />;

    return <V2DocumentReader focusBlockId={target.blockId} key={`${target.versionId}:${target.blockId}`} versionId={target.versionId} />;
}

/** The panel in a dialog (filings list, search hits, the CIK page); null target = closed. */
export function SecSourceDialog({ onClose, target }: { onClose: () => void; target: null | SecPanelTarget }) {
    const title = target?.title ?? (target?.kind === "filing" ? target.accession : "Cited passage");

    return (
        <Dialog onOpenChange={open => !open && onClose()} open={target !== null}>
            <DialogContent className="sm:max-w-5xl h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] p-0">
                <div className="flex h-full min-h-0 flex-col">
                    <DialogHeader className="p-4 pb-2">
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            Invinite&apos;s SEC document store: documents as filed, cited by version and block.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-0 grow px-4 pb-4">
                        {target && <SecSourcePanel target={target} />}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
