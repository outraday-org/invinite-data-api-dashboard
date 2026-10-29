import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
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
import { startDownload } from "@/lib/news/download";
import {
    canViewPdf,
    CLAIM_STATUS_LABELS,
    edgarLabel,
    fileTypeLabel,
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

/** "PDF · 1.2 MB · 1200 × 800": what the file is before anyone fetches it. */
function assetFacts(asset: NewsAsset) {
    return [
        fileTypeLabel(asset.content_type),
        asset.byte_size === null ? null : formatBytes(asset.byte_size),
        asset.width && asset.height ? `${asset.width} × ${asset.height}` : null,
    ].filter(Boolean).join(" · ");
}

const NOT_DOWNLOADABLE = "This file cannot be downloaded right now.";

/** Opens a fresh inline URL in a new tab: the tab is opened on the click (no popup block), then pointed at the file. */
function useOpenInNewTab(assetId: string, itemId: string) {
    const download = useNewsAssetDownload();

    const open = () => {
        const tab = window.open("", "_blank");

        if (tab) tab.opener = null;

        download.mutate({ assetId, id: itemId, purpose: "display" }, {
            onError: () => tab?.close(),
            onSuccess: (delivered) => {
                if (tab) tab.location.href = delivered.url;

                download.reset();
            },
        });
    };

    return { error: download.error, isPending: download.isPending, open };
}

/**
 * One image / original file: type, size, metadata and credit always; the file only through the API's short-lived URL,
 * on click. "View" shows a PDF inline in the panel (`purpose=display`: the browser's PDF viewer, with "Open in new
 * tab"); "Show" previews a displayable image; "Download" (`purpose=download`) saves the file at once (`startDownload`:
 * no second click, the URL kept nowhere); neither permission → the original link only. A viewed / shown URL lives
 * only in this row's state while the panel is open (the frame has loaded the bytes; it is never cached or stored).
 */
function AssetRow({ asset, itemId }: { asset: NewsAsset; itemId: string }) {
    const download = useNewsAssetDownload();

    const newTab = useOpenInNewTab(asset.id, itemId);

    const [preview, setPreview] = React.useState<NewsAssetDownloadResponse | null>(null);

    const [refused, setRefused] = React.useState(false);

    const credit = [asset.credit, asset.copyright_notice].filter(Boolean).join(" · ");

    const facts = assetFacts(asset);

    const pdf = canViewPdf(asset);

    const request = (purpose: "display" | "download", onDelivered: (delivered: NewsAssetDownloadResponse) => void) => {
        setRefused(false);

        download.mutate({ assetId: asset.id, id: itemId, purpose }, { onSuccess: onDelivered });
    };

    const onDownload = () => request("download", (delivered) => {
        // Only an attachment URL is followed: an inline one would replace this page.
        if (delivered.purpose === "download") startDownload(delivered.url);
        else setRefused(true);

        download.reset();
    });

    const onShow = () => request("display", delivered => setPreview(delivered.purpose === "display" ? delivered : null));

    const busy = download.isPending || newTab.isPending;

    const viewer = preview && pdf
        ? (
                <div className="flex flex-col gap-1">
                    <iframe
                        className="h-[60vh] w-full rounded border"
                        data-testid="news-pdf-viewer"
                        referrerPolicy="no-referrer"
                        src={preview.url}
                        title={asset.title ?? "PDF"}
                    />
                    <div className="text-muted-foreground">Not showing? Open it in a new tab.</div>
                </div>
            )
        : preview && (
            <figure className="flex flex-col gap-1">
                <img alt={asset.alt ?? asset.title ?? ""} className="max-h-80 w-auto self-start rounded border" referrerPolicy="no-referrer" src={preview.url} />
                {(preview.credit ?? credit) && <figcaption className="text-muted-foreground">{preview.credit ?? credit}</figcaption>}
            </figure>
        );

    return (
        <li className="flex flex-col gap-1 rounded-md border p-2 text-xs" data-testid="news-asset">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{asset.kind}</Badge>
                <span className="font-medium">{asset.title ?? asset.alt ?? "Untitled"}</span>
                {facts && <span className="text-muted-foreground">{facts}</span>}
            </div>
            {asset.caption && <div>{asset.caption}</div>}
            {credit && <div className="text-muted-foreground">{`Credit: ${credit}`}</div>}
            {viewer}
            {asset.can_display || asset.can_download
                ? (
                        <div className="flex flex-wrap items-center gap-2">
                            {pdf && (preview
                                ? (
                                        <Button onClick={() => setPreview(null)} size="sm" type="button" variant="outline">
                                            Hide
                                        </Button>
                                    )
                                : (
                                        <Button disabled={busy} onClick={onShow} size="sm" type="button" variant="outline">
                                            View
                                        </Button>
                                    ))}
                            {pdf && (
                                <Button disabled={busy} onClick={newTab.open} size="sm" type="button" variant="outline">
                                    <ExternalLinkIcon aria-hidden />
                                    Open in new tab
                                </Button>
                            )}
                            {asset.can_download && (
                                <Button disabled={busy} onClick={onDownload} size="sm" type="button" variant="outline">
                                    <DownloadIcon aria-hidden />
                                    Download
                                </Button>
                            )}
                            {asset.can_display && !pdf && !preview && (
                                <Button disabled={busy} onClick={onShow} size="sm" type="button" variant="outline">
                                    Show
                                </Button>
                            )}
                            {(download.error ?? newTab.error) && <span className="text-destructive">{(download.error ?? newTab.error)?.message}</span>}
                            {refused && <span className="text-destructive">{NOT_DOWNLOADABLE}</span>}
                        </div>
                    )
                : asset.original_url && (
                    <a className="underline underline-offset-4" href={asset.original_url} {...EXTERNAL}>At the source</a>
                )}
        </li>
    );
}

// Browsers drop a download that starts while the previous one is still being handed over.
const DOWNLOAD_ALL_GAP_MS = 400;

/**
 * "Download all": every file of the item the API lets you download (`can_download`), one after the other, each through
 * its own fresh ≤ 60-s URL. The browser may ask once to allow several downloads.
 */
function DownloadAll({ assets, itemId }: { assets: ReadonlyArray<NewsAsset>; itemId: string }) {
    const download = useNewsAssetDownload();

    const [failed, setFailed] = React.useState(0);

    const [running, setRunning] = React.useState(false);

    const onClick = async () => {
        setRunning(true);

        setFailed(0);

        let failures = 0;

        for (const [index, asset] of assets.entries()) {
            if (index > 0) await new Promise(resolve => setTimeout(resolve, DOWNLOAD_ALL_GAP_MS));

            try {
                const delivered = await download.mutateAsync({ assetId: asset.id, id: itemId, purpose: "download" });

                if (delivered.purpose === "download") startDownload(delivered.url);
                else failures += 1;
            }
            catch {
                failures += 1;
            }
        }

        download.reset();

        setFailed(failures);

        setRunning(false);
    };

    return (
        <div className="flex items-center gap-2 text-xs">
            <Button disabled={running} onClick={() => void onClick()} size="sm" type="button" variant="outline">
                <DownloadIcon aria-hidden />
                {`Download all (${assets.length})`}
            </Button>
            {failed > 0 && <span className="text-destructive">{`${failed} of ${assets.length} could not be downloaded.`}</span>}
        </div>
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

    const downloadable = data.assets.filter(asset => asset.can_download);

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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">Images and files</div>
                        {downloadable.length > 1 && <DownloadAll assets={downloadable} itemId={data.id} />}
                    </div>
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
