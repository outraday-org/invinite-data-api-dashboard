// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { newsroomItem, newsSearchPage } from "@/lib/news/news-fixtures";
import { hitFieldLabel, newsSearchCostText, NewsSearchResults } from "@/routes/$ticker/news/-components/news-search";

vi.mock("@tanstack/react-router", () => ({
    // A hit's headline is a `?item=` link: the mock shows the search it would navigate to.
    Link: ({ children, className, search }: { children: React.ReactNode; className?: string; search: (prev: Record<string, unknown>) => Record<string, unknown> }) => (
        <a className={className} href={`?item=${String(search({}).item)}`}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({ useV2NewsSearchInfinite: vi.fn() }));

afterEach(cleanup);

const props = { error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

describe("hitFieldLabel", () => {
    it("names the headline, the lede and the summary block a passage is from", () => {
        expect(hitFieldLabel({ block: null, field: "title" })).toBe("Headline");

        expect(hitFieldLabel({ block: null, field: "lede" })).toBe("Lede");

        expect(hitFieldLabel({ block: { heading: "Availability", id: "b", index: 2 }, field: "summary" })).toBe("Summary · Availability");
    });
});

describe("NewsSearchResults", () => {
    it("lists hits in the shared layout: match badge, where it matched, a headline link to the item panel, the passage", () => {
        render(<NewsSearchResults {...props} pages={[newsSearchPage()]} />);

        const hits = screen.getAllByTestId("news-hit");

        expect(hits).toHaveLength(2);

        expect(within(hits[0]).getByText("Headline")).toBeTruthy();

        expect(within(hits[0]).getByText("keyword")).toBeTruthy();

        expect(within(hits[0]).getByRole("link", { name: newsroomItem().title })).toHaveAttribute("href", `?item=${newsroomItem().id}`);

        // A headline hit shows the headline once (no passage repeating it); a summary hit shows its passage.
        expect(within(hits[1]).getByText("Summary · Availability")).toBeTruthy();

        // The server's span is marked (`HitPassage`).
        expect(within(hits[1]).getByText("from").tagName).toBe("MARK");
    });

    it("pages on by cursor and notes incomplete coverage; an empty answer with complete coverage says so", () => {
        const onLoadMore = vi.fn();

        const coverage = { completeness: "partial", reasons: ["lexical_backfill_pending"] } as const;

        render(
            <NewsSearchResults
                {...props}
                hasNextPage
                onLoadMore={onLoadMore}
                pages={[newsSearchPage({ has_more: true, meta: { index: coverage as never, query: "Rubin" }, next_cursor: "c2" })]}
            />,
        );

        fireEvent.click(screen.getByText("More results (10 credits)"));

        expect(onLoadMore).toHaveBeenCalledTimes(1);

        expect(screen.getByRole("status")).toBeTruthy();

        cleanup();

        render(<NewsSearchResults {...props} pages={[newsSearchPage({ data: [] })]} />);

        expect(screen.getByText("No passages found")).toBeTruthy();
    });

    it("renders the plan gate as a STANDARD notice and a 400 with the API's message", () => {
        render(<NewsSearchResults {...props} error={new ApiRequestError(403, { error: "Forbidden", message: "Upgrade" })} pages={[]} />);

        expect(screen.getByText("Your plan does not include news search")).toBeTruthy();

        cleanup();

        render(<NewsSearchResults {...props} error={new ApiRequestError(400, { error: "Bad Request", message: "Exact search needs 3 characters" })} pages={[]} />);

        expect(screen.getByText("Exact search needs 3 characters")).toBeTruthy();
    });
});

describe("newsSearchCostText", () => {
    it("names the page's day window only when one is set (the market scope has none)", () => {
        expect(newsSearchCostText(true)).toBe("10 credits per page · the page's date window applies");

        expect(newsSearchCostText(false)).toBe("10 credits per page");
    });
});
