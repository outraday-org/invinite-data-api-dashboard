// @vitest-environment jsdom
import type * as React from "react";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EarningsCompanyDocument, EarningsEventWithObservations } from "@/lib/api/types";
import type { DocumentsSearch } from "@/lib/earnings/documents";

import { useEarningsCompanyDocumentsInfinite, useEarningsEventsInfinite } from "@/lib/api/queries";
import { buildDocumentTree } from "@/lib/earnings/documents";
import { Route } from "@/routes/$ticker/documents";
import { DocumentTree } from "@/routes/$ticker/documents/-components/document-tree";

const route = vi.hoisted(() => ({ navigate: vi.fn(), search: {} as Record<string, unknown> }));

// The tree renders outside a router: a plain anchor that shows where the Link points; the page's route hooks read
// the test's search and record navigation.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({
        options,
        useNavigate: () => route.navigate,
        useParams: () => ({ ticker: "ACME" }),
        useSearch: () => route.search,
    }),
    Link: ({ children, className, params, search, to }: {
        children: React.ReactNode;
        className?: string;
        params: Record<string, string>;
        search?: Record<string, string>;
        to: string;
    }) => (
        <a className={className} data-search={JSON.stringify(search ?? {})} href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>
            {children}
        </a>
    ),
}));

// Keep the server functions (TanStack Start) unloaded; the page's two lists are set per test.
vi.mock("@/lib/api/queries", () => ({
    useEarningsCompanyDocument: vi.fn(() => ({ data: null, error: null, isLoading: false })),
    useEarningsCompanyDocumentsInfinite: vi.fn(),
    useEarningsDocumentSearch: vi.fn(),
    useEarningsEventsInfinite: vi.fn(),
}));

vi.mock("@/routes/$ticker/documents/-components/document-search", () => ({ DocumentSearch: () => null }));

afterEach(cleanup);

const SIGNED = "https://r2.example.com/docs/annual-report.pdf?X-Amz-Signature=secret";

const base: EarningsCompanyDocument = {
    bytes: 2_400_000,
    category: "reports",
    confidence: "high",
    content_type: "application/pdf",
    created_at: "2026-10-01T00:00:00.000Z",
    document_id: "00000000-0000-4000-8000-000000000001",
    event_date: null,
    event_id: null,
    event_type: null,
    expires_at: "2026-10-18T12:15:00.000Z",
    group: "reports/2025",
    group_label: "Reports 2025",
    kind: "annual_report",
    link_status: null,
    origin: "html_page",
    page_url: null,
    pages: 120,
    pages_url: "https://r2.example.com/docs/annual-report.pdf.pages.json?X-Amz-Signature=secret",
    period: "FY",
    producer: "company",
    section: "annual_reports",
    source: "company",
    source_label: null,
    source_url: "https://ir.example.com/annual-report.pdf",
    title: "Annual Report 2025",
    trust_tier: "confirmed_domain",
    updated_at: "2026-10-01T00:00:00.000Z",
    url: SIGNED,
    year: 2025,
};

const DOCUMENTS: Array<EarningsCompanyDocument> = [
    base,
    {
        ...base,
        document_id: "00000000-0000-4000-8000-000000000002",
        group: "reports/2024",
        group_label: "Reports 2024",
        title: "Annual Report 2024",
        year: 2024,
    },
    {
        ...base,
        bytes: null,
        category: "events",
        content_type: null,
        document_id: "00000000-0000-4000-8000-000000000003",
        event_date: "2026-03-12",
        event_id: "11111111-1111-4111-8111-111111111111",
        event_type: "investor_day",
        group: "events/2026/03-12-investor-day",
        group_label: "Events 2026 · Investor Day",
        kind: "webcast",
        link_status: "expired",
        pages: null,
        pages_url: null,
        period: null,
        section: "events_archive",
        source_url: "https://ir.example.com/events/investor-day-replay",
        title: "Investor Day replay",
        url: null,
        year: 2026,
    },
];

const renderTree = (documents: ReadonlyArray<EarningsCompanyDocument>, onShowText = vi.fn()) =>
    render(<DocumentTree onShowText={onShowText} ticker="ACME" tree={buildDocumentTree(documents, [], "")} />);

