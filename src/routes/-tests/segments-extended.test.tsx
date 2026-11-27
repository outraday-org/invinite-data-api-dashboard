// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as FinancialsSearchModule from "@/components/financials-pages/financials-search";
import type { SegmentDetailedRow } from "@/components/financials-pages/segments-detailed";

import { financialsSearchSchema } from "@/components/financials-pages/financials-search";
import { SegmentSelect } from "@/components/financials-pages/segment-select";
import { SegmentsFinancials, SegmentsView } from "@/components/financials-pages/segments";
import { SegmentsDetailedView } from "@/components/financials-pages/segments-detailed";
import { ChartParamContext } from "@/components/metric-chart/use-chart-selection";
import { segmentLines } from "@/lib/financials/statements";
import { V2_SEGMENTS, V2_SEGMENTS_DETAILED } from "@/lib/financials/v2-fixtures";

const mocks = vi.hoisted(() => {
    const search: FinancialsSearchModule.FinancialsSearch = {};

    const empty = () => ({ data: { pages: [] }, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false });

    return { detailed: vi.fn(empty), search, summary: vi.fn(empty), update: vi.fn() };
});

vi.mock("@/components/financials-pages/financials-search", async importOriginal => ({
    ...await importOriginal<typeof FinancialsSearchModule>(),
    useFinancialsSearch: () => [mocks.search, mocks.update],
}));

vi.mock("@/lib/api/queries", () => ({
    useV2SegmentsDetailedInfinite: mocks.detailed,
    useV2SegmentsInfinite: mocks.summary,
}));

vi.mock("@/components/sec/sec-source-panel", () => ({ SecSourceDialog: () => null }));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
    useNavigate: () => vi.fn(),
    useSearch: () => mocks.search,
}));

const state = { error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: vi.fn() };

beforeEach(() => {
    vi.clearAllMocks();

    mocks.search = {};
});

afterEach(cleanup);

