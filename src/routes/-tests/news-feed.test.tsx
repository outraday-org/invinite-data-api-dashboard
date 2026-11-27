// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WATCHLIST_MAX, WATCHLIST_STORAGE_KEY } from "@/lib/news/watchlist";
import { CompaniesField, feedEmptyText, Route } from "@/routes/news-feed";

const feed = vi.hoisted(() => ({ list: vi.fn(), navigate: vi.fn(), query: { q: "share repurchase" }, search: vi.fn() }));

vi.mock("@/routes/$ticker/news/-components/use-news-list", () => ({ useNewsList: feed.list }));

vi.mock("@/routes/$ticker/news/-components/news-item-panel", () => ({ NewsItemPanel: () => null }));

vi.mock("@/lib/live/live-default", () => ({ liveOn: () => true, liveParam: () => true, useLiveDefault: () => true }));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useNavigate: () => feed.navigate, useSearch: () => feed.query }),
    Link: ({ children }: { children: unknown }) => children,
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({ useInstrumentSearch: () => ({ data: undefined, isFetching: false }), useNewsKindCatalogInfinite: () => ({ data: null, error: null, fetchNextPage: () => undefined, hasNextPage: false, isFetching: false, isFetchNextPageError: false }), useV2NewsSearchInfinite: feed.search }));

afterEach(cleanup);

describe("CompaniesField", () => {
    it("shows the stored tickers in the company filter, clears them and states the count", () => {
        const onChange = vi.fn();

        render(<CompaniesField list={["AAPL", "MSFT"]} onChange={onChange} />);

        expect(screen.getAllByTestId("company-chip").map(chip => chip.textContent)).toEqual(["AAPL", "MSFT"]);

        expect(screen.getByText(`Kept in this browser only · 2 of ${WATCHLIST_MAX}`)).toBeTruthy();

        fireEvent.click(screen.getByLabelText(/clear companies/i));

        expect(onChange).toHaveBeenCalledWith([]);
    });

    it("opens the company picker dialog", () => {
        render(<CompaniesField list={[]} onChange={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Companies: Every company" }));

        expect(screen.getByRole("dialog")).toBeTruthy();

        expect(screen.getByText(/At most\s*20/u)).toBeTruthy();
    });
});

describe("the feed's texts", () => {
    it("distinguishes a historical market window, the live feed, and scoped companies", () => {
        expect(feedEmptyText({ hasWindow: false, live: false, market: true })).toBe("No news in the last 7 days.");

        expect(feedEmptyText({ hasWindow: true, live: true, market: true })).toBe("No news in this window.");

        expect(feedEmptyText({ hasWindow: false, live: true, market: true })).toBe("Listening: new items appear here as they are published.");

        expect(feedEmptyText({ hasWindow: false, live: false, market: false })).toBe("No news for these companies in this window.");
    });
});

describe("feed storage and request scope", () => {
    it.each([[[], true], [["AAPL", "0000789019"], false]] as const)("hydrates %j before mounting the first request", (companies, market) => {
        window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(companies));

        feed.search.mockReset().mockReturnValue({ data: null, error: null, isFetching: false, isLoading: true });

        feed.list.mockReset().mockReturnValue({ flashing: new Set(), items: [], liveIds: new Set(), pager: { page: 1 }, windowProblem: null });

        const Feed = Route.options.component!;

        render(<Feed />);

        const scope = market ? undefined : companies.join(",");

        expect(feed.search.mock.calls.length).toBeGreaterThan(0);

        expect(feed.list.mock.calls.length).toBeGreaterThan(0);

        for (const [input] of feed.search.mock.calls) expect(input).toMatchObject({ company: scope, q: "share repurchase" });

        for (const [input] of feed.list.mock.calls) expect(input).toMatchObject({ company: scope, liveTickers: market ? undefined : companies, market: market ? true : undefined, visible: false });

        expect(screen.queryByRole("tablist")).toBeNull();

        expect(screen.getByPlaceholderText(market ? "Search every company's news — e.g. share repurchase" : "Search the news of these companies")).toBeInTheDocument();

        window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    });
});
