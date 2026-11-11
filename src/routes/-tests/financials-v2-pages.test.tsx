// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinancialsStatementsView } from "@/components/financials-presentation/financials-statements-view";
import { addFactTypes, buildTreeRows } from "@/components/financials-presentation/utils";
import { ApiRequestError } from "@/lib/api/errors";
import { completePeriodsOnly, periodLabel, segmentLines, statementLines } from "@/lib/financials/statements";
import {
    V2_AS_REPORTED_DETAILED,
    V2_AS_REPORTED_PRESENTATION,
    V2_CAGR,
    V2_GROWTH,
    V2_RATIOS,
    V2_SEGMENTS,
    V2_STANDARDIZED,
    V2_STANDARDIZED_PENDING,
} from "@/lib/financials/v2-fixtures";
import { cagrRows, CagrView } from "@/routes/$ticker/financials-cagr/index";
import { GrowthView } from "@/routes/$ticker/financials-growth/index";
import { ratioRows, RatiosView } from "@/routes/$ticker/financials-ratios/index";
import { SegmentsView } from "@/routes/$ticker/segmented-financials/index";

// The page modules' routes need a router; the pure views do not.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useV2CagrInfinite: vi.fn(),
    useV2FinancialsInfinite: vi.fn(),
    useV2GrowthInfinite: vi.fn(),
    useV2RatiosInfinite: vi.fn(),
    useV2SegmentsInfinite: vi.fn(),
}));

afterEach(cleanup);

