import { ChartLine } from "lucide-react";

import type { V2GuidanceItem } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2GuidanceInfinite } from "@/lib/api/queries";
import { QUALIFIER_LABELS } from "@/lib/earnings/extraction";
import {
    BASIS_LABELS,
    DIRECTION_STYLES,
    formatGuidanceRange,
    formatGuidanceValue,
    metricLabel,
    PERIOD_KIND_LABELS,
} from "@/lib/earnings/labels";
import { cn } from "@/lib/utils";

import type { CallTabProps } from "../call-tabs";

import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";

export const EXTRACTIONS_PAGE_LIMIT = 50;

export function DirectionChip({ direction }: { direction: V2GuidanceItem["direction"] }) {
    const style = DIRECTION_STYLES[direction];

    return <Badge className={style.className} variant="outline">{style.label}</Badge>;
}

/** A guidance item without a number (Data API 12.1): a statement, with its `qualifier`, and no low / high. */
export const isQualitativeGuidance = (item: Pick<V2GuidanceItem, "high" | "low" | "midpoint" | "statement_text">) =>
    Boolean(item.statement_text) && item.low === null && item.high === null && item.midpoint === null;

/** The item's figure: the range (+ midpoint), or for a statement without a number its text and qualifier. */
export function GuidanceValue({ item }: { item: V2GuidanceItem }) {
    if (isQualitativeGuidance(item)) {
        return (
            <div className="flex max-w-[24rem] flex-col items-start gap-1">
                {item.qualifier && <Badge variant="outline">{QUALIFIER_LABELS[item.qualifier]}</Badge>}
                <span className="leading-snug">{item.statement_text}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col whitespace-nowrap tabular-nums">
            <span>{formatGuidanceRange(item)}</span>
            {item.midpoint !== null && item.low !== item.high && (
                <span className="text-muted-foreground">
                    mid
                    {" "}
                    {formatGuidanceValue(item.midpoint, item.unit, item.currency)}
                </span>
            )}
        </div>
    );
}

function GuidanceRow({ item, onMetricClick }: { item: V2GuidanceItem; onMetricClick: (item: V2GuidanceItem) => void }) {
    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col items-start gap-1">
                    {item.metric_normalized
                        ? (
                                <button
                                    className="inline-flex items-center gap-1 hover:underline"
                                    onClick={() => onMetricClick(item)}
                                    title="Guidance history for this metric"
                                    type="button"
                                >
                                    <Badge variant="secondary">{metricLabel(item.metric_normalized)}</Badge>
                                    <ChartLine className="text-muted-foreground size-3" />
                                </button>
                            )
                        : <Badge variant="secondary">—</Badge>}
                    <span className="text-muted-foreground">{item.metric}</span>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex flex-col">
                    <span>{item.period_label}</span>
                    <span className="text-muted-foreground">{PERIOD_KIND_LABELS[item.period_kind]}</span>
                </div>
            </TableCell>
            <TableCell className={cn(isQualitativeGuidance(item) && "whitespace-normal")}>
                <GuidanceValue item={item} />
            </TableCell>
            <TableCell>{BASIS_LABELS[item.basis]}</TableCell>
            <TableCell><DirectionChip direction={item.direction} /></TableCell>
        </TableRow>
    );
}

/** Forward guidance of the call: one consolidated item per metric, period and basis. */
export function GuidanceTable({
    eventId,
    onMetricClick,
}: Pick<CallTabProps, "eventId"> & { onMetricClick: (item: V2GuidanceItem) => void }) {
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2GuidanceInfinite({ event: eventId, limit: EXTRACTIONS_PAGE_LIMIT });

    const items = data?.pages.flatMap(page => page.data) ?? [];

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} operationId="listGuidance" title="Failed to load guidance" />;

    return (
        <div className="flex flex-col gap-2">
            {isLoading
                ? <Skeleton className="h-40 w-full" />
                : items.length === 0 && !hasNextPage
                    ? <Notice title="No guidance extracted" />
                    : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Metric</TableHead>
                                        <TableHead>Period</TableHead>
                                        <TableHead>Range</TableHead>
                                        <TableHead>Basis</TableHead>
                                        <TableHead>Direction</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item, index) => {
                                        // `id` is nullable in v2: the row's position is the fallback key.
                                        const rowKey = item.id ?? `row-${index}`;

                                        return (
                                            <GuidanceRow
                                                item={item}
                                                key={rowKey}
                                                onMetricClick={onMetricClick}
                                            />
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}

            <LoadMoreButton
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
            />
        </div>
    );
}
