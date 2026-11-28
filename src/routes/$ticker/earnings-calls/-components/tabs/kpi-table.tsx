import { ChartLine } from "lucide-react";

import type { V2KpiMention } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2KpisInfinite } from "@/lib/api/queries";
import { kpiUnitSuffix, metricLabel } from "@/lib/earnings/labels";

import type { CallTabProps } from "../call-tabs";

import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";
import { SeekButton } from "../seek-button";
import { EXTRACTIONS_PAGE_LIMIT } from "./guidance-table";

/** The stated value, then its unit only when the text lacks it ("$8.2 billion" never reads "$8.2 billion usd"). */
function ValueWithUnit({ kpi }: { kpi: Pick<V2KpiMention, "unit" | "value_text"> }) {
    const unit = kpiUnitSuffix(kpi.value_text, kpi.unit);

    return (
        <>
            {kpi.value_text}
            {unit && <span className="text-muted-foreground">{` ${unit}`}</span>}
        </>
    );
}

/** Reported KPI values with timed playback and metric history. */
export function KpiTable({ eventId, onMetricClick }: Pick<CallTabProps, "eventId"> & { onMetricClick?: (metric: string) => void }) {
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2KpisInfinite({ eventId, limit: EXTRACTIONS_PAGE_LIMIT });

    const kpis = data?.pages.flatMap(page => page.data) ?? [];

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} operationId="listKpis" title="Failed to load KPIs" />;

    if (isLoading) return <Skeleton className="h-40 w-full" />;

    if (kpis.length === 0 && !hasNextPage) return <Notice title="No KPIs" />;

    return (
        <div className="flex flex-col gap-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Speaker</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {kpis.map(kpi => (
                        <TableRow key={kpi.seq}>
                            <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                    {kpi.metric_normalized && (onMetricClick
                                        ? (
                                                <button
                                                    className="inline-flex items-center gap-1 hover:underline"
                                                    onClick={() => kpi.metric_normalized && onMetricClick(kpi.metric_normalized)}
                                                    title="This KPI across the company's calls"
                                                    type="button"
                                                >
                                                    <Badge variant="secondary">{metricLabel(kpi.metric_normalized)}</Badge>
                                                    <ChartLine className="text-muted-foreground size-3" />
                                                </button>
                                            )
                                        : <Badge variant="secondary">{metricLabel(kpi.metric_normalized)}</Badge>)}
                                    <span className="whitespace-normal">{kpi.metric}</span>
                                    <SeekButton startMs={kpi.start_ms} />
                                </div>
                            </TableCell>
                            <TableCell className="tabular-nums">
                                <ValueWithUnit kpi={kpi} />
                            </TableCell>
                            <TableCell>{kpi.period_label ?? "—"}</TableCell>
                            <TableCell className="whitespace-normal">
                                {kpi.speaker.name ?? <span className="text-muted-foreground">—</span>}
                                {kpi.speaker.title && <div className="text-muted-foreground">{kpi.speaker.title}</div>}
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
        </div>
    );
}
