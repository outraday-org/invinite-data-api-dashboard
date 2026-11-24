import { Link } from "@tanstack/react-router";

import type { NewsItemPublic } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDayTimeShort } from "@/lib/format";
import { NEWS_KIND_LABELS, publishedBy, sourceLabel } from "@/lib/news/labels";

const SKELETON_ROWS = 8;

const COLUMNS = 3;

/**
 * The feed (ui-redesign task 11: two-line rows): the headline (a link to `?item=`, which opens the item panel), then a
 * meta line — "Published by <issuer>" when a company published it itself (else "By <publisher>") · the source · the
 * publication day and time (one line, short zone) —; kind / earnings badges; the companies mentioned. The headline is
 * the publisher's, shown with its publisher and source.
 */
export function NewsTable({
    isLoading,
    items,
    liveIds,
}: {
    isLoading: boolean;
    items: ReadonlyArray<NewsItemPublic>;
    /** Items that arrived over the live feed (marked "New"). */
    liveIds?: ReadonlySet<string>;
}) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Headline</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Companies</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && items.length === 0
                    ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                            <TableRow key={index}>
                                {Array.from({ length: COLUMNS }, (_cell, cellIndex) => (
                                    <TableCell className="h-14" key={cellIndex}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    : items.map((item) => {
                            const publishers = publishedBy(item);

                            return (
                                <TableRow data-testid="news-row" key={item.id}>
                                    <TableCell className="max-w-[640px] min-w-[240px] py-2 align-top whitespace-normal">
                                        <div className="flex items-baseline gap-2">
                                            {liveIds?.has(item.id) && <Badge variant="default">New</Badge>}
                                            {/* A link (`?item=`): opens the item panel, and in a new tab with the panel open. The page keeps its
                                                scroll position behind the panel (the document scrolls, so a reset would jump to the top). */}
                                            <Link className="text-left font-medium hover:underline" resetScroll={false} search={prev => ({ ...prev, item: item.id })} to=".">
                                                {item.title}
                                            </Link>
                                        </div>
                                        <div className="text-muted-foreground flex flex-wrap gap-x-1.5 text-xs">
                                            <span>{publishers.length > 0 ? `Published by ${publishers.join(", ")}` : `By ${item.attribution.publisher}`}</span>
                                            <span aria-hidden>·</span>
                                            <span>{sourceLabel(item.source)}</span>
                                            <span aria-hidden>·</span>
                                            <span className="tabular-nums whitespace-nowrap">{formatDayTimeShort(item.published_at)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2 align-top">
                                        <div className="flex flex-wrap gap-1">
                                            <Badge variant="outline">{NEWS_KIND_LABELS[item.kind]}</Badge>
                                            {item.is_earnings_news && <Badge variant="secondary">Earnings</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground py-2 align-top whitespace-normal">{item.symbols.join(", ") || "—"}</TableCell>
                                </TableRow>
                            );
                        })}
            </TableBody>
        </Table>
    );
}
