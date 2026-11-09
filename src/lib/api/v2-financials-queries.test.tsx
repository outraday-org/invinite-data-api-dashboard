// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { V2_AS_REPORTED_DETAILED, V2_CAGR, V2_GROWTH, V2_RATIOS, V2_SEGMENTS, V2_STANDARDIZED, V2_STANDARDIZED_PENDING } from "@/lib/financials/v2-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError } from "./errors";
import {
    refetchWhileCoveragePending,
    useV2CagrInfinite,
    useV2FinancialsInfinite,
    useV2GrowthInfinite,
    useV2RatiosInfinite,
    useV2SegmentsInfinite,
} from "./queries";
import {
    getV2AsReported,
    getV2AsReportedDetailed,
    getV2AsReportedPresentation,
    getV2Cagr,
    getV2Growth,
    getV2Ratios,
    getV2Segments,
    getV2Standardized,
    getV2StandardizedDetailed,
    getV2StandardizedPresentation,
} from "./server-functions";

vi.mock("./server-functions", () => ({
    getV2AsReported: vi.fn(),
    getV2AsReportedDetailed: vi.fn(),
    getV2AsReportedPresentation: vi.fn(),
    getV2Cagr: vi.fn(),
    getV2Fact: vi.fn(),
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