describe("DocumentTree", () => {
    it("nests category → path segments: categories open, the newest path open", () => {
        renderTree(DOCUMENTS);

        const sections = screen.getAllByRole("button", { expanded: true }).map(button => button.textContent);

        // Events (open, its newest path open) before Reports (open, 2025 open); 2024 is collapsed.
        expect(sections).toEqual(["Events1", "20261", "Events 2026 · Investor Day1", "Reports2", "Reports 20251"]);

        expect(screen.getByRole("button", { expanded: false })).toHaveTextContent("Reports 20241");

        expect(screen.queryByText("Annual Report 2024")).toBeNull();

        fireEvent.click(screen.getByRole("button", { expanded: false }));

        expect(screen.getByText("Annual Report 2024")).toBeInTheDocument();
    });

    it("opens the signed file in a new tab without a referrer and offers its text", () => {
        const onShowText = vi.fn();

        renderTree([base], onShowText);

        const row = screen.getByText("Annual Report 2025").closest("li")!;

        const open = within(row).getByRole("link", { name: "Open" });

        expect(open).toHaveAttribute("href", SIGNED);

        expect(open).toHaveAttribute("rel", "noopener noreferrer");

        expect(open).toHaveAttribute("target", "_blank");

        expect(within(row).getByText("120 pp.")).toBeInTheDocument();

        fireEvent.click(within(row).getByRole("button", { name: "Show text" }));

        expect(onShowText).toHaveBeenCalledWith(base);
    });

    it("renders a link-only row: the source page, no text, its event, the expired replay", () => {
        renderTree([DOCUMENTS[2]]);

        const row = screen.getByText("Investor Day replay").closest("li")!;

        expect(within(row).getByText("Open page").closest("a")).toHaveAttribute("href", "https://ir.example.com/events/investor-day-replay");

        expect(within(row).queryByRole("button", { name: "Show text" })).toBeNull();

        expect(within(row).getByText("replay expired")).toBeInTheDocument();

        expect(within(row).getByText("2026-03-12")).toBeInTheDocument();

        const event = within(row).getByText("Event");

        expect(event).toHaveAttribute("href", "/ACME/earnings-calls/11111111-1111-4111-8111-111111111111");

        expect(event).toHaveAttribute("data-search", JSON.stringify({ tab: "documents" }));
    });
});

const CALL_EVENT_ID = "22222222-2222-4222-8222-222222222222";

const CALL_DOCUMENT: EarningsCompanyDocument = {
    ...base,
    category: "earnings",
    document_id: "00000000-0000-4000-8000-000000000004",
    event_date: "2026-08-26",
    event_id: CALL_EVENT_ID,
    event_type: "earnings_call",
    group: "earnings/fy2027/q2",
    group_label: "Q2 FY2027",
    kind: "cfo_commentary",
    origin: "q4_reports",
    pages_url: null,
    period: "Q2",
    section: null,
    source: "call",
    title: "CFO Commentary Q2",
    year: 2027,
};

const CALL_EVENT = {
    event_id: CALL_EVENT_ID,
    event_title: null,
    event_type: "earnings_call",
    fiscal_quarter: 2,
    fiscal_year: 2027,
    has_audio: true,
    has_documents: true,
    has_press_release: true,
    has_slides: false,
    has_transcript: true,
    scheduled_at: "2026-08-26T20:30:00.000Z",
    symbol: "ACME",
} as EarningsEventWithObservations;

/** The shape of an infinite list the page reads. */
function infinite<TPage>(pages: Array<TPage>, overrides: Record<string, unknown> = {}) {
    return {
        data: { pageParams: pages.map((_, index) => index), pages },
        error: null,
        fetchNextPage: vi.fn(() => Promise.resolve()),
        hasNextPage: false,
        isFetching: false,
        isFetchNextPageError: false,
        isLoading: false,
        refetch: vi.fn(),
        ...overrides,
    };
}

const documentsPage = (documents: Array<EarningsCompanyDocument>) => ({
    company: { name: "Acme Corp", symbol: "ACME" },
    documents,
    next_url: null,
});

const mockLists = (
    documents: ReturnType<typeof infinite>,
    events = infinite([{ events: [CALL_EVENT], next_url: null }]),
) => {
    vi.mocked(useEarningsCompanyDocumentsInfinite).mockReturnValue(documents as never);

    vi.mocked(useEarningsEventsInfinite).mockReturnValue(events as never);
};

const DocumentsPage = Route.options.component as React.ComponentType;

const openFolders = () => screen.getAllByRole("button", { expanded: true }).map(button => button.textContent);

