import type * as React from "react";

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ListState } from "@/lib/api/list-state";

import { ApiRequestError } from "@/lib/api/errors";
import { mergeLatest } from "@/lib/live/live-filings";
import {
    DATASETS,
    DOCUMENT_SECTIONS,
    FACT_PLACES,
    FILING_FACTS,
    FILING_FACTS_PENDING,
    FILING_HOLDINGS_13F,
    FILING_NOTES,
    FILING_PARTIES,
    LIVE_FILING,
    LIVE_FILING_S1,
    REVIEW_CHAIN_ALONE,
    REVIEW_CHAIN_LETTERS,
} from "@/lib/sec/filing-detail-fixtures";
import { V2_FILING_PRE_IPO, V2_FILINGS, V2_LATEST_FILINGS } from "@/lib/sec/v2-fixtures";
import {
    DocumentSectionsView,
    factPeriodText,
    FactPlacesView,
    FilingFactsView,
    FilingHoldingsView,
    FilingNotesView,
    FilingPartiesView,
    hasFiledHoldings,
    itemText,
    ReviewChainView,
    sectionStartBlock,
} from "@/routes/filings/-components/filing-detail-views";
import { latestEmptyText, LatestFilingsView } from "@/routes/filings/index";
import { SecDatasetsView } from "@/routes/sec/datasets";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => () => ({}),
    Link: ({ children, params = {}, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

// Pure views: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({}));

afterEach(cleanup);

function state<TPage>(pages: Array<TPage>, extra: Partial<ListState<TPage>> = {}): ListState<TPage> {
    return {
        error: null,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        onLoadMore: () => undefined,
        pages,
        ...extra,
    };
}

const ACCESSION = "0000320193-26-000020";

describe("filing page tabs", () => {
    it("sections pending is preparation, while a known version without an outline is a covered empty state", () => {
        const onOpenBlock = vi.fn();

        const { rerender } = render(
            <DocumentSectionsView
                onOpenBlock={onOpenBlock}
                state={state([
                    { ...DOCUMENT_SECTIONS, data: [], meta: { coverage: { reason: "sections_not_projected", state: "pending" } } },
                ])}
            />,
        );

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText("This document has no sections in this outline.")).toBeNull();

        rerender(
            <DocumentSectionsView
                onOpenBlock={onOpenBlock}
                state={state([
                    { ...DOCUMENT_SECTIONS, data: [], meta: { coverage: { reason: "no_legacy_outline", state: "complete" } } },
                ])}
            />,
        );

        expect(screen.getByText("Document available; no item outline")).toBeInTheDocument();

        expect(screen.getByText(/This version is known to the store/)).toBeInTheDocument();

        expect(screen.queryByText("Not known to the SEC store")).toBeNull();

        expect(screen.queryByText("Failed to load the sections")).toBeNull();
    });

    it("Facts: concept, value as filed (nil stated), period, dimensions; 'Load more' by cursor", () => {
        render(<FilingFactsView accession={ACCESSION} state={state([FILING_FACTS], { hasNextPage: true })} />);

        expect(screen.getByText("AccountsPayableCurrent")).toBeInTheDocument();

        expect(screen.getByText("64,525,000,000")).toBeInTheDocument();

        expect(screen.getByText("nil")).toBeInTheDocument();

        expect(screen.getByText("Mar 29, 2026 – Jun 27, 2026")).toBeInTheDocument();

        expect(screen.getByText("srt:ProductOrServiceAxis = us-gaap:ProductMember")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument();
    });

    it("Facts pending (the data set release is not out yet) is a notice, never 'no facts'", () => {
        render(<FilingFactsView accession={ACCESSION} state={state([FILING_FACTS_PENDING])} />);

        expect(screen.queryByText("This filing states no numeric facts.")).toBeNull();

        expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("a 404 not_covered filing is its state", () => {
        const error = new ApiRequestError(404, { error: "not_covered", message: "Filing 0001193125-26-463399 is not in the SEC registry.", requestId: "req_1" });

        render(<FilingFactsView accession={ACCESSION} state={state([], { error })} />);

        expect(screen.getByText(/not in the SEC registry|not covered/i)).toBeInTheDocument();
    });

    it("Notes: a long text block is cut until 'Show all'", () => {
        render(<FilingNotesView accession={ACCESSION} state={state([FILING_NOTES])} />);

        expect(screen.getByText("Period end Jun 27, 2026")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Show all" }));

        expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
    });

    it("Holdings of a 13F-HR: the line as filed with discretion and voting authority", () => {
        render(<FilingHoldingsView accession="0001193125-26-352200" state={state([FILING_HOLDINGS_13F])} />);

        expect(screen.getByText("MOODYS CORP")).toBeInTheDocument();

        expect(screen.getByText("13F information table, lines as filed (no issuer resolution).")).toBeInTheDocument();

        expect(screen.getByText("DFND")).toBeInTheDocument();

        expect(screen.getByText("11,973,928 / 0 / 0")).toBeInTheDocument();

        expect(screen.getByText("$5,423,231,470")).toBeInTheDocument();
    });

    it("only 13F-HR and NPORT-P filings have the Holdings tab", () => {
        expect(hasFiledHoldings("13F-HR")).toBe(true);

        expect(hasFiledHoldings("13F-HR/A")).toBe(true);

        expect(hasFiledHoldings("NPORT-P")).toBe(true);

        expect(hasFiledHoldings("13F-NT")).toBe(false);

        expect(hasFiledHoldings("10-K")).toBe(false);

        expect(hasFiledHoldings(null)).toBe(false);
    });

    it("Sections: a heading opens the reader at its first block", () => {
        const onOpenBlock = vi.fn();

        render(<DocumentSectionsView onOpenBlock={onOpenBlock} state={state([DOCUMENT_SECTIONS])} />);

        fireEvent.click(screen.getByRole("button", { name: "Risk Factors" }));

        expect(onOpenBlock).toHaveBeenCalledWith("b00107");

        expect(screen.getByText("Part II · Item 1A")).toBeInTheDocument();

        expect(sectionStartBlock({ blocks: [] })).toBeNull();

        // The legacy outline's ids already read "Item 1." (F042).
        expect(itemText("Item 1.")).toBe("Item 1.");

        expect(itemText("1A")).toBe("Item 1A");

        expect(itemText(null)).toBeNull();
    });

    it("Fact places: a place opens its block in the reader and links the annotated rendition", () => {
        const onOpenBlock = vi.fn();

        render(<FactPlacesView onOpenBlock={onOpenBlock} state={state([FACT_PLACES])} versionId="f735ba2e-582b-5682-a5c7-746c8cef1457" />);

        expect(screen.getByText("Placed")).toBeInTheDocument();

        expect(screen.getByText("row 14, col 39")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Block b00085" }));

        expect(onOpenBlock).toHaveBeenCalledWith("b00085");

        expect(screen.getByRole("link", { name: /Annotated/ })).toHaveAttribute("href", FACT_PLACES.data[0].rendition_url);
    });

    it("Fact places on a plan below PRO is the plan state, not an empty list", () => {
        const error = new ApiRequestError(403, { error: "plan_required", message: "This route needs the PRO plan.", requestId: "req_2" });

        render(<FactPlacesView onOpenBlock={() => undefined} state={state([], { error })} versionId="f735ba2e-582b-5682-a5c7-746c8cef1457" />);

        expect(screen.queryByText("No fact is placed in this document.")).toBeNull();
    });

    it("Review chain: a filing alone says so; letters list their filings (each opens its page) and what was cut", () => {
        const { unmount } = render(<ReviewChainView data={REVIEW_CHAIN_ALONE} error={null} isLoading={false} />);

        expect(screen.getByText(/No comment letters relate to this filing/)).toBeInTheDocument();

        unmount();

        render(<ReviewChainView data={REVIEW_CHAIN_LETTERS} error={null} isLoading={false} />);

        expect(screen.getByRole("link", { name: "0000000000-26-000002" })).toHaveAttribute("href", "/filings/0000000000-26-000002");

        expect(screen.getByText("Cut at 1 hops / 100 nodes")).toBeInTheDocument();

        expect(screen.getByText("2 relations not resolved yet")).toBeInTheDocument();

        expect(screen.getByText("1 filing not held")).toBeInTheDocument();

        expect(screen.getByText(/kind: reviews/)).toBeInTheDocument();
    });

    it("Review chain 503 (review store off) is its state", () => {
        const error = new ApiRequestError(503, { error: "unavailable", message: "The review store is switched off.", requestId: "req_3" });

        render(<ReviewChainView data={null} error={error} isLoading={false} />);

        expect(screen.getByText("The review store is switched off")).toBeInTheDocument();
    });

    it("Parties & relations: a party links its filer page; relations read as sentences", () => {
        render(<FilingPartiesView data={FILING_PARTIES} error={null} isLoading={false} />);

        expect(screen.getByText("Apple Inc.")).toBeInTheDocument();

        expect(screen.getAllByRole("link", { name: "320193" })[0]).toHaveAttribute("href", "/sec/320193");

        expect(screen.getByText("exhibit of", { exact: false })).toBeInTheDocument();
    });

    it("a fact's period: duration, instant, or end", () => {
        expect(factPeriodText({ instant: "2026-06-30", period_end: null, period_start: null })).toBe("Jun 30, 2026");

        expect(factPeriodText({ instant: null, period_end: "2026-06-27", period_start: null })).toBe("Jun 27, 2026");
    });
});

describe("SEC data sets", () => {
    it("names each data set, its newest release and forms; an unknown code stays as stated", () => {
        render(<SecDatasetsView error={null} isLoading={false} pages={[DATASETS]} />);

        expect(screen.getByText("Form 13F (institutional holdings)")).toBeInTheDocument();

        expect(screen.getByText("01jun2026-31aug2026")).toBeInTheDocument();

        expect(screen.getAllByText("zzz")).toHaveLength(2);

        expect(screen.getByText("13F-HR, 13F-HR/A, 13F-NT, 13F-NT/A")).toBeInTheDocument();
    });

    it("links each known data set to the page that shows its data, and offers no export", () => {
        render(<SecDatasetsView error={null} isLoading={false} pages={[DATASETS]} />);

        expect(screen.getByRole("link", { name: "Institutions" })).toHaveAttribute("href", "/institutions");

        expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
    });
});

describe("latest filings list (/filings)", () => {
    const pager = { hasNext: false, isFetching: false, onNext: () => undefined, onPrevious: () => undefined, page: 1 };

    const view = (props: Partial<React.ComponentProps<typeof LatestFilingsView>> = {}) => (
        <LatestFilingsView error={null} flashing={new Set()} forms={[]} isLoading={false} pager={pager} paused={false} rows={[]} {...props} />
    );

    it("empty texts: none in the last 7 days (the forms named), the live feed off", () => {
        const { rerender } = render(view());

        expect(screen.getByText("No filings in the last 7 days.")).toBeInTheDocument();

        rerender(view({ forms: ["8-K", "S-1"] }));

        expect(screen.getByText("No 8-K, S-1 filings in the last 7 days.")).toBeInTheDocument();

        rerender(view({ paused: true }));

        expect(screen.getByText("No filings in the last 7 days. The live feed is off.")).toBeInTheDocument();

        expect(latestEmptyText([], false)).toBe("No filings in the last 7 days.");
    });

    it("prefilled rows: filer name → filer page for a null symbol, ticker badge → its filings, the filed instant; the pager pages", () => {
        const onNext = vi.fn();

        render(view({ pager: { ...pager, hasNext: true, onNext }, rows: mergeLatest([], V2_LATEST_FILINGS.data) }));

        expect(screen.getByRole("link", { name: "Fidelity Chainlink Fund" })).toHaveAttribute("href", "/sec/2166611");

        expect(screen.getAllByRole("link", { name: "AAPL" })[0]).toHaveAttribute("href", "/AAPL/filings");

        expect(screen.getByRole("link", { name: V2_FILING_PRE_IPO.accession })).toHaveAttribute("href", `/filings/${V2_FILING_PRE_IPO.accession}`);

        // No "Arrived" column: the flash says it.
        expect(screen.queryByText("Arrived")).toBeNull();

        fireEvent.click(screen.getByText("Next"));

        expect(onNext).toHaveBeenCalled();
    });

    it("a live row without a listed copy on top: its filer page by CIK and its proposed tickers", () => {
        render(view({ rows: mergeLatest([{ filing: LIVE_FILING_S1, receivedAt: "2026-11-27T10:00:00Z" }], V2_FILINGS.data) }));

        expect(screen.getByRole("link", { name: "CIK 1999999" })).toHaveAttribute("href", "/sec/1999999");

        expect(screen.getByText("NEWC")).toBeInTheDocument();

        expect(screen.getAllByRole("row")[1]).toHaveTextContent(LIVE_FILING_S1.accession_number);
    });

    it("a REST error stands above the table; live rows stay", () => {
        const error = new ApiRequestError(503, { error: "unavailable", message: "The filings door is switched off.", requestId: "req_4" });

        render(view({ error, rows: mergeLatest([{ filing: LIVE_FILING, receivedAt: "2026-11-27T10:00:00Z" }], []) }));

        expect(screen.getByText("The filings door is switched off.")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: LIVE_FILING.accession_number })).toBeInTheDocument();
    });
});
