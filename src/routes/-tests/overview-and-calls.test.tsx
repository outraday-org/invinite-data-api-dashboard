// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { columnsForTab, loadedCount } from "@/routes/$ticker/earnings-calls/index";
import { CoverageCard, OverviewTilesView } from "@/routes/$ticker/index";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params = {}, search, to }: { children: React.ReactNode; params?: Record<string, string>; search?: Record<string, string>; to: string }) => {
        const path = Object.entries(params).reduce((value, [key, param]) => value.replace(`$${key}`, param), to);

        const query = new URLSearchParams(search ?? {}).toString();

        return <a href={query ? `${path}?${query}` : path}>{children}</a>;
    },
}));

vi.mock("@/lib/api/queries", () => ({}));

afterEach(cleanup);

describe("overview", () => {
    it("coverage badges link their sections (metrics → the ratios tab)", () => {
        render(<CoverageCard coverage={{ families: [{ family: "dividends", through: "2026-11-01" }, { family: "metrics", through: null }, { family: "people", through: null }] } as never} ticker="AAPL" />);

        expect(screen.getByText("dividends through Nov 1, 2026").closest("a")).toHaveAttribute("href", "/AAPL/dividends");

        expect(screen.getByText("financial metrics").closest("a")).toHaveAttribute("href", "/AAPL/financials?view=ratios");

        expect(screen.getByText("people").closest("a")).toBeNull();
    });

    it("tiles: the next call links to it, the latest filing to the filings, the website and IR site", () => {
        render(
            <OverviewTilesView
                filing={{ accession: "0000320193-25-000079", filed_at: "2025-10-31T00:00:00Z", form: "10-K" }}
                filingLoading={false}
                homepage="https://www.apple.com"
                investorRelations="https://investor.apple.com"
                nextCall={CALENDAR_EVENT}
                nextLoading={false}
                ticker="AAPL"
            />,
        );

        expect(screen.getByText(/^Q3 FY2026 · /).closest("a")).toHaveAttribute("href", `/MLCO/earnings-calls/${CALENDAR_EVENT.event_id}`);

        expect(screen.getByRole("link", { name: "10-K · Oct 31, 2025" })).toHaveAttribute("href", "/AAPL/filings");

        expect(screen.getByRole("link", { name: "Investor relations" })).toHaveAttribute("href", "https://investor.apple.com");
    });
});

describe("calls list", () => {
    it("counts read \"40+\" while more pages exist", () => {
        expect(loadedCount(40, true)).toBe("40+");

        expect(loadedCount(12, false)).toBe("12");
    });

    it("the Upcoming tab has no Started / Ended columns", () => {
        const columns = [{ id: "fiscal_period" }, { id: "started_at" }, { id: "ended_at" }, { id: "materials" }];

        expect(columnsForTab(columns, "upcoming").map(column => column.id)).toEqual(["fiscal_period", "materials"]);

        expect(columnsForTab(columns, "past")).toHaveLength(4);
    });
});
