// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsSearch } from "@/lib/news/labels";
import type { useNewsList } from "@/routes/$ticker/news/-components/use-news-list";

import { ApiRequestError } from "@/lib/api/errors";
import { useV2NewsSearchInfinite } from "@/lib/api/queries";
import { newsSearchPage } from "@/lib/news/news-fixtures";
import { NewsView, useNewsSearchView } from "@/routes/$ticker/news/-components/news-view";

vi.mock("@/lib/api/queries", () => ({ useV2NewsSearchInfinite: vi.fn() }));

vi.mock("@tanstack/react-router", async importOriginal => ({ ...await importOriginal<object>(), Link: ({ children}: { children: React.ReactNode }) => <span>{children}</span> }));

afterEach(cleanup);

const list = { error: null, flashing: new Set(), hidden: 0, isLoading: false, items: [], liveIds: new Set(), pager: { hasNext: false, isFetching: false, onNext: vi.fn(), onPrevious: vi.fn(), page: 2 }, skippedPages: 0, windowProblem: null } as unknown as ReturnType<typeof useNewsList>;

function Harness({ company, initial = {}}: { initial?: Partial<NewsSearch>; company?: string }) {
    const [query, setQuery] = useState(initial);

    const search = useNewsSearchView(query, company);

    return <NewsView company={company} controls={<div>List controls</div>} description="Company news" emptyText="No listed items." exportScope="all" headerActions={null} list={list} patch={patch => setQuery(prev => ({ ...prev, ...patch }))} placeholder={company ?? "Search every company's news"} query={query} scope={null} scopeText={company ?? "every company"} search={search} submit={q => setQuery(prev => ({ ...prev, q }))} title="News feed" />;
}

function answer(error?: ApiRequestError) {
    vi.mocked(useV2NewsSearchInfinite).mockImplementation(({ q }) => ({ data: q && !error ? { pages: [newsSearchPage()] } : null, error: q ? error ?? null : null, isFetching: false, isLoading: false } as ReturnType<typeof useV2NewsSearchInfinite>));
}

describe("shared news view", () => {
    it("replaces the list on submit and returns to its page", () => {
        answer();

        render(<Harness />);

        fireEvent.change(screen.getByRole("textbox", { name: "Search the news" }), { target: { value: "Rubin" } });

        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(screen.queryByText("List controls")).toBeNull();

        expect(screen.getAllByTestId("news-hit")).toHaveLength(2);

        expect(screen.getByText("2 results for “Rubin” in every company")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Back to the list" }));

        expect(screen.getByText("List controls")).toBeTruthy();

        expect(screen.getByText("Page 2")).toBeTruthy();
    });

    it.each([["News search is not enabled", true], ["Search is temporarily unavailable", false]] as const)("handles %s", (message, off) => {
        answer(new ApiRequestError(503, { error: "unavailable", message }));

        render(<Harness initial={{ q: "Rubin" }} />);

        expect(Boolean(screen.queryByText("List controls"))).toBe(off);

        expect(screen.getByText(off ? "News search isn't switched on right now." : "The search took too long")).toBeTruthy();
    });

    it("guards exact market links and permits editing a valid query", () => {
        answer();

        render(<Harness initial={{ mode: "literal", q: "ai" }} />);

        expect(vi.mocked(useV2NewsSearchInfinite).mock.calls.at(-1)?.[0].q).toBe("");

        expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();

        fireEvent.change(screen.getByRole("textbox"), { target: { value: "income" } });

        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(vi.mocked(useV2NewsSearchInfinite).mock.calls.at(-1)?.[0].q).toBe("income");
    });

    it("clears only the search filters on reset while leaving the submitted query", () => {
        answer();

        render(<Harness initial={{ field: "title", from: "2026-09-01", mode: "literal", q: "Rubin" }} />);

        fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

        expect(vi.mocked(useV2NewsSearchInfinite).mock.calls.at(-1)?.[0]).toMatchObject({ field: undefined, from: undefined, mode: "lexical", q: "Rubin" });

        expect(screen.getByRole("region", { name: "News search results" })).toBeTruthy();
    });

    it("shows the plan gate and restores hits when the query succeeds after a timeout", () => {
        answer(new ApiRequestError(403, { error: "plan_required", message: "Upgrade" }));

        const { rerender } = render(<Harness initial={{ q: "Rubin" }} />);

        expect(screen.getByText("Your plan does not include news search")).toBeTruthy();

        answer(new ApiRequestError(503, { error: "unavailable", message: "Search is temporarily unavailable" }));

        rerender(<Harness initial={{ q: "Rubin" }} />);

        expect(screen.getByText("The search took too long")).toBeTruthy();

        answer();

        rerender(<Harness initial={{ q: "Rubin" }} />);

        expect(screen.queryByText("The search took too long")).toBeNull();

        expect(screen.getAllByTestId("news-hit")).toHaveLength(2);
    });
});
