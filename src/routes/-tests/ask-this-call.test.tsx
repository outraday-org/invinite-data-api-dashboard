// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EarningsSearchResponse, SearchCoverage } from "@/lib/api/types";

import { useEarningsSearch } from "@/lib/api/queries";
import { AskResults, AskThisCall, SpanHighlightedText } from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

// The results body is rendered with its data directly: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useEarningsDocumentSearch: vi.fn(),
    useEarningsSearch: vi.fn(),
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ loaded: false, playUrl: vi.fn(), seekMs: null }),
}));

afterEach(cleanup);

const SCOPE = { eventId: "11111111-1111-4111-8111-111111111111", kind: "event", onJumpToTranscript: vi.fn() } as const;

const HIT: EarningsSearchResponse["hits"][number] = {
    audio_url: null,
    chunk_index: 7,
    cik: "0000000001",
    conference_date: "2026-10-20",
    end_ms: 65_000,
    event_id: SCOPE.eventId,
    fiscal_quarter: 3,
    fiscal_year: 2026,
    match: { lexical_rank: 1, spans: [{ end: 12, start: 6 }], type: "lexical" },
    score: 0.032_522,
    slide: null,
    speaker: { label: null, name: "Jane Doe", title: "CFO" },
    start_ms: 60_000,
    symbol: "ACME",
    text: "📈 Our margins expanded.",
    text_truncated: false,
    type: "qa",
};

const coverage = (completeness: SearchCoverage["completeness"], reasons: SearchCoverage["reasons"] = []): SearchCoverage => ({
    completeness,
    lexical: { failed: 0, indexed: 2, pending: completeness === "complete" ? 0 : 1, state: completeness === "complete" ? "ready" : "partial" },
    reasons,
});

describe("SpanHighlightedText", () => {
    // "📈" is one code point but two UTF-16 units: offsets applied with string.slice would mark " margi".
    it("marks code-point spans exactly with an emoji before the match", () => {
        const { container } = render(<SpanHighlightedText spans={[{ end: 12, start: 6 }]} text="📈 Our margins expanded." />);

        expect(screen.getByText("margin", { selector: "mark" })).toBeInTheDocument();

        expect(container.querySelector("p")).toHaveTextContent("📈 Our margins expanded.");
    });
});

describe("AskResults", () => {
    it("shows the match badge, the span and the 4-decimal keyword score", () => {
        render(<AskResults data={{ coverage: coverage("complete"), hits: [HIT], mode: "lexical", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("keyword")).toBeInTheDocument();

        expect(screen.getByText("margin", { selector: "mark" })).toBeInTheDocument();

        expect(screen.getByText("0.0325")).toBeInTheDocument();
    });

    it("guesses the highlight from the query for a keyword hit without spans (an attached answer)", () => {
        const attachedAnswer = { ...HIT, match: { lexical_rank: 2, spans: [], type: "lexical" as const } };

        render(<AskResults data={{ coverage: coverage("complete"), hits: [attachedAnswer], mode: "lexical", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("keyword")).toBeInTheDocument();

        // No server spans: the term guess marks the query word.
        expect(screen.getByText("margins", { selector: "mark" })).toBeInTheDocument();
    });

    it("badges an exact hit and shows no score for literal", () => {
        const exact = { ...HIT, match: { lexical_rank: 1, spans: [{ end: 14, start: 6 }], type: "literal" as const }, score: 0 };

        render(<AskResults data={{ coverage: coverage("complete"), hits: [exact], mode: "literal", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("exact")).toBeInTheDocument();

        expect(screen.queryByTitle("Relevance score")).toBeNull();
    });

    it("explains unreadable coverage instead of an empty answer", () => {
        render(
            <AskResults
                data={{ coverage: { completeness: "unknown", lexical: null, reasons: ["coverage_unavailable"] }, hits: [], mode: "lexical", query: "margins" }}
                error={null}
                isLoading={false}
                scope={SCOPE}
            />,
        );

        expect(screen.getByText("Search coverage could not be checked — results may be incomplete")).toBeInTheDocument();

        expect(screen.queryByText("No passages found")).toBeNull();
    });

    it("reads \"No passages found\" only with complete coverage", () => {
        const { rerender } = render(
            <AskResults data={{ coverage: coverage("complete"), hits: [], mode: "lexical", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />,
        );

        expect(screen.getByText("No passages found")).toBeInTheDocument();

        rerender(
            <AskResults
                data={{ coverage: coverage("partial", ["lexical_backfill_pending"]), hits: [], mode: "lexical", query: "margins" }}
                error={null}
                isLoading={false}
                scope={SCOPE}
            />,
        );

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText("Search index is still being built for this company — results may be incomplete")).toBeInTheDocument();

        rerender(<AskResults data={{ coverage: coverage("unknown"), hits: [], mode: "lexical", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText("Results may be incomplete")).toBeInTheDocument();
    });
});

describe("AskThisCall", () => {
    it("is a keyword search box: \"Search this call\" sends mode=lexical on submit, never another mode", () => {
        const search = vi.mocked(useEarningsSearch).mockReturnValue({ data: null, error: null, isFetching: false } as unknown as ReturnType<typeof useEarningsSearch>);

        render(<AskThisCall scope={SCOPE} />);

        fireEvent.change(screen.getByRole("textbox", { name: "Search this call" }), { target: { value: "gross margin" } });

        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ eventId: SCOPE.eventId, mode: "lexical", q: "gross margin" }));

        expect(search.mock.calls.every(([input]) => input.mode === "lexical")).toBe(true);
    });
});
