import * as React from "react";
import {
    Area,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { V2GuidanceBasis, V2GuidancePeriodKind } from "@/lib/api/types";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2GuidanceInfinite } from "@/lib/api/queries";
import { useLoadAllPages } from "@/lib/api/use-load-all-pages";
import { BASIS_LABELS, formatGuidanceRange, formatGuidanceValue, metricLabel, PERIOD_KIND_LABELS } from "@/lib/earnings/labels";

import { EventLink } from "../event-link";
import { Notice } from "../media-state";
import { DirectionChip } from "./guidance-table";

export type GuidanceHistoryTarget = {
    basis: V2GuidanceBasis;
    metric: string;
    periodKind: V2GuidancePeriodKind;
};

/** A signed delta in the item's unit ("+$200.00 M", "−1.5%"); null → "—". */
function formatDelta(delta: null | number, unit: null | string, currency: null | string) {
    if (delta === null) return "—";

    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";

    return `${sign}${formatGuidanceValue(Math.abs(delta), unit, currency)}`;
}

/** The call day of a guidance row (`conference_date` is a timestamp in v2). */
const callDay = (conferenceDate: null | string) => conferenceDate?.slice(0, 10) ?? "—";

function HistoryBody({ company, target }: { company: string; target: GuidanceHistoryTarget }) {
    // The company's items for the metric across its calls, newest call first (`/v1/guidance`, every review state).
    const query = useV2GuidanceInfinite({
        basis: target.basis,
        company,
        limit: 200,
        metric: target.metric,
        periodKind: target.periodKind,
        sort: "-conference_date",
    });

    useLoadAllPages({ ...query, hasNextPage: Boolean(query.hasNextPage) });

    const { data, error, isLoading } = query;

    const series = React.useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

    // The API answers newest call first; the chart reads left to right.
    const points = React.useMemo(
        () => [...series].reverse().map(entry => ({
            band: entry.low !== null && entry.high !== null ? [entry.low, entry.high] : null,
            label: `${callDay(entry.conference_date)} · ${entry.period_label}`,
            midpoint: entry.midpoint,
        })),
        [series],
    );

    if (error) return <ErrorState error={error} title="Failed to load guidance history" />;

    if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

    if (series.length === 0) return <Notice title="No history for this metric" />;

    const { currency, unit } = series[0];

    const format = (value: number) => formatGuidanceValue(value, unit, currency);

    return (
        <div className="flex flex-col gap-3">
            <div className="border-border/70 bg-muted/20 h-64 w-full rounded-lg border p-3">
                <ResponsiveContainer height="100%" width="100%">
                    <ComposedChart data={points} margin={{ bottom: 0, left: 4, right: 20, top: 12 }}>
                        <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} />
                        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={format} width={72} />
                        <Tooltip
                            formatter={value => (Array.isArray(value)
                                ? value.map(item => (typeof item === "number" ? format(item) : item)).join(" – ")
                                : typeof value === "number" ? format(value) : value)}
                        />
                        <Area
                            dataKey="band"
                            fill="var(--color-chart-1)"
                            fillOpacity={0.15}
                            name="Range"
                            stroke="none"
                            type="monotone"
                        />
                        <Line
                            connectNulls
                            dataKey="midpoint"
                            name="Midpoint"
                            stroke="var(--color-chart-1)"
                            strokeWidth={2}
                            type="monotone"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Call</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Δ low</TableHead>
                        <TableHead>Δ midpoint</TableHead>
                        <TableHead>Δ high</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {series.map((entry, index) => (
                        // A call can guide several periods: event id + period label + order.
                        <TableRow key={`${entry.event_id ?? ""}:${entry.period_label}:${index}`}>
                            <TableCell>
                                {entry.event_id
                                    ? (
                                            <EventLink className="underline-offset-4 hover:underline" event={{ event_id: entry.event_id, symbol: entry.company.ticker ?? company }}>
                                                {callDay(entry.conference_date)}
                                            </EventLink>
                                        )
                                    : callDay(entry.conference_date)}
                            </TableCell>
                            <TableCell>{entry.period_label}</TableCell>
                            <TableCell className="tabular-nums">{formatGuidanceRange(entry)}</TableCell>
                            <TableCell><DirectionChip direction={entry.direction} /></TableCell>
                            <TableCell className="tabular-nums">{formatDelta(entry.change_vs_prior?.low_delta ?? null, entry.unit, entry.currency)}</TableCell>
                            <TableCell className="tabular-nums">{formatDelta(entry.change_vs_prior?.midpoint_delta ?? null, entry.unit, entry.currency)}</TableCell>
                            <TableCell className="tabular-nums">{formatDelta(entry.change_vs_prior?.high_delta ?? null, entry.unit, entry.currency)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

/**
 * How the company's guidance for one metric evolved across its calls: midpoint line with the
 * low–high band, and the change versus the prior call. Scoped to the clicked item's period kind
 * and basis so the series compares like with like.
 */
export function GuidanceHistoryPanel({
    company,
    onClose,
    target,
}: {
    company: string;
    onClose: () => void;
    target: GuidanceHistoryTarget | null;
}) {
    return (
        <Dialog onOpenChange={open => !open && onClose()} open={target !== null}>
            <DialogContent className="sm:max-w-3xl">
                {target && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{`${metricLabel(target.metric)} guidance history`}</DialogTitle>
                            <DialogDescription>
                                {`${PERIOD_KIND_LABELS[target.periodKind]} guidance · ${BASIS_LABELS[target.basis] === "—" ? "basis unknown" : BASIS_LABELS[target.basis]} · newest call first in the table`}
                            </DialogDescription>
                        </DialogHeader>
                        <HistoryBody company={company} target={target} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
