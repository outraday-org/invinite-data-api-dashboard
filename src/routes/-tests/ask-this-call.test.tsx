// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SearchCoverage, V2TranscriptSearchHit, V2TranscriptSearchResponse } from "@/lib/api/types";

import { useV2TranscriptSearch } from "@/lib/api/queries";
import { AskResults, AskThisCall, SpanHighlightedText } from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

// The results body is rendered with its data directly: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useV2InvestorDocumentSearch: vi.fn(),
    useV2Participants: () => ({ data: null }),
    useV2TranscriptSearch: vi.fn(),
}));

const callAudio = vi.hoisted(() => ({ loaded: false, playUrl: vi.fn(), seekMs: vi.fn() }));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ canSeek: true, ...callAudio }),
}));

// No call player is mounted in these tests (the calls list has none): any reach for it fails the test.
const usePlayerThrows = vi.hoisted(() => () => {
    throw new Error("usePlayer must be used inside CallPlayerProvider");
});

vi.mock("@/lib/player/player-context", () => ({
    usePlayer: usePlayerThrows,
}));

afterEach(cleanup);

const SCOPE = { eventId: "11111111-1111-4111-8111-111111111111", kind: "event", onJumpToTranscript: vi.fn() } as const;

const HIT: V2TranscriptSearchHit = {
    audio_url: null,
    chunk_index: 7,
    cik: "0000000001",
    conference_date: "2026-10-20T21:00:00.000Z",
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

/** A v2 answer: one page of hits, the index coverage in `meta.index`, the query in `meta.query`. */
const answer = (index: SearchCoverage, hits: Array<V2TranscriptSearchHit>): V2TranscriptSearchResponse => ({
    data: hits,
    has_more: false,
    meta: { index, query: "margins" },
    next_cursor: null,
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
    it("reads \"No passages found\" when the answer carries no index coverage", () => {
        render(<AskResults data={{ data: [], has_more: false, meta: {}, next_cursor: null }} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("No passages found")).toBeInTheDocument();
    });

    it("shows the match badge (the 4-decimal keyword score in its tooltip), the span and the speaker header", () => {
        render(<AskResults data={answer(coverage("complete"), [HIT])} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("keyword")).toHaveAttribute("title", "How the passage matched · relevance 0.0325");

        expect(screen.queryByText("0.0325")).toBeNull();

        expect(screen.getByText("margin", { selector: "mark" })).toBeInTheDocument();

        // `TurnHeader`: initials (no image), name, title, m:ss.
        expect(screen.getByText("JD")).toBeInTheDocument();

        expect(screen.getByText("Jane Doe")).toBeInTheDocument();

        expect(screen.getByText("CFO")).toBeInTheDocument();

        expect(screen.getByText("1:00")).toBeInTheDocument();

        expect(screen.getByText("1 result for “margins”")).toBeInTheDocument();
    });

    it("collapses and expands the results under a header that stays, and clears", () => {
        const onExpandedChange = vi.fn();

        const onClear = vi.fn();

        const props = { data: answer(coverage("complete"), [HIT]), error: null, isLoading: false, onClear, onExpandedChange, scope: SCOPE };

        const { container, rerender } = render(<AskResults {...props} expanded />);

        const toggle = screen.getByRole("button", { name: "1 result for “margins”" });

        expect(toggle).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(toggle);

        expect(onExpandedChange).toHaveBeenCalledWith(false);

        rerender(<AskResults {...props} expanded={false} />);

        expect(screen.getByRole("button", { name: "1 result for “margins”" })).toHaveAttribute("aria-expanded", "false");

        expect(container.querySelector("ul")?.closest("[hidden]")).not.toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Clear the search" }));

        expect(onClear).toHaveBeenCalled();
    });

    it("plays a hit with audio AND scrolls the transcript to it, then collapses", () => {
        const onJumpToTranscript = vi.fn();

        const onPlayed = vi.fn();

        const withAudio = { ...HIT, audio_url: "https://storage.example.com/calls/t/file.mp3#t=60" };

        render(
            <AskResults
                data={answer(coverage("complete"), [withAudio])}
                error={null}
                isLoading={false}
                onPlayed={onPlayed}
                scope={{ ...SCOPE, onJumpToTranscript }}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Play from here" }));

        expect(callAudio.playUrl).toHaveBeenCalledWith(withAudio.audio_url);

        expect(onJumpToTranscript).toHaveBeenCalledWith(60_000, { quiet: true });

        expect(onPlayed).toHaveBeenCalled();

        // The header's ▷ m:ss is the same action.
        fireEvent.click(screen.getByRole("button", { name: "Play from 1:00" }));

        expect(onJumpToTranscript).toHaveBeenCalledTimes(2);
    });

    it("guesses the highlight from the query for a keyword hit without spans (an attached answer)", () => {
        const attachedAnswer = { ...HIT, match: { lexical_rank: 2, spans: [], type: "lexical" as const } };

        render(<AskResults data={answer(coverage("complete"), [attachedAnswer])} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("keyword")).toBeInTheDocument();

        // No server spans: the term guess marks the query word.
        expect(screen.getByText("margins", { selector: "mark" })).toBeInTheDocument();
    });

    it("badges an exact hit and shows no score for literal", () => {
        const exact = { ...HIT, match: { lexical_rank: 1, spans: [{ end: 14, start: 6 }], type: "literal" as const }, score: 0 };

        render(<AskResults data={answer(coverage("complete"), [exact])} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.getByText("exact")).toBeInTheDocument();

        expect(screen.queryByTitle("Relevance score")).toBeNull();
    });

    it("explains unreadable coverage instead of an empty answer", () => {
        render(
            <AskResults
                data={answer({ completeness: "unknown", lexical: null, reasons: ["coverage_unavailable"] }, [])}
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
            <AskResults data={answer(coverage("complete"), [])} error={null} isLoading={false} scope={SCOPE} />,
        );

        expect(screen.getByText("No passages found")).toBeInTheDocument();

        rerender(
            <AskResults
                data={answer(coverage("partial", ["lexical_backfill_pending"]), [])}
                error={null}
                isLoading={false}
                scope={SCOPE}
            />,
        );

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText("Search index is still being built for this company — results may be incomplete")).toBeInTheDocument();

        rerender(<AskResults data={answer(coverage("unknown"), [])} error={null} isLoading={false} scope={SCOPE} />);

        expect(screen.queryByText("No passages found")).toBeNull();

        expect(screen.getByText("Results may be incomplete")).toBeInTheDocument();
    });
});

describe("AskResults (company scope)", () => {
    it("renders hits without a call player, untimed ones too", () => {
        const company = { identifier: "ACME", kind: "company" } as const;

        render(<AskResults data={answer(coverage("complete"), [HIT, { ...HIT, match: { ...HIT.match, spans: [] }, start_ms: null, text: "Untimed passage" }])} error={null} isLoading={false} scope={company} />);

        expect(screen.getAllByText("Jane Doe")).toHaveLength(2);

        expect(screen.getByText("1:00")).toBeInTheDocument();

        expect(screen.getByText("Untimed passage")).toBeInTheDocument();
    });
});

describe("AskThisCall", () => {
    it("is a keyword search box: \"Search this call\" sends mode=lexical on submit, never another mode", () => {
        const search = vi.mocked(useV2TranscriptSearch).mockReturnValue({ data: null, error: null, isFetching: false } as unknown as ReturnType<typeof useV2TranscriptSearch>);

        render(<AskThisCall scope={SCOPE} />);

        fireEvent.change(screen.getByRole("textbox", { name: "Search this call" }), { target: { value: "gross margin" } });

        fireEvent.click(screen.getByRole("button", { name: /^Search/ }));

        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ event: SCOPE.eventId, mode: "lexical", q: "gross margin" }));

        expect(search.mock.calls.every(([input]) => input.mode === "lexical")).toBe(true);
    });
});
