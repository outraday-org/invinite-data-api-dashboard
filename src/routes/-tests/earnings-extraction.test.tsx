// @vitest-environment jsdom
import type * as React from "react";
import type * as Recharts from "recharts";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { useV2GuidanceInfinite } from "@/lib/api/queries";
import { CANDIDATE_GUIDANCE, KPI_SERIES_POINTS, NON_GAAP_GAP, NON_GAAP_RECONCILED, NON_GAAP_UNCHECKED, QUALITATIVE_GUIDANCE } from "@/lib/earnings/extraction-fixtures";
import { GuidanceTable, GuidanceValue } from "@/routes/$ticker/earnings-calls/-components/tabs/guidance-table";
import { KPI_SERIES_EMPTY_TITLE, KpiSeriesView } from "@/routes/$ticker/earnings-calls/-components/tabs/kpi-series-tab";
import { NON_GAAP_EMPTY_TITLE, NonGaapView } from "@/routes/$ticker/earnings-calls/-components/tabs/non-gaap-tab";

// Keep the server functions (TanStack Start) unloaded; the guidance table's answer is set per test.
vi.mock("@/lib/api/queries", () => ({ useV2GuidanceInfinite: vi.fn() }));

vi.mock("@/lib/player/player-context", () => ({ usePlayer: () => ({ canSeek: false }) }));

