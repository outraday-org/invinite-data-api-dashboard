// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TickerSearch } from "@/components/search/ticker-search";
import { useInstrumentSearch } from "@/lib/api/queries";
import { INSTRUMENT_SEARCH } from "@/lib/instruments-fixtures";

const router = vi.hoisted(() => ({ navigate: vi.fn(), pathname: "/AAPL/financials-standardized", ticker: "AAPL" as string | undefined }));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => router.navigate,
    useParams: ({ select }: { select: (params: { ticker?: string }) => string | undefined }) => select({ ticker: router.ticker }),
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: router.pathname } }),
}));

vi.mock("@/lib/api/queries", () => ({ useInstrumentSearch: vi.fn(), useKeyReady: () => true }));

afterEach(cleanup);

beforeEach(() => {
    vi.useFakeTimers();

    router.navigate.mockReset();

    vi.mocked(useInstrumentSearch).mockImplementation(query => ({
        data: query ? INSTRUMENT_SEARCH : null,
        isFetching: false,
    }) as never);
});

afterEach(() => {
    vi.useRealTimers();
});

const search = (text: string) => {
    render(<TickerSearch />);

    fireEvent.click(screen.getByRole("button", { name: "Search stocks, ETFs and funds" }));

    act(() => vi.runOnlyPendingTimers());

    fireEvent.change(screen.getByPlaceholderText("Search stocks, ETFs and funds"), { target: { value: text } });

    act(() => vi.advanceTimersByTime(300));
};

const hit = (symbol: string) => screen.getByText(symbol, { selector: "div.font-medium" }).closest("button")!;

describe("instrument search (`/v1/instruments?q=`)", () => {
    it("finds TQQQ with an ETF badge, GLD as an ETF trust, PDI, VXX and AAPL with theirs", () => {
        search("TQQQ");

        expect(useInstrumentSearch).toHaveBeenLastCalledWith("TQQQ");

        const badges = (symbol: string) => within(hit(symbol)).getAllByTestId("search-badge").map(badge => badge.textContent);

        expect(badges("TQQQ")).toEqual(["ETF"]);

        expect(badges("GLD")).toEqual(["ETF", "Trust"]);

        expect(badges("PDI")).toEqual(["Closed-end fund"]);

        expect(badges("VXX")).toEqual(["ETN"]);

        expect(badges("AAPL")).toEqual(["Stock"]);
    });

    it("keeps the section only when the picked instrument has it: AAPL's financials → TQQQ's overview", () => {
        search("TQQQ");

        fireEvent.click(hit("TQQQ"));

        expect(router.navigate).toHaveBeenLastCalledWith({ params: { ticker: "TQQQ" }, to: "/$ticker" });

        router.pathname = "/MSFT/holders";

        router.navigate.mockReset();

        cleanup();

        search("PDI");

        fireEvent.click(hit("PDI"));

        expect(router.navigate).toHaveBeenLastCalledWith({ href: "/PDI/holders" });

        router.pathname = "/AAPL/financials-standardized";
    });
});
