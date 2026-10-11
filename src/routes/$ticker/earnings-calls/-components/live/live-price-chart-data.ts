import type { LivePriceTick } from "@/lib/live/live-prices-reducer";

import { formatMs } from "@/lib/earnings/format";

/**
 * Pure pieces of the live price chart (`live-price-chart.tsx`; another basename, so
 * `./live-price-chart` resolves to the component): the minute rows of
 * `GET /v1/earnings-calls/price-attribution` seed the line (no second-level backlog exists for a
 * late join), the `price_tick` frames continue it, both on the transcript clock when it is known.
 *
 * - The clock: a tick's `call_ms` = its `at` on the transcript clock, so `at − call_ms` is the
 *   call's t0; without such a tick the live stream's `call_t0`; without either the chart runs
 *   on wall time.
 * - A minute row is one point at the minute's close (`bucket + 60 s`), its value the
 *   cumulative return since the call reference (the same reference as a tick's `return_bps`).
 *   Rows from the first tick on are dropped: the ticks cover them.
 * - Gaps are gaps: more than `TICK_GAP_MS` between two ticks (or `MINUTE_GAP_MS` next to a
 *   minute point) breaks the line; a point with no connected neighbour gets a dot.
 */

export const TICK_GAP_MS = 5_000;

export const MINUTE_GAP_MS = 90_000;

const MINUTE_MS = 60_000;

export type LivePriceSource = "minute" | LivePriceTick["source"];

export type LivePricePoint = {
    /** Wall clock (epoch ms) of the point. */
    readonly atMs: number;
    /** The x value: call ms on the transcript clock, else wall ms (`xMode`). */
    readonly x: number;
    readonly price: null | number;
    readonly returnBps: null | number;
    readonly dayReturnBps: null | number;
    readonly source: LivePriceSource;
};

/** A chart row: a point, or a break (`source: null`, every value null) between two points. */
export type LivePriceRow = {
    readonly atMs: null | number;
    readonly x: number;
    readonly price: null | number;
    readonly returnBps: null | number;
    readonly dayReturnBps: null | number;
    readonly source: LivePriceSource | null;
    /** No connected neighbour: drawn as a dot (a line of one point draws nothing). */
    readonly isolated: boolean;
};

/** A minute row as the price-attribution answer sends it. */
export type LivePriceSeedRow = {
    readonly bucket: string;
    readonly cumulative_return_bps: number;
};

/** The call's t0 in epoch ms: from a tick with `callMs`, else `callT0`, else null (wall time). */
export function clockOffsetMs(ticks: ReadonlyArray<LivePriceTick>, callT0: null | string): null | number {
    for (const tick of ticks) {
        const atMs = Date.parse(tick.at);

        if (tick.callMs !== null && !Number.isNaN(atMs)) return atMs - tick.callMs;
    }

    if (callT0 === null) return null;

    const t0Ms = Date.parse(callT0);

    return Number.isNaN(t0Ms) ? null : t0Ms;
}

/** The price a return implies against the reference (4 dp); null without a reference. */
function priceOf(reference: null | number, returnBps: number) {
    if (reference === null) return null;

    return Math.round(reference * (1 + returnBps / 10_000) * 10_000) / 10_000;
}

/**
 * The minute rows up to the first tick, then the ticks, ascending by wall time. `reference`
 * (the ticks' reference price) gives a minute point its price; without it the point has none.
 */
export function mergeSeed(
    minuteRows: ReadonlyArray<LivePriceSeedRow>,
    ticks: ReadonlyArray<LivePriceTick>,
    { offsetMs, reference }: { offsetMs: null | number; reference: null | number },
): Array<LivePricePoint> {
    const xOf = (atMs: number) => (offsetMs === null ? atMs : atMs - offsetMs);

    const tickPoints: Array<LivePricePoint> = [];

    for (const tick of ticks) {
        const atMs = Date.parse(tick.at);

        if (Number.isNaN(atMs)) continue;

        tickPoints.push({
            atMs,
            dayReturnBps: tick.dayReturnBps,
            price: tick.price,
            returnBps: tick.returnBps,
            source: tick.source,
            x: offsetMs === null ? atMs : (tick.callMs ?? xOf(atMs)),
        });
    }

    const firstTickMs = tickPoints.reduce((min, point) => Math.min(min, point.atMs), Number.POSITIVE_INFINITY);

    const minutePoints: Array<LivePricePoint> = [];

    for (const row of minuteRows) {
        const bucketMs = Date.parse(row.bucket);

        if (Number.isNaN(bucketMs)) continue;

        const atMs = bucketMs + MINUTE_MS;

        if (atMs >= firstTickMs) continue;

        minutePoints.push({
            atMs,
            dayReturnBps: null,
            price: priceOf(reference, row.cumulative_return_bps),
            returnBps: row.cumulative_return_bps,
            source: "minute",
            x: xOf(atMs),
        });
    }

    return [...minutePoints, ...tickPoints].sort((a, b) => a.atMs - b.atMs);
}

/** The points with a break row wherever the gap rule says so, and `isolated` set. */
export function gapBreaks(
    points: ReadonlyArray<LivePricePoint>,
    { minuteGapMs = MINUTE_GAP_MS, tickGapMs = TICK_GAP_MS }: { minuteGapMs?: number; tickGapMs?: number } = {},
): Array<LivePriceRow> {
    const breakBefore = points.map((point, index) => {
        if (index === 0) return false;

        const previous = points[index - 1];

        const limit = point.source === "minute" || previous.source === "minute" ? minuteGapMs : tickGapMs;

        return point.atMs - previous.atMs > limit;
    });

    const rows: Array<LivePriceRow> = [];

    points.forEach((point, index) => {
        if (breakBefore[index]) {
            const previous = points[index - 1];

            rows.push({
                atMs: null,
                dayReturnBps: null,
                isolated: false,
                price: null,
                returnBps: null,
                source: null,
                x: (previous.x + point.x) / 2,
            });
        }

        const startsRun = index === 0 || breakBefore[index];

        const endsRun = index === points.length - 1 || breakBefore[index + 1];

        rows.push({ ...point, isolated: startsRun && endsRun });
    });

    return rows;
}

/** Call ms as `m:ss` / `h:mm:ss`, signed below zero (a minute row before the call clock's start). */
export function formatCallMs(ms: number) {
    return ms < 0 ? `−${formatMs(-ms)}` : formatMs(ms);
}

const wallTimeFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
});

/** Wall time in New York ("4:31:05 PM"). */
export function formatWallTime(ms: number) {
    return wallTimeFormat.format(new Date(ms));
}

const priceFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 2 });

/** A price ("230.47"); null → "—". */
export function formatPrice(value: null | number) {
    return value === null ? "—" : priceFormat.format(value);
}
