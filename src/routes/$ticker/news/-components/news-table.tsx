import type { NewsItemPublic } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInstant } from "@/lib/earnings/format";
import { NEWS_KIND_LABELS, publishedBy, sourceLabel } from "@/lib/news/labels";

const SKELETON_ROWS = 8;

/**
 * The feed: publication time, headline (opens the item panel) with "Published by <issuer>" when a company published
 * it itself, the first source, kind / earnings badges and the companies mentioned. The headline is the publisher's,
 * shown with its publisher and source on the same row.
 */
export function NewsTable({
    isLoading,
    items,
    liveIds,
    onOpen,
}: {
    isLoading: boolean;
    items: ReadonlyArray<NewsItemPublic>;
    /** Items that arrived over the live feed (marked "New"). */
    liveIds?: ReadonlySet<string>;
    onOpen: (id: string) => void;
}) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Published</TableHead>
                    <TableHead>Headline</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Companies</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && items.length === 0
                    ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                            <TableRow key={index}>
                                {Array.from({ length: 5 }, (_cell, cellIndex) => (
                                    <TableCell key={cellIndex}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    : items.map((item) => {
                            const publishers = publishedBy(item);

                            return (
                                <TableRow data-testid="news-row" key={item.id}>
                                    <TableCell className="whitespace-nowrap align-top">
                                        {formatInstant(item.published_at)}
                                        {liveIds?.has(item.id) && <Badge className="ml-2" variant="default">New</Badge>}
                                    </TableCell>
                                    <TableCell className="max-w-[460px] align-top whitespace-normal">
                                        <button className="text-left font-medium hover:underline" onClick={() => onOpen(item.id)} type="button">
                                            {item.title}
                                        </button>
                                        <div className="text-muted-foreground text-xs">
                                            {publishers.length > 0 ? `Published by ${publishers.join(", ")}` : `By ${item.attribution.publisher}`}
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top">{sourceLabel(item.source.id)}</TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-wrap gap-1">
                                            <Badge variant="outline">{NEWS_KIND_LABELS[item.kind]}</Badge>
                                            {item.is_earnings_news && <Badge variant="secondary">Earnings</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground align-top text-xs">{item.symbols.join(", ") || "—"}</TableCell>
                                </TableRow>
                            );
                        })}
            </TableBody>
        </Table>
    );
}
