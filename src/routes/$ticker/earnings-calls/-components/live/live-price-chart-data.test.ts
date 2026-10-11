import { describe, expect, it } from "vitest";

import type { LivePriceTick } from "@/lib/live/live-prices-reducer";

import type { LivePricePoint } from "./live-price-chart-data";

import { clockOffsetMs, formatCallMs, formatPrice, gapBreaks, mergeSeed } from "./live-price-chart-data";

const T0 = Date.parse("2026-10-09T21:00:00.000Z");

function tick(second: number, overrides: Partial<LivePriceTick> = {}): LivePriceTick {
    return {
        at: new Date(T0 + second * 1000).toISOString(),
        callMs: second * 1000,
        cumulativeVolume: null,
        dayReturnBps: -10,
        high: 100,
        low: 100,
        open: 100,
        prevClose: 101,
        price: 100.5,
        referencePrice: 100,
        returnBps: 50,
        source: "stream",
        volume: 10,
        ...overrides,
    };
}

function minute(offsetMinutes: number, cumulative: number) {
    return { bucket: new Date(T0 + offsetMinutes * 60_000).toISOString(), cumulative_return_bps: cumulative };
}

function point(atSecond: number, source: LivePricePoint["source"] = "stream"): LivePricePoint {
    return { atMs: T0 + atSecond * 1000, dayReturnBps: null, price: 1, returnBps: 1, source, x: atSecond * 1000 };
}

describe("clockOffsetMs", () => {
    it("reads the call's t0 from a tick with call_ms", () => {
        expect(clockOffsetMs([tick(5, { callMs: null }), tick(6, { callMs: 4000 })], null)).toBe(T0 + 2000);
    });

    it("falls back to the stream's call_t0, else wall time", () => {
        expect(clockOffsetMs([tick(5, { callMs: null })], "2026-10-09T21:00:00.000Z")).toBe(T0);

        expect(clockOffsetMs([], null)).toBeNull();
    });
});

describe("mergeSeed", () => {
    it("places minute closes before the first tick on the call clock, priced from the reference", () => {
        // Minute rows of 20:58 and 20:59 close at 20:59 and 21:00; the 21:00 row closes after the first tick.
        const points = mergeSeed(
            [minute(-2, 10), minute(-1, 20), minute(0, 30)],
            [tick(30), tick(31)],
            { offsetMs: T0, reference: 100 },
        );

        expect(points.map(p => [p.source, p.x, p.returnBps])).toStrictEqual([
            ["minute", -60_000, 10],
            ["minute", 0, 20],
            ["stream", 30_000, 50],
            ["stream", 31_000, 50],
        ]);

        expect(points[0].price).toBe(100.1);
    });

    it("runs on wall time without a clock and leaves a seed point unpriced without a reference", () => {
        const points = mergeSeed([minute(-1, 20)], [], { offsetMs: null, reference: null });

        expect(points).toStrictEqual([
            { atMs: T0, dayReturnBps: null, price: null, returnBps: 20, source: "minute", x: T0 },
        ]);
    });
});

describe("gapBreaks", () => {
    it("breaks the line after more than 5 s without a tick and marks lone points", () => {
        const rows = gapBreaks([point(0), point(1), point(2), point(9), point(20), point(21)]);

        expect(rows.map(row => row.source)).toStrictEqual(["stream", "stream", "stream", null, "stream", null, "stream", "stream"]);

        expect(rows.filter(row => row.isolated).map(row => row.atMs)).toStrictEqual([T0 + 9000]);

        expect(rows[3].returnBps).toBeNull();
    });

    it("keeps minute points one minute apart connected", () => {
        const rows = gapBreaks([point(-60, "minute"), point(0, "minute"), point(30)]);

        expect(rows.every(row => row.source !== null)).toBe(true);

        expect(rows.some(row => row.isolated)).toBe(false);
    });
});

describe("formatting", () => {
    it("formats call ms with a sign before the call clock's start", () => {
        expect(formatCallMs(65_000)).toBe("1:05");

        expect(formatCallMs(-60_000)).toBe("−1:00");

        expect(formatCallMs(3_725_000)).toBe("1:02:05");
    });

    it("formats a price", () => {
        expect(formatPrice(230.4)).toBe("230.40");

        expect(formatPrice(null)).toBe("—");
    });
});
