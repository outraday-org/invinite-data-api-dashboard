// @vitest-environment jsdom
import type * as React from "react";
import type * as Recharts from "recharts";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EarningsPriceAttributionResponse } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import {
    PRICE_ATTRIBUTION_CAVEAT,
    PRICE_ATTRIBUTION_LIVE_BANNER,
    PRICE_ATTRIBUTION_UNAVAILABLE,
    PriceAttributionView,
} from "@/routes/$ticker/earnings-calls/-components/tabs/price-attribution-tab";

// jsdom has no layout: give recharts a fixed-size box instead of a ResponsiveContainer.
vi.mock("recharts", async importOriginal => ({
    ...await importOriginal<typeof Recharts>(),
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div style={{ height: 300, width: 800 }}>{children}</div>
    ),
}));

// The timestamps' SeekButton reads the page's audio host; a call without a recording renders text.
vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ seekMs: null }),
}));

// The view is rendered with its data directly: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    isEarningsEventLiveish: vi.fn(),
    useEarningsPriceAttribution: vi.fn(),
}));

afterEach(cleanup);

const OPENING = { speaker_label: "A", start_ms: 65_000, text: "Revenue grew 12% year over year." };

const GUIDANCE = { speaker_label: "B", start_ms: 130_000, text: "We now expect full-year margins of 30%." };

const ATTRIBUTION: EarningsPriceAttributionResponse = {
    anchor_kind: "t0_wallclock",
    anchor_lag_ms: 4200,
    anchor_uncertainty_s: 2,
    bar_count: 3,
    buckets: [
        {
            bar_start: "2026-10-08T20:30:00.000Z",
            bucket: "2026-10-08T20:30:00.000Z",
            cumulative_return_bps: 4.5,
            return_bps: 4.5,
            utterance_refs: [],
        },
        {
            bar_start: "2026-10-08T20:31:00.000Z",
            bucket: "2026-10-08T20:31:00.000Z",
            cumulative_return_bps: 16.5,
            return_bps: 12,
            utterance_refs: [OPENING],
        },
        {
            bar_start: "2026-10-08T20:32:00.000Z",
            bucket: "2026-10-08T20:32:00.000Z",
            cumulative_return_bps: -15,
            return_bps: -31.5,
            utterance_refs: [GUIDANCE],
        },
    ],
    end_of_window_return_bps: -15,
    event: {
        cik: "0000320193",
        conference_date: "2026-10-08T20:30:00.000Z",
        event_id: "7f0c1c1e-8a7b-4c39-9a5e-0b7e3c1d2a10",
        symbol: "AAPL",
    },
    lag_kind: "playlist",
    live: false,
    session: "post",
    settled: true,
    top_minutes: [
        { bucket: "2026-10-08T20:32:00.000Z", return_bps: -31.5, utterance_refs: [GUIDANCE] },
    ],
};

// While the call runs: the minute rows so far, no summary yet.
const LIVE_ATTRIBUTION: EarningsPriceAttributionResponse = {
    ...ATTRIBUTION,
    anchor_kind: null,
    anchor_lag_ms: null,
    anchor_uncertainty_s: null,
    bar_count: 2,
    buckets: ATTRIBUTION.buckets.slice(0, 2),
    end_of_window_return_bps: null,
    lag_kind: null,
    live: true,
    session: null,
    settled: false,
    top_minutes: [],
};

describe("PriceAttributionView", () => {
    it("shows the coincidence sentence and the unavailable state on a 404", () => {
        const error = new ApiRequestError(404, {
            error: "price_attribution_unavailable",
            message: "Price attribution is not available for this call yet",
        });

        render(<PriceAttributionView data={null} error={error} isLoading={false} />);

        expect(screen.getByText(PRICE_ATTRIBUTION_CAVEAT)).toBeInTheDocument();

        expect(screen.getByRole("status")).toHaveTextContent(PRICE_ATTRIBUTION_UNAVAILABLE);

        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("renders the anchor facts, the top minute and the bucket table without a price column", () => {
        render(<PriceAttributionView data={ATTRIBUTION} error={null} isLoading={false} />);

        expect(screen.getByText(PRICE_ATTRIBUTION_CAVEAT)).toBeInTheDocument();

        expect(screen.getByText("Capture clock")).toBeInTheDocument();

        expect(screen.getByText("4.2 s (stream playlist)")).toBeInTheDocument();

        expect(screen.getByText("± 2 s")).toBeInTheDocument();

        expect(screen.getByText("After hours")).toBeInTheDocument();

        const topMinutes = screen.getByText("Largest minute moves").closest("section");

        expect(topMinutes).not.toBeNull();

        expect(within(topMinutes as HTMLElement).getByText(GUIDANCE.text)).toBeInTheDocument();

        expect(screen.getByText("Cumulative return (bps)")).toBeInTheDocument();

        const table = screen.getByRole("table");

        const headers = within(table).getAllByRole("columnheader").map(cell => cell.textContent);

        expect(headers).toEqual(["Minute (ET)", "Return", "Cumulative", "Being said"]);

        expect(headers.some(header => /price|volume/i.test(header))).toBe(false);

        const rows = within(table).getAllByRole("row");

        expect(rows).toHaveLength(4);

        expect(within(rows[2]).getByText("+12 bps")).toBeInTheDocument();

        expect(within(rows[2]).getByText(OPENING.text)).toBeInTheDocument();

        // No recording in the test: the utterance's timestamp renders as text.
        expect(within(rows[2]).getByText("1:05")).toBeInTheDocument();

        expect(within(rows[3]).getByText("−31.5 bps")).toBeInTheDocument();

        expect(screen.queryByText(PRICE_ATTRIBUTION_LIVE_BANNER)).not.toBeInTheDocument();
    });

    it("shows the live banner and the minute rows so far, without anchor facts or top minutes", () => {
        render(<PriceAttributionView data={LIVE_ATTRIBUTION} error={null} isLoading={false} />);

        expect(screen.getByText(PRICE_ATTRIBUTION_CAVEAT)).toBeInTheDocument();

        expect(screen.getByText(PRICE_ATTRIBUTION_LIVE_BANNER)).toBeInTheDocument();

        expect(screen.queryByText("Anchor")).not.toBeInTheDocument();

        expect(screen.queryByText("Largest minute moves")).not.toBeInTheDocument();

        expect(screen.getByText("Cumulative return (bps)")).toBeInTheDocument();

        const table = screen.getByRole("table");

        const headers = within(table).getAllByRole("columnheader").map(cell => cell.textContent);

        expect(headers.some(header => /price|volume/i.test(header))).toBe(false);

        expect(within(table).getAllByRole("row")).toHaveLength(3);
    });
});
