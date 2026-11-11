// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2InvestorDocument } from "@/lib/api/types";
import type { CallTabProps } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { useV2InvestorDocumentsInfinite } from "@/lib/api/queries";
import { DocumentsTab } from "@/routes/$ticker/earnings-calls/-components/tabs/documents-tab";

vi.mock("@/lib/api/queries", () => ({ useV2InvestorDocument: vi.fn(), useV2InvestorDocumentsInfinite: vi.fn() }));

vi.mock("@/lib/api/use-load-all-pages", () => ({ useLoadAllPages: vi.fn() }));

afterEach(cleanup);

const EVENT_ID = "6f1c2b9e-0d4a-4c1b-9a6e-2f3b4c5d6e7f";

// A `/v1/investor-documents?event=` row (`source: "call"`; `pages` is null in lists, `body_text` too).
const base: V2InvestorDocument = {
    accession_number: null,
    body_text: null,
    bytes: 182_000,
    category: "earnings",
    confidence: "high",
    content_type: "application/pdf",
    created_at: "2026-10-30T21:00:00.000Z",
    document_id: "00000000-0000-4000-8000-000000000001",
    event_date: "2026-10-30",
    event_id: EVENT_ID,
    event_type: "earnings_call",
    filing_date: null,
    group: "earnings/fy2026/q4",
    group_label: "Q4 FY2026",
    kind: "cfo_commentary",
    link_status: "live",
    origin: "q4_reports",
    page_url: null,
    pages: null,
    pages_url: null,
    period: "Q4",
    producer: null,
    section: null,
    source: "call",
    source_label: "CFO Commentary",
    source_url: "https://investor.example.com/cfo.pdf",
    title: "CFO Commentary Q4 FY2026",
    trust_tier: "confirmed_domain",
    updated_at: "2026-10-30T21:00:00.000Z",
    url: "https://storage-prod.invinite.com/earnings/cfo.pdf",
    year: 2026,
};

const tenK: V2InvestorDocument = {
    ...base,
    accession_number: "0000320193-26-000026",
    bytes: null,
    content_type: null,
    document_id: "00000000-0000-4000-8000-000000000002",
    filing_date: "2026-11-03",
    kind: "sec_filing",
    origin: "edgar_filing",
    source_label: "EDGAR 10-K",
    source_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
    title: "FY2026 Form 10-K",
    trust_tier: "sec",
    url: null,
};

const props = {
    event: { has_press_release: false, has_slides: false },
    eventId: EVENT_ID,
    onTabChange: vi.fn(),
    onTranscriptJumpHandled: vi.fn(),
    transcriptJump: null,
} as unknown as CallTabProps;

const mockDocuments = (documents: Array<V2InvestorDocument>) =>
    vi.mocked(useV2InvestorDocumentsInfinite).mockReturnValue({
        data: { pageParams: [null], pages: [{ data: documents, has_more: false, meta: {}, next_cursor: null }] },
        error: null,
        hasNextPage: false,
        isLoading: false,
    } as never);

describe("DocumentsTab", () => {
    it("asks the event's documents by id (`/v1/investor-documents?event=`), every page", () => {
        mockDocuments([base]);

        render(<DocumentsTab {...props} />);

        expect(useV2InvestorDocumentsInfinite).toHaveBeenLastCalledWith({ event: EVENT_ID, kind: undefined, limit: 200 });

        // v2 lists carry no page count: no Pages column.
        expect(screen.queryByRole("columnheader", { name: "Pages" })).toBeNull();
    });

    it("lists the call's SEC filings apart under Filings, with their EDGAR filing date", () => {
        mockDocuments([base, tenK]);

        render(<DocumentsTab {...props} />);

        const filings = screen.getByRole("region", { name: "Filings" });

        expect(within(filings).getByText("FY2026 Form 10-K")).toBeInTheDocument();

        expect(within(filings).getByText("2026-11-03")).toBeInTheDocument();

        expect(within(filings).getByText("EDGAR").closest("a")).toHaveAttribute("href", tenK.source_url);

        // The documents table above holds only the call material.
        expect(screen.getAllByText("FY2026 Form 10-K")).toHaveLength(1);

        expect(screen.getByText("CFO Commentary Q4 FY2026").closest("section")).toBeNull();
    });

    it("no Filings section without a filing; a call with only a filing says there is nothing else", () => {
        mockDocuments([base]);

        const { unmount } = render(<DocumentsTab {...props} />);

        expect(screen.queryByRole("region", { name: "Filings" })).toBeNull();

        unmount();

        mockDocuments([{ ...tenK, filing_date: null }]);

        render(<DocumentsTab {...props} />);

        expect(screen.getByText("No other documents stored for this call.")).toBeInTheDocument();

        expect(within(screen.getByRole("region", { name: "Filings" })).getByText("—")).toBeInTheDocument();
    });
});
