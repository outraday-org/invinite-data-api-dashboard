// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EarningsCompanyDocument } from "@/lib/api/types";

import { DocumentTree } from "@/routes/$ticker/documents/-components/document-tree";

// The tree renders outside a router: a plain anchor that shows where the Link points.
vi.mock("@tanstack/react-router", () => ({
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

describe("DocumentTree", () => {
    it("groups by category then folder: categories open, only the newest folder open", () => {
        render(<DocumentTree documents={DOCUMENTS} onShowText={vi.fn()} ticker="ACME" />);

        const sections = screen.getAllByRole("button", { expanded: true }).map(button => button.textContent);

        // Events (open, its only folder open) before Reports (open, 2025 open); 2024 is collapsed.
        expect(sections).toEqual(["Events1", "Events 2026 · Investor Day1", "Reports2", "Reports 20251"]);

        expect(screen.getByRole("button", { expanded: false })).toHaveTextContent("Reports 20241");

        expect(screen.queryByText("Annual Report 2024")).toBeNull();

        fireEvent.click(screen.getByRole("button", { expanded: false }));

        expect(screen.getByText("Annual Report 2024")).toBeInTheDocument();
    });

    it("opens the signed file in a new tab without a referrer and offers its text", () => {
        const onShowText = vi.fn();

        render(<DocumentTree documents={[base]} onShowText={onShowText} ticker="ACME" />);

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
        render(<DocumentTree documents={[DOCUMENTS[2]]} onShowText={vi.fn()} ticker="ACME" />);

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
