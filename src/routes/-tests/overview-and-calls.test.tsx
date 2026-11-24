// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { addressLines, CompanyDescription, IdentifiersView, KeyFactsView, NextUpView, percentText, sharesSubText } from "@/routes/$ticker/-overview/company-overview";
import { CoverageSection } from "@/routes/$ticker/-overview/overview-parts";
import { callTabCounts, columnsForTab, loadedCount, recordingText, tabHasMore } from "@/routes/$ticker/earnings-calls/index";

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
    it("coverage rows link their sections (metrics → the ratios tab); a family without a page is text", () => {
        render(<CoverageSection coverage={{ families: [{ family: "dividends", through: "2026-11-01" }, { family: "metrics", through: null }, { family: "people", through: null }] } as never} ticker="AAPL" />);

        const dividends = screen.getByText("dividends").closest("a");

        expect(dividends).toHaveAttribute("href", "/AAPL/dividends");

        expect(dividends).toHaveTextContent("dividends through Nov 1, 2026");

        expect(screen.getByText("financial metrics").closest("a")).toHaveAttribute("href", "/AAPL/financials?view=ratios");

        expect(screen.getByText("people").closest("a")).toBeNull();

        // A compact list, not pills.
        expect(screen.getByTestId("coverage-list").tagName).toBe("UL");
    });

    it("next up: the next call links to it, the latest filing to the filings", () => {
        render(
            <NextUpView
                filing={{ accession: "0000320193-25-000079", filed_at: "2025-10-31T00:00:00Z", form: "10-K" }}
                filingLoading={false}
                nextCall={CALENDAR_EVENT}
                nextLoading={false}
                ticker="AAPL"
            />,
        );

        expect(screen.getByText(/^Q3 FY2026 · /).closest("a")).toHaveAttribute("href", `/MLCO/earnings-calls/${CALENDAR_EVENT.event_id}`);

        expect(screen.getByRole("link", { name: "10-K · Oct 31, 2025" })).toHaveAttribute("href", "/AAPL/filings");

        cleanup();

        render(<NextUpView filing={null} filingLoading={false} nextCall={null} nextLoading={false} ticker="AAPL" />);

        expect(screen.getByText("None scheduled")).toBeInTheDocument();
    });

    it("a long description is clamped to two lines with More / Less", () => {
        render(<CompanyDescription text={"Apple designs phones. ".repeat(12)} />);

        const more = screen.getByRole("button", { name: "More" });

        expect(screen.getByText(/Apple designs phones/).className).toContain("line-clamp-2");

        fireEvent.click(more);

        expect(screen.getByText(/Apple designs phones/).className).not.toContain("line-clamp-2");

        expect(screen.getByRole("button", { name: "Less" })).toHaveAttribute("aria-expanded", "true");
    });
});

