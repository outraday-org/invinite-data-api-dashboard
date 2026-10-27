// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EarningsDocumentSearchResponse, SearchCoverage } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { useEarningsDocumentSearch } from "@/lib/api/queries";
import { SEARCH_MODES } from "@/lib/earnings/labels";
import { DocumentSearch, DocumentSearchResults } from "@/routes/$ticker/documents/-components/document-search";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params, search, to }: {
        children: React.ReactNode;
        params: Record<string, string>;
        search?: Record<string, string>;
        to: string;
    }) => (
        <a data-search={JSON.stringify(search ?? {})} href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>
            {children}
        </a>
    ),
}));

// The results body is rendered with its data directly: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useEarningsDocumentSearch: vi.fn(),
    useEarningsSearch: vi.fn(),
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ seekMs: null }),
}));

afterEach(cleanup);

const HIT: EarningsDocumentSearchResponse["hits"][number] = {
    category: "reports",
    chunk_index: 3,
    cik: "0000000001",
    document_id: "00000000-0000-4000-8000-000000000001",
    event_id: null,
    expires_at: "2026-10-18T12:15:00.000Z",
    group: "reports/2025",
    group_label: "Reports 2025",
    heading: "Capital allocation",
    kind: "annual_report",
    match: { lexical_rank: 1, spans: [{ end: 22, start: 4 }], type: "lexical" },
    page: 14,
    period: "FY",
    score: 0.8123,
    section: "annual_reports",
    symbol: "ACME",
    table: "company_documents",
    text: "Our capital allocation priorities remain investment, dividends and buybacks.",
    text_truncated: false,
    title: "Annual Report 2025",
    url: "https://r2.example.com/docs/annual-report.pdf?X-Amz-Signature=secret",
    year: 2025,
};

const COMPLETE: SearchCoverage = {
    completeness: "complete",
    lexical: { failed: 0, indexed: 12, pending: 0, state: "ready" },
    reasons: [],
};

const answer = (
    hits: EarningsDocumentSearchResponse["hits"],
    query: string,
    coverage: SearchCoverage = COMPLETE,
    mode: EarningsDocumentSearchResponse["mode"] = "lexical",
): EarningsDocumentSearchResponse => ({ coverage, hits, mode, query });

