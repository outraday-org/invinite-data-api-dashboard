// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WATCHLIST_MAX } from "@/lib/news/watchlist";
import { feedDescription, feedEmptyText, WatchlistEditor } from "@/routes/news-feed";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children }: { children: unknown }) => children,
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({ useInstrumentSearch: () => ({ data: undefined, isFetching: false }) }));

afterEach(cleanup);

describe("WatchlistEditor", () => {
    it("shows the stored tickers in the company filter, clears them and states the count", () => {
        const onChange = vi.fn();

        render(<WatchlistEditor list={["AAPL", "MSFT"]} onChange={onChange} />);

        expect(screen.getAllByTestId("company-chip").map(chip => chip.textContent)).toEqual(["AAPL", "MSFT"]);

        expect(screen.getByText(`2 of ${WATCHLIST_MAX} companies, kept in this browser only.`)).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Clear watchlist"));

        expect(onChange).toHaveBeenCalledWith([]);
    });

    it("opens the company picker dialog", () => {
        render(<WatchlistEditor list={[]} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Watchlist: Add tickers" }));

        expect(screen.getByRole("dialog")).toBeTruthy();

        expect(screen.getByText(/At most\s*20/u)).toBeTruthy();
    });
});

describe("the feed's texts", () => {
    it("states that the API serves news per company, and that the market scope is live only", () => {
        expect(feedDescription("watchlist")).toMatch(/serves news per company/u);

        expect(feedDescription("market")).toMatch(/needs a company or an event/u);

        expect(feedEmptyText({ live: false, scope: "watchlist", tickers: 0 })).toBe("Add tickers above to see their news.");

        expect(feedEmptyText({ live: false, scope: "market", tickers: 3 })).toBe("Switch Live on to follow every company's new items.");

        expect(feedEmptyText({ live: true, scope: "market", tickers: 0 })).toBe("Listening: new items appear here as they are published.");
    });
});
