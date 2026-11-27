// @vitest-environment jsdom
import type * as React from "react";
import type * as Recharts from "recharts";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2InvestorDocumentResponse } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { AAPL_Q4_EVENT, EXPIRED_ESTIMATE_EVENT, MARKET_SEARCH_ANSWER, NVDA_REVENUE_HISTORY } from "@/lib/earnings/o7-earnings-fixtures";
import { CallHeader } from "@/routes/$ticker/earnings-calls/-components/call-header";
import { DocumentTextView } from "@/routes/$ticker/earnings-calls/-components/tabs/documents-tab";
import { KpiHistoryView } from "@/routes/$ticker/earnings-calls/-components/tabs/kpi-history-panel";
import { ComparisonView, PriorPicker } from "@/routes/$ticker/earnings-calls/-components/tabs/metrics-diff-tab";
import { SpeakerConfidenceBadge } from "@/routes/$ticker/earnings-calls/-components/tabs/transcript-turns";
import { exactTooShort, TranscriptSearchView, windowText } from "@/routes/search";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => () => ({}),
    Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

// Pure views only: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({}));

// The SEC panel is its own test (`sec-source-panel.test.tsx`); here only which filing the header opens.
vi.mock("@/components/sec/sec-source-panel", () => ({
    SecSourceDialog: ({ target }: { target: null | { accession: string } }) => (target ? <div data-testid="sec-dialog">{target.accession}</div> : null),
}));

