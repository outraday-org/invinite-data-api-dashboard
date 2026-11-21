// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WATCHLIST_MAX } from "@/lib/news/watchlist";
import { feedDescription, feedEmptyText, WatchlistEditor } from "@/routes/news-feed";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children }: { children: unknown }) => children,
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({}));

afterEach(cleanup);

describe("WatchlistEditor", () => {
    it("adds the typed tickers in one go and removes one by its chip", () => {
        const onAdd = vi.fn();

        const onRemove = vi.fn();

        render(<WatchlistEditor list={["AAPL", "MSFT"]} onAdd={onAdd} onRemove={onRemove} />);

        expect(within(screen.getByTestId("watchlist")).getByText("AAPL")).toBeTruthy();

        expect(screen.getByText(`2 of ${WATCHLIST_MAX} tickers, kept in this browser only.`)).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Add tickers"), { target: { value: "nvda, brk.b" } });

        fireEvent.click(screen.getByText("Add"));

        expect(onAdd).toHaveBeenCalledWith(["NVDA", "BRK.B"]);

        expect(screen.getByLabelText("Add tickers")).toHaveValue("");

        fireEvent.click(screen.getByLabelText("Remove MSFT"));

        expect(onRemove).toHaveBeenCalledWith("MSFT");
    });

    it("refuses more tickers once the list is full", () => {
        render(<WatchlistEditor list={Array.from({ length: WATCHLIST_MAX }, (_, index) => `T${index}`)} onAdd={vi.fn()} onRemove={vi.fn()} />);

        expect(screen.getByLabelText("Add tickers")).toBeDisabled();

        expect((screen.getByText("Add").closest("button") as HTMLButtonElement).disabled).toBe(true);
    });
});

describe("the feed's texts", () => {
    it("states that the API serves news per company, and that the market scope is live only", () => {
        expect(feedDescription("watchlist")).toMatch(/serves news per company/u);

        expect(feedDescription("market")).toMatch(/needs a company or an event/u);

        expect(feedEmptyText({ live: false, scope: "watchlist", tickers: 0 })).toBe("Add tickers to your watchlist to see their news.");

        expect(feedEmptyText({ live: false, scope: "market", tickers: 3 })).toBe("Switch Live on to follow every company's new items.");

        expect(feedEmptyText({ live: true, scope: "market", tickers: 0 })).toBe("Listening: new items appear here as they are published.");
    });
});
