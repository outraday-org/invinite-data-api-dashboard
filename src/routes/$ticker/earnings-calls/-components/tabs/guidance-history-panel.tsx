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

import type { EarningsGuidanceBasis, EarningsGuidancePeriodKind } from "@/lib/api/types";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEarningsGuidanceHistory } from "@/lib/api/queries";
import { BASIS_LABELS, formatGuidanceRange, formatGuidanceValue, metricLabel, PERIOD_KIND_LABELS } from "@/lib/earnings/labels";

import { EventLink } from "../event-link";
import { Notice } from "../media-state";
import { DirectionChip } from "./guidance-table";

export type GuidanceHistoryTarget = {
    basis: EarningsGuidanceBasis;
    metric: string;
    periodKind: EarningsGuidancePeriodKind;
};

/** A signed delta in the item's unit ("+$200.00 M", "−1.5%"); null → "—". */
function formatDelta(delta: null | number, unit: null | string, currency: null | string) {
    if (delta === null) return "—";

    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";

    return `${sign}${formatGuidanceValue(Math.abs(delta), unit, currency)}`;
}

function HistoryBody({ identifier, target }: { identifier: string; target: GuidanceHistoryTarget }) {
    const { data, error, isLoading } = useEarningsGuidanceHistory({
        basis: target.basis,
        identifier,
        metric: target.metric,
        periodKind: target.periodKind,
    });

    // The API answers newest call first; the chart reads left to right.
    const points = React.useMemo(
        () => [...(data?.series ?? [])].reverse().map(entry => ({
            band: entry.low !== null && entry.high !== null ? [entry.low, entry.high] : null,
            label: `${entry.conference_date} · ${entry.period_label}`,
            midpoint: entry.midpoint,
        })),
        [data],
    );

    if (error) return <ErrorState error={error} title="Failed to load guidance history" />;

    if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

    if (data.series.length === 0) return <Notice title="No history for this metric" />;

    const { currency, unit } = data.series[0];

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
                    {data.series.map((entry, index) => (
                        // A call can guide several periods: event id + period label + order.
                        <TableRow key={`${entry.event_id}:${entry.period_label}:${index}`}>
                            <TableCell>
                                <EventLink className="underline-offset-4 hover:underline" event={{ event_id: entry.event_id, symbol: data.symbol }}>
                                    {entry.conference_date}
                                </EventLink>
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
    identifier,
    onClose,
    target,
}: {
    identifier: string;
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
                        <HistoryBody identifier={identifier} target={target} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