// recharts measures its container; jsdom has none.
vi.mock("recharts", async (original) => {
    const actual = await original<typeof Recharts>();

    return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

afterEach(cleanup);

describe("KpiHistoryView", () => {
    it("lists every mention as said, plots one unit and names what stays in the table", () => {
        render(<KpiHistoryView company="NVDA" error={null} isLoading={false} mentions={NVDA_REVENUE_HISTORY} onSortChange={vi.fn()} sort="-conference_date" />);

        expect(screen.getByText("6 mentions on 4 calls")).toBeInTheDocument();

        // 4 usd mentions plotted; the pct one and the one without a value are table-only.
        expect(screen.getByRole("img", { name: "4 mentions plotted" })).toBeInTheDocument();

        expect(screen.getByText("2 mentions are in the table only (another unit, or no value).")).toBeInTheDocument();

        const rows = screen.getAllByRole("row").slice(1);

        expect(rows).toHaveLength(6);

        expect(within(rows[0]).getByText("$96 billion")).toBeInTheDocument();

        expect(within(rows[2]).getByText("Press release")).toBeInTheDocument();

        // The same words as the KPI table beside it (ORIGIN_LABELS): a call mention is "Transcript".
        expect(within(rows[0]).getByText("Transcript")).toBeInTheDocument();

        expect(within(rows[2]).getByRole("link", { name: "8-K" })).toHaveAttribute("href", expect.stringContaining("sec.gov"));
    });

    it("sends the order through onSortChange", () => {
        const onSortChange = vi.fn();

        render(<KpiHistoryView company="NVDA" error={null} isLoading={false} mentions={NVDA_REVENUE_HISTORY} onSortChange={onSortChange} sort="-conference_date" />);

        expect(screen.getByRole("button", { name: "Newest first" })).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", { name: "Oldest first" }));

        expect(onSortChange).toHaveBeenCalledWith("conference_date");
    });

    it("renders an empty history and an error as states", () => {
        const { rerender } = render(<KpiHistoryView company="NVDA" error={null} isLoading={false} mentions={[]} onSortChange={vi.fn()} sort="-conference_date" />);

        expect(screen.getByText("No history for this KPI")).toBeInTheDocument();

        rerender(<KpiHistoryView company="NVDA" error={new ApiRequestError(500, { error: "internal", message: "boom" })} isLoading={false} mentions={[]} onSortChange={vi.fn()} sort="-conference_date" />);

        expect(screen.getByText("Failed to load the KPI history")).toBeInTheDocument();
    });
});

describe("TranscriptSearchView (/search)", () => {
    it("shows a full page with each hit's company and says how to narrow", () => {
        render(<TranscriptSearchView data={MARKET_SEARCH_ANSWER} error={null} isLoading={false} search={{ q: "gross margin" }} />);

        expect(screen.getByText("8 results for “gross margin”")).toBeInTheDocument();

        expect(screen.getAllByText(/^WES · /)).toHaveLength(1);

        expect(screen.getByTestId("search-narrow")).toHaveTextContent("pages no further");
    });

    it("never sends an exact pattern the API refuses without a company", () => {
        expect(exactTooShort({ mode: "literal", q: "AI" })).toBe(true);

        expect(exactTooShort({ company: "NVDA", mode: "literal", q: "AI" })).toBe(false);

        expect(exactTooShort({ mode: "lexical", q: "AI" })).toBe(false);

        // Code points, not UTF-16 units: one emoji + one letter is 2.
        expect(exactTooShort({ mode: "literal", q: "📈A" })).toBe(true);

        render(<TranscriptSearchView data={null} error={null} isLoading={false} search={{ mode: "literal", q: "AI" }} />);

        expect(screen.getByText("Exact search needs 3 characters or a company")).toBeInTheDocument();
    });

    it("renders a 400 in the API's words", () => {
        const error = new ApiRequestError(400, { error: "invalid_parameter", message: "Query contains only stopwords" });

        render(<TranscriptSearchView data={null} error={error} isLoading={false} search={{ q: "the" }} />);

        expect(screen.getByText("Query contains only stopwords")).toBeInTheDocument();
    });

    it("says a timed-out search took too long and how to narrow it", () => {
        const error = new ApiRequestError(503, { error: "unavailable", message: "Search is temporarily unavailable." });

        render(<TranscriptSearchView data={null} error={error} isLoading={false} search={{ q: "revenue" }} />);

        expect(screen.getByText("The search took too long")).toBeInTheDocument();

        expect(screen.getByText(/narrow the search with a company/)).toBeInTheDocument();
    });

    it("keeps the API's words for a search that is switched off", () => {
        const error = new ApiRequestError(503, { error: "unavailable", message: "Transcript search is not enabled" });

        render(<TranscriptSearchView data={null} error={error} isLoading={false} search={{ q: "revenue" }} />);

        expect(screen.getByText("Transcript search is not enabled")).toBeInTheDocument();
    });

    it("states the call window, the API's 365-day default without a company", () => {
        expect(windowText({})).toBe("Calls of the last 365 days (the API's default window)");

        expect(windowText({ company: "AAPL,MSFT" })).toBe("Every call of the chosen companies");

        expect(windowText({ company: "NVDA" })).toBe("Every call of the company");

        expect(windowText({ from: "2026-10-01", to: "2026-11-21" })).toBe("Calls from Oct 1, 2026 to Nov 21, 2026");
    });
});

describe("ComparisonView + PriorPicker (Metrics & diff)", () => {
    it("shows the API's detail when the picked call is not the derived prior", () => {
        const error = new ApiRequestError(404, {
            error: "not_found",
            message: "Only the comparison with the previous call (b1dfd0fb-63d6-4d68-8d64-020588d4bbc0) is derived for this event.",
        });

        render(<ComparisonView data={null} error={error} isLoading={false} prior="474fd5cd-64b9-4f54-b0a9-d39f3c031648" symbol="NVDA" />);

        expect(screen.getByText("No comparison with this call")).toBeInTheDocument();

        expect(screen.getByText(/Only the comparison with the previous call/)).toBeInTheDocument();
    });

    it("keeps the default 404 (first call / not derived) a notice with the API's reason", () => {
        const error = new ApiRequestError(404, { error: "not_found", message: "No comparison for this event: no earlier call of this company to compare with." });

        render(<ComparisonView data={null} error={error} isLoading={false} symbol="AAPL" />);

        expect(screen.getByText("No comparison yet — the first call on record, or not derived yet")).toBeInTheDocument();

        expect(screen.getByText(/no earlier call of this company/)).toBeInTheDocument();
    });

    it("names the default and the picked call", () => {
        const { rerender } = render(<PriorPicker calls={[]} isLoading={false} onOpenChange={vi.fn()} onPriorChange={vi.fn()} prior={undefined} />);

        expect(screen.getByRole("button", { name: "Compare with" })).toHaveTextContent("Previous call");

        rerender(<PriorPicker calls={[AAPL_Q4_EVENT]} isLoading={false} onOpenChange={vi.fn()} onPriorChange={vi.fn()} prior={AAPL_Q4_EVENT.event_id} />);

        expect(screen.getByRole("button", { name: "Compare with" })).toHaveTextContent("Q4 FY2026 · Nov 2, 2026");
    });
});

describe("CallHeader (O7 group 5 facts)", () => {
    it("titles the call in sentence form, and names the company of a call under another symbol", () => {
        const { rerender } = render(<CallHeader event={AAPL_Q4_EVENT} pageSymbol="aapl" />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Q4 FY2026 earnings call");

        expect(screen.queryByText("Apple Inc. · AAPL")).toBeNull();

        rerender(<CallHeader event={AAPL_Q4_EVENT} pageSymbol="MSFT" />);

        expect(screen.getByText("Apple Inc. · AAPL")).toBeInTheDocument();
    });

    it("links the results filing and the periodic report", () => {
        render(<CallHeader event={AAPL_Q4_EVENT} />);

        expect(screen.getByText("SEC filing · high confidence")).toBeInTheDocument();

        // The filings sit in the "Details" disclosure, closed by default (ui-redesign task 10).
        const details = screen.getByRole("button", { name: "Details" });

        expect(details).toHaveAttribute("aria-expanded", "false");

        expect(screen.queryByText("Results filing")).toBeNull();

        fireEvent.click(details);

        expect(details).toHaveAttribute("aria-expanded", "true");

        expect(screen.getByText("Results filing")).toBeInTheDocument();

        expect(screen.getByText("period ending Sep 26, 2026 · filed Nov 3, 2026")).toBeInTheDocument();

        expect(screen.getAllByRole("link", { name: "EDGAR" })).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: "10-K" }));

        expect(screen.getByTestId("sec-dialog")).toHaveTextContent("0000320193-26-000026");
    });

    it("marks a low-confidence time and names why the row expired", () => {
        render(<CallHeader event={EXPIRED_ESTIMATE_EVENT} />);

        expect(screen.getByText("Estimate · low confidence")).toHaveAttribute("title", "The start time may still change");

        fireEvent.click(screen.getByRole("button", { name: "Details" }));

        expect(screen.getByText("Estimate replaced by the confirmed date")).toBeInTheDocument();

        expect(screen.queryByText("Results filing")).toBeNull();
    });
});