describe("segment page controls", () => {
    it("offers all twelve metric families in the existing picker", async () => {
        render(<SegmentSelect onValueChange={vi.fn()} value="all" />);

        fireEvent.click(screen.getByRole("button", { name: "Segment" }));

        expect(await screen.findAllByRole("menuitemradio")).toHaveLength(13);

        expect(screen.getByRole("menuitemradio", { name: "Total Assets (Business Segment)" })).toBeInTheDocument();

        expect(screen.getByRole("menuitemradio", { name: "Depreciation & Amortization (Business Segment)" })).toBeInTheDocument();
    });

    it("sends the selected id and follow flag to the standard hook without activating PRO", () => {
        mocks.search = { followLinks: true, period: "annual", segment: "seg_operating_income_business_segment" };

        render(<SegmentsFinancials tabs={<div>Tabs</div>} ticker="AAPL" />);

        expect(mocks.summary).toHaveBeenCalledWith(expect.objectContaining({
            company: "AAPL", followLinks: true, period: "annual", segmentIds: ["seg_operating_income_business_segment"],
        }));

        expect(mocks.detailed).toHaveBeenCalledWith(expect.objectContaining({ company: "" }));

        expect(screen.getByRole("button", { name: "Follow renamed segments" })).toHaveAttribute("aria-pressed", "true");

        expect(screen.getByText(/Reconciliation details are available in Detailed/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Follow renamed segments" }));

        expect(mocks.update).toHaveBeenCalledWith({ chart: undefined, followLinks: undefined });
    });

    it.each(["ttm", "ytd"] as const)("normalizes an instant metric's stale %s URL and offers only quarterly/annual", (period) => {
        mocks.search = { period, segment: "seg_total_assets_business_segment" };

        render(<SegmentsFinancials tabs={<div>Tabs</div>} ticker="AAPL" />);

        expect(mocks.summary).toHaveBeenCalledWith(expect.objectContaining({ period: "quarterly", segmentIds: ["seg_total_assets_business_segment"] }));

        const periods = within(screen.getByRole("group", { name: "Period" }));

        expect(periods.getByRole("button", { name: "Quarterly" })).toHaveAttribute("aria-pressed", "true");

        expect(periods.getByRole("button", { name: "Annual" })).toBeInTheDocument();

        expect(periods.queryByRole("button", { name: "TTM" })).toBeNull();

        expect(periods.queryByRole("button", { name: "YTD" })).toBeNull();
    });

    it("keeps the follow flag and a complete source/target chart key in URL state", () => {
        const chart = "source-and-target-identity".repeat(25);

        expect(financialsSearchSchema.parse({ chart, followLinks: true }).chart).toBe(chart);

        expect(financialsSearchSchema.parse({ followLinks: true }).followLinks).toBe(true);
    });
});

describe("segment value rendering", () => {
    it("opens a saved segment chart URL when the old key matches one row", () => {
        const row = { ...V2_SEGMENTS.data[0], currency: "USD" };

        const legacyKey = [row.metric_id, row.segment_id, row.dimensions.map(d => `${d.axis}=${d.member}`).join("|")].join("::");

        const { chart } = financialsSearchSchema.parse(Object.fromEntries(new URLSearchParams(`chart=${encodeURIComponent(legacyKey)}`)));

        render(
            <ChartParamContext value={{ chart: chart ?? null, setChart: vi.fn() }}>
                <SegmentsView {...state} pages={[{ ...V2_SEGMENTS, data: [row] }]} segmentId="all" />
            </ChartParamContext>,
        );

        expect(screen.getByRole("dialog")).toHaveAccessibleName(/USD/);
    });

    it("does not guess which currency or followed component an old chart key identifies", () => {
        const row = V2_SEGMENTS.data[0];

        const usd = { ...row, currency: "USD", source_member: "OldA", source_row_id: "a", via_link: true };

        const other = { ...row, currency: "USD", source_member: "OldB", source_row_id: "b", via_link: true };

        const legacyKey = [row.metric_id, row.segment_id, row.dimensions.map(d => `${d.axis}=${d.member}`).join("|")].join("::");

        const setChart = vi.fn();

        const view = (chart: string, data: typeof V2_SEGMENTS.data) => (
            <ChartParamContext value={{ chart, setChart }}>
                <SegmentsView {...state} pages={[{ ...V2_SEGMENTS, data }]} segmentId="all" />
            </ChartParamContext>
        );

        const { rerender } = render(view(legacyKey, [{ ...row, currency: "USD" }, { ...row, currency: "EUR" }]));

        expect(screen.queryByRole("dialog")).toBeNull();

        rerender(view(legacyKey, [usd]));

        expect(screen.queryByRole("dialog")).toBeNull();

        const selected = segmentLines([usd, other]).find(line => line.sourceMember === "OldB");

        expect(selected).toBeDefined();

        rerender(view(selected?.key ?? "", [usd, other]));

        expect(screen.getByRole("dialog")).toHaveAccessibleName(/from OldB.*USD/);
    });

    it("keeps zero source components visible and never infers a basic row's reconciliation role", () => {
        const row = {
            ...V2_SEGMENTS.data[0], currency: "EUR", dimensions: [{ axis: "StatementBusinessSegmentsAxis", member: "CorporateMember" }],
            metric_id: "is_operating_income", segment_id: "seg_operating_income_business_segment", value: 0,
        };

        render(<SegmentsView {...state} pages={[{ ...V2_SEGMENTS, data: [row], has_more: false, next_cursor: null }]} segmentId="all" />);

        expect(screen.getByText("0.00")).toBeInTheDocument();

        expect(screen.getByText("EUR")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /Chart Operating Income.*EUR/ })).toBeInTheDocument();

        expect(screen.queryByText("Reconciling items")).toBeNull();

        expect(screen.queryByText("Total", { exact: true })).toBeNull();
    });

    it("separates authoritative reconcilers, keeps false/null distinct, and calculates no total", () => {
        const normal: SegmentDetailedRow = { ...V2_SEGMENTS_DETAILED.data[0], member_role: null, reconciles_to_total: null, value: 80 };

        const reconciling: SegmentDetailedRow = {
            ...normal, currency: "EUR", dimensions: [{ axis: "StatementBusinessSegmentsAxis", member: "CorporateMember" }],
            html_label: "Corporate", member_role: "reconciling", reconciles_to_total: false, unit: "eur", value: -20,
        };

        render(<SegmentsDetailedView {...state} onOpenFiling={vi.fn()} pages={[{ ...V2_SEGMENTS_DETAILED, data: [reconciling, normal] }]} segmentId="all" ticker="AAPL" />);

        expect(screen.getAllByTestId("data-table-group").map(row => row.textContent)).toEqual(["Segment values", "Reconciling items"]);

        expect(screen.getByText("Not compared")).toBeInTheDocument();

        expect(screen.getByText("Group does not reconcile")).toBeInTheDocument();

        expect(screen.getByText("EUR")).toBeInTheDocument();

        expect(screen.queryByText("Total", { exact: true })).toBeNull();
    });

    it("keeps followed source identity and all proof periods with source-filing actions", async () => {
        const onOpenFiling = vi.fn();

        const row: SegmentDetailedRow = {
            ...V2_SEGMENTS_DETAILED.data[0], predecessors: [{
                evidence: "restated_values", first_period_end: "2025-01-01", kind: "renamed", matched_periods: [2023, 2024].map(year => ({
                    concept: "Revenues", end_date: `${year}-12-31`, from_accession: `original-${year}`, from_members: ["OldMember"],
                    qualifiers: [], start_date: `${year}-01-01`, to_accession: "restatement", to_members: ["NewMember"], unit: "usd",
                })),
                member: "OldMember",
            }], source_member: "OldMember", source_row_id: "source-fact",
            via_link: true,
        };

        render(<SegmentsDetailedView {...state} onOpenFiling={onOpenFiling} pages={[{ ...V2_SEGMENTS_DETAILED, data: [row, { ...row }] }]} segmentId="all" ticker="AAPL" />);

        expect(screen.getByText("From OldMember")).toBeInTheDocument();

        fireEvent.click(screen.getByText("1 link"));

        const originals = await screen.findAllByRole("button", { name: "Original filing" });

        expect(originals).toHaveLength(2);

        fireEvent.click(originals[0]);

        expect(onOpenFiling).toHaveBeenCalledWith("original-2023");
    });
});
