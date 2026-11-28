// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FilingDocumentTarget } from "@/components/sec/filing-document-dialog";
import type { V2InvestorDocument } from "@/lib/api/types";
import type { CallTabProps } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { useV2InvestorDocumentsInfinite } from "@/lib/api/queries";
import { DocumentsTab } from "@/routes/$ticker/earnings-calls/-components/tabs/documents-tab";

vi.mock("@/lib/api/queries", () => ({ useV2InvestorDocument: vi.fn(), useV2InvestorDocumentsInfinite: vi.fn() }));

vi.mock("@/lib/api/use-auto-load-pages", () => ({ useAutoLoadPages: vi.fn() }));

vi.mock("@/components/sec/filing-document-dialog", () => ({
    FilingDocumentDialog: ({ onClose, target }: { onClose: () => void; target: FilingDocumentTarget | null }) => target && (
        <div aria-label={target.title} role="dialog">
            {target.accession}
            <button onClick={onClose} type="button">Close filing</button>
        </div>
    ),
}));

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
    onSearchChange: vi.fn(),
    onTabChange: vi.fn(),
    onTranscriptJumpHandled: vi.fn(),
    search: {},
    transcriptJump: null,
} as unknown as CallTabProps;

const mockDocuments = (documents: Array<Omit<V2InvestorDocument, "origin" | "trust_tier">>) =>
    vi.mocked(useV2InvestorDocumentsInfinite).mockReturnValue({
        data: { pageParams: [null], pages: [{ data: documents, has_more: false, meta: {}, next_cursor: null }] },
        error: null,
        hasNextPage: false,
        isLoading: false,
    } as never);

describe("DocumentsTab", () => {
    it.each(["current", "candidate"] as const)("keeps document products and semantic sources without acquisition/trust (%s)", (shape) => {
        const { origin: _origin, trust_tier: _trust, ...candidate } = base;

        mockDocuments([shape === "candidate" ? candidate : base]);

        render(<DocumentsTab {...props} />);

        expect(screen.getAllByRole("columnheader")).toHaveLength(6);

        expect(screen.queryByRole("columnheader", { name: "Trust" })).toBeNull();

        expect(screen.getByText("CFO Commentary")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", base.url);

        expect(screen.getByRole("button", { name: "Show text" })).toBeInTheDocument();

        expect(screen.queryByText("Company domain")).toBeNull();

        expect(screen.queryByText("Q4 reports")).toBeNull();

        expect(candidate).not.toHaveProperty("origin");

        expect(candidate).not.toHaveProperty("trust_tier");
    });

    it("uses semantic call source when an unlabelled link-only document has no producer", () => {
        const { origin: _origin, trust_tier: _trust, ...candidate } = base;

        mockDocuments([{ ...candidate, source_label: null, url: null }]);

        render(<DocumentsTab {...props} />);

        expect(screen.getByText("Call document")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", base.source_url);
    });

    it("asks the event's documents by id (`/v1/investor-documents?event=`), every page", () => {
        mockDocuments([base]);

        render(<DocumentsTab {...props} />);

        expect(useV2InvestorDocumentsInfinite).toHaveBeenLastCalledWith({ event: EVENT_ID, kind: undefined, limit: 200, sort: undefined });

        // v2 lists carry no page count: no Pages column.
        expect(screen.queryByRole("columnheader", { name: "Pages" })).toBeNull();
    });

    it("sends the URL's order (`?docSort=` → `sort`) and names it", () => {
        mockDocuments([base]);

        render(<DocumentsTab {...props} search={{ docSort: "event_date" }} />);

        expect(useV2InvestorDocumentsInfinite).toHaveBeenLastCalledWith({ event: EVENT_ID, kind: undefined, limit: 200, sort: "event_date" });

        expect(screen.getByRole("button", { name: "Order" })).toHaveTextContent("Call date, oldest first");
    });

    it("lists the call's SEC filings apart under Filings, with their EDGAR filing date", () => {
        mockDocuments([base, tenK]);

        render(<DocumentsTab {...props} />);

        const filings = screen.getByRole("region", { name: "Filings" });

        expect(within(filings).getByText("FY2026 Form 10-K")).toBeInTheDocument();

        // A formatted day, never the raw ISO date (UI walk F068).
        expect(within(filings).getByText("Nov 3, 2026")).toBeInTheDocument();

        expect(within(filings).queryByRole("link")).toBeNull();

        expect(within(filings).getAllByRole("columnheader")).toHaveLength(3);

        // The documents table above holds only the call material.
        expect(screen.getAllByText("FY2026 Form 10-K")).toHaveLength(1);

        expect(screen.getByText("CFO Commentary Q4 FY2026").closest("section")).toBeNull();
    });

    it("opens the stored filing from any cell, with a native button for keyboard access, and closes it", () => {
        mockDocuments([tenK]);

        render(<DocumentsTab {...props} />);

        expect(screen.queryByRole("dialog")).toBeNull();

        fireEvent.click(screen.getByText("Nov 3, 2026"));

        expect(screen.getByRole("dialog", { name: tenK.title ?? "" })).toHaveTextContent(tenK.accession_number ?? "");

        fireEvent.click(screen.getByRole("button", { name: "Close filing" }));

        expect(screen.queryByRole("dialog")).toBeNull();

        const button = screen.getByRole("button", { name: "FY2026 Form 10-K" });

        expect(button.tagName).toBe("BUTTON");

        fireEvent.click(button);

        expect(screen.getByRole("dialog")).toHaveTextContent(tenK.accession_number ?? "");
    });

    it("keeps a filing without an accession noninteractive", () => {
        mockDocuments([{ ...tenK, accession_number: null }]);

        render(<DocumentsTab {...props} />);

        const filings = screen.getByRole("region", { name: "Filings" });

        expect(within(filings).queryByRole("button")).toBeNull();

        fireEvent.click(within(filings).getByText("FY2026 Form 10-K"));

        expect(screen.queryByRole("dialog")).toBeNull();

        expect(within(filings).getByText("—")).toBeInTheDocument();
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
