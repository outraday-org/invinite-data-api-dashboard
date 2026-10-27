// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EarningsSearchResponse, SearchCoverage } from "@/lib/api/types";

import { AskResults, SpanHighlightedText } from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

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
    match: { lexical_rank: 2, semantic_rank: 1, spans: [{ end: 12, start: 6 }], type: "hybrid" },
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
    semantic: { failed: 0, indexed: 2, pending: 0, state: "ready" },
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
    it("shows the match badge, the span and the hybrid score", () => {
        render(<AskResults data={{ coverage: coverage("complete"), hits: [HIT], mode: "hybrid", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("both")).toBeInTheDocument();

        expect(screen.getByText("margin", { selector: "mark" })).toBeInTheDocument();

        expect(screen.getByText("0.0325")).toBeInTheDocument();
    });

    it("badges a hybrid hit only one leg found by that leg and guesses the highlight from the query", () => {
        const semanticOnly = { ...HIT, match: { lexical_rank: null, semantic_rank: 1, spans: [], type: "semantic" as const } };

        render(<AskResults data={{ coverage: coverage("complete"), hits: [semanticOnly], mode: "hybrid", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("meaning")).toBeInTheDocument();

        expect(screen.queryByText("both")).toBeNull();

        // No server spans: the term guess marks the query word.
        expect(screen.getByText("margins", { selector: "mark" })).toBeInTheDocument();
    });

    it("explains unreadable coverage instead of an empty answer", () => {
        render(
            <AskResults
                data={{ coverage: { completeness: "unknown", lexical: null, reasons: ["coverage_unavailable"], semantic: null }, hits: [], mode: "hybrid", query: "margins" }}
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
            <AskResults data={{ coverage: coverage("complete"), hits: [], mode: "hybrid", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />,
        );

        expect(screen.getByText("No passages found")).toBeInTheDocument();

        rerender(
            <AskResults
                data={{ coverage: coverage("partial", ["semantic_backfill_pending"]), hits: [], mode: "hybrid", query: "margins" }}
                error={null}
                isLoading={false}
                scope={SCOPE}
            />,
        );

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText("Search index is still being built for this company — results may be incomplete")).toBeInTheDocument();

        rerender(<AskResults data={{ coverage: coverage("unknown"), hits: [], mode: "hybrid", query: "margins" }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText("Results may be incomplete")).toBeInTheDocument();
    });
});
