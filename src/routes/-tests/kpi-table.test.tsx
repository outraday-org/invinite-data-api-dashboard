// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { useV2KpisInfinite } from "@/lib/api/queries";
import { NVDA_REVENUE_HISTORY } from "@/lib/earnings/o7-earnings-fixtures";
import { NO_TRANSCRIPT_TITLE } from "@/routes/$ticker/earnings-calls/-components/media-state";
import { KpiTable } from "@/routes/$ticker/earnings-calls/-components/tabs/kpi-table";

// Keep the server functions (TanStack Start) unloaded; the hook's answer is set per test.
vi.mock("@/lib/api/queries", () => ({ useV2KpisInfinite: vi.fn() }));

const player = vi.hoisted(() => ({ seekMs: vi.fn() }));

vi.mock("@/lib/player/player-context", () => ({
    usePlayer: () => ({ canSeek: true, engine: player }),
}));

afterEach(cleanup);

function answerWith(error: Error) {
    vi.mocked(useV2KpisInfinite).mockReturnValue({
        data: null,
        error,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
    } as unknown as ReturnType<typeof useV2KpisInfinite>);
}

describe("KpiTable", () => {
    it("keeps timed playback, metric history and values without source/filing diagnostics", () => {
        const mention = NVDA_REVENUE_HISTORY[0];

        const onMetricClick = vi.fn();

        vi.mocked(useV2KpisInfinite).mockReturnValue({ data: { pages: [{ data: [mention, { ...NVDA_REVENUE_HISTORY[2], start_ms: null }] }] }, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false } as unknown as ReturnType<typeof useV2KpisInfinite>);

        render(<KpiTable eventId={mention.event_id} onMetricClick={onMetricClick} />);

        expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Metric", "Value", "Period", "Speaker"]);

        expect(screen.getByText("$96 billion")).toBeInTheDocument();

        expect(screen.getAllByText("Colette Kress")).toHaveLength(2);

        expect(screen.queryByRole("link", { name: /Filing|EDGAR/ })).toBeNull();

        expect(screen.queryByText(mention.source_sentence)).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Play from 2:00" }));

        expect(player.seekMs).toHaveBeenCalledWith(120_000);

        fireEvent.click(screen.getAllByRole("button", { name: "Revenue" })[0]);

        expect(onMetricClick).toHaveBeenCalledWith("revenue");

        expect(mention.source_sentence).toBe("Revenue was a record.");
    });

    it("renders a 404 (no transcript) as the notice, not an error", () => {
        answerWith(new ApiRequestError(404, { error: "not_found", message: "No transcript for event" }));

        render(<KpiTable eventId="9655a5db-8968-40be-8c79-7cd1a8aed8e9" />);

        expect(screen.getByText(NO_TRANSCRIPT_TITLE)).toBeInTheDocument();

        expect(screen.queryByText("Failed to load KPIs")).toBeNull();
    });

    it("keeps any other API error an ErrorState", () => {
        answerWith(new ApiRequestError(500, { error: "Internal Server Error", message: "boom" }));

        render(<KpiTable eventId="9655a5db-8968-40be-8c79-7cd1a8aed8e9" />);

        expect(screen.getByText("Failed to load KPIs")).toBeInTheDocument();

        expect(screen.queryByText(NO_TRANSCRIPT_TITLE)).toBeNull();
    });
});
