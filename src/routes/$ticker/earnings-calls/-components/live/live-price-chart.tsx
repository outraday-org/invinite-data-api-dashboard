import * as React from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import type { LivePricesState } from "@/lib/live/live-prices-reducer";

import {
    AXIS_TICK,
    CHART_MARGIN,
    ChartFrame,
    GRID_STROKE,
    LINE_CURSOR,
    TOOLTIP_CONTENT_STYLE,
} from "@/components/status/chart-parts";
import { Button } from "@/components/ui/button";
import { formatSigned } from "@/lib/earnings/labels";

import type { LivePriceRow, LivePriceSeedRow, LivePriceSource } from "./live-price-chart-data";

import {
    clockOffsetMs,
    formatCallMs,
    formatPrice,
    formatWallTime,
    gapBreaks,
    mergeSeed,
} from "./live-price-chart-data";

/** The chart's lead text: coincidence in time, never cause (the Price moves tab says the same). */
export const LIVE_PRICE_CAVEAT = "Temporal coincidence, not attribution of cause. Pre-market and after-hours bars are sparse.";

type YMode = "price" | "return";

const SOURCE_LABELS: Record<LivePriceSource, string> = {
    minute: "minute close",
    snapshot: "snapshot",
    stream: "live",
};

/** A signed return in basis points ("+12.5 bps"); null → "—". */
function formatBps(value: null | number) {
    const signed = formatSigned(value, 1);

    return signed === null ? "—" : `${signed} bps`;
}

type DotProps = {
    cx?: number;
    cy?: number;
    index?: number;
    payload?: LivePriceRow;
};

/** Only a point with no connected neighbour gets a dot: a one-point line draws nothing. */
function renderIsolatedDot({ cx, cy, index, payload }: DotProps) {
    if (typeof cx !== "number" || typeof cy !== "number" || !payload?.isolated) return <g key={`dot-${index}`} />;

    return <circle cx={cx} cy={cy} fill="var(--color-chart-1)" key={`dot-${index}`} r={2} strokeWidth={0} />;
}

type TooltipProps = {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: unknown }>;
};

/**
 * recharts clones the element with `active` / `payload`; `payload[0].payload` is the very row object it was
 * given, so it is looked up by identity in `rows` (typed, no cast). A break row shows nothing.
 */
function PriceTooltip({
    active,
    payload,
    rows,
    xLabel,
}: TooltipProps & { rows: ReadonlyArray<LivePriceRow>; xLabel: (x: number) => string }) {
    const hovered = payload?.[0]?.payload;

    const row = hovered === undefined ? undefined : rows.find(entry => entry === hovered);

    if (!active || !row || row.source === null || row.atMs === null) return null;

    return (
        <div className="space-y-0.5 p-2 tabular-nums" style={TOOLTIP_CONTENT_STYLE}>
            <div className="font-medium">
                {xLabel(row.x)}
                {" · "}
                {formatWallTime(row.atMs)}
                {" ET"}
            </div>
            <div>{`Price ${formatPrice(row.price)}`}</div>
            <div>{`Return ${formatBps(row.returnBps)}`}</div>
            <div>{`Day return ${formatBps(row.dayReturnBps)}`}</div>
            <div className="text-muted-foreground">{SOURCE_LABELS[row.source]}</div>
        </div>
    );
}

type LivePriceChartProps = {
    /** The price-attribution minute rows (the backlog of a late join); `[]` without them. */
    buckets: ReadonlyArray<LivePriceSeedRow>;
    /** The live stream's `call_t0` (null without live audio): the clock before a tick carries one. */
    callT0: null | string;
    /** The audio position on the transcript clock while the player is synced, else null. */
    cursorMs: null | number;
    prices: LivePricesState;
};

/**
 * The call's stock during the live call, on the transcript clock: the minute rows so far, then
 * one point per `price_tick` second. x = call time (`m:ss`, the live transcript's clock) or, before
 * the clock is known, New York wall time; y = return since the call reference in bps or the price.
 * A missing second is a gap, never a straight line across it.
 */
export function LivePriceChart({ buckets, callT0, cursorMs, prices }: LivePriceChartProps) {
    const [yMode, setYMode] = React.useState<YMode>("return");

    const offsetMs = clockOffsetMs(prices.ticks, callT0);

    const rows = gapBreaks(mergeSeed(buckets, prices.ticks, { offsetMs, reference: prices.reference }));

    const pointCount = rows.filter(row => row.source !== null).length;

    const gapCount = rows.length - pointCount;

    const chartLabel = `Live price line: ${pointCount} ${pointCount === 1 ? "point" : "points"}, ${gapCount} ${gapCount === 1 ? "gap" : "gaps"}`;

    const xLabel = offsetMs === null ? formatWallTime : formatCallMs;

    const last = prices.last;

    return (
        <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">{LIVE_PRICE_CAVEAT}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                <div aria-label="Price chart scale" className="flex items-center gap-1" role="group">
                    <Button aria-pressed={yMode === "return"} onClick={() => setYMode("return")} size="xs" type="button" variant={yMode === "return" ? "secondary" : "outline"}>
                        Return
                    </Button>
                    <Button aria-pressed={yMode === "price"} onClick={() => setYMode("price")} size="xs" type="button" variant={yMode === "price" ? "secondary" : "outline"}>
                        Price
                    </Button>
                </div>
                {last !== null && (
                    <span>
                        {formatPrice(last.price)}
                        {" · "}
                        {formatBps(last.returnBps)}
                        {" since the call reference · "}
                        {formatBps(last.dayReturnBps)}
                        {" on the day"}
                    </span>
                )}
                {cursorMs !== null && offsetMs !== null && (
                    <span className="text-muted-foreground">{`Audio at ${formatCallMs(cursorMs)}`}</span>
                )}
            </div>
            <div aria-label={chartLabel} role="img">
                <ChartFrame
                    description={offsetMs === null ? "New York time (the call clock is not known yet)" : "Call time, the live transcript's clock"}
                    height={160}
                    title={yMode === "return" ? "Return since the call reference (bps)" : "Price"}
                >
                    <LineChart data={rows} margin={CHART_MARGIN}>
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                        <XAxis
                            axisLine={{ stroke: GRID_STROKE }}
                            dataKey="x"
                            domain={["dataMin", "dataMax"]}
                            minTickGap={32}
                            tick={AXIS_TICK}
                            tickFormatter={xLabel}
                            tickLine={false}
                            type="number"
                        />
                        <YAxis
                            axisLine={false}
                            domain={["auto", "auto"]}
                            tick={AXIS_TICK}
                            tickFormatter={(value: number) => (yMode === "return" ? (formatSigned(value, 0) ?? "") : formatPrice(value))}
                            tickLine={false}
                            width={56}
                        />
                        {yMode === "return" && <ReferenceLine stroke={GRID_STROKE} y={0} />}
                        {cursorMs !== null && offsetMs !== null && (
                            <ReferenceLine stroke="var(--muted-foreground)" strokeDasharray="3 3" x={cursorMs} />
                        )}
                        <Tooltip content={<PriceTooltip rows={rows} xLabel={xLabel} />} cursor={LINE_CURSOR} />
                        <Line
                            connectNulls={false}
                            dataKey={yMode === "return" ? "returnBps" : "price"}
                            dot={renderIsolatedDot}
                            isAnimationActive={false}
                            name={yMode === "return" ? "Return" : "Price"}
                            stroke="var(--color-chart-1)"
                            strokeWidth={2}
                            type="linear"
                        />
                    </LineChart>
                </ChartFrame>
            </div>
        </div>
    );
}
