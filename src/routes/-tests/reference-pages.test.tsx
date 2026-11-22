// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinancialMetricsTable } from "@/components/financial-metrics/financial-metrics-table";
import { FinancialsFlatTable } from "@/components/financials-presentation/financials-flat-table";
import { ApiStatusView, familyReach, LicensingView, overallStatus, StatusDot, statusSummary, uptimeText } from "@/components/reference/api-status";
import { CompaniesList, companiesSort, fiscalYearEndText } from "@/components/reference/companies-list";
import { FiscalPeriodsView, latestFiscalYearEnd } from "@/components/reference/fiscal-periods-card";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { ApiRequestError } from "@/lib/api/errors";
import {
    AAPL_FISCAL_PERIODS,
    V2_API_STATUS,
    V2_COMPANIES,
    V2_DIVIDENDS,
    V2_LICENSING,
    V2_MAPPING_RULES,
    V2_METRIC_CATALOG,
} from "@/lib/reference/reference-fixtures";
import { dividendsRequest, DividendsView, dividendTypeLabel } from "@/routes/$ticker/dividends/index";
import { CATALOG_SPECS, catalogCountText, CatalogTable } from "@/routes/catalog";
import { companiesRequest } from "@/routes/instruments";
import { holidaysRequest } from "@/routes/market-holidays";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params = {}, search, to, ...rest }: Record<string, unknown> & { children: React.ReactNode; params?: Record<string, string>; search?: Record<string, string>; to: string }) => {
        const path = Object.entries(params).reduce((acc, [key, value]) => acc.replace(`$${key}`, value), to);

        const query = search ? `?${new URLSearchParams(search).toString()}` : "";

        return <a aria-label={rest["aria-label"] as string | undefined} href={`${path}${query}`}>{children}</a>;
    },
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    // The flat statement table's "Explain this number" dialog: idle (no value clicked).
    useV2Fact: () => ({ data: undefined, error: null, isLoading: false }),
    useV2FactPlaces: () => ({ data: undefined, error: null, isLoading: false }),
}));

vi.mock("@/components/ui/credit-hint", async importOriginal => ({
    ...await importOriginal<object>(),
    PlanBadge: () => null,
    usePlanAllows: () => null,
}));

afterEach(cleanup);

