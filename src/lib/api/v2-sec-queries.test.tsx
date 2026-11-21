// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FILING_FACTS } from "@/lib/sec/filing-detail-fixtures";
import { V2_FILING_10K, V2_FILING_SEARCH, V2_FILINGS, V2_HOLDERS_13F, V2_HOLDERS_OVERVIEW, V2_HOLDERS_PENDING, V2_INSIDER_TRADES, V2_IPOS } from "@/lib/sec/v2-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError } from "./errors";
import {
    refetchWhileCoveragePending,
    useFilerHoldingsInfinite,
    useHolderChangesInfinite,
    useHoldersInfinite,
    useV2DocumentVersion,
    useV2Filing,
    useV2FilingFactsInfinite,
    useV2FilingSearchInfinite,
    useV2FilingsInfinite,
    useV2InsiderTradesInfinite,
    useV2IposInfinite,
} from "./queries";
import {
    getFilerHoldings,
    getHolderChanges,
    getHolders,
    getV2DocumentVersion,
    getV2Filing,
    getV2FilingFacts,
    getV2Filings,
    getV2FilingSearch,
    getV2InsiderTrades,
    getV2Ipos,
} from "./server-functions";

vi.mock("./server-functions", () => ({
    getFilerHoldings: vi.fn(),
    getHolderChanges: vi.fn(),
    getHolders: vi.fn(),
    getV2DocumentVersion: vi.fn(),
    getV2Filing: vi.fn(),
    getV2FilingFacts: vi.fn(),
    getV2Filings: vi.fn(),
    getV2FilingSearch: vi.fn(),
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
    it("sends symbol, the form list, 8-K items, the sort and the day range as days (filed_at.gte / .lte); pages by next_cursor", async () => {
        vi.mocked(getV2Filings)
            .mockResolvedValueOnce(V2_FILINGS)
            .mockResolvedValueOnce({ ...V2_FILINGS, has_more: false, next_cursor: null });

        const { result } = renderHook(() => useV2FilingsInfinite({
            form: ["10-K"],
            from: "2026-01-01",
            items: ["2.02"],
            limit: 40,
            sort: "-filed_at",
            symbol: "AAPL",
            to: "2026-11-03",
        }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getV2Filings).toHaveBeenLastCalledWith({
            data: {
                apiKey: "test-key",
                cursor: undefined,
                filedFrom: "2026-01-01",
                filedTo: "2026-11-03",
                form: ["10-K"],
                items: ["2.02"],
                limit: 40,
                sort: "-filed_at",
                symbol: "AAPL",
            },
        });

        await act(() => result.current.fetchNextPage());

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

        expect(vi.mocked(getV2Filings).mock.lastCall?.[0]?.data).toMatchObject({ cursor: "eyJ2IjoyfQ" });

        expect(result.current.hasNextPage).toBe(false);
    });

    it("a 403 excluded problem is a page state: revived, never retried, no toast", async () => {
        vi.mocked(getV2Filings).mockRejectedValue(revivedProblem(403, "excluded", "Excluded issuer"));

        const { result } = renderHook(() => useV2FilingsInfinite({ symbol: "ABSX" }), { wrapper });

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

describe("holders, holder changes and a manager's portfolio", () => {
    it("one source by cursor with the picked period; an empty symbol stays idle", async () => {
        vi.mocked(getHolders).mockResolvedValue(V2_HOLDERS_13F);

        renderHook(() => useHoldersInfinite({ source: "13f", symbol: "" }), { wrapper });

        const { result } = renderHook(() => useHoldersInfinite({ limit: 100, periodEnd: "2026-06-30", source: "13f", symbol: "AAPL" }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getHolders).toHaveBeenCalledTimes(1);

        expect(getHolders).toHaveBeenCalledWith({
            data: { apiKey: "test-key", cursor: undefined, instruments: undefined, limit: 100, periodEnd: "2026-06-30", source: "13f", symbol: "AAPL" },
        });

        expect(result.current.data?.pages[0].meta).toMatchObject({ counting: expect.any(String), pinned_at: "2026-11-09T06:00:00Z" });
    });

    it("issuer files never send a period; the overview sends no source and no cursor", async () => {
        vi.mocked(getHolders).mockResolvedValue(V2_HOLDERS_OVERVIEW);

        const issuer = renderHook(() => useHoldersInfinite({ periodEnd: "2026-06-30", source: "issuer_file", symbol: "NVDA" }), { wrapper });

        await waitFor(() => expect(issuer.result.current.data).not.toBeNull());

        expect(vi.mocked(getHolders).mock.lastCall?.[0]?.data).toMatchObject({ periodEnd: undefined, source: "issuer_file" });

        const overview = renderHook(() => useHoldersInfinite({ limit: 25, symbol: "NVDA" }), { wrapper });

        await waitFor(() => expect(overview.result.current.data).not.toBeNull());

        expect(vi.mocked(getHolders).mock.lastCall?.[0]?.data).toMatchObject({ cursor: undefined, limit: 25, source: undefined, symbol: "NVDA" });

        expect(overview.result.current.hasNextPage).toBe(false);
    });

    it("changes ask by symbol and the picked period; the portfolio by CIK, idle without one", async () => {
        vi.mocked(getHolderChanges).mockResolvedValue({ data: [], has_more: false, meta: {}, next_cursor: null });

        vi.mocked(getFilerHoldings).mockResolvedValue({ data: [], has_more: false, meta: {}, next_cursor: null });

        const { result } = renderHook(() => useHolderChangesInfinite({ limit: 100, symbol: "AAPL" }), { wrapper });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        expect(getHolderChanges).toHaveBeenCalledWith({ data: { apiKey: "test-key", cursor: undefined, limit: 100, symbol: "AAPL" } });

        renderHook(() => useFilerHoldingsInfinite({ cik: "" }), { wrapper });

        const portfolio = renderHook(() => useFilerHoldingsInfinite({ cik: "102909", periodEnd: "2026-09-30" }), { wrapper });

        await waitFor(() => expect(portfolio.result.current.data).not.toBeNull());

        expect(getFilerHoldings).toHaveBeenCalledTimes(1);

        expect(getFilerHoldings).toHaveBeenCalledWith({ data: { apiKey: "test-key", cik: "102909", cursor: undefined, periodEnd: "2026-09-30" } });
    });

    it("a pending first page is asked again every 30 s; partial / complete are not", () => {
        const state = (page: typeof V2_HOLDERS_13F) => ({ state: { data: { pageParams: [null], pages: [page] } } });

        expect(refetchWhileCoveragePending(state(V2_HOLDERS_PENDING))).toBe(30_000);

        expect(refetchWhileCoveragePending(state(V2_HOLDERS_13F))).toBe(false);

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

describe("filings depth hooks (O7 group 3)", () => {
    it("a filing's facts: idle without an accession; the accession and concepts as sent", async () => {
        vi.mocked(getV2FilingFacts).mockResolvedValue(FILING_FACTS);

        const { rerender, result } = renderHook(({ accession }) => useV2FilingFactsInfinite(accession, "Revenues"), { initialProps: { accession: "" }, wrapper });

        expect(getV2FilingFacts).not.toHaveBeenCalled();

        rerender({ accession: "0000320193-26-000020" });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getV2FilingFacts).toHaveBeenLastCalledWith({
            data: { accession: "0000320193-26-000020", apiKey: "test-key", cursor: undefined, limit: 50, tag: "Revenues" },
        });
    });

    it("the filing search asks without a symbol only when marketWide; filters and days as sent", async () => {
        vi.mocked(getV2FilingSearch).mockResolvedValue(V2_FILING_SEARCH);

        renderHook(() => useV2FilingSearchInfinite({ mode: "lexical", q: "tariff", symbol: "" }), { wrapper });

        expect(getV2FilingSearch).not.toHaveBeenCalled();

        const { result } = renderHook(() => useV2FilingSearchInfinite({
            form: "8-K",
            from: "2026-11-01",
            item: "2.02",
            limit: 10,
            marketWide: true,
            mode: "lexical",
            q: "tariff",
            symbol: "",
            to: "2026-11-20",
        }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getV2FilingSearch).toHaveBeenLastCalledWith({
            data: {
                apiKey: "test-key",
                caseSensitive: undefined,
                cursor: undefined,
                filedFrom: "2026-11-01",
                filedTo: "2026-11-20",
                form: "8-K",
                item: "2.02",
                limit: 10,
                mode: "lexical",
                q: "tariff",
                symbol: undefined,
            },
        });
    });
});
