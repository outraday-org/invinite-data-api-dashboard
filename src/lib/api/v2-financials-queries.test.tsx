// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    V2_AS_REPORTED_DETAILED,
    V2_CAGR,
    V2_FACT_PLACES,
    V2_FINANCIAL_VINTAGES,
    V2_GROWTH,
    V2_RATIOS,
    V2_SEGMENTS,
    V2_SEGMENTS_DETAILED,
    V2_STANDARDIZED,
    V2_STANDARDIZED_AS_OF,
    V2_STANDARDIZED_PENDING,
} from "@/lib/financials/v2-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type { AsReportedDetailedPeriodTarget } from "./queries";

import { ApiRequestError } from "./errors";
import {
    refetchWhileCoveragePending,
    useAsReportedDetailedPeriod,
    useFinancialVintages,
    useReportedValueLookup,
    useV2CagrInfinite,
    useV2FactPlaces,
    useV2FinancialsInfinite,
    useV2GrowthInfinite,
    useV2RatiosInfinite,
    useV2SegmentsDetailedInfinite,
    useV2SegmentsInfinite,
} from "./queries";
import { fileRequests, requestsOf } from "./request-meta";
import {
    getFinancialVintages,
    getV2AsReported,
    getV2AsReportedDetailed,
    getV2AsReportedPresentation,
    getV2Cagr,
    getV2FactPlaces,
    getV2Growth,
    getV2Ratios,
    getV2Segments,
    getV2SegmentsDetailed,
    getV2Standardized,
    getV2StandardizedDetailed,
    getV2StandardizedPresentation,
} from "./server-functions";

