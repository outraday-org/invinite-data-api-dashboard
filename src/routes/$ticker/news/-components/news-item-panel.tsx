import * as React from "react";

import type { NewsAttribution, NewsDevelopment, NewsItemResponse } from "@/lib/api/types";

import { PdfDocumentSection } from "@/components/pdf/pdf-inline-viewer";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { useNewsItem } from "@/lib/api/queries";
import { formatInstant } from "@/lib/earnings/format";
import {
    CLAIM_STATUS_LABELS,
    edgarLabel,
    NEWS_KIND_LABELS,
    NEWS_TOPIC_LABELS,
    publicationTypeLabel,
    publishedBy,
    sourceLabel,
} from "@/lib/news/labels";
import { prepareSummaryHtml } from "@/lib/news/summary-html";
import { Notice } from "@/routes/$ticker/earnings-calls/-components/media-state";

import { SummaryBody } from "./summary-body";

const EXTERNAL = { rel: "noopener noreferrer", target: "_blank" } as const;

/**
 * The attribution block (D26: backend earnings tasks/inhouse-news-pipeline README), rendered ABOVE every text this
 * dashboard shows: publisher, original link, publication date, the API's statement (the text below is Invinite's
 * summary, not the publisher's), the © holder of an issuer publication and an SEC filing's form + accession. This is
 * the reference rendering other consumers copy.
 */
export function AttributionBlock({ attribution }: { attribution: NewsAttribution }) {
    const edgar = edgarLabel(attribution.edgar);

    return (
        <dl aria-label="Attribution" className="bg-muted/40 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border p-3 text-xs">
            <dt className="text-muted-foreground">Publisher</dt>
            <dd>{attribution.publisher_host ? `${attribution.publisher} (${attribution.publisher_host})` : attribution.publisher}</dd>
            <dt className="text-muted-foreground">Published</dt>
            <dd>{formatInstant(attribution.published_at)}</dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="break-all">
                <a className="underline underline-offset-4" href={attribution.source_url} {...EXTERNAL}>{attribution.source_url}</a>
            </dd>
            {edgar && (
                <>
                    <dt className="text-muted-foreground">SEC EDGAR</dt>
                    <dd>{edgar}</dd>
                </>
            )}
            <dt className="text-muted-foreground">Notice</dt>
            <dd>
                {attribution.statement}
                {attribution.rights === "issuer" ? ` © ${attribution.publisher}.` : " Public record (SEC filing)."}
            </dd>
        </dl>
    );
}

