// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EarningsDocument } from "@/lib/api/types";
import type { CallTabProps } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { useEarningsDocumentsInfinite } from "@/lib/api/queries";
import { DocumentsTab } from "@/routes/$ticker/earnings-calls/-components/tabs/documents-tab";

vi.mock("@/lib/api/queries", () => ({ useEarningsDocumentsInfinite: vi.fn() }));

vi.mock("@/lib/api/use-load-all-pages", () => ({ useLoadAllPages: vi.fn() }));

afterEach(cleanup);

const base: EarningsDocument = {
    accession_number: null,
    bytes: 182_000,
    category: "earnings",
    confidence: "high",
    content_type: "application/pdf",
    document_id: "00000000-0000-4000-8000-000000000001",
    filing_date: null,
    group: "earnings/fy2026/q4",
    group_label: "Q4 FY2026",
    kind: "cfo_commentary",
    origin: "q4_reports",
    pages: 6,
    producer: null,
    source_label: "CFO Commentary",
    source_url: "https://investor.example.com/cfo.pdf",
    title: "CFO Commentary Q4 FY2026",
    trust_tier: "confirmed_domain",
    url: "https://storage-prod.invinite.com/earnings/cfo.pdf",
};

const tenK: EarningsDocument = {
    ...base,
    accession_number: "0000320193-26-000026",
    bytes: null,
    content_type: null,
    document_id: "00000000-0000-4000-8000-000000000002",
    filing_date: "2026-11-03",
    kind: "sec_filing",
    origin: "edgar_filing",
    pages: null,
    source_label: "EDGAR 10-K",
    source_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
    title: "FY2026 Form 10-K",
    trust_tier: "sec",
    url: null,
};

const props = {
    event: { has_press_release: false, has_slides: false },
    onTabChange: vi.fn(),
    onTranscriptJumpHandled: vi.fn(),
    selector: { eventId: "6f1c2b9e-0d4a-4c1b-9a6e-2f3b4c5d6e7f" },
    transcriptJump: null,
} as unknown as CallTabProps;

const mockDocuments = (documents: Array<EarningsDocument>) =>
    vi.mocked(useEarningsDocumentsInfinite).mockReturnValue({
        data: { pageParams: [0], pages: [{ documents, next_url: null }] },
        error: null,
        hasNextPage: false,
        isLoading: false,
    } as never);

describe("DocumentsTab", () => {
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
