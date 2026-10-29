import * as React from "react";

import type { NewsAsset, NewsAssetDownloadResponse, NewsAttribution, NewsDevelopment, NewsItemResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { useNewsAssetDownload, useNewsItem } from "@/lib/api/queries";
import { formatBytes, formatInstant } from "@/lib/earnings/format";
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

const EXTERNAL = { rel: "noopener noreferrer", target: "_blank" } as const;

/**
 * The attribution block (D26: backend earnings tasks/inhouse-news-pipeline README), rendered ABOVE every text this
 * dashboard shows: publisher, original link, publication date, the API's verbatim statement, the © holder of an
 * issuer text and an SEC filing's form + accession. This is the reference rendering other consumers copy.
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

/** One image / original file: metadata and credit always; the file only through the API's short-lived URL, on click. */
function AssetRow({ asset, itemId }: { asset: NewsAsset; itemId: string }) {
    const download = useNewsAssetDownload();

    // Held only while this panel is open: the URL is a ≤ 60-s bearer credential, never cached or stored.
    const [delivered, setDelivered] = React.useState<NewsAssetDownloadResponse | null>(null);

    const permitted = asset.can_display || asset.can_download;

    const credit = [asset.credit, asset.copyright_notice].filter(Boolean).join(" · ");

    const image = delivered?.purpose === "display" && delivered.content_type?.startsWith("image/") ? delivered : null;

    return (
        <li className="flex flex-col gap-1 rounded-md border p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{asset.kind}</Badge>
                <span className="font-medium">{asset.title ?? asset.alt ?? "Untitled"}</span>
                {asset.byte_size !== null && <span className="text-muted-foreground">{formatBytes(asset.byte_size)}</span>}
            </div>
            {asset.caption && <div>{asset.caption}</div>}
            {credit && <div className="text-muted-foreground">{`Credit: ${credit}`}</div>}
            {image
                ? (
                        <figure className="flex flex-col gap-1">
                            <img alt={asset.alt ?? asset.title ?? ""} className="max-h-80 w-auto self-start rounded border" referrerPolicy="no-referrer" src={image.url} />
                            {(image.credit ?? credit) && <figcaption className="text-muted-foreground">{image.credit ?? credit}</figcaption>}
                        </figure>
                    )
                : delivered
                    ? <a className="underline underline-offset-4" href={delivered.url} {...EXTERNAL}>Open the file (link valid about a minute)</a>
                    : permitted
                        ? (
                                <div className="flex items-center gap-2">
                                    <Button
                                        disabled={download.isPending}
                                        onClick={() => download.mutate({ assetId: asset.id, id: itemId }, { onSuccess: setDelivered })}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        {asset.can_display ? "Show" : "Get file"}
                                    </Button>
                                    {download.error && <span className="text-destructive">{download.error.message}</span>}
                                </div>
                            )
                        : asset.original_url && (
                            <a className="underline underline-offset-4" href={asset.original_url} {...EXTERNAL}>At the source</a>
                        )}
        </li>
    );
}

/** AI-read developments, each with its claim status (a planned launch is labelled planned) and its cited quotes. */
function Developments({ developments }: { developments: ReadonlyArray<NewsDevelopment> }) {
    return (
        <section className="flex flex-col gap-2">
            <div className="text-sm font-medium">AI-extracted developments</div>
            <div className="text-muted-foreground text-xs">
                Read by a model from the text above: what the publisher announced, with the quotes it rests on — not verified facts.
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
                        {development.evidence.map(evidence => (
                            <blockquote className="border-l-2 pl-2 italic" key={`${evidence.block_id}:${evidence.start}`}>
                                {evidence.quote}
                            </blockquote>
                        ))}
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** The item panel's body (pure: tested in `src/routes/-tests/news-page.test.tsx`). */
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
    if (isTierError(error)) return <Notice badge="STANDARD" title="Your plan does not include news text" />;

    if (error instanceof ApiRequestError && error.status === 404) return <Notice title="This news item is not available" />;

    if (error) return <ErrorState error={error} title="Failed to load the news item" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const publishers = publishedBy(data);

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

            {data.content_status === "available" && data.body_text
                ? <div className="whitespace-pre-wrap leading-relaxed" data-testid="news-body">{data.body_text}</div>
                : (
                        <Notice title="Headline and link only">
                            No text is served for this item.
                            {" "}
                            <a className="underline underline-offset-4" href={data.attribution.source_url} {...EXTERNAL}>Open at source</a>
                        </Notice>
                    )}

            {data.developments.length > 0 && <Developments developments={data.developments} />}

            {data.assets.length > 0 && (
                <section className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Images and files</div>
                    <ul className="flex flex-col gap-2">
                        {data.assets.map(asset => <AssetRow asset={asset} itemId={data.id} key={asset.id} />)}
                    </ul>
                </section>
            )}

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
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{data?.title ?? title ?? "News item"}</DialogTitle>
                    <DialogDescription>Published text, shown verbatim with its attribution.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[65vh] pr-3">
                    <NewsItemView data={data} error={error} isLoading={isLoading} onOpen={onOpen} />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
