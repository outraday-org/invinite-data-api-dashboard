import { ChartLine, Check, ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import type { EarningsGuidanceItem } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEarningsExtractionsInfinite } from "@/lib/api/queries";
import {
    BASIS_LABELS,
    DIRECTION_STYLES,
    formatGuidanceRange,
    formatGuidanceValue,
    metricLabel,
    percent,
    PERIOD_KIND_LABELS,
    REVIEW_STATUS_LABELS,
} from "@/lib/earnings/labels";
import { cn } from "@/lib/utils";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

import type { CallTabProps } from "../call-tabs";

import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";
import { SeekButton } from "../seek-button";

export const EXTRACTIONS_PAGE_LIMIT = 50;

/** The API filters `review` by `approved | auto | all`; "needs review" is a filter over the loaded rows. */
type ReviewFilter = "all" | "needs_review";

const ORIGIN_LABELS = { press_release: "Press release", transcript: "Transcript" } as const;

/** `confidence` (0–1, calibrated on spot checks, not a probability) as a small bar. */
export function ConfidenceBar({ value }: { value: number }) {
    const width = Math.round(Math.min(1, Math.max(0, value)) * 100);

    return (
        <div className="flex items-center gap-1.5" title={`Confidence ${percent(value, 0)}`}>
            <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
                <div className="bg-primary h-full" style={{ width: `${width}%` }} />
            </div>
            <span className="text-muted-foreground tabular-nums">{percent(value, 0)}</span>
        </div>
    );
}

export function DirectionChip({ direction }: { direction: EarningsGuidanceItem["direction"] }) {
    const style = DIRECTION_STYLES[direction];

    return <Badge className={style.className} variant="outline">{style.label}</Badge>;
}

function GuidanceSources({ item }: { item: EarningsGuidanceItem }) {
    if (item.sources.length === 0) return <div className="text-muted-foreground">No citations.</div>;

    return (
        <div className="flex flex-col gap-2">
            {item.sources.map((source, index) => (
                // Sources have no id; their order within one item is stable.
                <div className="flex flex-col gap-1" key={index}>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{ORIGIN_LABELS[source.origin]}</Badge>
                        {source.speaker.name && (
                            <span className="font-medium">
                                {source.speaker.name}
                                {source.speaker.title && <span className="text-muted-foreground font-normal">{` · ${source.speaker.title}`}</span>}
                            </span>
                        )}
                        <SeekButton startMs={source.start_ms} />
                    </div>
                    <p className="leading-relaxed">{source.sentence}</p>
                </div>
            ))}
        </div>
    );
}

const COLUMN_COUNT = 10;

function GuidanceRow({
    expanded,
    item,
    onMetricClick,
    onToggle,
}: {
    expanded: boolean;
    item: EarningsGuidanceItem;
    onMetricClick: (item: EarningsGuidanceItem) => void;
    onToggle: () => void;
}) {
    return (
        <>
            <TableRow className={cn(expanded && "border-b-0")}>
                <TableCell>
                    <Button
                        aria-expanded={expanded}
                        aria-label={expanded ? "Hide citations" : "Show citations"}
                        onClick={onToggle}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                    >
                        {expanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col items-start gap-1">
                        <button
                            className="inline-flex items-center gap-1 hover:underline"
                            onClick={() => onMetricClick(item)}
                            title="Guidance history for this metric"
                            type="button"
                        >
                            <Badge variant="secondary">{metricLabel(item.metric_normalized)}</Badge>
                            <ChartLine className="text-muted-foreground size-3" />
                        </button>
                        <span className="text-muted-foreground">{item.metric}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col">
                        <span>{item.period_label}</span>
                        <span className="text-muted-foreground">{PERIOD_KIND_LABELS[item.period_kind]}</span>
                    </div>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>{BASIS_LABELS[item.basis]}</TableCell>
                <TableCell><DirectionChip direction={item.direction} /></TableCell>
                <TableCell><ConfidenceBar value={item.confidence} /></TableCell>
                <TableCell>
                    {item.cross_validated
                        ? <Check aria-label="Cross-validated (call and press release)" className="size-3.5 text-emerald-600" />
                        : <span className="text-muted-foreground" title="One source only">—</span>}
                </TableCell>
                <TableCell>
                    <Badge variant={item.review_status === "needs_review" ? "destructive" : "outline"}>
                        {REVIEW_STATUS_LABELS[item.review_status]}
                    </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{item.sources.length}</TableCell>
            </TableRow>
            {expanded && (
                <TableRow>
                    <TableCell className="bg-muted/30 whitespace-normal" colSpan={COLUMN_COUNT}>
                        <GuidanceSources item={item} />
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

/** Forward guidance of the call: one consolidated item per metric, period and basis. */
export function GuidanceTable({
    onMetricClick,
    selector,
}: Pick<CallTabProps, "selector"> & { onMetricClick: (item: EarningsGuidanceItem) => void }) {
    const [review, setReview] = React.useState<ReviewFilter>("all");

    const [expandedId, setExpandedId] = React.useState<null | string>(null);

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useEarningsExtractionsInfinite({ ...selector, kind: "guidance", limit: EXTRACTIONS_PAGE_LIMIT });

    const all = data?.pages.flatMap(page => page.guidance ?? []) ?? [];

    const items = review === "needs_review" ? all.filter(item => item.review_status === "needs_review") : all;

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} title="Failed to load guidance" />;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
                {(["all", "needs_review"] as const).map(value => (
                    <Button
                        aria-pressed={review === value}
                        key={value}
                        onClick={() => setReview(value)}
                        size="xs"
                        type="button"
                        variant={review === value ? "secondary" : "outline"}
                    >
                        {value === "all" ? "All" : "Needs review"}
                    </Button>
                ))}
            </div>

            {isLoading
                ? <Skeleton className="h-40 w-full" />
                : items.length === 0 && !hasNextPage
                    ? <Notice title={review === "all" ? "No guidance extracted" : "No guidance needs review"} />
                    : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8" />
                                        <TableHead>Metric</TableHead>
                                        <TableHead>Period</TableHead>
                                        <TableHead>Range</TableHead>
                                        <TableHead>Basis</TableHead>
                                        <TableHead>Direction</TableHead>
                                        <TableHead>Confidence</TableHead>
                                        <TableHead>Cross-validated</TableHead>
                                        <TableHead>Review</TableHead>
                                        <TableHead>Sources</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(item => (
                                        <GuidanceRow
                                            expanded={expandedId === item.id}
                                            item={item}
                                            key={item.id}
                                            onMetricClick={onMetricClick}
                                            onToggle={() => setExpandedId(current => (current === item.id ? null : item.id))}
                                        />
                                    ))}
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
