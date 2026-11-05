// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SecSearchCoverage, SecSearchHit, SecSearchResponse } from "@/lib/api/types";

import { SEC_SEARCH_OFF, SecFilingSearch, SecSearchResults } from "@/components/sec/sec-filing-search";
import { ApiRequestError } from "@/lib/api/errors";
import { useSecSearchInfinite } from "@/lib/api/queries";

vi.mock("@/lib/api/queries", () => ({
    useSecDocumentBlocks: vi.fn(),
    useSecFigure: vi.fn(),
    useSecFilingManifest: vi.fn(),
    useSecSearchInfinite: vi.fn(),
}));

afterEach(() => {
    cleanup();

    vi.mocked(useSecSearchInfinite).mockReset();
});

const COMPLETE: SecSearchCoverage = { completeness: "complete", lexical: { failed: 0, indexed: 40, pending: 0, state: "ready" }, reasons: [] };

const HIT: SecSearchHit = {
    accession: "0000320193-26-000026",
    citation: { accession: "0000320193-26-000026", source: null, version_id: "v-10k" },
    cited: [{ citation: { block_id: "b00412", page: 18, printed: "18", version_id: "v-10k" }, id: "b00412", page: { ordinal: 18, printed: "18" } }],
    filename: "aapl-20260926.htm",
    filer: { cik: "320193", name: "Apple Inc." },
    filing_date: "2026-11-03",
    form: "10-K",
    match: { lexical_rank: 1, spans: [{ end: 16, start: 4 }], type: "lexical" },
    score: 0.0123,
    text: "The supply chain is concentrated in a few regions.",
    version_id: "v-10k",
};

const page = (hits: Array<SecSearchHit>, coverage: SecSearchCoverage, extra: Partial<SecSearchResponse> = {}): SecSearchResponse => ({
    api_schema: "secdoors.v1",
    coverage,
    hits,
    mode: "lexical",
    next_cursor: null,
    readiness: { reason: null, recoverable: false, status: "ready" },
    ...extra,
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
    it("503 not_ready (search switched off) is said, never an empty result", () => {
        const error = new ApiRequestError(503, {
            code: "search_provider_not_registered",
            error: "not_ready",
            message: "This SEC store capability is not switched on yet.",
            readiness: { reason: "search_provider_not_registered", status: "not_ready" },
        });

        render(results({ error }));

        expect(screen.getByText(SEC_SEARCH_OFF)).toBeInTheDocument();

        expect(screen.queryByText("No passages found")).toBeNull();
    });

    it("hits name filer, form, date, document and page; spans are marked exactly; a hit opens its cited block", () => {
        const onOpen = vi.fn();

        render(results({ onOpen, pages: [page([HIT], COMPLETE)] }));

        expect(screen.getByText("Apple Inc. · 10-K · 2026-11-03 · aapl-20260926.htm · p. 18 (ordinal)")).toBeInTheDocument();

        expect(screen.getByText("supply chain", { selector: "mark" })).toBeInTheDocument();

        expect(screen.getByText("No public copy yet")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Open cited passage/ }));

        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ blockId: "b00412", kind: "citation", versionId: "v-10k" }));
    });

    it("partial coverage with zero hits is not 'No passages found': the coverage note says why", () => {
        render(results({ pages: [page([], { completeness: "partial", lexical: null, reasons: ["not_projected", "held_gap"] })] }));

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText(/not indexed yet/)).toBeInTheDocument();

        expect(screen.getByText(/gaps/)).toBeInTheDocument();
    });

    it("complete coverage with zero hits is a genuine no-result", () => {
        render(results({ pages: [page([], COMPLETE)] }));

        expect(screen.getByText("No passages found")).toBeInTheDocument();
    });

    it("a pending answer (202) shows its notice and no empty state", () => {
        render(results({ pages: [page([], COMPLETE, { readiness: { reason: "documents_not_held", recoverable: true, status: "pending" } })] }));

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText("No passages found")).toBeNull();
    });

    it("multi-page cursor: every page's hits, 'More results' while a cursor remains", () => {
        const onMore = vi.fn();

        const second = { ...HIT, text: "Second page passage about the supply chain." };

        render(results({ hasNextPage: true, onMore, pages: [page([HIT], COMPLETE, { next_cursor: "c2" }), page([second], COMPLETE)] }));

        expect(screen.getAllByRole("listitem")).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: "More results" }));

        expect(onMore).toHaveBeenCalledOnce();
    });
});

describe("SecFilingSearch", () => {
    const idle = { data: null, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetching: false, isFetchingNextPage: false };

    it("sends lexical by default and literal + case_sensitive with Exact, scoped to the CIK", () => {
        vi.mocked(useSecSearchInfinite).mockReturnValue(idle as unknown as ReturnType<typeof useSecSearchInfinite>);

        render(<SecFilingSearch cik="320193" onOpen={() => undefined} />);

        fireEvent.change(screen.getByLabelText("Search this company's SEC filings"), { target: { value: "going concern" } });

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));

        expect(vi.mocked(useSecSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({
            caseSensitive: undefined,
            cik: "320193",
            mode: "lexical",
            q: "going concern",
        }));

        fireEvent.click(screen.getByRole("button", { name: "Exact" }));

        expect(vi.mocked(useSecSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: "true", mode: "literal" }));

        fireEvent.click(screen.getByRole("button", { name: "Match case" }));

        expect(vi.mocked(useSecSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: "false", mode: "literal" }));
    });

    it("without a CIK nothing is searched", () => {
        vi.mocked(useSecSearchInfinite).mockReturnValue(idle as unknown as ReturnType<typeof useSecSearchInfinite>);

        render(<SecFilingSearch cik={null} onOpen={() => undefined} />);

        expect(screen.getByRole("button", { name: /Search/ })).toBeDisabled();

        expect(vi.mocked(useSecSearchInfinite)).toHaveBeenLastCalledWith(expect.objectContaining({ q: "" }));
    });
});
