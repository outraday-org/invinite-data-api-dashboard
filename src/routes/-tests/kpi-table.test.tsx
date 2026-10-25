// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { useEarningsExtractionsInfinite } from "@/lib/api/queries";
import { NO_TRANSCRIPT_TITLE } from "@/routes/$ticker/earnings-calls/-components/media-state";
import { KpiTable } from "@/routes/$ticker/earnings-calls/-components/tabs/kpi-table";

// Keep the server functions (TanStack Start) unloaded; the hook's answer is set per test.
vi.mock("@/lib/api/queries", () => ({ useEarningsExtractionsInfinite: vi.fn() }));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ seekMs: null }),
}));

afterEach(cleanup);

function answerWith(error: Error) {
    vi.mocked(useEarningsExtractionsInfinite).mockReturnValue({
        data: null,
        error,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
    } as unknown as ReturnType<typeof useEarningsExtractionsInfinite>);
}

describe("KpiTable", () => {
    it("renders a 404 (no transcript) as the notice, not an error", () => {
        answerWith(new ApiRequestError(404, { error: "Not Found", message: "No transcript for event" }));

        render(<KpiTable selector={{ eventId: "9655a5db-8968-40be-8c79-7cd1a8aed8e9" }} />);

        expect(screen.getByText(NO_TRANSCRIPT_TITLE)).toBeInTheDocument();

        expect(screen.queryByText("Failed to load KPIs")).toBeNull();
    });

    it("keeps any other API error an ErrorState", () => {
        answerWith(new ApiRequestError(500, { error: "Internal Server Error", message: "boom" }));

        render(<KpiTable selector={{ eventId: "9655a5db-8968-40be-8c79-7cd1a8aed8e9" }} />);

        expect(screen.getByText("Failed to load KPIs")).toBeInTheDocument();

        expect(screen.queryByText(NO_TRANSCRIPT_TITLE)).toBeNull();
    });
});