const list = { error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

describe("/catalog", () => {
    const metricsSpec = CATALOG_SPECS.metrics;

    it("a metric label's link (?q=<metric_id>) shows that metric alone and says how many were loaded", () => {
        render(<CatalogTable list={{ ...list, rows: V2_METRIC_CATALOG.data }} query="is_total_revenue" scope="all" spec={metricsSpec} />);

        expect(screen.getByText("Total Revenue")).toBeInTheDocument();

        expect(screen.queryByText("Revenue Growth Drivers")).toBeNull();

        expect(screen.getByTestId("catalog-count")).toHaveTextContent("1 of 4 metrics");
    });

    it("while pages are still loading the count says so; no match = its own line", () => {
        expect(catalogCountText(4, 4, "metrics", false)).toBe("4 metrics");

        expect(catalogCountText(4, 200, "metrics", true)).toBe("4 of 200+ metrics");

        render(<CatalogTable list={{ ...list, rows: V2_METRIC_CATALOG.data }} query="zzz" scope="all" spec={metricsSpec} />);

        expect(screen.getByText("No metrics match \"zzz\".")).toBeInTheDocument();
    });

    it("a failed first page is an error state, never an empty catalog", () => {
        render(<CatalogTable list={{ ...list, error: new Error("Network down"), rows: [] }} query={undefined} scope="all" spec={metricsSpec} />);

        expect(screen.getByText("Failed to load the metrics")).toBeInTheDocument();

        expect(screen.queryByText("No metrics.")).toBeNull();
    });

    it("a statement metric links its mapping rules; a derived one has none", () => {
        render(<CatalogTable list={{ ...list, rows: V2_METRIC_CATALOG.data }} query={undefined} scope="all" spec={metricsSpec} />);

        const revenue = screen.getByText("Total Revenue").closest("tr")!;

        expect(within(revenue).getByRole("link", { name: "Mapping rules" })).toHaveAttribute("href", "/catalog?metric=is_total_revenue&tab=mapping-rules");

        expect(within(screen.getByText("Gross Margin").closest("tr")!).queryByRole("link")).toBeNull();

        expect(within(screen.getByText("Gross Margin").closest("tr")!).getByText("Derived")).toBeInTheDocument();
    });

    it("mapping rules: concept or formula, the parent, and the next page while it loads", () => {
        render(<CatalogTable list={{ ...list, hasNextPage: true, rows: V2_MAPPING_RULES.data }} query={undefined} scope="all" spec={CATALOG_SPECS["mapping-rules"]} />);

        expect(screen.getByText("us_gaap:AccountsNotesAndLoansReceivableNetCurrent (primary)")).toBeInTheDocument();

        expect(screen.getByText("bs_common_shareholders_equity + bs_additional_paid_in_capital")).toBeInTheDocument();

        expect(screen.getByText("bs_total_receivables_current")).toBeInTheDocument();

        expect(screen.getByTestId("catalog-count")).toHaveTextContent("2 of 2+ mapping rules");
    });
});

describe("metric catalog links on financial metric labels", () => {
    it("a catalog metric links /catalog?q=<id>; an as-reported concept gets no link", () => {
        render(
            <>
                <MetricCatalogLink label="Total Revenue" metricId="is_total_revenue" />
                <MetricCatalogLink label="Revenues" metricId="us-gaap:Revenues" />
            </>,
        );

        expect(screen.getByRole("link", { name: "Total Revenue in the metric catalog" })).toHaveAttribute("href", "/catalog?q=is_total_revenue");

        expect(screen.queryByRole("link", { name: "Revenues in the metric catalog" })).toBeNull();
    });

    it("a statement line links its metric; an as-reported concept line gets none", () => {
        render(<FinancialsFlatTable columns={[{ label: "FY2025", title: "" }]} lines={[{ id: "is_total_revenue", label: "Total Revenue", values: [] }, { id: "Revenues", label: "Revenues", values: [] }]} />);

        expect(screen.getAllByRole("link")).toHaveLength(1);

        expect(screen.getByRole("link", { name: "Total Revenue in the metric catalog" })).toHaveAttribute("href", "/catalog?q=is_total_revenue");
    });

    it("the ratios table links the metric named in its first column", () => {
        render(<FinancialMetricsTable periodLabels={["FY2025"]} rows={[{ group: "Gross Margin Pct", key: "ratio_gross_margin_pct:profitability", label: "Profitability", metricId: "ratio_gross_margin_pct", values: { FY2025: 46.2 } }]} />);

        expect(screen.getByRole("link", { name: "Gross Margin Pct in the metric catalog" })).toHaveAttribute("href", "/catalog?q=ratio_gross_margin_pct");
    });
});

describe("/instruments Companies tab (`GET /v1/companies`)", () => {
    it("rows link the ticker page and the filer page; sector and fiscal year end shown", () => {
        render(<CompaniesList {...list} hasNextPage pages={[V2_COMPANIES]} scope="us" />);

        expect(screen.getByRole("link", { name: "AAPL" })).toHaveAttribute("href", "/AAPL");

        const googl = screen.getByRole("link", { name: "GOOGL" }).closest("tr")!;

        expect(within(googl).getByRole("link", { name: "0001652044" })).toHaveAttribute("href", "/sec/1652044");

        expect(within(googl).getByText("Dec 31")).toBeInTheDocument();

        expect(within(googl).getByText("Nasdaq")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("the shared search, exchange and sort map to the companies operation; the sector is its own", () => {
        expect(companiesRequest({ exchange: "XNAS", q: "apple", sector: "Technology", sort: "-symbol", view: "companies" })).toEqual({
            enabled: true,
            exchange: ["XNAS"],
            limit: 50,
            q: "apple",
            sector: ["Technology"],
            sort: "-ticker",
        });

        expect(companiesSort(undefined)).toBeUndefined();

        expect(companiesSort("name")).toBe("name");

        expect(fiscalYearEndText("09-30")).toBe("Sep 30");

        expect(fiscalYearEndText(null)).toBe("—");

        expect(fiscalYearEndText("2026-09")).toBe("2026-09");
    });
});

describe("status widget (`/status`, `/status/licensing`)", () => {
    it("overall = the worst family; the summary names the families; uptime in percent, none = —", () => {
        expect(overallStatus(V2_API_STATUS.services)).toBe("outage");

        expect(overallStatus(null)).toBe("unknown");

        expect(overallStatus([{ status: "operational" }])).toBe("operational");

        expect(statusSummary(V2_API_STATUS.services)).toBe("Outage: News · Degraded: SEC filings, Institutional ownership");

        expect(statusSummary([{ family: "company", status: "operational" }])).toBe("All products operational");

        expect(uptimeText(0.989)).toBe("98.9%");

        expect(uptimeText(null)).toBe("—");
    });

    it("the account card lists every product, the universe and the docs groups", () => {
        render(<ApiStatusView status={V2_API_STATUS} />);

        const news = screen.getByText("News").closest("tr")!;

        expect(within(news).getByText("Outage")).toBeInTheDocument();

        expect(within(news).getAllByText("98.3%")).toHaveLength(2);

        expect(screen.getByTestId("api-status-universe")).toHaveTextContent("6,023 listed companies");

        expect(screen.getByText("Per API group: uptime and latency")).toBeInTheDocument();

        expect(screen.getByText("≤ 800 ms")).toBeInTheDocument();
    });

    it("`services: null` = no table, a sentence", () => {
        render(<ApiStatusView status={{ ...V2_API_STATUS, groups: null, services: null }} />);

        expect(screen.getByText("The API states no product status right now.")).toBeInTheDocument();

        expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    });

    it("the sidebar dot carries the summary for screen readers", () => {
        render(<StatusDot status="degraded" summary="Degraded: SEC filings" />);

        expect(screen.getByTestId("api-status-dot")).toHaveAttribute("title", "Degraded: SEC filings");

        expect(screen.getByRole("img", { name: "Degraded: SEC filings" })).toBeInTheDocument();
    });

    it("licensing: the plan's rights and the routes it reaches per family", () => {
        render(<LicensingView licensing={V2_LICENSING} plan="standard" />);

        const rights = within(screen.getByTestId("licensing-rights"));

        expect(rights.getByText("AI retrieval (RAG)").closest("li")).toHaveTextContent("Allowed");

        expect(rights.getByText("Redistribute").closest("li")).toHaveTextContent("Not on your plan");

        expect(screen.getByText("Draft")).toBeInTheDocument();

        expect(familyReach(V2_LICENSING.families, "standard")).toEqual([
            { family: "company", reachable: 2, total: 2 },
            { family: "financials", reachable: 1, total: 2 },
        ]);

        expect(familyReach(V2_LICENSING.families, "free")[1]).toMatchObject({ reachable: 0 });
    });
});

describe("overview: fiscal periods (`/v1/fiscal-periods`)", () => {
    it("newest first, 8 shown, Show all; the latest fiscal year end from the newest Q4", () => {
        render(<FiscalPeriodsView error={null} isLoading={false} periods={AAPL_FISCAL_PERIODS} ticker="AAPL" />);

        expect(screen.getByText("The latest fiscal year ended Sep 27, 2025. Each fiscal quarter with the calendar quarter it falls in.")).toBeInTheDocument();

        const firstRow = screen.getAllByRole("row")[1];

        expect(firstRow).toHaveTextContent("FY2026 Q2");

        expect(firstRow).toHaveTextContent("2026 Q1");

        expect(screen.queryByText("FY2024 Q1")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Show all 10" }));

        expect(screen.getByText("FY2024 Q1")).toBeInTheDocument();

        expect(latestFiscalYearEnd([])).toBeNull();
    });
});

describe("dividends and holidays filters", () => {
    it("dividends: type in words (unknown code as itself), range sent as ex_date, a swapped range ordered", () => {
        render(<DividendsView {...list} filtered={false} pages={[V2_DIVIDENDS]} ticker="AAPL" />);

        expect(screen.getByText("Regular cash")).toBeInTheDocument();

        expect(screen.getByText("Special cash")).toBeInTheDocument();

        expect(screen.getByText("XX")).toBeInTheDocument();

        expect(dividendTypeLabel(null)).toBe("—");

        expect(dividendsRequest("AAPL", { from: "2026-01-01", sort: "pay_date", to: "2025-01-01" })).toEqual({
            exDateGte: "2025-01-01",
            exDateLte: "2026-01-01",
            limit: 40,
            sort: "pay_date",
            symbol: "AAPL",
        });

        expect(dividendsRequest("AAPL", {})).toMatchObject({ exDateGte: undefined, sort: "-ex_date" });
    });

    it("dividends: an empty range says so", () => {
        render(<DividendsView {...list} filtered pages={[{ ...V2_DIVIDENDS, data: [] }]} ticker="AAPL" />);

        expect(screen.getByText("No dividends with an ex-date in this range.")).toBeInTheDocument();
    });

    it("dividends: a 404 not_covered is a notice in the API's words, not 'Failed to load' (UI walk F093)", () => {
        const error = new ApiRequestError(404, { error: "not_covered", message: "No dividend data is available for VOO." });

        render(<DividendsView {...list} error={error} filtered={false} pages={[]} ticker="VOO" />);

        expect(screen.getByText("No dividend data is available for VOO.")).toBeInTheDocument();

        expect(screen.getByText("Not covered")).toBeInTheDocument();

        expect(screen.queryByText("Failed to load dividends")).toBeNull();
    });

    it("holidays: the range narrows the tab, never leaves it", () => {
        const today = "2026-11-21";

        expect(holidaysRequest({}, today)).toEqual({ dateGte: today, dateLte: undefined, limit: 40, sort: "date" });

        expect(holidaysRequest({ from: "2027-01-01", to: "2027-12-31" }, today)).toMatchObject({ dateGte: "2027-01-01", dateLte: "2027-12-31" });

        expect(holidaysRequest({ from: "2020-01-01" }, today)).toMatchObject({ dateGte: today });

        expect(holidaysRequest({ tab: "past" }, today)).toEqual({ dateGte: undefined, dateLte: "2026-11-20", limit: 40, sort: "-date" });

        expect(holidaysRequest({ from: "2024-01-01", tab: "past", to: "2024-12-31" }, today)).toMatchObject({ dateGte: "2024-01-01", dateLte: "2024-12-31" });

        expect(holidaysRequest({ tab: "past", to: "2030-01-01" }, today)).toMatchObject({ dateLte: "2026-11-20" });

        // A swapped range is put in order.
        expect(holidaysRequest({ from: "2027-12-31", to: "2027-01-01" }, today)).toMatchObject({ dateGte: "2027-01-01", dateLte: "2027-12-31" });
    });
});
