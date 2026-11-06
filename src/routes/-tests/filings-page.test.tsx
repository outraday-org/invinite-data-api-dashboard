// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SecFilingManifestResponse } from "@/lib/api/types";
import type { FilingListRow } from "@/lib/sec/parity";

import { SEC_MANIFEST } from "@/lib/sec/sec-fixtures";
import { FilingItem } from "@/routes/$ticker/filings/-components/filing-item";
import { FilingHtmlBody, primaryDocumentUrl } from "@/routes/$ticker/filings/-components/html-dialog";

// Pure views: keep the server functions (TanStack Start) and the HTML fetcher unloaded.
vi.mock("@/lib/api/queries", () => ({
    useSecDocumentBlocks: vi.fn(),
    useSecFigure: vi.fn(),
    useSecFilingManifest: vi.fn(),
}));

vi.mock("@/components/html/html-viewer", () => ({
    HtmlViewer: ({ url }: { url: string }) => <div data-testid="html-viewer" data-url={url} />,
}));

afterEach(cleanup);

const PUBLIC_URL = "https://storage-prod.invinite.com/sec/4765d5384d6b2195ff48ff775f9244f9/aapl-20260926.htm";

// The live 10-K manifest (0000320193-26-000026, 2026-11-06) trimmed to its primary document with a public copy.
const MANIFEST_10K: SecFilingManifestResponse = {
    ...SEC_MANIFEST,
    documents: [{
        ...SEC_MANIFEST.documents![0],
        doc_type: "10-K",
        filename: "aapl-20260926.htm",
        role: "primary",
        source: { url: PUBLIC_URL },
    }],
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

describe("HTML view (lazy manifest)", () => {
    it("renders the primary document at its permanent public URL", () => {
        expect(primaryDocumentUrl(MANIFEST_10K, ROW.primaryDocument)).toBe(PUBLIC_URL);

        render(<FilingHtmlBody data={MANIFEST_10K} error={null} isLoading={false} onOpenDocuments={noop} primaryFilename={ROW.primaryDocument} title="AAPL 10-K" />);

        expect(screen.getByTestId("html-viewer")).toHaveAttribute("data-url", PUBLIC_URL);
    });

    it("source null: 'No public copy yet' and the SEC document store reader instead", () => {
        const onOpenDocuments = vi.fn();

        render(<FilingHtmlBody data={SEC_MANIFEST} error={null} isLoading={false} onOpenDocuments={onOpenDocuments} primaryFilename="aapl-20261102.htm" title="AAPL 8-K" />);

        expect(screen.getByText("No public copy yet")).toBeInTheDocument();

        expect(screen.queryByTestId("html-viewer")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /Read in the SEC document store/ }));

        expect(onOpenDocuments).toHaveBeenCalledOnce();
    });

    it("a too-large primary document is never linked", () => {
        const tooLarge = { ...MANIFEST_10K, documents: [{ ...MANIFEST_10K.documents![0], too_large: true }] };

        expect(primaryDocumentUrl(tooLarge, ROW.primaryDocument)).toBeNull();
    });

    it("while the manifest loads nothing is rendered as a document", () => {
        render(<FilingHtmlBody data={null} error={null} isLoading onOpenDocuments={noop} primaryFilename={null} title="x" />);

        expect(screen.queryByTestId("html-viewer")).toBeNull();

        expect(screen.queryByText("No public copy yet")).toBeNull();
    });
});
