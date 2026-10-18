// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EarningsDocumentSearchResponse } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { DocumentSearchResults } from "@/routes/$ticker/documents/-components/document-search";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params, search, to }: {
        children: React.ReactNode;
        params: Record<string, string>;
        search?: Record<string, string>;
        to: string;
    }) => (
        <a data-search={JSON.stringify(search ?? {})} href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>
            {children}
        </a>
    ),
}));

// The results body is rendered with its data directly: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useEarningsDocumentSearch: vi.fn(),
    useEarningsSearch: vi.fn(),
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ seekMs: null }),
}));

afterEach(cleanup);

const HIT: EarningsDocumentSearchResponse["hits"][number] = {
    cik: "0000000001",
    document_id: "00000000-0000-4000-8000-000000000001",
    event_id: null,
    expires_at: "2026-10-18T12:15:00.000Z",
    heading: "Capital allocation",
    kind: "annual_report",
    page: 14,
    period: "FY",
    score: 0.8123,
    section: "annual_reports",
    symbol: "ACME",
    table: "company_documents",
    text: "Our capital allocation priorities remain investment, dividends and buybacks.",
    title: "Annual Report 2025",
    url: "https://r2.example.com/docs/annual-report.pdf?X-Amz-Signature=secret",
    year: 2025,
};

describe("DocumentSearchResults", () => {
    it("shows each passage with its document, year and page and opens the PDF at that page", () => {
        render(<DocumentSearchResults data={{ hits: [HIT], query: "capital allocation" }} error={null} isLoading={false} />);

        expect(screen.getByText("Annual Report 2025 · 2025 · p. 14")).toBeInTheDocument();

        expect(screen.getByText("annual report")).toBeInTheDocument();

        // The query terms are highlighted.
        expect(screen.getByText("capital", { selector: "mark" })).toBeInTheDocument();

        const open = screen.getByRole("link", { name: "Open page" });

        expect(open).toHaveAttribute("href", `${HIT.url}#page=14`);

        expect(open).toHaveAttribute("rel", "noopener noreferrer");

        expect(screen.queryByText("Open event")).toBeNull();
    });

    it("links a call document's event and says when no file is stored", () => {
        const hit = {
            ...HIT,
            event_id: "11111111-1111-4111-8111-111111111111",
            page: null,
            table: "event_documents" as const,
            title: null,
            url: null,
            year: null,
        };

        render(<DocumentSearchResults data={{ hits: [hit], query: "dividends" }} error={null} isLoading={false} />);

        expect(screen.getByText("Untitled document · undated")).toBeInTheDocument();

        expect(screen.getByText("No stored file")).toBeInTheDocument();

        expect(screen.getByText("Open event")).toHaveAttribute("href", "/ACME/earnings-calls/11111111-1111-4111-8111-111111111111");
    });

    it("renders empty answers and the plan gate as states", () => {
        const { rerender } = render(<DocumentSearchResults data={{ hits: [], query: "x" }} error={null} isLoading={false} />);

        expect(screen.getByText("No passages found")).toBeInTheDocument();

        rerender(<DocumentSearchResults data={null} error={new ApiRequestError(403, { error: "Forbidden", message: "This endpoint requires STANDARD plan." })} isLoading={false} />);

        expect(screen.getByText("Your plan does not include document search")).toBeInTheDocument();

        expect(screen.getByText("STANDARD")).toBeInTheDocument();
    });
});
