// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SecSearchCoverage, V2FilingSearchHit, V2FilingSearchResponse } from "@/lib/api/types";

import { matchesText, SEC_SEARCH_OFF, SecFilingSearch, SecSearchResults } from "@/components/sec/sec-filing-search";
import { ApiRequestError } from "@/lib/api/errors";
import { useV2FilingSearchInfinite } from "@/lib/api/queries";
import { V2_FILING_SEARCH } from "@/lib/sec/v2-fixtures";

vi.mock("@/lib/api/queries", () => ({
    useV2DocumentFigure: vi.fn(),
    useV2DocumentVersion: vi.fn(),
    useV2FilingSearchInfinite: vi.fn(),
}));

afterEach(() => {
    cleanup();

    vi.mocked(useV2FilingSearchInfinite).mockReset();
});

const COMPLETE: SecSearchCoverage = {
    completeness: "complete",
    lexical: { failed: 0, indexed: 40, pending: 0, state: "ready" },
    reasons: [],
};

const HIT: V2FilingSearchHit = V2_FILING_SEARCH.data[0];

const page = (hits: Array<V2FilingSearchHit>, index: SecSearchCoverage, extra: Partial<V2FilingSearchResponse["meta"]> = {}): V2FilingSearchResponse => ({
    data: hits,
    has_more: false,
    meta: { coverage: { state: "complete" }, index, mode: "lexical", query: "supply chain", ...extra },
    next_cursor: null,
});

const results = (props: Partial<Parameters<typeof SecSearchResults>[0]>) => (
    <SecSearchResults
        error={null}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        onMore={() => undefined}
        onOpen={() => undefined}
        pages={[]}
        query="supply chain"
        {...props}
    />
);

describe("SecSearchResults", () => {
    it("503 unavailable (search switched off) is said, never an empty result", () => {
        const error = new ApiRequestError(503, { error: "unavailable", message: "Filing search is not switched on yet.", requestId: "req_1" });

        render(results({ error }));

        expect(screen.getByText(SEC_SEARCH_OFF)).toBeInTheDocument();

        expect(screen.queryByText("No passages found")).toBeNull();
    });

    it("hits name form, date and document; spans are marked exactly; a hit opens its cited block and links the original", () => {
        const onOpen = vi.fn();

        render(results({ onOpen, pages: [page([HIT], COMPLETE)] }));

        expect(screen.getByText("10-K · Oct 31, 2025 · aapl-20250927.htm")).toBeInTheDocument();

        // The relevance is in the match badge's tooltip, never printed beside the hit.
        expect(screen.queryByText("0.0128")).toBeNull();

        expect(screen.getByTitle("How the passage matched · relevance 0.0128")).toBeInTheDocument();

        expect(screen.getByText("supply", { selector: "mark" })).toBeInTheDocument();

        expect(screen.getByRole("link", { name: /Original/ })).toHaveAttribute(
            "href",
            "https://storage.invinite.com/sec/18cf21cf542b9c42832192ccfdaef882/aapl-20250927.htm",
        );

        fireEvent.click(screen.getByRole("button", { name: /Open cited passage/ }));

        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({
            blockId: "b00136",
            kind: "citation",
            versionId: "d7bbe5c0-8708-521f-a720-15ef6d1bd1fa",
        }));
    });

    it("a hit without a public original says so", () => {
        render(results({ pages: [page([{ ...HIT, citation: { ...HIT.citation, source: { url: null } } }], COMPLETE)] }));

        expect(screen.getByText("No public copy yet")).toBeInTheDocument();
    });

    it("a partial index with zero hits is not 'No passages found': the coverage note says why", () => {
        render(results({ pages: [page([], { completeness: "partial", lexical: null, reasons: ["not_projected", "held_gap"] })] }));

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText(/not indexed yet/)).toBeInTheDocument();

        expect(screen.getByText(/gaps/)).toBeInTheDocument();
    });

    it("a complete index with zero hits is a genuine no-result", () => {
        render(results({ pages: [page([], COMPLETE)] }));

        expect(screen.getByText("No passages found")).toBeInTheDocument();
    });

    it("a pending page (meta.coverage) shows its notice and no empty state", () => {
        render(results({ pages: [page([], COMPLETE, { coverage: { state: "pending" } })] }));

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText("No passages found")).toBeNull();
    });

    it("multi-page cursor: every page's hits, 'More results' while a cursor remains", () => {
        const onMore = vi.fn();

        const second = { ...HIT, text: "Second page passage about the supply chain." };

        render(results({ hasNextPage: true, onMore, pages: [{ ...page([HIT], COMPLETE), has_more: true, next_cursor: "c2" }, page([second], COMPLETE)] }));

        expect(screen.getAllByRole("listitem")).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: "More results" }));

        expect(onMore).toHaveBeenCalledOnce();
    });
});

