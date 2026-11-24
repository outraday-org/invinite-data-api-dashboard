// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cagrRows, CagrView } from "@/components/financials-pages/cagr";
import { financialsSearchSchema, tabSearch } from "@/components/financials-pages/financials-search";
import { parseFiscalYear } from "@/components/financials-pages/fiscal-year-range";
import { GrowthView } from "@/components/financials-pages/growth";
import { filingChoices, PointInTimeBanner, PointInTimeControls } from "@/components/financials-pages/point-in-time";
import { ratioRows, RatiosView } from "@/components/financials-pages/ratios";
import { SegmentsView } from "@/components/financials-pages/segments";
import { segmentFilterOptions, SegmentsDetailedView } from "@/components/financials-pages/segments-detailed";
import { FactExplanationView } from "@/components/financials-presentation/fact-explain-dialog";
import { FinancialsStatementsView } from "@/components/financials-presentation/financials-statements-view";
import { addFactTypes, buildTreeRows } from "@/components/financials-presentation/utils";
import { highlightStyle } from "@/hooks/use-html-document-processing";
import { ApiRequestError } from "@/lib/api/errors";
import { factExplanationModel, factIdText, factPlaceTargets, readableFormula } from "@/lib/financials/fact-explanation";
import { completePeriodsOnly, periodLabel, segmentLines, statementLines } from "@/lib/financials/statements";
import {
    V2_AS_REPORTED_DETAILED,
    V2_AS_REPORTED_PRESENTATION,
    V2_CAGR,
    V2_FACT,
    V2_FACT_PLACES,
    V2_GROWTH,
    V2_RATIOS,
    V2_SEGMENTS,
    V2_SEGMENTS_DETAILED,
    V2_STANDARDIZED,
    V2_STANDARDIZED_AS_OF,
    V2_STANDARDIZED_DETAILED,
    V2_STANDARDIZED_PENDING,
} from "@/lib/financials/v2-fixtures";

// The page modules' routes need a router; the pure views do not.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    // The metric labels' catalog links (O7 group 7).
    Link: ({ children, search, to }: { children: React.ReactNode; search?: Record<string, string>; to: string }) => <a href={`${to}?${new URLSearchParams(search).toString()}`}>{children}</a>,
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useV2CagrInfinite: vi.fn(),
    // The explain dialog's two requests: idle until a value is clicked (then loading in these tests).
    useV2Fact: vi.fn((factId: null | string) => ({ data: undefined, error: null, isLoading: Boolean(factId) })),
    useV2FactPlaces: vi.fn((factId: null | string) => ({ data: undefined, error: null, isLoading: Boolean(factId) })),
    // The as-reported explanation's one request: the filing's documents, for a filed value's element link.
    useV2Filing: vi.fn((accession: null | string) => ({
        data: accession
            ? { accession, documents: [{ current_version_id: null, description: null, filename: "aapl-20260627.htm", source_url: "https://storage.example/aapl-20260627.htm", type: "10-Q" }], form: "10-Q" }
            : undefined,
        error: null,
        isLoading: false,
    })),
    useV2FinancialsInfinite: vi.fn(),
    useV2GrowthInfinite: vi.fn(),
    useV2RatiosInfinite: vi.fn(),
    useV2SegmentsDetailedInfinite: vi.fn(),
    useV2SegmentsInfinite: vi.fn(),
}));

// The framed document fetches its HTML through React Query: its props are what these views decide.
vi.mock("@/components/html/html-viewer", () => ({
    HtmlViewer: ({ highlightId, url }: { highlightId?: null | string; url: string }) => <div data-highlight={highlightId ?? undefined} data-testid="html-viewer" data-url={url} />,
}));

// The plan badges read `/v1/me` (outside these pure views): no badge.
vi.mock("@/components/ui/credit-hint", async importOriginal => ({
    ...await importOriginal<object>(),
    PlanBadge: () => null,
    usePlanAllows: () => null,
}));

afterEach(cleanup);

