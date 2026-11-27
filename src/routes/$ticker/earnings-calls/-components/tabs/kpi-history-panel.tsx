import * as React from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

import type { V2KpiMention } from "@/lib/api/types";

import { AXIS_TICK } from "@/components/charts/chart-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2KpiHistoryInfinite } from "@/lib/api/queries";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";
import { kpiHistoryCallCount, kpiHistorySeries } from "@/lib/earnings/kpi-history";
import { formatGuidanceValue, metricLabel, ORIGIN_LABELS } from "@/lib/earnings/labels";
import { formatDay } from "@/lib/format";

import { EventLink } from "../event-link";
import { MediaState, Notice } from "../media-state";

/** Newest call first (the API's default) or oldest first: sent as `sort`. */
export type KpiHistorySort = "-conference_date" | "conference_date";

const AXIS_PAD_MS = 14 * 24 * 60 * 60 * 1000;

const dayValue = (day: string) => Date.parse(`${day.slice(0, 10)}T00:00:00Z`);

/** The plotted mentions (the most common unit), one dot each, call day on the x axis. */
function KpiHistoryChart({ mentions }: { mentions: ReadonlyArray<V2KpiMention> }) {
    const series = React.useMemo(() => kpiHistorySeries(mentions), [mentions]);

    if (series.points.length === 0) return null;

    const format = (value: number) => formatGuidanceValue(value, series.unit, null);

    const data = series.points.map(point => ({ ...point, x: dayValue(point.day) }));

    return (
        <div className="flex flex-col gap-1">
            <div
                aria-label={`${series.points.length} mentions plotted`}
                className="border-border/70 bg-muted/20 h-56 w-full rounded-lg border p-3"
                role="img"
            >
                <ResponsiveContainer height="100%" width="100%">
                    <ScatterChart margin={{ bottom: 0, left: 4, right: 20, top: 12 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                            dataKey="x"
                            // Two weeks either side: one call (or calls a day apart) still gets a readable axis.
                            domain={([min, max]: readonly [number, number]) => [min - AXIS_PAD_MS, max + AXIS_PAD_MS]}
                            name="Call"
                            tick={AXIS_TICK}
                            tickFormatter={(value: number) => formatDay(new Date(value).toISOString().slice(0, 10))}
                            type="number"
                        />
                        <YAxis dataKey="value" name="Value" tick={AXIS_TICK} tickFormatter={format} width={72} />
                        <Tooltip
                            content={({ active, payload }) => {
                                const point = active ? (payload[0] as undefined | { payload?: (typeof data)[number] })?.payload : undefined;

                                if (!point) return null;

                                return (
                                    <div className="bg-popover text-popover-foreground rounded-md border px-2 py-1 text-xs shadow-sm">
                                        <div className="font-medium">{point.valueText}</div>
                                        <div className="text-muted-foreground">{[formatDay(point.day), point.period].filter(Boolean).join(" · ")}</div>
                                    </div>
                                );
                            }}
                        />
                        <Scatter data={data} fill="var(--color-chart-1)" isAnimationActive={false} name="Mentions" />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            {series.omitted > 0 && (
                <p className="text-muted-foreground">
                    {`${series.omitted} ${series.omitted === 1 ? "mention is" : "mentions are"} in the table only (another unit, or no value).`}
                </p>
            )}
        </div>
    );
}

/**
 * A company's history of one KPI (pure): what each call said about it — every mention, as stated (several per call:
 * other periods, the press release beside the call) — a dot chart of the most common unit and the table, in the API's
 * order (`sort`).
 */
export function KpiHistoryView({
    company,
    error,
    isLoading,
    mentions,
    onSortChange,
    sort,
}: {
    company: string;
    error: unknown;
    isLoading: boolean;
    mentions: ReadonlyArray<V2KpiMention>;
    onSortChange: (sort: KpiHistorySort) => void;
    sort: KpiHistorySort;
}) {
    if (error) return <MediaState error={error} operationId="listKpis" title="Failed to load the KPI history" />;

    if (isLoading) return <Skeleton className="h-64 w-full" />;

    if (mentions.length === 0) return <Notice title="No history for this KPI" />;

    const calls = kpiHistoryCallCount(mentions);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">
                    {`${mentions.length} ${mentions.length === 1 ? "mention" : "mentions"} on ${calls} ${calls === 1 ? "call" : "calls"}`}
                </span>
                <div aria-label="Order" className="ml-auto flex gap-1" role="group">
                    {(["-conference_date", "conference_date"] as const).map(value => (
                        <Button
                            aria-pressed={sort === value}
                            key={value}
                            onClick={() => onSortChange(value)}
                            size="xs"
                            type="button"
                            variant={sort === value ? "default" : "outline"}
                        >
                            {value === "-conference_date" ? "Newest first" : "Oldest first"}
                        </Button>
                    ))}
                </div>
            </div>

            <KpiHistoryChart mentions={mentions} />

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Call</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Said in</TableHead>
                        <TableHead>Filing</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {mentions.map(mention => (
                        <TableRow key={`${mention.event_id}:${mention.seq}`}>
                            <TableCell className="whitespace-nowrap">
                                <EventLink className="underline-offset-4 hover:underline" event={{ event_id: mention.event_id, symbol: mention.company.ticker ?? company }}>
                                    {formatDay(mention.conference_date)}
                                </EventLink>
                            </TableCell>
                            <TableCell>{mention.period_label ?? "—"}</TableCell>
                            <TableCell className="tabular-nums" title={mention.source_sentence}>{mention.value_text}</TableCell>
                            <TableCell><Badge variant="outline">{ORIGIN_LABELS[mention.origin]}</Badge></TableCell>
                            <TableCell>
                                {mention.filing_link
                                    ? (
                                            <a
                                                className="underline-offset-4 hover:underline"
                                                href={mention.filing_link.document_url}
                                                rel="noopener noreferrer"
                                                target="_blank"
                                            >
                                                {mention.filing_link.form}
                                            </a>
                                        )
                                    : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function KpiHistoryBody({ company, metric }: { company: string; metric: string }) {
    const [sort, setSort] = React.useState<KpiHistorySort>("-conference_date");

    const query = useV2KpiHistoryInfinite({ company, metric, sort });

    useAutoLoadPages({ ...query, hasNextPage: Boolean(query.hasNextPage) });

    const mentions = React.useMemo(() => query.data?.pages.flatMap(page => page.data) ?? [], [query.data]);

    return (
        <KpiHistoryView
            company={company}
            error={query.error}
            isLoading={query.isLoading}
            mentions={mentions}
            onSortChange={setSort}
            sort={sort}
        />
    );
}

/**
 * "KPI history" beside the guidance history (`/v1/kpis?company=&metric=&sort=`, every page): opens for a KPI the API
 * normalized (`metric_normalized`); `metric: null` = closed, no request.
 */
export function KpiHistoryPanel({ company, metric, onClose }: { company: string; metric: null | string; onClose: () => void }) {
    return (
        <Dialog onOpenChange={open => !open && onClose()} open={metric !== null}>
            <DialogContent className="sm:max-w-3xl">
                {metric !== null && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{`${metricLabel(metric)} across ${company}'s calls`}</DialogTitle>
                            <DialogDescription>Every time a call or its press release stated this KPI, as said.</DialogDescription>
                        </DialogHeader>
                        <KpiHistoryBody company={company} metric={metric} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