describe("SecFilingSearch", () => {
    const idle = { data: null, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetching: false, isFetchingNextPage: false };

    it("sends lexical by default and literal + case_sensitive with Exact, scoped to the company", () => {
        vi.mocked(useV2FilingSearchInfinite).mockReturnValue(idle as unknown as ReturnType<typeof useV2FilingSearchInfinite>);

        render(<SecFilingSearch onOpen={() => undefined} symbol="AAPL" />);

        fireEvent.change(screen.getByLabelText("Search this company's SEC filings"), { target: { value: "going concern" } });

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({
            caseSensitive: undefined,
            mode: "lexical",
            q: "going concern",
            symbol: "AAPL",
        }));

        fireEvent.click(screen.getByRole("button", { name: "Exact" }));

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: true, mode: "literal" }));

        fireEvent.click(screen.getByRole("button", { name: "Match case" }));

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: false, mode: "literal" }));
    });

    it("without a symbol nothing can be submitted", () => {
        vi.mocked(useV2FilingSearchInfinite).mockReturnValue(idle as unknown as ReturnType<typeof useV2FilingSearchInfinite>);

        render(<SecFilingSearch onOpen={() => undefined} symbol="" />);

        fireEvent.change(screen.getByLabelText("Search this company's SEC filings"), { target: { value: "going concern" } });

        expect(screen.getByRole("button", { name: /Search/ })).toBeDisabled();

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ q: "" }));
    });
});

describe("market-wide search and filters (O7 group 3)", () => {
    const idle = { data: null, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetching: false, isFetchingNextPage: false };

    const CAPPED: SecSearchCoverage = {
        completeness: "partial",
        hint: "Add a company, a form or a filing-date range for a complete answer.",
        lexical: { failed: 0, indexed: 900000, pending: 0, state: "ready" },
        matches: {
            cap: 300,
            capped: true,
            complete_since: "2026-11-14",
            examined: 300,
            examined_in_scope: 290,
            filed_from: "2026-09-01",
            filed_to: "2026-11-19",
            narrow_with: ["company", "form", "filed_at"],
            order: "newest_first",
            total: null,
            total_at_least: 301,
            window_from: "2026-09-01",
        },
        reasons: ["too_many_matches"],
    };

    it("states the cap of a search without a company: examined, at least how many, the order and the hint", () => {
        render(results({ pages: [page([HIT], CAPPED)], renderFilingLink: accession => <a href={`/filings/${accession}`}>Filing</a> }));

        expect(screen.getByTestId("search-matches")).toHaveTextContent("Examined 300 of at least 301 matching passages (cap 300, newest filings first — complete since Nov 14, 2026). Filed Sep 1, 2026 to Nov 19, 2026.");

        expect(screen.getByText(CAPPED.hint ?? "")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "Filing" })).toHaveAttribute("href", "/filings/0000320193-25-000079");
    });

    it("an uncapped market-wide answer gives its total; a company search (matches null) shows no cap line", () => {
        if (!CAPPED.matches) throw new Error("fixture");

        expect(matchesText({ ...CAPPED.matches, capped: false, complete_since: null, total: 12, total_at_least: null })).toBe(
            "Examined 300 of 12 matching passages (cap 300, newest filings first). Filed Sep 1, 2026 to Nov 19, 2026.",
        );

        render(results({ pages: [page([HIT], COMPLETE)] }));

        expect(screen.queryByTestId("search-matches")).toBeNull();
    });

    it("marketWide without a symbol can submit; form, items and the date range are sent on Search only", () => {
        vi.mocked(useV2FilingSearchInfinite).mockReturnValue(idle as unknown as ReturnType<typeof useV2FilingSearchInfinite>);

        const onFiltersChange = vi.fn();

        render(<SecFilingSearch filters={{}} marketWide onFiltersChange={onFiltersChange} onOpen={() => undefined} symbol="" />);

        fireEvent.change(screen.getByLabelText("Search every filer's SEC filings"), { target: { value: "tariff" } });

        fireEvent.change(screen.getByLabelText("Form"), { target: { value: " 8-K " } });

        fireEvent.change(screen.getByLabelText("Section items"), { target: { value: "2.02" } });

        fireEvent.change(screen.getByLabelText("Search filed from"), { target: { value: "2026-11-01" } });

        // Typing a filter sends nothing (each search page is billed).
        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ form: undefined, marketWide: true, q: "" }));

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));

        expect(onFiltersChange).toHaveBeenCalledWith({ form: "8-K", from: "2026-11-01", item: "2.02", to: undefined });

        // One submit = one request with the query AND its filters (the URL's copy, still `{}` here, is not read).
        expect(vi.mocked(useV2FilingSearchInfinite).mock.calls.filter(([input]) => input.q === "tariff").map(([input]) => input))
            .toEqual([expect.objectContaining({ form: "8-K", from: "2026-11-01", item: "2.02", marketWide: true, q: "tariff", symbol: "" })]);
    });

    it("without onFiltersChange the box keeps the submitted filters itself", () => {
        vi.mocked(useV2FilingSearchInfinite).mockReturnValue(idle as unknown as ReturnType<typeof useV2FilingSearchInfinite>);

        render(<SecFilingSearch onOpen={() => undefined} symbol="SPY" />);

        fireEvent.change(screen.getByLabelText("Search this company's SEC filings"), { target: { value: "securities lending" } });

        fireEvent.change(screen.getByLabelText("Form"), { target: { value: "N-CSR" } });

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ form: "N-CSR", q: "securities lending", symbol: "SPY" }));
    });
});