// recharts measures its container; jsdom has none.
vi.mock("recharts", async (original) => {
    const actual = await original<typeof Recharts>();

    return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

afterEach(cleanup);

describe("NonGaapView (call page · Non-GAAP tab)", () => {
    it("shows each figure as printed with its GAAP start, adjustment lines and reconciliation without extraction diagnostics", () => {
        render(<NonGaapView error={null} figures={[NON_GAAP_RECONCILED, NON_GAAP_GAP, NON_GAAP_UNCHECKED]} isLoading={false} />);

        const eps = screen.getByRole("article", { name: "Adjusted diluted EPS" });

        expect(within(eps).getByText("Quarter ended Sep 27, 2026")).toBeInTheDocument();

        expect(within(eps).getByText("Reconciled")).toBeInTheDocument();

        const lines = within(eps).getByRole("table", { name: "Reconciliation of Adjusted diluted EPS" });

        expect(within(lines).getByText("Diluted EPS")).toBeInTheDocument();

        expect(within(lines).getByText("Share-based compensation")).toBeInTheDocument();

        expect(within(lines).getByText("+$0.12")).toBeInTheDocument();

        expect(within(lines).getByText("-$0.03")).toBeInTheDocument();

        expect(within(eps).queryByText(/Table 3, row 7, column 2/)).toBeNull();

        expect(within(eps).queryByRole("link", { name: "Results release" })).toBeNull();

        expect(within(eps).queryByText(/Confidence/)).toBeNull();

        expect(within(eps).getByText("Prior year $1.46")).toBeInTheDocument();

        const gap = screen.getByRole("article", { name: "Adjusted operating income" });

        expect(within(gap).getByText("Does not add up")).toBeInTheDocument();

        expect(within(gap).getByText("Gap (reported − GAAP − adjustments)")).toBeInTheDocument();

        const fcf = screen.getByRole("article", { name: "Free cash flow" });

        expect(within(fcf).getByText("Nothing to check")).toBeInTheDocument();

        expect(within(fcf).getByText("The release prints no reconciliation for this figure.")).toBeInTheDocument();
    });

    it("renders empty, the PRO plan gate and an error as states", () => {
        const { rerender } = render(<NonGaapView error={null} figures={[]} isLoading={false} />);

        expect(screen.getByText(NON_GAAP_EMPTY_TITLE)).toBeInTheDocument();

        rerender(<NonGaapView error={new ApiRequestError(403, { error: "plan_required", message: "PRO plan required" })} figures={[]} isLoading={false} />);

        expect(screen.getByText("PRO plan required")).toBeInTheDocument();

        rerender(<NonGaapView error={new ApiRequestError(500, { error: "internal", message: "boom" })} figures={[]} isLoading={false} />);

        expect(screen.getByText("Failed to load the non-GAAP figures")).toBeInTheDocument();
    });
});

describe("KpiSeriesView (call page · KPI series tab)", () => {
    it("draws one chart + table per KPI of the company-wide rows, with financial values and XBRL checks without source diagnostics", () => {
        render(<KpiSeriesView error={null} isLoading={false} onSegmentChange={vi.fn()} points={KPI_SERIES_POINTS} segment={null} />);

        const load = screen.getByRole("region", { name: "Load factor" });

        // Two quarters plotted; the year is table-only and said so.
        expect(within(load).getByText("Percent · Quarter · 1 value of other periods in the table only")).toBeInTheDocument();

        const rows = within(within(load).getByRole("table", { name: "Load factor values" })).getAllByRole("row").slice(1);

        // Newest first; the Domestic segment point is not company-wide.
        expect(rows).toHaveLength(3);

        expect(within(rows[0]).getByText("86.1%")).toBeInTheDocument();

        expect(within(rows[0]).getByText("+0.8 pts")).toBeInTheDocument();

        expect(within(rows[0]).getByText("Matches filing")).toBeInTheDocument();

        expect(within(rows[0]).queryByRole("link")).toBeNull();

        expect(within(load).queryByRole("columnheader", { name: "Read from" })).toBeNull();

        expect(within(load).queryByRole("columnheader", { name: "Source" })).toBeNull();

        const asm = screen.getByRole("region", { name: "Available seat miles" });

        expect(within(asm).queryByText("“Capacity was 74.2 billion available seat miles in the quarter.”")).toBeNull();

        expect(within(asm).getByText("Differs from filing")).toBeInTheDocument();
    });

    it("offers the segments and shows the chosen segment's points", () => {
        const onSegmentChange = vi.fn();

        const { rerender } = render(<KpiSeriesView error={null} isLoading={false} onSegmentChange={onSegmentChange} points={KPI_SERIES_POINTS} segment={null} />);

        expect(screen.getByRole("button", { name: "Segment" })).toBeInTheDocument();

        rerender(<KpiSeriesView error={null} isLoading={false} onSegmentChange={onSegmentChange} points={KPI_SERIES_POINTS} segment="Domestic" />);

        expect(screen.queryByRole("region", { name: "Available seat miles" })).toBeNull();

        expect(within(screen.getByRole("table", { name: "Load factor values" })).getAllByRole("row")).toHaveLength(2);
    });

    it("renders empty and the plan gate as states", () => {
        const { rerender } = render(<KpiSeriesView error={null} isLoading={false} onSegmentChange={vi.fn()} points={[]} segment={null} />);

        expect(screen.getByText(KPI_SERIES_EMPTY_TITLE)).toBeInTheDocument();

        rerender(<KpiSeriesView error={new ApiRequestError(403, { error: "plan_required", message: "PRO plan required" })} isLoading={false} onSegmentChange={vi.fn()} points={[]} segment={null} />);

        expect(screen.getByText("PRO plan required")).toBeInTheDocument();
    });
});

describe("GuidanceValue (qualitative guidance, Data API 12.1)", () => {
    it("shows the statement and its qualifier instead of an empty range", () => {
        render(<GuidanceValue item={QUALITATIVE_GUIDANCE} />);

        expect(screen.getByText("Directional")).toBeInTheDocument();

        expect(screen.getByText("We expect revenue to grow year over year in the December quarter.")).toBeInTheDocument();

        expect(screen.queryByText("—")).toBeNull();
    });

    it("keeps the range of a numeric item", () => {
        render(<GuidanceValue item={{ ...QUALITATIVE_GUIDANCE, currency: "USD", high: 140e9, low: 138e9, midpoint: 139e9, qualifier: null, statement_text: null, unit: "usd" }} />);

        expect(screen.getByText("$138B – $140B")).toBeInTheDocument();

        expect(screen.queryByText("Directional")).toBeNull();
    });
});

describe("GuidanceValue numeric boundaries", () => {
    it("keeps zero guidance and a missing numeric value distinct", () => {
        const { rerender } = render(<GuidanceValue item={{ ...QUALITATIVE_GUIDANCE, currency: "USD", high: 0, low: 0, midpoint: 0, qualifier: null, statement_text: null, unit: "usd" }} />);

        expect(screen.getByText("$0")).toBeInTheDocument();

        rerender(<GuidanceValue item={{ ...QUALITATIVE_GUIDANCE, qualifier: null, statement_text: null }} />);

        expect(screen.getByText("—")).toBeInTheDocument();

        expect(screen.queryByText("$0")).toBeNull();
    });
});

describe("GuidanceTable financial presentation", () => {
    it.each([QUALITATIVE_GUIDANCE, CANDIDATE_GUIDANCE])("keeps financial content and history with old and omitted-review responses", (item) => {
        vi.mocked(useV2GuidanceInfinite).mockReturnValue({
            data: { pages: [{ data: [item] }] },
            error: null,
            fetchNextPage: vi.fn(),
            hasNextPage: false,
            isFetchingNextPage: false,
            isLoading: false,
        } as unknown as ReturnType<typeof useV2GuidanceInfinite>);

        const onMetricClick = vi.fn();

        render(<GuidanceTable eventId="9655a5db-8968-40be-8c79-7cd1a8aed8e9" onMetricClick={onMetricClick} />);

        expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Metric", "Period", "Range", "Basis", "Direction"]);

        expect(screen.getByText(item.statement_text ?? "")).toBeInTheDocument();

        expect(screen.getByText("Q1 FY2027")).toBeInTheDocument();

        expect(screen.getByText("Maintained")).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: "Needs review" })).toBeNull();

        expect(screen.queryByRole("button", { name: /citations/ })).toBeNull();

        expect(screen.queryByRole("link", { name: "Release" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /Revenue/ }));

        expect(onMetricClick).toHaveBeenCalledWith(item);

        expect(item.confidence).toBe(0.81);

        expect(item.source_url).toContain("sec.gov");

        expect(item.sources?.[0].sentence).toBe("Hidden source evidence remains accessible.");

        expect(screen.queryByText("Hidden source evidence remains accessible.")).toBeNull();
    });

    it("keeps pagination and empty/loading/error states without review controls", () => {
        const fetchNextPage = vi.fn();

        const answer = { data: { pages: [{ data: [] }] }, error: null, fetchNextPage, hasNextPage: false, isFetchingNextPage: false, isLoading: false };

        const setAnswer = (overrides: object) => vi.mocked(useV2GuidanceInfinite).mockReturnValue({ ...answer, ...overrides } as unknown as ReturnType<typeof useV2GuidanceInfinite>);

        setAnswer({});

        const { rerender } = render(<GuidanceTable eventId="test-event" onMetricClick={vi.fn()} />);

        expect(screen.getByText("No guidance extracted")).toBeInTheDocument();

        setAnswer({ hasNextPage: true });

        rerender(<GuidanceTable eventId="test-event" onMetricClick={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Load more" }));

        expect(fetchNextPage).toHaveBeenCalledOnce();

        setAnswer({ isLoading: true });

        rerender(<GuidanceTable eventId="test-event" onMetricClick={vi.fn()} />);

        expect(screen.queryByRole("table")).toBeNull();

        setAnswer({ error: new ApiRequestError(500, { error: "internal", message: "boom" }) });

        rerender(<GuidanceTable eventId="test-event" onMetricClick={vi.fn()} />);

        expect(screen.getByText("Failed to load guidance")).toBeInTheDocument();
    });
});
