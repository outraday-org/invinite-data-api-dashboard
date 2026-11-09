// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { V2_FILING_10K, V2_FILINGS, V2_HOLDINGS, V2_HOLDINGS_PENDING, V2_INSIDER_TRADES, V2_IPOS } from "@/lib/sec/v2-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError } from "./errors";
import {
    refetchWhileCoveragePending,
    useV2DocumentVersion,
    useV2Filing,
    useV2FilingsInfinite,
    useV2HoldingChangesInfinite,
    useV2HoldingsInfinite,
    useV2InsiderTradesInfinite,
    useV2IposInfinite,
} from "./queries";
import {
    getV2DocumentVersion,
    getV2Filing,
    getV2Filings,
    getV2HoldingChanges,
    getV2Holdings,
    getV2InsiderTrades,
    getV2Ipos,
} from "./server-functions";

vi.mock("./server-functions", () => ({
    getV2DocumentVersion: vi.fn(),
    getV2Filing: vi.fn(),
    getV2Filings: vi.fn(),
    getV2HoldingChanges: vi.fn(),
    getV2Holdings: vi.fn(),
    getV2InsiderTrades: vi.fn(),
    getV2Ipos: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// A problem as TanStack Start revives a thrown `ApiRequestError` (own properties of a plain Error).
const revivedProblem = (status: number, code: string, detail: string) =>
    Object.assign(new Error(detail), { body: { error: code, message: detail, requestId: "req_7" }, code, status });

beforeEach(() => {
    vi.clearAllMocks();

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });
});

describe("useV2FilingsInfinite", () => {
    it("sends company, the form list, the sort and the day range as filed_at.gte / .lt; pages by next_cursor", async () => {
        vi.mocked(getV2Filings)
            .mockResolvedValueOnce(V2_FILINGS)
            .mockResolvedValueOnce({ ...V2_FILINGS, has_more: false, next_cursor: null });

        const { result } = renderHook(() => useV2FilingsInfinite({
            company: "AAPL",
            form: ["10-K"],
            from: "2026-01-01",
            limit: 40,
            sort: "-filed_at",
            to: "2026-11-03",
        }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getV2Filings).toHaveBeenLastCalledWith({
            data: {
                apiKey: "test-key",
                company: "AAPL",
                cursor: undefined,
                filedAtGte: "2026-01-01T00:00:00.000Z",
                filedAtLt: "2026-11-04T00:00:00.000Z",
                form: ["10-K"],
                limit: 40,
                sort: "-filed_at",
            },
        });

        await act(() => result.current.fetchNextPage());

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

        expect(vi.mocked(getV2Filings).mock.lastCall?.[0]?.data).toMatchObject({ cursor: "eyJ2IjoyfQ" });

        expect(result.current.hasNextPage).toBe(false);
    });

    it("a 403 excluded problem is a page state: revived, never retried, no toast", async () => {
        vi.mocked(getV2Filings).mockRejectedValue(revivedProblem(403, "excluded", "Excluded issuer"));

        const { result } = renderHook(() => useV2FilingsInfinite({ company: "ABSX" }), { wrapper });

        await waitFor(() => expect(result.current.error).not.toBeNull());

        expect(result.current.error).toBeInstanceOf(ApiRequestError);

        expect((result.current.error as ApiRequestError).code).toBe("excluded");

        expect(getV2Filings).toHaveBeenCalledTimes(1);

        expect(toast.error).not.toHaveBeenCalled();
    });
});

describe("useV2Filing / useV2DocumentVersion", () => {
    it("idle without an accession / version; asks with expand=documents and a block range", async () => {
        const { rerender, result } = renderHook(({ accession }: { accession: null | string }) => useV2Filing(accession, ["documents"]), {
            initialProps: { accession: null as null | string },
            wrapper,
        });

        expect(getV2Filing).not.toHaveBeenCalled();

        vi.mocked(getV2Filing).mockResolvedValue(V2_FILING_10K);

        rerender({ accession: "0000320193-26-000026" });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        expect(getV2Filing).toHaveBeenCalledWith({ data: { accession: "0000320193-26-000026", apiKey: "test-key", expand: ["documents"] } });

        const version = renderHook(() => useV2DocumentVersion(null, {}), { wrapper });

        expect(version.result.current.data).toBeNull();

        expect(getV2DocumentVersion).not.toHaveBeenCalled();
    });
});

describe("13F holdings and changes", () => {
    it("holdings need exactly one scope; the period end is sent only when picked", async () => {
        vi.mocked(getV2Holdings).mockResolvedValue(V2_HOLDINGS);

        renderHook(() => useV2HoldingsInfinite({ accession: "0000102909-26-000123", company: "AAPL" }), { wrapper });

        renderHook(() => useV2HoldingsInfinite({}), { wrapper });

        const { result } = renderHook(() => useV2HoldingsInfinite({ company: "AAPL", limit: 100, periodEnd: "2026-06-30" }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getV2Holdings).toHaveBeenCalledTimes(1);

        expect(getV2Holdings).toHaveBeenCalledWith({ data: { apiKey: "test-key", company: "AAPL", cursor: undefined, limit: 100, periodEnd: "2026-06-30" } });

        expect(result.current.data?.pages[0].meta).toMatchObject({ counting: expect.any(String), pinned_at: "2026-11-09T06:00:00Z" });
    });

    it("changes ask by company and the picked period", async () => {
        vi.mocked(getV2HoldingChanges).mockResolvedValue({ data: [], has_more: false, meta: {}, next_cursor: null });

        const { result } = renderHook(() => useV2HoldingChangesInfinite({ company: "AAPL", limit: 100 }), { wrapper });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        expect(getV2HoldingChanges).toHaveBeenCalledWith({ data: { apiKey: "test-key", company: "AAPL", cursor: undefined, limit: 100 } });
    });

    it("a pending first page is asked again every 30 s; partial / complete are not", () => {
        const state = (page: typeof V2_HOLDINGS) => ({ state: { data: { pageParams: [null], pages: [page] } } });

        expect(refetchWhileCoveragePending(state(V2_HOLDINGS_PENDING))).toBe(30_000);

        expect(refetchWhileCoveragePending(state(V2_HOLDINGS))).toBe(false);

        expect(refetchWhileCoveragePending({ state: {} })).toBe(false);
    });
});

describe("useV2InsiderTradesInfinite", () => {
    it("sends side and the inclusive day range; nothing unset", async () => {
        vi.mocked(getV2InsiderTrades).mockResolvedValue(V2_INSIDER_TRADES);

        const { result } = renderHook(() => useV2InsiderTradesInfinite({ company: "AAPL", from: "2026-10-01", limit: 50, side: "sell" }), { wrapper });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        expect(getV2InsiderTrades).toHaveBeenCalledWith({
            data: {
                apiKey: "test-key",
                company: "AAPL",
                cursor: undefined,
                filedAtGte: "2026-10-01T00:00:00.000Z",
                filedAtLt: undefined,
                limit: 50,
                side: "sell",
            },
        });
    });

    it("404 not_covered (no trade ever stored) stays quiet: the page shows the state", async () => {
        vi.mocked(getV2InsiderTrades).mockRejectedValue(revivedProblem(404, "not_covered", "No insider trades are stored for this company"));

        const { result } = renderHook(() => useV2InsiderTradesInfinite({ company: "ZZZZ" }), { wrapper });

        await waitFor(() => expect(result.current.error).not.toBeNull());

        expect((result.current.error as ApiRequestError).status).toBe(404);

        expect(toast.error).not.toHaveBeenCalled();
    });
});

describe("useV2IposInfinite", () => {
    it("market-wide (no company), the stage list and the sort", async () => {
        vi.mocked(getV2Ipos).mockResolvedValue(V2_IPOS);

        const { result } = renderHook(() => useV2IposInfinite({ limit: 50, sort: "-listing_date", stage: ["priced", "trading"] }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages[0].data).toHaveLength(2));

        expect(getV2Ipos).toHaveBeenCalledWith({
            data: { apiKey: "test-key", cursor: undefined, limit: 50, sort: "-listing_date", stage: ["priced", "trading"] },
        });
    });
});