describe("DocumentSearchResults", () => {
    it("shows each passage with its document, year and page and opens the PDF at that page", () => {
        render(<DocumentSearchResults data={answer([HIT], "capital allocation")} error={null} isLoading={false} mode="lexical" />);

        expect(screen.getByText("Annual Report 2025 · 2025 · p. 14")).toBeInTheDocument();

        expect(screen.getByText("annual report")).toBeInTheDocument();

        expect(screen.getByText("keyword")).toBeInTheDocument();

        // The server's span is highlighted as one mark, not the query's terms one by one.
        expect(screen.getByText("capital allocation", { selector: "mark" })).toBeInTheDocument();

        expect(screen.queryByText("capital", { selector: "mark" })).toBeNull();

        const open = screen.getByRole("link", { name: "Open page" });

        expect(open).toHaveAttribute("href", `${HIT.url}#page=14`);

        expect(open).toHaveAttribute("rel", "noopener noreferrer");

        expect(screen.queryByText("Open event")).toBeNull();
    });

    it("links a call document's event and says when no file is stored", () => {
        const hit = {
            ...HIT,
            event_id: "11111111-1111-4111-8111-111111111111",
            page: null,
            table: "event_documents" as const,
            title: null,
            url: null,
            year: null,
        };

        render(<DocumentSearchResults data={answer([hit], "dividends")} error={null} isLoading={false} mode="lexical" />);

        expect(screen.getByText("Untitled document · undated")).toBeInTheDocument();

        expect(screen.getByText("No stored file")).toBeInTheDocument();

        expect(screen.getByText("Open event")).toHaveAttribute("href", "/ACME/earnings-calls/11111111-1111-4111-8111-111111111111");
    });

    it("renders empty answers and the plan gate as states", () => {
        const { rerender } = render(<DocumentSearchResults data={answer([], "x")} error={null} isLoading={false} mode="lexical" />);

        expect(screen.getByText("No passages found")).toBeInTheDocument();

        rerender(<DocumentSearchResults data={null} error={new ApiRequestError(403, { error: "Forbidden", message: "This endpoint requires STANDARD plan." })} isLoading={false} mode="lexical" />);

        expect(screen.getByText("Your plan does not include document search")).toBeInTheDocument();

        expect(screen.getByText("STANDARD")).toBeInTheDocument();
    });

    it("falls back to term highlighting for a hit without spans and notes failed passages", () => {
        const hit = { ...HIT, match: { lexical_rank: 1, spans: [], type: "lexical" as const } };

        const coverage: SearchCoverage = {
            completeness: "partial",
            lexical: { failed: 2, indexed: 10, pending: 0, state: "partial" },
            reasons: ["projection_failed"],
        };

        render(<DocumentSearchResults data={answer([hit], "capital allocation", coverage)} error={null} isLoading={false} mode="lexical" />);

        expect(screen.getByText("keyword")).toBeInTheDocument();

        expect(screen.getByText("capital", { selector: "mark" })).toBeInTheDocument();

        expect(screen.getByText("Some passages could not be indexed — results may be incomplete")).toBeInTheDocument();
    });

    it("never reads a bare \"No passages found\" when coverage is partial", () => {
        const coverage: SearchCoverage = {
            completeness: "partial",
            lexical: { failed: 0, indexed: 3, pending: 9, state: "partial" },
            reasons: ["lexical_backfill_pending"],
        };

        render(<DocumentSearchResults data={answer([], "buybacks", coverage)} error={null} isLoading={false} mode="lexical" />);

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText("Search index is still being built for this company — results may be incomplete")).toBeInTheDocument();
    });

    it("names the exact-search scope rule on a 400 under Exact, else shows the API's message", () => {
        const error = new ApiRequestError(400, { error: "Bad Request", message: "pattern too short" });

        const { rerender } = render(<DocumentSearchResults data={null} error={error} isLoading={false} mode="literal" />);

        expect(screen.getByText("Exact search needs 3 characters or a company")).toBeInTheDocument();

        rerender(<DocumentSearchResults data={null} error={error} isLoading={false} mode="lexical" />);

        expect(screen.getByText("pattern too short")).toBeInTheDocument();
    });
});

describe("DocumentSearch", () => {
    it("defaults to Keyword and re-runs the submitted query with a new mode", () => {
        const search = vi.mocked(useEarningsDocumentSearch);

        search.mockReturnValue({ data: null, error: null, isFetching: false } as unknown as ReturnType<typeof useEarningsDocumentSearch>);

        render(<DocumentSearch identifier="ACME" />);

        expect(screen.getByRole("button", { name: "Keyword" })).toHaveAttribute("aria-pressed", "true");

        fireEvent.change(screen.getByLabelText("Search this company's documents"), { target: { value: "FY2027" } });

        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: undefined, mode: "lexical", q: "FY2027" }));

        // "Match case" belongs to Exact only.
        expect(screen.queryByRole("button", { name: "Match case" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Exact" }));

        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: "true", mode: "literal", q: "FY2027" }));

        fireEvent.click(screen.getByRole("button", { name: "Match case" }));

        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: "false", mode: "literal", q: "FY2027" }));

        fireEvent.click(screen.getByRole("button", { name: "Keyword" }));

        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ caseSensitive: undefined, mode: "lexical", q: "FY2027" }));
    });

    it("offers only the Keyword and Exact chips (no meaning or hybrid mode)", () => {
        vi.mocked(useEarningsDocumentSearch).mockReturnValue({ data: null, error: null, isFetching: false } as unknown as ReturnType<typeof useEarningsDocumentSearch>);

        render(<DocumentSearch identifier="ACME" />);

        expect(screen.getByRole("button", { name: "Keyword" })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Exact" })).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: "Hybrid" })).toBeNull();

        expect(screen.queryByRole("button", { name: "Meaning" })).toBeNull();

        expect(SEARCH_MODES).toEqual(["lexical", "literal"]);
    });
});
