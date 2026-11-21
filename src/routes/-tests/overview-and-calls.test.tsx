// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { callTabCounts, columnsForTab, loadedCount } from "@/routes/$ticker/earnings-calls/index";
import { addressLines, CompanyFactTilesView, CoverageCard, OverviewTilesView, ownershipText } from "@/routes/$ticker/index";

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

describe("overview fact tiles (O7 group 4)", () => {
    const AAPL = {
        city: "CUPERTINO",
        composite_figi: "BBG000B9XRY4",
        country_code: "US",
        insider_own_pct: 0.07,
        insider_own_shares: 9_898_119,
        inst_own_pct: 63.65,
        inst_own_shares: 9_250_375_827,
        is_delisted: false,
        short_float_pct: 1,
        short_float_shares: 144_791_472,
        state: "California",
        street: "ONE APPLE PARK WAY",
        zip_code: "95014",
    };

    it("ownership, short float, address and listing from the company already fetched (no Fama-French: the API removed the fields)", () => {
        render(<CompanyFactTilesView company={AAPL} />);

        const tiles = screen.getByTestId("company-fact-tiles");

        expect(tiles).toHaveTextContent("63.65% · 9,250,375,827 shares");

        expect(tiles).toHaveTextContent("0.07% · 9,898,119 shares");

        expect(tiles).toHaveTextContent("1% of float · 144,791,472 shares");

        expect(tiles).toHaveTextContent("ONE APPLE PARK WAYCUPERTINO, California 95014 · US");

        expect(tiles).toHaveTextContent("FIGI BBG000B9XRY4");

        expect(screen.getByText("Listed")).toBeInTheDocument();

        // The Data API removed `fama_sector` / `fama_industry` (always null): no tile, and an answer without them renders.
        expect(tiles).not.toHaveTextContent("Fama-French");

        expect(screen.queryByText("Not stated")).toBeNull();
    });

    it("a delisted company says so; nothing stated reads as such", () => {
        render(<CompanyFactTilesView company={{ ...AAPL, composite_figi: null, inst_own_pct: null, inst_own_shares: null, is_delisted: true }} />);

        expect(screen.getByText("Delisted")).toBeInTheDocument();

        expect(screen.getByText("No FIGI")).toBeInTheDocument();

        expect(ownershipText(null, null)).toBeNull();

        expect(addressLines({ city: null, country_code: null, state: null, street: " ", zip_code: null })).toEqual([]);
    });
});

describe("calls list", () => {
    it("counts read \"40+\" while more pages exist", () => {
        expect(loadedCount(40, true)).toBe("40+");

        expect(loadedCount(12, false)).toBe("12");

        // Newest first: once a past call is loaded, every upcoming one is too.
        expect(callTabCounts(3, 37, true)).toEqual({ past: "37+", upcoming: "3" });

        expect(callTabCounts(40, 0, true)).toEqual({ past: "0+", upcoming: "40+" });
    });

    it("the Upcoming tab has no Started / Ended columns", () => {
        const columns = [{ id: "fiscal_period" }, { id: "started_at" }, { id: "ended_at" }, { id: "materials" }];

        expect(columnsForTab(columns, "upcoming").map(column => column.id)).toEqual(["fiscal_period", "materials"]);

        expect(columnsForTab(columns, "past")).toHaveLength(4);
    });
});