const list = { error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("Statements (`/v1/financials/*`)", () => {
    it("summary (standardized): one line per metric, one column per period, the filing in the header tooltip, Load older periods by cursor", () => {
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

        expect(screen.getByText("Q3 2026").closest("th")).toHaveAttribute("title", "10-Q filed Aug 1, 2026 · 0000320193-26-000073");

        expect(screen.getByText("Q2 2026").closest("th")?.getAttribute("title")).toContain("restated by a later filing");

        const revenue = screen.getByText("Total Revenue").closest("tr")!;

        expect(within(revenue).getAllByRole("cell")).toHaveLength(3);

        // Net income is stated for the newest period only: the older cell is a dash.
        const netIncome = screen.getByText("Net Income").closest("tr")!;

        expect(within(netIncome).getByText("—")).toBeInTheDocument();

        expect(screen.getByTestId("financials-meta")).toHaveTextContent("Values in USD");

        fireEvent.click(screen.getByRole("button", { name: /Load older periods/ }));

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

    it("detailed (as reported): a value explains itself — a derived one by formula, a filed one by its filing and element", () => {
        render(<FinancialsStatementsView {...list} basis="as-reported" pages={[V2_AS_REPORTED_DETAILED]} statement="income-statement" view="detailed" />);

        expect(screen.getByTestId("explain-hint")).toHaveTextContent("Click a value to explain it");

        fireEvent.click(screen.getByRole("button", { name: "Explain Net income, Q3 2026" }));

        const derived = screen.getByTestId("as-reported-explanation");

        expect(within(derived).getByText("Computed by Invinite")).toBeInTheDocument();

        expect(within(derived).getByText("FY - Q1 - Q2 - Q3")).toBeInTheDocument();

        expect(within(derived).getByText("us-gaap:NetIncomeLoss")).toBeInTheDocument();

        cleanup();

        render(<FinancialsStatementsView {...list} basis="as-reported" pages={[V2_AS_REPORTED_DETAILED]} statement="income-statement" view="detailed" />);

        fireEvent.click(screen.getByRole("button", { name: "Explain Revenues, Q3 2026" }));

        const filed = screen.getByTestId("as-reported-explanation");

        expect(within(filed).getByText("Reported by the company")).toBeInTheDocument();

        // The explanation, not the row chart.
        expect(screen.queryByRole("dialog", { name: /Revenues$/ })).toBeNull();

        // The filing's 10-Q opens framed at the value's element, which the viewer marks.
        fireEvent.click(within(filed).getByRole("button", { name: "Show the value in the filing" }));

        const viewer = screen.getByTestId("html-viewer");

        expect(viewer).toHaveAttribute("data-url", "https://storage.example/aapl-20260627.htm");

        expect(viewer).toHaveAttribute("data-highlight", "f-12");

        expect(screen.getByRole("link", { name: /Open in new tab/ })).toHaveAttribute("href", "https://storage.example/aapl-20260627.htm#f-12");
    });

    it("detailed (as reported): a computed value with a filing opens it at the top (no element stated)", () => {
        const page = structuredClone(V2_AS_REPORTED_DETAILED);

        page.data[0].statements.income_statement!.facts["us-gaap:NetIncomeLoss"].accession = "0000320193-26-000073";

        render(<FinancialsStatementsView {...list} basis="as-reported" pages={[page]} statement="income-statement" view="detailed" />);

        fireEvent.click(screen.getByRole("button", { name: "Explain Net income, Q3 2026" }));

        fireEvent.click(screen.getByRole("button", { name: "Open the filing" }));

        expect(screen.getByTestId("html-viewer")).not.toHaveAttribute("data-highlight");

        expect(screen.getByText(/no place in the document is stated/)).toBeInTheDocument();
    });

    it("detailed (standardized): the cell hands its filing + element to the explanation, which opens it", () => {
        const onOpen = vi.fn();

        render(<FactExplanationView fact={{ data: V2_FACT, error: null, isLoading: false }} filing={{ elementId: "f-76", onOpen }} formula={null} onOpenFiling={() => undefined} onOpenPlace={() => undefined} places={null} />);

        fireEvent.click(screen.getByRole("button", { name: "Show the value in the filing" }));

        expect(onOpen).toHaveBeenCalledTimes(1);

        cleanup();

        render(<FactExplanationView fact={{ data: V2_FACT, error: null, isLoading: false }} filing={{ elementId: null, onOpen }} formula={null} onOpenFiling={() => undefined} onOpenPlace={() => undefined} places={null} />);

        expect(screen.getByRole("button", { name: "Open the filing" })).toBeInTheDocument();
    });

    it("the highlight is a box-shadow ring in the brand green on the element id (quoted: any id is safe)", () => {
        const style = highlightStyle("f-12\"]x");

        expect(style.startsWith("[id=\"f-12\\\"]x\"]{box-shadow:0 0 0 2px oklch(0.545 0.149 146.3)")).toBe(true);

        expect(style).not.toContain("border:");
    });

    it("a tab change keeps the statement, layout, window and the period as shown; the chart closes", () => {
        const kept = { fyFrom: 2020, layout: "detailed", statement: "balance-sheet" } as const;

        expect(tabSearch({ ...kept, chart: "is_total_revenue" }, "as-reported")).toEqual({ ...kept, chart: undefined, period: undefined, view: "as-reported" });

        // Quarterly (the default) stays quarterly on CAGR, whose default is annual; CAGR's annual stays annual elsewhere.
        expect(tabSearch({ view: "ratios" }, "cagr").period).toBe("quarterly");

        expect(tabSearch({ view: "cagr" }, "standardized")).toEqual({ chart: undefined, period: "annual", view: undefined });

        expect(tabSearch({ period: "ttm", view: "as-reported" }, "standardized").period).toBe("ttm");
    });

    it("presentation (as reported): the filer's tree with its total (`is_total`)", () => {
        render(<FinancialsStatementsView {...list} basis="as-reported" pages={[V2_AS_REPORTED_PRESENTATION]} statement="income-statement" view="presentation" />);

        expect(screen.getByText("Total net sales")).toHaveClass("font-semibold");

        expect(screen.getByText("Products")).toBeInTheDocument();

        expect(screen.getByText("Services")).toBeInTheDocument();
    });

    it("presentation (standardized, collapsible): the tree toggle is named after its row and states its state (F102)", () => {
        render(<FinancialsStatementsView {...list} basis="standardized" pages={[V2_AS_REPORTED_PRESENTATION as never]} statement="income-statement" view="presentation" />);

        const toggle = screen.getByRole("button", { name: /^(Expand|Collapse) Total net sales$/ });

        const expanded = toggle.getAttribute("aria-expanded");

        expect(expanded === "true" || expanded === "false").toBe(true);

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute("aria-expanded", expanded === "true" ? "false" : "true");
    });

    it("presentation: a newest period without a filed tree (an as-reported Q4) still shows the older periods' tree (F037)", () => {
        const filed = V2_AS_REPORTED_PRESENTATION.data[0];

        const q4 = { ...filed, fiscal_quarter: 4, statements: { income_statement: { facts: [] } } };

        render(<FinancialsStatementsView {...list} basis="as-reported" pages={[{ ...V2_AS_REPORTED_PRESENTATION, data: [q4, filed] }]} statement="income-statement" view="presentation" />);

        expect(screen.getByText("Total net sales")).toBeInTheDocument();

        expect(screen.getByText("Products")).toBeInTheDocument();
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

        expect(screen.getByRole("button", { name: /Load older periods/ })).toBeInTheDocument();
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

        // The chart button names the metric with its category, never the category alone ("Chart Leverage", F099).
        expect(screen.getByRole("button", { name: "Chart To Equity · Leverage" })).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: "Chart Leverage" })).toBeNull();
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

        expect(screen.getByRole("button", { name: /Load older periods/ })).toBeInTheDocument();
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

describe("Point in time (`as_of`, `filing`, `meta.point_in_time`)", () => {
    it("the banner names the selector and goes back to the current renderings; a current answer shows none", () => {
        const onClear = vi.fn();

        const { rerender } = render(<PointInTimeBanner onClear={onClear} pointInTime={V2_STANDARDIZED_AS_OF.meta.point_in_time} />);

        expect(screen.getByTestId("point-in-time-banner")).toHaveTextContent("Point in time: as filed on or before May 1, 2026");

        fireEvent.click(screen.getByRole("button", { name: "Back to current" }));

        expect(onClear).toHaveBeenCalledTimes(1);

        rerender(<PointInTimeBanner onClear={onClear} pointInTime={{ as_of: null, filing: "0000320193-26-000052" }} />);

        expect(screen.getByTestId("point-in-time-banner")).toHaveTextContent("as rendered by filing 0000320193-26-000052");

        rerender(<PointInTimeBanner onClear={onClear} pointInTime={null} />);

        expect(screen.queryByTestId("point-in-time-banner")).toBeNull();
    });

    it("the filing choices: the loaded periods' filings, newest first, one per accession; a pinned one the pages lack is kept", () => {
        const second = { ...V2_STANDARDIZED.data[1], source: { ...V2_STANDARDIZED.data[1].source, filed_at: "2026-05-02T20:30:00Z" } };

        const page = { ...V2_STANDARDIZED, data: [V2_STANDARDIZED.data[0], second, V2_STANDARDIZED.data[0]] };

        expect(filingChoices([page], null)).toEqual([
            { accession: "0000320193-26-000073", label: "10-Q · Aug 1, 2026" },
            { accession: "0000320193-26-000052", label: "10-Q · May 2, 2026" },
        ]);

        expect(filingChoices([page], "0000320193-25-000079").at(0)).toEqual({ accession: "0000320193-25-000079", label: "0000320193-25-000079" });
    });

    it("an as-of day clears a pinned filing (the two exclude each other)", () => {
        const onChange = vi.fn();

        render(<PointInTimeControls asOf={undefined} choices={[]} filing="0000320193-26-000052" onChange={onChange} />);

        fireEvent.change(screen.getByLabelText("As of"), { target: { value: "2026-05-01" } });

        expect(onChange).toHaveBeenCalledWith({ asOf: "2026-05-01", filing: undefined });
    });

    it("the URL state: a typed `?horizon=5` (a number) and the select's \"5\" both read; bad values drop", () => {
        expect(financialsSearchSchema.parse({ fyFrom: "2021", horizon: 5 })).toMatchObject({ fyFrom: 2021, horizon: "5" });

        expect(financialsSearchSchema.parse({ asOf: "2026-13", filing: "nope", horizon: "7" })).toMatchObject({ asOf: undefined, filing: undefined, horizon: undefined });
    });

    it("fiscal years: only a four-digit year in the API's window", () => {
        expect(parseFiscalYear("2024")).toBe(2024);

        expect(parseFiscalYear(" 2024 ")).toBe(2024);

        expect(parseFiscalYear("20")).toBeNull();

        expect(parseFiscalYear("1800")).toBeNull();
    });
});

describe("Explain this number (`/v1/facts/{fact_id}`, `/v1/fact-places`)", () => {
    function loaded<T>(data: T) {
        return { data, error: null, isLoading: false };
    }

    it("a standardized detailed value is a button: it opens the explanation, not the chart", () => {
        render(
            <FinancialsStatementsView
                {...list}
                basis="standardized"
                pages={[V2_STANDARDIZED_DETAILED]}
                statement="income-statement"
                view="detailed"
            />,
        );

        expect(screen.getByTestId("explain-hint")).toHaveTextContent("Click a value to explain it");

        fireEvent.click(screen.getByRole("button", { name: "Explain Total Revenue, Q3 2026" }));

        expect(screen.getByRole("dialog", { name: "Explain this number" })).toBeInTheDocument();

        expect(screen.queryByRole("dialog", { name: /Total Revenue$/ })).toBeNull();
    });

    it("a summary value has no fact id: no button, the hint names the Detailed view", () => {
        render(<FinancialsStatementsView {...list} basis="standardized" pages={[V2_STANDARDIZED]} statement="income-statement" view="summary" />);

        expect(screen.queryByRole("button", { name: /^Explain / })).toBeNull();

        expect(screen.getByTestId("explain-hint")).toHaveTextContent("The Detailed view explains each value.");
    });

    it("the model reads the free-JSON rule and source facts (raw value as a string, the period from its dates)", () => {
        const model = factExplanationModel(V2_FACT);

        expect(model.metricName).toBe("Total Revenue");

        expect(model.rule).toMatchObject({ alias: "us_gaap:RevenueFromContractWithCustomerExcludingAssessedTax", formula: null, kind: "alias" });

        expect(model.sources).toEqual([{
            accession: "0000320193-26-000073",
            anchor: "f-76",
            basis: "receipt",
            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
            period: "Mar 29, 2026 – Jun 27, 2026",
            segment: null,
            value: 94_036_000_000,
        }]);

        expect(factExplanationModel({ ...V2_FACT, rule: "unexpected", source_facts: [42] } as never).sources[0]).toMatchObject({ concept: "—", value: null });
    });

    it("a derived fact (F036, live shape 2026-11-22): operands by raw fact id with their weighted values, the source value under `derived`, the formula in words", () => {
        const fy = "320193|RevenueFromContractWithCustomerExcludingAssessedTax|2025-09-28T00:00:00|2026-09-26T00:00:00|-|-";

        const q1 = "320193|RevenueFromContractWithCustomerExcludingAssessedTax|2025-09-28T00:00:00|2025-12-27T00:00:00|-|-";

        const derived = {
            ...V2_FACT,
            operands: [
                { depth: 1, id: fy, status: "resolved", stored_value: "478834000000", tier: "raw", type: "reported", weighted_value: "478834000000" },
                { depth: 1, id: q1, status: "resolved", stored_value: "143756000000", tier: "raw", type: "reported", weighted_value: "-143756000000" },
            ],
            source_facts: [{
                accession: "0000320193-26-000026",
                annotated_anchor: null,
                basis: "receipt",
                concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                derived: { accession: "0000320193-26-000026", formula_str: `${fy} - ${q1}`, tier: "enriched", value: "114477000000" },
                segment: null,
            }],
        } as never;

        const model = factExplanationModel(derived);

        expect(model.operands).toEqual([
            { label: "RevenueFromContractWithCustomerExcludingAssessedTax · Sep 28, 2025 – Sep 26, 2026", nested: 0, value: 478_834_000_000 },
            { label: "RevenueFromContractWithCustomerExcludingAssessedTax · Sep 28, 2025 – Dec 27, 2025", nested: 0, value: -143_756_000_000 },
        ]);

        expect(model.sources[0]?.value).toBe(114_477_000_000);

        expect(readableFormula(`${fy} - ${q1}`)).toBe("RevenueFromContractWithCustomerExcludingAssessedTax · Sep 28, 2025 – Sep 26, 2026 - RevenueFromContractWithCustomerExcludingAssessedTax · Sep 28, 2025 – Dec 27, 2025");

        expect(factIdText("not|a fact id")).toBeNull();

        render(<FactExplanationView fact={loaded(derived)} formula={`${fy} - ${q1}`} onOpenFiling={() => undefined} onOpenPlace={() => undefined} places={loaded(V2_FACT_PLACES)} />);

        const view = screen.getByTestId("fact-explanation");

        expect(view).not.toHaveTextContent("2025-09-28T00:00:00");

        expect(view).toHaveTextContent("478,834,000,000");

        expect(view).toHaveTextContent("114,477,000,000");
    });

    it("places: placed spots only, one per version × block, the table cell 1-based", () => {
        expect(factPlaceTargets(V2_FACT_PLACES.data)).toEqual([
            { blockId: "b00407", label: "Table row 7, column 4", versionId: "8be0b759-1a9d-5f89-8308-bd86185f5e1f" },
            { blockId: "b00475", label: "Table row 8, column 4", versionId: "8be0b759-1a9d-5f89-8308-bd86185f5e1f" },
        ]);
    });

    it("the view: rule, the reported formula text, the source filing (documents + EDGAR) and Show in filing", () => {
        const onOpenFiling = vi.fn();

        const onOpenPlace = vi.fn();

        render(<FactExplanationView fact={loaded(V2_FACT)} formula={null} onOpenFiling={onOpenFiling} onOpenPlace={onOpenPlace} places={loaded(V2_FACT_PLACES)} />);

        const view = screen.getByTestId("fact-explanation");

        expect(view).toHaveTextContent("Total Revenue");

        expect(view).toHaveTextContent("94,036,000,000 USD");

        expect(view).toHaveTextContent("None: the value is reported as filed");

        fireEvent.click(screen.getByRole("button", { name: "0000320193-26-000073" }));

        expect(onOpenFiling).toHaveBeenCalledWith("0000320193-26-000073");

        expect(screen.getByRole("link", { name: "EDGAR" })).toHaveAttribute("href", "https://www.sec.gov/Archives/edgar/data/320193/000032019326000073/");

        fireEvent.click(screen.getByRole("button", { name: "Table row 7, column 4" }));

        expect(onOpenPlace).toHaveBeenCalledWith({ blockId: "b00407", label: "Table row 7, column 4", versionId: "8be0b759-1a9d-5f89-8308-bd86185f5e1f" });
    });

    it("a derived value shows its formula; the places' plan gate is a notice beside the explanation", () => {
        render(
            <FactExplanationView
                fact={loaded(V2_FACT)}
                formula="is_revenue_fy - is_revenue_q1 - is_revenue_q2 - is_revenue_q3"
                onOpenFiling={() => undefined}
                onOpenPlace={() => undefined}
                places={{ data: undefined, error: problem(403, "plan_required", "Fact places need the PRO plan."), isLoading: false }}
            />,
        );

        expect(screen.getByText("is_revenue_fy - is_revenue_q1 - is_revenue_q2 - is_revenue_q3")).toBeInTheDocument();

        expect(screen.getByText("Your plan does not include this view")).toBeInTheDocument();

        expect(screen.getByTestId("fact-explanation")).toHaveTextContent("Total Revenue");
    });

    it("a plan without fact places: the PRO notice, the explanation still shown", () => {
        render(<FactExplanationView fact={loaded(V2_FACT)} formula={null} onOpenFiling={() => undefined} onOpenPlace={() => undefined} places={null} />);

        expect(screen.getByText("Your plan does not include the places in the filing")).toBeInTheDocument();

        expect(screen.queryByText("No place of this value in a stored document.")).toBeNull();
    });

    it("a failed explanation is its notice", () => {
        render(<FactExplanationView fact={{ data: undefined, error: problem(404, "not_found", "No such fact."), isLoading: false }} formula={null} onOpenFiling={() => undefined} onOpenPlace={() => undefined} places={loaded(V2_FACT_PLACES)} />);

        expect(screen.queryByTestId("fact-explanation")).toBeNull();
    });
});

describe("Detailed segments (`/v1/segments/detailed`) and the metric / axis filters", () => {
    it("one row per segment fact with its concept, caption and filing; the picker filters; export above the table", () => {
        const onOpenFiling = vi.fn();

        const { rerender } = render(<SegmentsDetailedView {...list} hasNextPage onOpenFiling={onOpenFiling} pages={[V2_SEGMENTS_DETAILED]} segmentId="all" ticker="AAPL" />);

        const view = screen.getByTestId("segments-detailed");

        expect(view).toHaveTextContent("iPhone");

        expect(view).toHaveTextContent("us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax");

        expect(within(view).getAllByRole("row")).toHaveLength(1 + 2);

        expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "0000320193-26-000073" }));

        expect(onOpenFiling).toHaveBeenCalledWith("0000320193-26-000073");

        rerender(<SegmentsDetailedView {...list} onOpenFiling={onOpenFiling} pages={[V2_SEGMENTS_DETAILED]} segmentId="seg_revenue_business_segment" ticker="AAPL" />);

        expect(screen.queryByText("iPhone")).toBeNull();
    });

    it("the plan gate of the PRO list is its notice, no table", () => {
        render(<SegmentsDetailedView {...list} error={problem(403, "plan_required", "PRO")} onOpenFiling={() => undefined} pages={[]} segmentId="all" ticker="AAPL" />);

        expect(screen.getByText("Your plan does not include this view")).toBeInTheDocument();

        expect(screen.queryByTestId("segments-detailed")).toBeNull();
    });

    it("metric / axis choices come from the loaded rows, in words; a chosen value the rows lack is kept", () => {
        const options = segmentFilterOptions(V2_SEGMENTS.data, { axis: "us-gaap:SubsegmentsAxis" });

        expect(options.metrics).toEqual([{ label: "Total Revenue", value: "is_total_revenue" }]);

        expect(options.axes.map(axis => axis.value)).toEqual(["srt:ProductOrServiceAxis", "us-gaap:StatementBusinessSegmentsAxis", "us-gaap:SubsegmentsAxis"]);

        expect(options.axes[0].label).toBe("Product Or Service");
    });

    it("two taxonomies' axes of the same name keep their prefix (GOOGL: srt: / us-gaap:StatementGeographicalAxis)", () => {
        const row = (axis: string) => ({ dimensions: [{ axis, member: "x:UsMember" }], metric_id: "is_total_revenue" });

        expect(segmentFilterOptions([row("srt:StatementGeographicalAxis"), row("us-gaap:StatementGeographicalAxis")], {}).axes.map(axis => axis.label))
            .toEqual(["Statement Geographical (srt)", "Statement Geographical (us-gaap)"]);
    });
});
