// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError } from "./errors";
import { useV2DividendsInfinite } from "./queries";
import { getV2Dividends } from "./server-functions";

vi.mock("./server-functions", () => ({ getV2Dividends: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const getDividends = vi.mocked(getV2Dividends);

function row(exDate: string) {
    return {
        cash_amount: 0.25,
        company: { cik: "0000320193", ticker: "AAPL" },
        declaration_date: exDate,
        dividend_type: "CD",
        ex_dividend_date: exDate,
        frequency: 4,
        pay_date: exDate,
        record_date: exDate,
    };
}

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
    getDividends.mockReset();

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });
});

describe("useV2DividendsInfinite", () => {
    it("pages by next_cursor with the same filters, and stops at a null cursor", async () => {
        getDividends
            .mockResolvedValueOnce({ data: [row("2026-08-11")], has_more: true, meta: {}, next_cursor: "c2" })
            .mockResolvedValueOnce({ data: [row("2026-05-12")], has_more: false, meta: {}, next_cursor: null });

        const { result } = renderHook(() => useV2DividendsInfinite({ company: "AAPL", limit: 1, sort: "-ex_date" }), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getDividends).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", company: "AAPL", cursor: undefined, limit: 1, sort: "-ex_date" } });

        expect(result.current.hasNextPage).toBe(true);

        await act(() => result.current.fetchNextPage());

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

        expect(getDividends).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", company: "AAPL", cursor: "c2", limit: 1, sort: "-ex_date" } });

        expect(result.current.hasNextPage).toBe(false);
    });

    it("revives the problem error with its request id and never retries it", async () => {
        const thrown = Object.assign(new Error("Unknown parameter: offset"), {
            body: { error: "unknown_parameter", message: "Unknown parameter: offset", requestId: "req_9" },
            code: "unknown_parameter",
            status: 400,
        });

        getDividends.mockRejectedValue(thrown);

        const { result } = renderHook(() => useV2DividendsInfinite({ company: "AAPL" }), { wrapper });

        await waitFor(() => expect(result.current.error).not.toBeNull());

        expect(result.current.error).toBeInstanceOf(ApiRequestError);

        expect((result.current.error as ApiRequestError).requestId).toBe("req_9");

        expect(getDividends).toHaveBeenCalledTimes(1);

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to load dividends", {
            description: "Unknown parameter: offset (unknown_parameter, request req_9)",
        }));
    });
});
