// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2FilingDetailResponse } from "@/lib/api/types";
import type { FilingListRow } from "@/lib/sec/parity";

import { ApiRequestError } from "@/lib/api/errors";
import { V2_FILING_10K } from "@/lib/sec/v2-fixtures";
import { FilingItem } from "@/routes/$ticker/filings/-components/filing-item";
import { FilingHtmlBody, primaryDocumentUrl } from "@/routes/$ticker/filings/-components/html-dialog";

// Pure views: keep the server functions (TanStack Start) and the HTML fetcher unloaded.
vi.mock("@/lib/api/queries", () => ({
    useV2DocumentFigure: vi.fn(),
    useV2DocumentVersion: vi.fn(),
    useV2Filing: vi.fn(),
}));

vi.mock("@/components/html/html-viewer", () => ({
    HtmlViewer: ({ url }: { url: string }) => <div data-testid="html-viewer" data-url={url} />,
}));

afterEach(cleanup);

const PUBLIC_URL = "https://storage.invinite.com/sec/4765d5384d6b2195ff48ff775f9244f9/aapl-20260926.htm";

// `/v1/filings/0000320193-26-000026?expand=documents` (the API mapper over the recorded manifest, 2026-11-09).
const FILING_10K: V2FilingDetailResponse = V2_FILING_10K;

// The same filing before its primary document has a public copy.
const NO_COPY: V2FilingDetailResponse = {
    ...V2_FILING_10K,
    documents: (V2_FILING_10K.documents ?? []).map(doc => ({ ...doc, source_url: null })),
};

const ROW: FilingListRow = {
    accessionNumber: "0000320193-26-000026",
    calendarQuarter: 3,
    calendarYear: 2026,
    edgarIndexUrl: null,
    filingDate: "2026-11-03",
    fiscalQuarter: 4,
    fiscalYear: 2026,
    formType: "10-K",
    periodEnd: "2026-09-26",
    primaryDocument: "aapl-20260926.htm",
};

const noop = () => undefined;

describe("filings row", () => {
    it("shows form, accession, the fiscal quarter of its period end, and opens the HTML view on click", () => {
        const onOpenHtml = vi.fn();

        render(<FilingItem filing={ROW} onOpenHtml={onOpenHtml} />);

        expect(screen.getByText("10-K")).toBeInTheDocument();

        expect(screen.getByText("Q4 FY26")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "HTML" }));

        expect(onOpenHtml).toHaveBeenCalledOnce();
    });

    it("an unmatched period shows its period end; no period at all shows a dash", () => {
        const { rerender } = render(<FilingItem filing={{ ...ROW, fiscalQuarter: null, fiscalYear: null }} onOpenHtml={noop} />);

        expect(screen.getByText("2026-09-26")).toBeInTheDocument();

        rerender(<FilingItem filing={{ ...ROW, fiscalQuarter: null, fiscalYear: null, periodEnd: null }} onOpenHtml={noop} />);

        expect(screen.getByText("—")).toBeInTheDocument();
    });
});

describe("HTML view (lazy /v1/filings/{accession}?expand=documents)", () => {
    it("renders the primary document at its permanent public URL", () => {
        expect(primaryDocumentUrl(FILING_10K, ROW.primaryDocument)).toBe(PUBLIC_URL);

        render(<FilingHtmlBody data={FILING_10K} error={null} isLoading={false} onOpenDocuments={noop} primaryFilename={ROW.primaryDocument} title="AAPL 10-K" />);

        expect(screen.getByTestId("html-viewer")).toHaveAttribute("data-url", PUBLIC_URL);
    });

    it("no primary filename stated: the document whose EDGAR type is the form", () => {
        expect(primaryDocumentUrl(FILING_10K, null)).toBe(PUBLIC_URL);
    });

    it("source_url null: 'No public copy yet' and the SEC document store reader instead", () => {
        const onOpenDocuments = vi.fn();

        expect(primaryDocumentUrl(NO_COPY, ROW.primaryDocument)).toBeNull();

        render(<FilingHtmlBody data={NO_COPY} error={null} isLoading={false} onOpenDocuments={onOpenDocuments} primaryFilename={ROW.primaryDocument} title="AAPL 10-K" />);

        expect(screen.getByText("No public copy yet")).toBeInTheDocument();

        expect(screen.queryByTestId("html-viewer")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /Read in the SEC document store/ }));

        expect(onOpenDocuments).toHaveBeenCalledOnce();
    });

    it("a 403 excluded problem is the excluded state", () => {
        const problem = new ApiRequestError(403, { error: "excluded", message: "This issuer is excluded" });

        render(<FilingHtmlBody data={null} error={problem} isLoading={false} onOpenDocuments={noop} primaryFilename={null} title="x" />);

        expect(screen.getByText("Outside the SEC store's coverage")).toBeInTheDocument();
    });

    it("while the filing loads nothing is rendered as a document", () => {
        render(<FilingHtmlBody data={null} error={null} isLoading onOpenDocuments={noop} primaryFilename={null} title="x" />);

        expect(screen.queryByTestId("html-viewer")).toBeNull();

        expect(screen.queryByText("No public copy yet")).toBeNull();
    });
});