vi.mock("./server-functions", () => ({
    getFinancialVintages: vi.fn(),
    getV2AsReported: vi.fn(),
    getV2AsReportedDetailed: vi.fn(),
    getV2AsReportedPresentation: vi.fn(),
    getV2Cagr: vi.fn(),
    getV2Fact: vi.fn(),
    getV2FactPlaces: vi.fn(),
    getV2Growth: vi.fn(),
    getV2Ratios: vi.fn(),
    getV2Segments: vi.fn(),
    getV2SegmentsDetailed: vi.fn(),
    getV2Standardized: vi.fn(),
    getV2StandardizedDetailed: vi.fn(),
    getV2StandardizedPresentation: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const revivedProblem = (status: number, code: string, detail: string) =>
    Object.assign(new Error(detail), { body: { error: code, message: detail, requestId: "req_9" }, code, status });

beforeEach(() => {
    vi.clearAllMocks();

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });
});

describe("useV2FinancialsInfinite", () => {
    it("standardized summary: company, one statement, period, limit; pages by next_cursor; never the as-reported switches", async () => {
        vi.mocked(getV2Standardized)
            .mockResolvedValueOnce(V2_STANDARDIZED)
            .mockResolvedValueOnce({ ...V2_STANDARDIZED, has_more: false, next_cursor: null });

        const { result } = renderHook(() => useV2FinancialsInfinite({
            basis: "standardized",
            company: "AAPL",
            displaySign: "cash_flow_direction",
            limit: 8,
            period: "quarterly",
            reportedOnly: true,
            statement: ["income-statement"],
            view: "summary",
        }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getV2Standardized).toHaveBeenLastCalledWith({
            data: {
                apiKey: "test-key",
                asOf: undefined,
                company: "AAPL",
                cursor: undefined,
                filing: undefined,
                limit: 8,
                period: "quarterly",
                statement: ["income-statement"],
            },
        });

        await act(() => result.current.fetchNextPage());

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

        expect(vi.mocked(getV2Standardized).mock.lastCall?.[0]?.data).toMatchObject({ cursor: "eyJ2IjoyfQ" });

        expect(result.current.hasNextPage).toBe(false);
    });

    it("basis × view picks the operation; as-reported sends reported_only / display_sign", async () => {
        vi.mocked(getV2AsReportedDetailed).mockResolvedValue(V2_AS_REPORTED_DETAILED);

        const { result } = renderHook(() => useV2FinancialsInfinite({
            basis: "as-reported",
            company: "AAPL",
            displaySign: "cash_flow_direction",
            period: "annual",
            reportedOnly: true,
            statement: ["cash-flow"],
            view: "detailed",
        }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(vi.mocked(getV2AsReportedDetailed).mock.lastCall?.[0]?.data).toMatchObject({
            displaySign: "cash_flow_direction",
            period: "annual",
            reportedOnly: true,
            statement: ["cash-flow"],
        });

        for (const other of [getV2AsReported, getV2AsReportedPresentation, getV2Standardized, getV2StandardizedDetailed, getV2StandardizedPresentation]) {
            expect(other).not.toHaveBeenCalled();
        }
    });

    it("a 403 plan_required problem is a page state: revived, never retried, no toast", async () => {
        vi.mocked(getV2StandardizedPresentation).mockRejectedValue(revivedProblem(403, "plan_required", "PRO"));

        const { result } = renderHook(() => useV2FinancialsInfinite({ basis: "standardized", company: "AAPL", period: "quarterly", view: "presentation" }), { wrapper });

        await waitFor(() => expect(result.current.error).not.toBeNull());

        expect(result.current.error).toBeInstanceOf(ApiRequestError);

        expect((result.current.error as ApiRequestError).code).toBe("plan_required");

        expect(getV2StandardizedPresentation).toHaveBeenCalledTimes(1);

        expect(toast.error).not.toHaveBeenCalled();
    });

    it("a pending first page is asked again every 30 s", () => {
        expect(refetchWhileCoveragePending({ state: { data: { pageParams: [null], pages: [V2_STANDARDIZED_PENDING] } } })).toBe(30_000);

        expect(refetchWhileCoveragePending({ state: { data: { pageParams: [null], pages: [V2_STANDARDIZED] } } })).toBe(false);
    });
});

describe("metrics hooks", () => {
    it.each(["standard", "detailed"])("%s segments include server selection and following in their cache identity", async (view) => {
        vi.mocked(getV2Segments).mockResolvedValue(V2_SEGMENTS);

        vi.mocked(getV2SegmentsDetailed).mockResolvedValue(V2_SEGMENTS_DETAILED);

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        const stableWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

        const useRead = view === "standard" ? useV2SegmentsInfinite : useV2SegmentsDetailedInfinite;

        const server = view === "standard" ? getV2Segments : getV2SegmentsDetailed;

        const { rerender, result } = renderHook(({ followLinks, segmentIds }) => useRead({
            company: "AAPL", followLinks, period: "annual", segmentIds,
        }), { initialProps: { followLinks: false, segmentIds: ["seg_operating_income_business_segment"] }, wrapper: stableWrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(server).toHaveBeenCalledTimes(1);

        rerender({ followLinks: false, segmentIds: ["seg_total_assets_business_segment"] });

        await waitFor(() => expect(server).toHaveBeenCalledTimes(2));

        rerender({ followLinks: true, segmentIds: ["seg_total_assets_business_segment"] });

        await waitFor(() => expect(server).toHaveBeenCalledTimes(3));

        expect(vi.mocked(server).mock.lastCall?.[0]?.data).toMatchObject({
            followLinks: true, segmentIds: ["seg_total_assets_business_segment"],
        });

        client.clear();
    });

    it("ratios `category`, growth `basis`, CAGR `horizon`, segments: the renamed v2 filters reach the server functions", async () => {
        vi.mocked(getV2Ratios).mockResolvedValue(V2_RATIOS);

        vi.mocked(getV2Growth).mockResolvedValue({ ...V2_GROWTH, has_more: false, next_cursor: null });

        vi.mocked(getV2Cagr).mockResolvedValue(V2_CAGR);

        vi.mocked(getV2Segments).mockResolvedValue(V2_SEGMENTS);

        const ratios = renderHook(() => useV2RatiosInfinite({ category: ["leverage"], company: "AAPL", limit: 8, period: "quarterly" }), { wrapper });

        const growth = renderHook(() => useV2GrowthInfinite({ basis: "yoy", company: "AAPL", period: "quarterly" }), { wrapper });

        const cagr = renderHook(() => useV2CagrInfinite({ company: "AAPL", horizon: 5, period: "annual" }), { wrapper });

        const segments = renderHook(() => useV2SegmentsInfinite({ company: "AAPL", limit: 200, period: "quarterly" }), { wrapper });

        await waitFor(() => expect(segments.result.current.data?.pages).toHaveLength(1));

        await waitFor(() => expect(ratios.result.current.data?.pages).toHaveLength(1));

        await waitFor(() => expect(growth.result.current.data?.pages).toHaveLength(1));

        await waitFor(() => expect(cagr.result.current.data?.pages).toHaveLength(1));

        expect(getV2Ratios).toHaveBeenCalledWith({ data: { apiKey: "test-key", category: ["leverage"], company: "AAPL", cursor: undefined, limit: 8, period: "quarterly" } });

        expect(vi.mocked(getV2Growth).mock.lastCall?.[0]?.data).toMatchObject({ basis: "yoy", period: "quarterly" });

        expect(vi.mocked(getV2Cagr).mock.lastCall?.[0]?.data).toMatchObject({ horizon: 5, period: "annual" });

        expect(vi.mocked(getV2Segments).mock.lastCall?.[0]?.data).toMatchObject({ company: "AAPL", limit: 200, period: "quarterly" });
    });
});

describe("O7 group 4: point in time, fiscal years, detailed segments, fact places", () => {
    it("as_of / filing and the fiscal-year window reach the statement operation; each selector is its own cache entry", async () => {
        vi.mocked(getV2Standardized).mockResolvedValue(V2_STANDARDIZED_AS_OF);

        const input = { basis: "standardized", company: "AAPL", fiscalYearGte: 2020, fiscalYearLte: 2024, period: "annual", view: "summary" } as const;

        const first = renderHook(() => useV2FinancialsInfinite({ ...input, asOf: "2026-05-01" }), { wrapper });

        await waitFor(() => expect(first.result.current.data?.pages).toHaveLength(1));

        expect(vi.mocked(getV2Standardized).mock.lastCall?.[0]?.data).toMatchObject({ asOf: "2026-05-01", fiscalYearGte: 2020, fiscalYearLte: 2024 });

        const pinned = renderHook(() => useV2FinancialsInfinite({ ...input, filing: "0000320193-26-000052" }), { wrapper });

        await waitFor(() => expect(pinned.result.current.data?.pages).toHaveLength(1));

        expect(vi.mocked(getV2Standardized).mock.lastCall?.[0]?.data).toMatchObject({ asOf: undefined, filing: "0000320193-26-000052" });
    });

    it("ratios / growth / CAGR / segments send the fiscal-year window; CAGR any period", async () => {
        vi.mocked(getV2Ratios).mockResolvedValue(V2_RATIOS);

        vi.mocked(getV2Cagr).mockResolvedValue(V2_CAGR);

        vi.mocked(getV2Segments).mockResolvedValue(V2_SEGMENTS);

        const ratios = renderHook(() => useV2RatiosInfinite({ company: "AAPL", fiscalYearGte: 2021, period: "annual" }), { wrapper });

        const cagr = renderHook(() => useV2CagrInfinite({ company: "AAPL", fiscalYearLte: 2025, period: "ttm" }), { wrapper });

        const segments = renderHook(() => useV2SegmentsInfinite({ axis: ["srt:ProductOrServiceAxis"], company: "AAPL", fiscalYearGte: 2022, metric: ["is_total_revenue"], period: "annual" }), { wrapper });

        await waitFor(() => expect(ratios.result.current.data?.pages).toHaveLength(1));

        await waitFor(() => expect(cagr.result.current.data?.pages).toHaveLength(1));

        await waitFor(() => expect(segments.result.current.data?.pages).toHaveLength(1));

        expect(vi.mocked(getV2Ratios).mock.lastCall?.[0]?.data).toMatchObject({ fiscalYearGte: 2021 });

        expect(vi.mocked(getV2Cagr).mock.lastCall?.[0]?.data).toMatchObject({ fiscalYearLte: 2025, period: "ttm" });

        expect(vi.mocked(getV2Segments).mock.lastCall?.[0]?.data).toMatchObject({ axis: ["srt:ProductOrServiceAxis"], fiscalYearGte: 2022, metric: ["is_total_revenue"] });
    });

    it("detailed segments: metric / axis sent; idle without a company", async () => {
        vi.mocked(getV2SegmentsDetailed).mockResolvedValue(V2_SEGMENTS_DETAILED);

        renderHook(() => useV2SegmentsDetailedInfinite({ company: "", period: "quarterly" }), { wrapper });

        const detailed = renderHook(() => useV2SegmentsDetailedInfinite({ axis: ["srt:ProductOrServiceAxis"], company: "AAPL", limit: 100, period: "quarterly" }), { wrapper });

        await waitFor(() => expect(detailed.result.current.data?.pages).toHaveLength(1));

        expect(getV2SegmentsDetailed).toHaveBeenCalledTimes(1);

        expect(vi.mocked(getV2SegmentsDetailed).mock.lastCall?.[0]?.data).toMatchObject({ axis: ["srt:ProductOrServiceAxis"], company: "AAPL", limit: 100 });
    });

    it("fact places: `fact=` while a fact is open, nothing for a null id", async () => {
        vi.mocked(getV2FactPlaces).mockResolvedValue(V2_FACT_PLACES);

        renderHook(() => useV2FactPlaces(null), { wrapper });

        const places = renderHook(() => useV2FactPlaces("320193|is_total_revenue|quarterly|2026|3"), { wrapper });

        await waitFor(() => expect(places.result.current.data?.data).toHaveLength(4));

        expect(getV2FactPlaces).toHaveBeenCalledTimes(1);

        expect(vi.mocked(getV2FactPlaces).mock.lastCall?.[0]?.data).toMatchObject({ apiKey: "test-key", fact: "320193|is_total_revenue|quarterly|2026|3" });
    });
});

describe("as-reported cell queries", () => {
    const row = V2_AS_REPORTED_DETAILED.data[0];

    // A comparative statement can be carried by an earlier filing than the pin used to select its rendering.
    const renderingAccession = "0000320193-27-000017";

    const pinnedResponse = { ...V2_AS_REPORTED_DETAILED, meta: { ...V2_AS_REPORTED_DETAILED.meta, point_in_time: { as_of: null, filing: renderingAccession } } };

    const period: AsReportedDetailedPeriodTarget = {
        accession: row.source.accession,
        cik: row.company.cik,
        company: "AAPL",
        filedAt: row.source.filed_at,
        fiscalQuarter: row.fiscal_quarter,
        fiscalYear: row.fiscal_year,
        period: row.period,
        periodEnd: row.period_end,
        periodStart: row.period_start,
        statement: "income-statement",
    };

    it("waits for a computed cell, then caches the exact selected period and rendition across member explanations", async () => {
        const asOf = { ...period, asOf: "2026-09-01", displaySign: "cash_flow_direction", reportedOnly: false } satisfies AsReportedDetailedPeriodTarget;

        const response = { ...V2_AS_REPORTED_DETAILED, meta: { ...V2_AS_REPORTED_DETAILED.meta, point_in_time: { as_of: asOf.asOf, filing: null } } };

        fileRequests(response, [{
            credits: 1,
            method: "GET",
            operationId: "getAsReportedFinancialsDetailed",
            path: "/v1/financials/as-reported/detailed",
            query: { company: "AAPL", limit: "1" },
            requestId: "test-detail",
            status: 200,
        }]);

        vi.mocked(getV2AsReportedDetailed)
            .mockResolvedValueOnce(response)
            .mockResolvedValueOnce(pinnedResponse)
            .mockResolvedValueOnce(V2_AS_REPORTED_DETAILED);

        const initialProps: { target: AsReportedDetailedPeriodTarget | null } = { target: null };

        const { rerender, result } = renderHook(({ target }) => useAsReportedDetailedPeriod(target), { initialProps, wrapper });

        expect(getV2AsReportedDetailed).not.toHaveBeenCalled();

        rerender({ target: asOf });

        await waitFor(() => expect(result.current.data?.data[0]).toEqual(row));

        expect(requestsOf(result.current.data).map(request => request.requestId)).toEqual(["test-detail"]);

        expect(getV2AsReportedDetailed).toHaveBeenLastCalledWith({
            data: {
                apiKey: "test-key",
                asOf: asOf.asOf,
                company: "AAPL",
                displaySign: "cash_flow_direction",
                filing: undefined,
                fiscalQuarter: 3,
                fiscalYear: 2026,
                limit: 1,
                period: "quarterly",
                reportedOnly: false,
                statement: ["income-statement"],
            },
        });

        rerender({ target: null });

        rerender({ target: { ...asOf } });

        expect(getV2AsReportedDetailed).toHaveBeenCalledTimes(1);

        rerender({ target: { ...period, filing: renderingAccession } });

        await waitFor(() => expect(result.current.data?.data[0]).toEqual(row));

        expect(getV2AsReportedDetailed).toHaveBeenCalledTimes(2);

        rerender({ target: { ...period, reportedOnly: true } });

        await waitFor(() => expect(result.current.data?.data[0]).toEqual(row));

        expect(getV2AsReportedDetailed).toHaveBeenCalledTimes(3);
    });

    it.each([
        { ...row, period_end: "2026-03-28" },
        { ...row, source: { ...row.source, accession: "0000320193-26-000010" } },
        { ...row, source: { ...row.source, filed_at: "2026-08-02T20:30:00Z" } },
    ])("rejects the wrong period or rendition", async (received) => {
        vi.mocked(getV2AsReportedDetailed).mockResolvedValue({ ...V2_AS_REPORTED_DETAILED, data: [received] });

        const { result } = renderHook(() => useAsReportedDetailedPeriod(period), { wrapper });

        await waitFor(() => expect(result.current.error?.message).toMatch(/selected period and filing/));

        expect(result.current.data).toBeNull();

        expect(getV2AsReportedDetailed).toHaveBeenCalledTimes(1);
    });

    it("accepts an older statement source under the pinned rendering on both page and operand reads", async () => {
        vi.mocked(getV2AsReportedDetailed).mockResolvedValue(pinnedResponse);

        const page = renderHook(() => useV2FinancialsInfinite({
            basis: "as-reported", company: "AAPL", filing: renderingAccession, period: "quarterly", view: "detailed",
        }), { wrapper });

        const fallback = renderHook(() => useReportedValueLookup("AAPL", { fiscalYearGte: 2025, fiscalYearLte: 2027, period: "quarterly" }, {
            filing: renderingAccession,
        }), { wrapper });

        await waitFor(() => expect(page.result.current.data?.pages[0].data[0].source.accession).toBe(row.source.accession));

        await waitFor(() => expect(fallback.result.current.data?.data[0].source.accession).toBe(row.source.accession));

        expect(row.source.accession).not.toBe(renderingAccession);
    });

    it("rejects a current response on the pinned page and exact-period read, even with matching row identity", async () => {
        vi.mocked(getV2AsReportedDetailed).mockResolvedValue(V2_AS_REPORTED_DETAILED);

        const page = renderHook(() => useV2FinancialsInfinite({
            basis: "as-reported", company: "AAPL", filing: renderingAccession, period: "quarterly", view: "detailed",
        }), { wrapper });

        const details = renderHook(() => useAsReportedDetailedPeriod({ ...period, filing: renderingAccession }), { wrapper });

        await waitFor(() => expect(page.result.current.error?.message).toMatch(/selected filing or date/));

        await waitFor(() => expect(details.result.current.error?.message).toMatch(/selected period and filing/));

        expect(page.result.current.data).toBeNull();

        expect(details.result.current.data).toBeNull();
    });

    it("rejects source filings after the as-of New York date, even with matching metadata", async () => {
        const asOf = "2026-07-31";

        vi.mocked(getV2AsReportedDetailed).mockResolvedValue({
            ...V2_AS_REPORTED_DETAILED,
            meta: { ...V2_AS_REPORTED_DETAILED.meta, point_in_time: { as_of: asOf, filing: null } },
        });

        const { result } = renderHook(() => useAsReportedDetailedPeriod({ ...period, asOf }), { wrapper });

        await waitFor(() => expect(result.current.error?.message).toMatch(/selected period and filing/));

        expect(result.current.data).toBeNull();
    });

    it("never accepts a current fallback operand page for a historical request", async () => {
        vi.mocked(getV2AsReportedDetailed).mockResolvedValue(V2_AS_REPORTED_DETAILED);

        const { result } = renderHook(() => useReportedValueLookup("AAPL", { fiscalYearGte: 2025, fiscalYearLte: 2027, period: "quarterly" }, {
            asOf: "2026-08-15", displaySign: "cash_flow_direction", reportedOnly: true,
        }), { wrapper });

        await waitFor(() => expect(result.current.error?.message).toMatch(/selected filing or date/));

        expect(result.current.data).toBeNull();

        expect(getV2AsReportedDetailed).toHaveBeenCalledWith({
            data: {
                apiKey: "test-key",
                asOf: "2026-08-15",
                company: "AAPL",
                displaySign: "cash_flow_direction",
                filing: undefined,
                fiscalYearGte: 2025,
                fiscalYearLte: 2027,
                limit: 20,
                period: "quarterly",
                reportedOnly: true,
            },
        });
    });

    it("isolates consolidated, Products and Services vintage caches for the same period", async () => {
        vi.mocked(getFinancialVintages).mockResolvedValue(V2_FINANCIAL_VINTAGES);

        const target = { company: "AAPL", concept: "Revenue", periodEnd: "2026-06-27", periodStart: "2026-03-29" };

        const { rerender, result } = renderHook(({ member }: { member?: string }) => useFinancialVintages({ ...target, member }), { initialProps: {}, wrapper });

        await waitFor(() => expect(result.current.data).toBeTruthy());

        rerender({ member: "us-gaap:ProductMember" });

        await waitFor(() => expect(result.current.data).toBeTruthy());

        rerender({ member: "us-gaap:ServiceMember" });

        await waitFor(() => expect(result.current.data).toBeTruthy());

        rerender({ member: "us-gaap:ProductMember" });

        expect(vi.mocked(getFinancialVintages).mock.calls.map(([input]) => input.data.member)).toEqual([
            undefined, "us-gaap:ProductMember", "us-gaap:ServiceMember",
        ]);
    });
});