/** AI-read developments, each with its claim status (a planned launch is labelled planned). */
function Developments({ developments }: { developments: ReadonlyArray<NewsDevelopment> }) {
    return (
        <section className="flex flex-col gap-2">
            <div className="text-sm font-medium">AI-extracted developments</div>
            <div className="text-muted-foreground text-xs">
                Read by a model from the publication: what the publisher announced — not verified facts.
            </div>
            <ul className="flex flex-col gap-2">
                {developments.map(development => (
                    <li className="flex flex-col gap-1 rounded-md border p-2 text-xs" data-testid="news-development" key={development.id}>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{NEWS_TOPIC_LABELS[development.topic]}</Badge>
                            <Badge variant={development.claim_status === "planned" ? "secondary" : "outline"}>
                                {CLAIM_STATUS_LABELS[development.claim_status]}
                            </Badge>
                            <span className="font-medium">{development.title}</span>
                        </div>
                        <div>{development.summary}</div>
                        {(development.products.length > 0 || development.counterparties.length > 0) && (
                            <div className="text-muted-foreground">
                                {[...development.products.map(p => p.name), ...development.counterparties.map(c => c.name)].join(" · ")}
                            </div>
                        )}
                        {development.effective_date_text && (
                            <div className="text-muted-foreground">{`When: ${development.effective_date_text}`}</div>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * The item panel's body (pure: tested in `src/routes/-tests/news-page.test.tsx`): the header (kind, source, publisher,
 * the attribution block with date and source link) → the lede → Invinite's summary → developments → the branded PDF.
 */
export function NewsItemView({
    data,
    error,
    isLoading,
    onOpen,
}: {
    data: NewsItemResponse | null;
    error: unknown;
    isLoading: boolean;
    onOpen: (id: string) => void;
}) {
    const summaryHtml = data?.content_status === "available" ? data.summary_html : null;

    // Sanitized once per answer, not on every render.
    const html = React.useMemo(() => (summaryHtml ? prepareSummaryHtml(summaryHtml) : null), [summaryHtml]);

    if (isTierError(error)) return <Notice badge="STANDARD" title="Your plan does not include news summaries" />;

    if (error instanceof ApiRequestError && error.status === 404) return <Notice title="This news item is not available" />;

    if (error) return <ErrorState error={error} title="Failed to load the news item" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const publishers = publishedBy(data);

    const text = data.content_status === "available" ? (data.summary_text ?? "") : "";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{NEWS_KIND_LABELS[data.kind]}</Badge>
                {data.is_earnings_news && <Badge variant="secondary">Earnings</Badge>}
                <span className="text-muted-foreground">{sourceLabel(data.source.id)}</span>
                {publishers.length > 0 && <span>{`Published by ${publishers.join(", ")}`}</span>}
                {data.publications.map(publication => (
                    <Badge key={`${publication.source_id}:${publication.url}`} variant="outline">
                        {publicationTypeLabel(publication.publication_type)}
                    </Badge>
                ))}
            </div>

            {data.superseded_by && (
                <Notice title="A corrected version of this item exists">
                    <button className="underline underline-offset-4" onClick={() => onOpen(data.superseded_by ?? "")} type="button">
                        Open the corrected item
                    </button>
                </Notice>
            )}

            <AttributionBlock attribution={data.attribution} />

            {data.description && <p className="text-sm font-medium" data-testid="news-lede">{data.description}</p>}

            {html || text
                ? (
                        <section className="flex flex-col gap-1">
                            {data.summary_words !== null && data.source_words !== null && (
                                <div className="text-muted-foreground text-xs">
                                    {`Summary by Invinite · ${data.summary_words.toLocaleString("en-US")} of ${data.source_words.toLocaleString("en-US")} words`}
                                </div>
                            )}
                            <SummaryBody html={html} text={text} />
                        </section>
                    )
                : (
                        <Notice title="Headline and link only">
                            No summary is served for this item.
                            {" "}
                            <a className="underline underline-offset-4" href={data.attribution.source_url} {...EXTERNAL}>Open at source</a>
                        </Notice>
                    )}

            {data.developments.length > 0 && <Developments developments={data.developments} />}

            <PdfDocumentSection filename={`news-${data.id}.pdf`} pdf={data.pdf} />

            <section className="flex flex-col gap-1 text-xs">
                <div className="text-sm font-medium">Seen on</div>
                {data.sightings.map(sighting => (
                    <div key={`${sighting.source_id}:${sighting.seen_at}`}>
                        <a className="underline underline-offset-4" href={sighting.url} {...EXTERNAL}>{sourceLabel(sighting.source_id)}</a>
                        {` ${formatInstant(sighting.seen_at)}`}
                    </div>
                ))}
                {data.companies.length > 0 && (
                    <div className="text-muted-foreground">{`Companies: ${data.companies.map(c => c.symbol).join(", ")}`}</div>
                )}
            </section>
        </div>
    );
}

/** `?item=<id>`: the item in a dialog; `id: null` = closed (no request). */
export function NewsItemPanel({ id, onClose, onOpen, title }: { id: null | string; onClose: () => void; onOpen: (id: string) => void; title?: string }) {
    const { data, error, isLoading } = useNewsItem(id);

    return (
        <Dialog onOpenChange={open => !open && onClose()} open={id !== null}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>{data?.title ?? title ?? "News item"}</DialogTitle>
                    <DialogDescription>Invinite&apos;s summary of the announcement</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[80vh] pr-3">
                    {/* p-px: the viewport clips what lies outside it, and a Card's ring-1 does */}
                    <div className="p-px">
                        <NewsItemView data={data} error={error} isLoading={isLoading} onOpen={onOpen} />
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
