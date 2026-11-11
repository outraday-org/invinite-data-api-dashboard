// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SecSearchCoverage, V2FilingSearchHit, V2FilingSearchResponse } from "@/lib/api/types";

import { SEC_SEARCH_OFF, SecFilingSearch, SecSearchResults } from "@/components/sec/sec-filing-search";
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

        expect(screen.getByText("10-K · 2025-10-31 · aapl-20250927.htm")).toBeInTheDocument();

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

        render(<SecFilingSearch company="AAPL" onOpen={() => undefined} />);

        fireEvent.change(screen.getByLabelText("Search this company's SEC filings"), { target: { value: "going concern" } });

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({
            caseSensitive: undefined,
            company: "AAPL",
            mode: "lexical",
            q: "going concern",
        }));

        fireEvent.click(screen.getByRole("button", { name: "Exact" }));

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: true, mode: "literal" }));

        fireEvent.click(screen.getByRole("button", { name: "Match case" }));

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: false, mode: "literal" }));
    });

    it("without a company nothing can be submitted", () => {
        vi.mocked(useV2FilingSearchInfinite).mockReturnValue(idle as unknown as ReturnType<typeof useV2FilingSearchInfinite>);

        render(<SecFilingSearch company="" onOpen={() => undefined} />);

        fireEvent.change(screen.getByLabelText("Search this company's SEC filings"), { target: { value: "going concern" } });

        expect(screen.getByRole("button", { name: /Search/ })).toBeDisabled();

        expect(vi.mocked(useV2FilingSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ q: "" }));
    });
});