describe("overview key facts and identifiers (O7 group 4)", () => {
    const AAPL = {
        cik: "0000320193",
        city: "CUPERTINO",
        composite_figi: "BBG000B9XRY4",
        country_code: "US",
        currency: "USD",
        employees: 166_000,
        exchange: "XNAS",
        filer_cik: "320193",
        homepage_url: "https://www.apple.com",
        industry: "Electronic Computers",
        insider_own_pct: 0.07,
        insider_own_shares: 9_898_119,
        inst_own_pct: 63.65,
        inst_own_shares: 9_250_375_827,
        investor_relations_url: "https://investor.apple.com",
        is_delisted: false,
        list_date: "1980-12-12",
        market_cap: 5_070_000_000_000,
        sector: "Technology",
        shares_outstanding: 14_840_000_000,
        short_float_pct: 1,
        short_float_shares: 144_791_472,
        state: "California",
        street: "ONE APPLE PARK WAY",
        zip_code: "95014",
    };

    it("ownership as the value with the share count as its sub-line; listing and classification (no Fama-French: the API removed the fields)", () => {
        render(<KeyFactsView company={AAPL} />);

        const facts = screen.getByTestId("company-key-facts");

        expect(within(facts).getByText("Institutional").parentElement).toHaveTextContent("Institutional63.65%9,250,375,827 shares");

        expect(within(facts).getByText("Insider").parentElement).toHaveTextContent("Insider0.07%9,898,119 shares");

        expect(within(facts).getByText("Short float").parentElement).toHaveTextContent("Short float1% of float144,791,472 shares");

        expect(within(facts).getByText("Market cap").nextSibling).toHaveTextContent("$5.07T");

        expect(within(facts).getByText("Listed since").nextSibling).toHaveTextContent("Dec 12, 1980");

        expect(facts).not.toHaveTextContent("Fama-French");

        // Listed: no status cell.
        expect(within(facts).queryByText("Status")).toBeNull();

        // 11 cells on 4 columns: no orphan; no cell is a "—".
        expect(facts.querySelectorAll("[data-slot=stat]")).toHaveLength(11);

        expect(facts).not.toHaveTextContent("—");
    });

    it("a null value is left out of the grid; a delisted company says so", () => {
        render(<KeyFactsView company={{ ...AAPL, employees: null, inst_own_pct: null, inst_own_shares: null, is_delisted: true, sector: null }} />);

        const facts = screen.getByTestId("company-key-facts");

        expect(within(facts).queryByText("Institutional")).toBeNull();

        expect(within(facts).queryByText("Employees")).toBeNull();

        expect(within(facts).getByText("Status").nextSibling).toHaveTextContent("Delisted");

        expect(percentText(null)).toBeNull();

        expect(sharesSubText(null)).toBeNull();

        expect(addressLines({ city: null, country_code: null, state: null, street: " ", zip_code: null })).toEqual([]);
    });

    it("identifiers: CIK links its filer page, FIGI, website and IR site (http(s) only), the address", () => {
        render(<IdentifiersView company={AAPL} />);

        const identifiers = screen.getByTestId("company-identifiers");

        expect(within(identifiers).getByRole("link", { name: "0000320193" })).toHaveAttribute("href", "/sec/320193");

        expect(within(identifiers).getByText("BBG000B9XRY4")).toBeInTheDocument();

        expect(within(identifiers).getByRole("link", { name: "Investor relations" })).toHaveAttribute("href", "https://investor.apple.com");

        expect(within(identifiers).getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://www.apple.com");

        expect(identifiers).toHaveTextContent("ONE APPLE PARK WAYCUPERTINO, California 95014 · US");

        cleanup();

        render(<IdentifiersView company={{ ...AAPL, composite_figi: null, homepage_url: "javascript:alert(1)", investor_relations_url: null }} />);

        expect(screen.queryByText("Links")).toBeNull();

        expect(screen.queryByText("FIGI")).toBeNull();

        expect(screen.queryByText("Former tickers")).toBeNull();
    });

    it("identifiers: former tickers (`expand=former_tickers`), each with where it was seen", () => {
        render(
            <IdentifiersView
                company={{
                    ...AAPL,
                    former_tickers: [
                        { exchange: "XNAS", first_seen_on: "2012-05-18", last_seen_on: "2022-06-08", source: "listing", ticker: "FB" },
                        { exchange: null, first_seen_on: null, last_seen_on: "2021-10-01", source: "registry", ticker: "FBK" },
                    ],
                }}
            />,
        );

        const formers = screen.getByTestId("former-tickers");

        expect(within(formers).getByText("FB · XNAS · May 18, 2012 – Jun 8, 2022 · Retired listing")).toBeInTheDocument();

        expect(within(formers).getByText("FBK · ? – Oct 1, 2021 · SEC company ticker file")).toBeInTheDocument();
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

    it("the Upcoming tab offers no \"Load more\" once a past call is loaded (UI walk F060)", () => {
        expect(tabHasMore("upcoming", 39, true)).toBe(false);

        expect(tabHasMore("upcoming", 0, true)).toBe(true);

        expect(tabHasMore("past", 39, true)).toBe(true);

        expect(tabHasMore("past", 39, false)).toBe(false);
    });

    it("the Upcoming tab has no Recording column", () => {
        const columns = [{ id: "fiscal_period" }, { id: "recording" }, { id: "materials" }];

        expect(columnsForTab(columns, "upcoming").map(column => column.id)).toEqual(["fiscal_period", "materials"]);

        expect(columnsForTab(columns, "past")).toHaveLength(3);
    });

    it("the Recording cell: start – end on one line, the shared zone once", () => {
        expect(recordingText("2026-11-24T04:06:00.000Z", "2026-11-24T04:59:00.000Z", "America/New_York")).toBe("11:06 PM – 11:59 PM EST");

        expect(recordingText("2026-11-24T04:06:00.000Z", null, "America/New_York")).toBe("from 11:06 PM EST");

        expect(recordingText(null, null)).toBe("—");
    });
});
