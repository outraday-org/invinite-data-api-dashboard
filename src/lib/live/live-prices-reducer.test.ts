import { describe, expect, it } from "vitest";

import type { LivePricesState, LivePriceTick } from "./live-prices-reducer";

import { INITIAL_LIVE_PRICES, livePricesReducer, MAX_LIVE_PRICE_TICKS } from "./live-prices-reducer";

const T0 = Date.parse("2026-10-09T21:00:00.000Z");

function tick(second: number, overrides: Partial<LivePriceTick> = {}): LivePriceTick {
    return {
        at: new Date(T0 + second * 1000).toISOString(),
        callMs: second * 1000,
        cumulativeVolume: null,
        dayReturnBps: null,
        high: 100,
        low: 100,
        open: 100,
        prevClose: 99,
        price: 100 + second / 100,
        referencePrice: 100,
        returnBps: second,
        source: "stream",
        volume: 10,
        ...overrides,
    };
}

function apply(state: LivePricesState, ...ticks: Array<LivePriceTick>) {
    return ticks.reduce((current, next) => livePricesReducer(current, { kind: "tick", tick: next }), state);
}

describe("live-prices-reducer", () => {
    it("keeps ticks ordered by their second", () => {
        const state = apply(INITIAL_LIVE_PRICES, tick(1), tick(3), tick(2), tick(0));

        expect(state.ticks.map(t => t.callMs)).toStrictEqual([0, 1000, 2000, 3000]);

        expect(state.last?.callMs).toBe(3000);
    });

    it("replaces a second seen again", () => {
        const state = apply(INITIAL_LIVE_PRICES, tick(1), tick(2, { source: "snapshot" }), tick(2, { price: 123 }));

        expect(state.ticks).toHaveLength(2);

        expect(state.ticks[1].price).toBe(123);
    });

    it("caps the held ticks, dropping the oldest", () => {
        const ticks = Array.from({ length: MAX_LIVE_PRICE_TICKS + 5 }, (_, second) => tick(second));

        const state = apply(INITIAL_LIVE_PRICES, ...ticks);

        expect(state.ticks).toHaveLength(MAX_LIVE_PRICE_TICKS);

        expect(state.ticks[0].callMs).toBe(5000);
    });

    it("carries the newest non-null reference and previous close", () => {
        const state = apply(
            INITIAL_LIVE_PRICES,
            tick(1, { prevClose: 98, referencePrice: 101 }),
            tick(2, { prevClose: null, referencePrice: null }),
        );

        expect(state.reference).toBe(101);

        expect(state.prevClose).toBe(98);
    });

    it("ignores a tick with an unreadable second", () => {
        expect(apply(INITIAL_LIVE_PRICES, tick(1, { at: "soon" }))).toBe(INITIAL_LIVE_PRICES);
    });
});