describe("Documents page", () => {
    beforeEach(() => {
        route.navigate.mockReset();

        route.search = {};
    });

    it("asks for the library with the call documents and every event", () => {
        mockLists(infinite([documentsPage(DOCUMENTS)]));

        render(<DocumentsPage />);

        expect(useEarningsCompanyDocumentsInfinite).toHaveBeenCalledWith(expect.objectContaining({ identifier: "ACME", include: ["calls"], limit: 100 }));

        expect(useEarningsEventsInfinite).toHaveBeenCalledWith({ eventType: "all", identifier: "ACME", limit: 200, sort: "desc" });

        expect(screen.queryByText("Call folders")).toBeNull();
    });

    it("shows a call document and its call row under the earnings quarter", () => {
        mockLists(infinite([documentsPage([CALL_DOCUMENT, ...DOCUMENTS])]));

        render(<DocumentsPage />);

        expect(openFolders().slice(0, 3)).toEqual(["Earnings2", "FY20272", "Q2 FY20272"]);

        const quarter = screen.getByRole("button", { name: /Q2 FY2027/ }).closest("li")!;

        const callRow = quarter.querySelector<HTMLElement>(`[data-event-id="${CALL_EVENT_ID}"]`)!;

        const callHref = `/ACME/earnings-calls/${CALL_EVENT_ID}`;

        expect(within(callRow).getByText("Q2 FY2027 call")).toHaveAttribute("href", callHref);

        expect(within(callRow).getByText("2026-08-26")).toBeInTheDocument();

        expect(within(callRow).getByText("Press release")).toHaveAttribute("data-search", JSON.stringify({ tab: "press-release" }));

        expect(within(callRow).getByText("Documents")).toHaveAttribute("data-search", JSON.stringify({ tab: "documents" }));

        // No slides on this call: no link to an empty tab.
        expect(within(callRow).queryByText("Slides")).toBeNull();

        // The call row comes first in its folder, then the call's documents (a "Call" badge → its Documents tab).
        const rows = [...quarter.querySelectorAll<HTMLElement>("li[data-event-id], li[data-document-id]")];

        expect(rows.map(row => row.getAttribute("data-event-id") ?? row.getAttribute("data-document-id")))
            .toEqual([CALL_EVENT_ID, CALL_DOCUMENT.document_id]);

        const docRow = rows[1];

        expect(within(docRow).getByText("Call").closest("a")).toHaveAttribute("href", callHref);

        expect(within(docRow).queryByText("Event")).toBeNull();
    });

    it("filters by ?q=: opens the deep match, hides the rest, says when nothing matches", () => {
        mockLists(infinite([documentsPage([CALL_DOCUMENT, ...DOCUMENTS])]));

        route.search = { q: "investor day" } satisfies DocumentsSearch;

        render(<DocumentsPage />);

        expect(openFolders()).toEqual(["Events1", "20261", "Events 2026 · Investor Day1"]);

        expect(screen.getByText("Investor Day replay")).toBeInTheDocument();

        expect(screen.queryByText("Annual Report 2025")).toBeNull();

        expect(screen.queryByText("Q2 FY2027 call")).toBeNull();

        cleanup();

        route.search = { q: "zzz" };

        render(<DocumentsPage />);

        expect(screen.getByText("No documents match “zzz”.")).toBeInTheDocument();
    });

    it("writes the typed filter to ?q= after 200 ms, replacing the history entry", () => {
        vi.useFakeTimers();

        try {
            mockLists(infinite([documentsPage(DOCUMENTS)]));

            render(<DocumentsPage />);

            fireEvent.change(screen.getByLabelText("Filter documents"), { target: { value: " Q2 " } });

            act(() => vi.advanceTimersByTime(199));

            expect(route.navigate).not.toHaveBeenCalled();

            act(() => vi.advanceTimersByTime(1));

            expect(route.navigate).toHaveBeenCalledTimes(1);

            const [{ replace, search }] = route.navigate.mock.calls[0] as [{ replace: boolean; search: (prev: object) => object }];

            expect(replace).toBe(true);

            expect(search({ kind: "annual_report" })).toEqual({ kind: "annual_report", q: "Q2" });
        }
        finally {
            vi.useRealTimers();
        }
    });

    it("loads every page by itself: N+ while loading, N when done", () => {
        const firstPage = infinite([documentsPage([base])], { hasNextPage: true });

        mockLists(firstPage);

        const { rerender } = render(<DocumentsPage />);

        expect(firstPage.fetchNextPage).toHaveBeenCalledTimes(1);

        expect(screen.getByText(/· 1\+ document ·/)).toBeInTheDocument();

        const bothPages = infinite([documentsPage([base]), documentsPage([DOCUMENTS[1]])]);

        mockLists(bothPages);

        rerender(<DocumentsPage />);

        expect(bothPages.fetchNextPage).not.toHaveBeenCalled();

        expect(screen.getByText(/· 2 documents ·/)).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: /Load more/ })).toBeNull();
    });
});