describe("SpeakerConfidenceBadge", () => {
    it("marks a named turn below 0.8, never an unnamed or unstated one", () => {
        const { rerender } = render(<SpeakerConfidenceBadge turn={{ name: "Jane Doe", speaker_confidence: 0.65 }} />);

        expect(screen.getByText("Speaker uncertain")).toHaveAttribute("title", expect.stringContaining("0.65"));

        rerender(<SpeakerConfidenceBadge turn={{ name: "Jane Doe", speaker_confidence: 0.9 }} />);

        expect(screen.queryByText("Speaker uncertain")).toBeNull();

        rerender(<SpeakerConfidenceBadge turn={{ name: null, speaker_confidence: 0.2 }} />);

        expect(screen.queryByText("Speaker uncertain")).toBeNull();

        rerender(<SpeakerConfidenceBadge turn={{ name: "Jane Doe", speaker_confidence: null }} />);

        expect(screen.queryByText("Speaker uncertain")).toBeNull();
    });
});

describe("DocumentTextView (call Documents tab, expand=pages)", () => {
    const doc = (patch: Partial<V2InvestorDocumentResponse>) => ({ body_text: null, pages: null, pages_url: null, ...patch }) as V2InvestorDocumentResponse;

    it("shows the text page by page, else the body, else the pages file", () => {
        const { rerender } = render(
            <DocumentTextView data={doc({ body_text: "all", pages: { pages: [{ n: 1, text: "First", title: "Cover" }, { n: 2, text: "Second" }] } as never })} error={null} isLoading={false} />,
        );

        expect(screen.getByRole("region", { name: "Page 1" })).toHaveTextContent("Page 1 · CoverFirst");

        expect(screen.queryByText("all")).toBeNull();

        rerender(<DocumentTextView data={doc({ body_text: "The whole text" })} error={null} isLoading={false} />);

        expect(screen.getByText("The whole text")).toBeInTheDocument();

        rerender(<DocumentTextView data={doc({ pages_url: "https://storage.example/pages.json" })} error={null} isLoading={false} />);

        expect(screen.getByRole("link", { name: "Open the per-page text (JSON)" })).toHaveAttribute("href", "https://storage.example/pages.json");
    });
});