const list = { error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("Statements (`/v1/financials/*`)", () => {
    it("summary (standardized): one line per metric, one column per period, the filing in the header tooltip, Load more by cursor", () => {
        const onLoadMore = vi.fn();

        render(
            <FinancialsStatementsView
                {...list}
                basis="standardized"
                hasNextPage
                onLoadMore={onLoadMore}
                pages={[V2_STANDARDIZED]}
                statement="income-statement"
                view="summary"
            />,
        );

        expect(screen.getByText("Q3 2026").closest("th")).toHaveAttribute("title", "10-Q filed 2026-08-01 · 0000320193-26-000073");

        expect(screen.getByText("Q2 2026").closest("th")?.getAttribute("title")).toContain("restated by a later filing");

        const revenue = screen.getByText("Total Revenue").closest("tr")!;

        expect(within(revenue).getAllByRole("cell")).toHaveLength(3);

        // Net income is stated for the newest period only: the older cell is a dash.
        const netIncome = screen.getByText("Net Income").closest("tr")!;

        expect(within(netIncome).getByText("—")).toBeInTheDocument();

        expect(screen.getByTestId("financials-meta")).toHaveTextContent("Values in USD");

        fireEvent.click(screen.getByRole("button", { name: /Load more/ }));

        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it("detailed (as reported): the company's caption, a derived value italic with its formula", () => {
        render(<FinancialsStatementsView {...list} basis="as-reported" pages={[V2_AS_REPORTED_DETAILED]} statement="income-statement" view="detailed" />);

        expect(screen.getByText("Net income")).toHaveAttribute("title", "us-gaap:NetIncomeLoss");

        // No company caption: the taxonomy label.
        expect(screen.getByText("Revenues")).toBeInTheDocument();

        const derived = within(screen.getByText("Net income").closest("tr")!).getByTitle(/Formula: FY - Q1 - Q2 - Q3/);

        expect(derived).toHaveClass("italic");

        expect(derived.getAttribute("title")).toContain("Computed by Invinite");
    });

    it("presentation (as reported): the filer's tree with its total (`is_total`)", () => {
        render(<FinancialsStatementsView {...list} basis="as-reported" pages={[V2_AS_REPORTED_PRESENTATION]} statement="income-statement" view="presentation" />);

        expect(screen.getByText("Total net sales")).toHaveClass("font-semibold");

        expect(screen.getByText("Products")).toBeInTheDocument();

        expect(screen.getByText("Services")).toBeInTheDocument();
    });

    it("pending coverage: the statements-are-being-prepared notice, never 'No financial data'", () => {
        render(<FinancialsStatementsView {...list} basis="standardized" pages={[V2_STANDARDIZED_PENDING]} statement="income-statement" view="summary" />);

        expect(screen.getByText("Statements are being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText("No financial data available.")).toBeNull();
    });

    it("a statement the loaded periods do not state is a genuine empty for a complete answer", () => {
        render(<FinancialsStatementsView {...list} basis="standardized" pages={[V2_STANDARDIZED]} statement="balance-sheet" view="summary" />);

        expect(screen.getByText("No financial data available.")).toBeInTheDocument();
    });

    it("the plan gate of a PRO view (403 plan_required) and 404 not_covered are states, no table", () => {
        const { unmount } = render(
            <FinancialsStatementsView
                {...list}
                basis="standardized"
                error={problem(403, "plan_required", "This view needs the PRO plan")}
                pages={[]}
                statement="income-statement"
                view="presentation"
            />,
        );

        expect(screen.getByText("Your plan does not include this view")).toBeInTheDocument();

        expect(screen.getByText("This view needs the PRO plan")).toBeInTheDocument();

        unmount();

        render(
            <FinancialsStatementsView
                {...list}
                basis="standardized"
                error={problem(404, "not_covered", "No statements are stored for this company")}
                pages={[]}
                statement="income-statement"
                view="summary"
            />,
        );

        expect(screen.getByText("No data for this company")).toBeInTheDocument();

        expect(screen.queryByRole("table")).toBeNull();
    });

    it("any other problem shows its detail, code and request id", () => {
        const error = new ApiRequestError(500, { error: "internal_error", message: "Something broke", requestId: "req_123" });

        render(<FinancialsStatementsView {...list} basis="standardized" error={error} pages={[]} statement="income-statement" view="summary" />);

        expect(screen.getByText("Something broke (internal_error, request req_123)")).toBeInTheDocument();
    });

    it("a complete page with more pages after it is no genuine empty yet", () => {
        render(<FinancialsStatementsView {...list} basis="standardized" hasNextPage pages={[V2_STANDARDIZED]} statement="balance-sheet" view="summary" />);

        expect(screen.queryByText("No financial data available.")).toBeNull();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });
});

describe("Statement adapters", () => {
    it("period labels: annual rows (fiscal_quarter 4) read as the year, the rest as Qn", () => {
        expect(periodLabel({ fiscal_quarter: 4, fiscal_year: 2025, period: "annual" })).toBe("2025");

        expect(periodLabel({ fiscal_quarter: 4, fiscal_year: 2025, period: "ttm" })).toBe("Q4 2025");
    });

    it("statement lines keep the newest period's order and leave missing cells undefined", () => {
        const lines = statementLines(V2_STANDARDIZED.data, "income-statement", true);

        expect(lines.map(line => line.id)).toEqual(["is_net_income", "is_total_revenue"]);

        expect(lines[0].values[1]).toBeUndefined();

        expect(lines[1].values.map(cell => cell?.value)).toEqual([94_036_000_000, 95_359_000_000]);
    });

    it("statement lines skip a fact of an unexpected shape instead of crashing", () => {
        const row = { ...V2_STANDARDIZED.data[0], statements: { income_statement: { facts: { is_bad: null, is_ok: 5 } } } };

        const lines = statementLines([row] as unknown as typeof V2_STANDARDIZED.data, "income-statement", true);

        expect(lines.map(line => line.id)).toEqual(["is_ok"]);
    });

    it("presentation tree rows read `is_total` (v1 `isTotal`) and a standardized node by `metric_id`", () => {
        const out: Parameters<typeof buildTreeRows>[3] = [];

        buildTreeRows(addFactTypes(V2_AS_REPORTED_PRESENTATION.data[0].statements.income_statement!.facts), 0, null, out);

        expect(out.map(row => [row.metricId, row.isTotal, row.depth])).toEqual([
            ["us-gaap:Revenues", true, 0],
            ["us-gaap:ProductRevenue", false, 1],
            ["us-gaap:ServiceRevenue", false, 1],
        ]);

        const standardized: typeof out = [];

        buildTreeRows(addFactTypes([{ children: [{ metric_id: "is_cost_of_revenue", value: 2 }], metric_id: "is_gross_profit", value: 5 }]), 0, null, standardized);

        expect(standardized.map(row => [row.metricId, row.label, row.parentId])).toEqual([
            ["is_gross_profit", "Gross Profit", null],
            ["is_cost_of_revenue", "Cost Of Revenue", "is_gross_profit"],
        ]);
    });

    it("completePeriodsOnly drops the last (maybe partial) period while more pages exist", () => {
        expect(completePeriodsOnly(V2_GROWTH.data, true).map(periodLabel)).toEqual(["Q3 2026", "Q3 2026"]);

        expect(completePeriodsOnly(V2_GROWTH.data, false)).toHaveLength(3);

        expect(completePeriodsOnly(V2_GROWTH.data.slice(0, 2), true)).toHaveLength(2);
    });
});

describe("Metrics (`/v1/metrics/*`, `/v1/segments`)", () => {
    it("ratios: one line per metric × category (leverage = v1 solvency), `_pct` as a percent", () => {
        expect(ratioRows(V2_RATIOS.data).map(row => [row.group, row.label])).toEqual([
            // `formatMetricId` drops the first word (the statement prefix of a standardized id), as on v1.
            ["Margin Pct", "Profitability"],
            ["To Equity", "Leverage"],
        ]);

        render(<RatiosView {...list} pages={[V2_RATIOS]} />);

        expect(screen.getByText("Leverage")).toBeInTheDocument();

        expect(screen.getByText("46.90%")).toBeInTheDocument();
    });

    it("ratios: pending coverage is the metrics-being-prepared notice", () => {
        render(<RatiosView {...list} pages={[{ ...V2_RATIOS, data: [], meta: { coverage: { state: "pending" } } }]} />);

        expect(screen.getByText("Metrics are being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText("No financial data available.")).toBeNull();
    });

    it("growth: one line per basis × metric; the half-loaded last period waits for the next page", () => {
        render(<GrowthView {...list} hasNextPage pages={[V2_GROWTH]} />);

        expect(screen.getByText("Total Revenue (YoY)")).toBeInTheDocument();

        expect(screen.getByText("Total Revenue (QoQ)")).toBeInTheDocument();

        // v2 serves growth as a fraction (0.096 = 9.6 %)
        expect(screen.getByText("9.60%")).toBeInTheDocument();

        expect(screen.getByText("-1.40%")).toBeInTheDocument();

        expect(screen.getByText("Q3 2026")).toBeInTheDocument();

        expect(screen.queryByText("Q2 2026")).toBeNull();

        expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument();
    });

    it("CAGR: one line per metric × horizon, the longest horizon first", () => {
        expect(cagrRows(V2_CAGR.data).map(row => row.label)).toEqual(["Total Revenue (10Y CAGR)", "Total Revenue (3Y CAGR)"]);

        render(<CagrView {...list} pages={[V2_CAGR]} />);

        expect(screen.getByText("2025")).toBeInTheDocument();
    });

    it("segments: dimensions in words, the segment picker filters the loaded rows", () => {
        expect(segmentLines(V2_SEGMENTS.data).map(line => [line.segmentId, line.details, Object.keys(line.values)])).toEqual([
            ["seg_revenue_business_segment", "Americas", ["Q3 2026"]],
            ["seg_revenue_product", "IPhone", ["Q3 2026", "Q2 2026"]],
        ]);

        const { unmount } = render(<SegmentsView {...list} pages={[V2_SEGMENTS]} segmentId="seg_revenue_product" />);

        expect(screen.getByText("Revenue Product · IPhone")).toBeInTheDocument();

        expect(screen.queryByText(/Americas/)).toBeNull();

        unmount();

        render(<SegmentsView {...list} hasNextPage pages={[V2_SEGMENTS]} segmentId="seg_revenue_geographic" />);

        expect(screen.getByText(/None of the loaded segment rows match this segment/)).toBeInTheDocument();
    });
});
