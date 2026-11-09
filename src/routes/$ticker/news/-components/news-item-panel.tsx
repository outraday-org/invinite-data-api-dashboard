import type { NewsAttribution, NewsDevelopment, V2NewsItem, V2NewsText } from "@/lib/api/types";

import { PdfDocumentSection } from "@/components/pdf/pdf-inline-viewer";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { useNewsAnnouncements, useNewsItem, useNewsText } from "@/lib/api/queries";
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
 * the attribution block with date and source link) → the lede → Invinite's summary (the text blocks) → the
 * announcements read from the item → the branded PDF. v2 (backend tasks/data-api-v2 task 8): the item is the list row
 * with its `pdf` (owner decision 2026-11-09), the summary comes from `/v2/news/{id}/text`, the developments from
 * `/v2/announcements?item=`; the v1 detail's sightings, companies, source word count and `superseded_by` are not in
 * the v2 contract (lead decision G4), so the panel shows none of them — never an empty section.
 */
export function NewsItemView({
    announcements,
    error,
    isLoading,
    item,
    text,
    textError,
}: {
    announcements: ReadonlyArray<NewsDevelopment>;
    error: unknown;
    isLoading: boolean;
    item: null | V2NewsItem;
    /** null while the text loads (or when it failed: `textError`); the header renders meanwhile. */
    text: null | V2NewsText;
    textError?: unknown;
}) {
    if (isTierError(error)) return <Notice badge="STANDARD" title="Your plan does not include news summaries" />;

    if (error instanceof ApiRequestError && error.status === 404) return <Notice title="This news item is not available" />;

    if (error) return <ErrorState error={error} title="Failed to load the news item" />;

    if (isLoading || !item) return <Skeleton className="h-40 w-full" />;

    const publishers = publishedBy(item);

    const blocks = text?.content_status === "available" ? text.blocks : [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{NEWS_KIND_LABELS[item.kind]}</Badge>
                {item.is_earnings_news && <Badge variant="secondary">Earnings</Badge>}
                <span className="text-muted-foreground">{sourceLabel(item.source.id)}</span>
                {publishers.length > 0 && <span>{`Published by ${publishers.join(", ")}`}</span>}
                {item.publications.map(publication => (
                    <Badge key={`${publication.source_id}:${publication.url}`} variant="outline">
                        {publicationTypeLabel(publication.publication_type)}
                    </Badge>
                ))}
            </div>

            {item.supersedes_id && <Notice title="A corrected version of an earlier item" />}

            <AttributionBlock attribution={text?.attribution ?? item.attribution} />

            {item.description && <p className="text-sm font-medium" data-testid="news-lede">{item.description}</p>}

            {textError
                ? <ErrorState error={textError} title="Failed to load the summary" />
                : text === null
                    ? <Skeleton className="h-24 w-full" />
                    : blocks.length > 0
                        ? (
                                <section className="flex flex-col gap-1">
                                    {item.summary_words !== null && (
                                        <div className="text-muted-foreground text-xs">
                                            {`Summary by Invinite · ${item.summary_words.toLocaleString("en-US")} words`}
                                        </div>
                                    )}
                                    <SummaryBody blocks={blocks} />
                                </section>
                            )
                        : (
                                <Notice title="Headline and link only">
                                    No summary is served for this item.
                                    {" "}
                                    <a className="underline underline-offset-4" href={item.attribution.source_url} {...EXTERNAL}>Open at source</a>
                                </Notice>
                            )}

            {announcements.length > 0 && <Developments developments={announcements} />}

            <PdfDocumentSection filename={`news-${item.id}.pdf`} pdf={item.pdf} />
        </div>
    );
}

/** `?item=<id>`: the item in a dialog; `id: null` = closed (no request). */
export function NewsItemPanel({ id, onClose, title }: { id: null | string; onClose: () => void; title?: string }) {
    const item = useNewsItem(id);

    const text = useNewsText(id);

    const announcements = useNewsAnnouncements(id);

    return (
        <Dialog onOpenChange={open => !open && onClose()} open={id !== null}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>{item.data?.title ?? title ?? "News item"}</DialogTitle>
                    <DialogDescription>Invinite&apos;s summary of the announcement</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[80vh] pr-3">
                    {/* p-px: the viewport clips what lies outside it, and a Card's ring-1 does */}
                    <div className="p-px">
                        <NewsItemView
                            announcements={announcements.data?.data ?? []}
                            error={item.error}
                            isLoading={item.isLoading}
                            item={item.data ?? null}
                            text={text.data ?? null}
                            textError={text.error}
                        />
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
