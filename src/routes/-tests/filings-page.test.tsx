// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2FilingDetailResponse } from "@/lib/api/types";
import type { FilingListRow } from "@/lib/sec/parity";

import { ApiRequestError } from "@/lib/api/errors";
import { facetSummary } from "@/lib/sec/parity";
import { V2_FILING_10K } from "@/lib/sec/v2-fixtures";
import { FilingsHeader } from "@/routes/$ticker/filings/-components/filings-header";
import { FilingsList } from "@/routes/$ticker/filings/-components/filings-list";
import { FilingHtmlBody, isHtmlDocumentUrl, primaryDocumentUrl } from "@/routes/$ticker/filings/-components/html-dialog";

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
    items: [],
    periodEnd: "2026-09-26",
    primaryDocument: "aapl-20260926.htm",
};

const noop = () => undefined;

/** The filings table with one row (the page's `DataTable`). */
const list = (filing: FilingListRow, onOpenHtml: () => void = noop) => (
    <FilingsList
        displayFilings={[filing]}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        onFetchNextPage={noop}
        onOpenHtml={onOpenHtml}
        onSortToggle={noop}
        sortDirection="desc"
    />
);

describe("filings row", () => {
    it("shows form, accession, the fiscal quarter of its period end, and opens the HTML view on click", () => {
        const onOpenHtml = vi.fn();

        render(list(ROW, onOpenHtml));

        expect(screen.getByText("10-K")).toBeInTheDocument();

        expect(screen.getByText("Q4 FY26")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "HTML" }));

        expect(onOpenHtml).toHaveBeenCalledOnce();
    });

    it("an unmatched period shows its period end; no period at all shows a dash", () => {
        const { rerender } = render(list({ ...ROW, fiscalQuarter: null, fiscalYear: null }));

        expect(screen.getByText("Sep 26, 2026")).toBeInTheDocument();

        rerender(list({ ...ROW, fiscalQuarter: null, fiscalYear: null, periodEnd: null }));

        // The period and the (empty) items column.
        expect(screen.getAllByText("—")).toHaveLength(2);
    });
});

describe("filings row: items, EDGAR, details, live (O7 group 3)", () => {
    it("an 8-K row lists its items, links EDGAR's index page and the filing page", () => {
        const edgar = "https://www.sec.gov/Archives/edgar/data/320193/000032019326000024/0000320193-26-000024-index.htm";

        render(
            <FilingsList
                displayFilings={[{ ...ROW, accessionNumber: "0000320193-26-000024", edgarIndexUrl: edgar, formType: "8-K", items: ["2.02", "9.01"] }]}
                hasNextPage={false}
                isFetchingNextPage={false}
                isLoading={false}
                onFetchNextPage={noop}
                onOpenHtml={noop}
                onSortToggle={noop}
                renderDetailsLink={filing => <a href={`/filings/${filing.accessionNumber}`}>Details</a>}
                sortDirection="desc"
            />,
        );

        expect(screen.getByText("2.02, 9.01")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: /EDGAR/ })).toHaveAttribute("href", edgar);

        expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute("href", "/filings/0000320193-26-000024");

        expect(screen.queryByText("New")).toBeNull();
    });

    it("a live row is marked New; a row without items or EDGAR link shows a dash and no link", () => {
        render(list({ ...ROW, live: true }));

        expect(screen.getByText("New")).toBeInTheDocument();

        expect(screen.queryByRole("link", { name: /EDGAR/ })).toBeNull();
    });

    it("the facet line: one form's count and newest date, else the newest filing of all", () => {
        const facet = [
            { count: 31, form: "10-K", newest_filing_date: "2026-11-03" },
            { count: 1, form: "8-K", newest_filing_date: "2026-11-19" },
        ];

        expect(facetSummary(facet, "10-K")).toBe("31 10-K filings, newest filed Nov 3, 2026");

        expect(facetSummary(facet, "8-K")).toBe("1 8-K filing, newest filed Nov 19, 2026");

        expect(facetSummary(facet, null)).toBe("Newest filing Nov 19, 2026");

        expect(facetSummary(facet, "S-1")).toBeNull();

        expect(facetSummary(undefined, null)).toBeNull();
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

    it("an XML primary document (a Form 4) is not framed as HTML: the statement, the original and the reader (F040)", () => {
        const onOpenDocuments = vi.fn();

        const form4 = "https://storage.invinite.com/sec/9de89155bf38c665fcd7ca8648e9c62f/form4.xml";

        const xmlOnly: V2FilingDetailResponse = {
            ...V2_FILING_10K,
            documents: (V2_FILING_10K.documents ?? []).map(doc => (doc.filename === ROW.primaryDocument ? { ...doc, source_url: form4 } : doc)),
        };

        expect(isHtmlDocumentUrl(form4)).toBe(false);

        expect(isHtmlDocumentUrl(PUBLIC_URL)).toBe(true);

        render(<FilingHtmlBody data={xmlOnly} error={null} isLoading={false} onOpenDocuments={onOpenDocuments} primaryFilename={ROW.primaryDocument} title="AAPL 4" />);

        expect(screen.queryByTestId("html-viewer")).toBeNull();

        expect(screen.getByTestId("no-html-document")).toHaveTextContent("No HTML document: the primary document is form4.xml.");

        expect(screen.getByRole("link", { name: /Open the original/ })).toHaveAttribute("href", form4);

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

describe("filings header (ui-redesign task 6)", () => {
    const header = (props: Partial<React.ComponentProps<typeof FilingsHeader>> = {}) => (
        <FilingsHeader
            actions={<button type="button">Live</button>}
            availableFormTypes={["10-K", "8-K"]}
            facetLine="31 10-K filings, newest filed Nov 3, 2026"
            formTypeFilter={null}
            loadingFormTypes={false}
            onFormTypeChange={noop}
            onItemsChange={noop}
            onRangeChange={noop}
            sortDirection="desc"
            trailing={<button type="button">Search text</button>}
            {...props}
        />
    );

    it("the primary actions beside the title, every filter labelled in one filter bar, the facet line as meta", () => {
        render(header());

        const bar = screen.getByRole("group", { name: "Filters" });

        expect(within(bar).getByLabelText("8-K items").tagName).toBe("INPUT");

        expect(within(bar).getByRole("button", { name: "Form type" })).toBeInTheDocument();

        expect(within(bar).getByRole("group", { name: "Filed" })).toBeInTheDocument();

        expect(within(bar).getByRole("button", { name: "Search text" })).toBeInTheDocument();

        // Live is a page action, not a filter.
        expect(within(bar).queryByRole("button", { name: "Live" })).toBeNull();

        expect(screen.getByText("31 10-K filings, newest filed Nov 3, 2026")).toHaveAttribute("data-slot", "page-header-meta");
    });

    it("\"Reset filters\" only with an active filter; it calls the page's reset", () => {
        const onReset = vi.fn();

        const { rerender } = render(header({ activeCount: 0, onReset }));

        expect(screen.queryByRole("button", { name: /Reset filters/ })).toBeNull();

        rerender(header({ activeCount: 2, onReset }));

        fireEvent.click(screen.getByRole("button", { name: /Reset filters/ }));

        expect(onReset).toHaveBeenCalledOnce();
    });
});
