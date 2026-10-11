// @vitest-environment jsdom
import type * as React from "react";
import type * as Recharts from "recharts";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LivePriceTick } from "@/lib/live/live-prices-reducer";

import { INITIAL_LIVE_PRICES, livePricesReducer } from "@/lib/live/live-prices-reducer";
import { LIVE_PRICE_CAVEAT, LivePriceChart } from "@/routes/$ticker/earnings-calls/-components/live/live-price-chart";

// jsdom has no layout: give recharts a fixed-size box instead of a ResponsiveContainer.
vi.mock("recharts", async importOriginal => ({
    ...await importOriginal<typeof Recharts>(),
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div style={{ height: 160, width: 800 }}>{children}</div>
    ),
}));

afterEach(cleanup);

const T0 = Date.parse("2026-10-09T21:00:00.000Z");

function tick(second: number, overrides: Partial<LivePriceTick> = {}): LivePriceTick {
    return {
        at: new Date(T0 + second * 1000).toISOString(),
        callMs: second * 1000,
        cumulativeVolume: null,
        dayReturnBps: -12,
        high: 100.3,
        low: 100.2,
        open: 100.2,
        prevClose: 101,
        price: 100.25,
        referencePrice: 100,
        returnBps: 25,
        source: "stream",
        volume: 300,
        ...overrides,
    };
}

function pricesOf(...ticks: Array<LivePriceTick>) {
    return ticks.reduce((state, next) => livePricesReducer(state, { kind: "tick", tick: next }), INITIAL_LIVE_PRICES);
}

// The 20:59 minute row closes at 21:00 = call time 0:00, before the first tick.
const SEED = [{ bucket: "2026-10-09T20:59:00.000Z", cumulative_return_bps: 10 }];

describe("LivePriceChart", () => {
    it("draws the seed minute and the ticks with the coincidence caveat", () => {
        render(<LivePriceChart buckets={SEED} callT0={null} cursorMs={null} prices={pricesOf(tick(30), tick(31))} />);

        expect(screen.getByText(LIVE_PRICE_CAVEAT)).toBeInTheDocument();

        expect(screen.getByRole("img", { name: /^Live price line/ })).toHaveAttribute("aria-label", "Live price line: 3 points, 0 gaps");

        expect(screen.getByText("Call time, the live transcript's clock")).toBeInTheDocument();

        expect(screen.getByText(/100\.25 · \+25 bps since the call reference/)).toBeInTheDocument();
    });

    it("breaks the line after more than 5 s without a tick", () => {
        render(<LivePriceChart buckets={[]} callT0={null} cursorMs={null} prices={pricesOf(tick(30), tick(31), tick(45))} />);

        expect(screen.getByRole("img", { name: /^Live price line/ })).toHaveAttribute("aria-label", "Live price line: 3 points, 1 gap");
    });

    it("marks the audio position only while the player is synced", () => {
        const prices = pricesOf(tick(30), tick(31));

        const { rerender } = render(<LivePriceChart buckets={[]} callT0={null} cursorMs={31_000} prices={prices} />);

        expect(screen.getByText("Audio at 0:31")).toBeInTheDocument();

        rerender(<LivePriceChart buckets={[]} callT0={null} cursorMs={null} prices={prices} />);

        expect(screen.queryByText(/Audio at/)).not.toBeInTheDocument();
    });

    it("falls back to wall time before the call clock is known", () => {
        render(<LivePriceChart buckets={[]} callT0={null} cursorMs={5_000} prices={pricesOf(tick(30, { callMs: null }))} />);

        expect(screen.getByText("New York time (the call clock is not known yet)")).toBeInTheDocument();

        expect(screen.queryByText(/Audio at/)).not.toBeInTheDocument();
    });

    it("switches the scale between return and price", () => {
        render(<LivePriceChart buckets={[]} callT0={null} cursorMs={null} prices={pricesOf(tick(30))} />);

        expect(screen.getByText("Return since the call reference (bps)")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Price" }));

        expect(screen.getByRole("button", { name: "Price" })).toHaveAttribute("aria-pressed", "true");

        expect(screen.getByText("Price", { selector: "div" })).toBeInTheDocument();
    });
});
