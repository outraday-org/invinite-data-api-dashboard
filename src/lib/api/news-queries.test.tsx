// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError, SEARCH_RETRY_DELAY_MS } from "./errors";
import { useNewsPage, useV2AnnouncementsInfinite, useV2NewsSearchInfinite } from "./queries";
import { getV2AnnouncementsList, getV2News, getV2NewsSearch } from "./server-functions";

vi.mock("./server-functions", () => ({
    getV2AnnouncementsList: vi.fn(),
    getV2News: vi.fn(),
    getV2NewsSearch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const EMPTY = { data: [], has_more: false, meta: {}, next_cursor: null };

beforeEach(() => {
    vi.mocked(getV2News).mockReset().mockResolvedValue(EMPTY as never);

    vi.mocked(getV2NewsSearch).mockReset().mockResolvedValue(EMPTY as never);

    vi.mocked(getV2AnnouncementsList).mockReset().mockResolvedValue(EMPTY as never);

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });
});

describe("useNewsPage (O7 group 2)", () => {
    it("sends the event and the oldest-first order; a comma list is one request", async () => {
        const { result } = renderHook(
            () => useNewsPage({ company: "AAPL,MSFT", cursor: null, event: "e1", limit: 50, sort: "published_at" }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(getV2News).toHaveBeenCalledTimes(1);

        expect(vi.mocked(getV2News).mock.calls[0][0].data).toMatchObject({ company: "AAPL,MSFT", event: "e1", sort: "published_at" });
    });

    it("asks nothing without a company (the live-only market scope)", () => {
        renderHook(() => useNewsPage({ company: "", cursor: null, limit: 50 }), { wrapper });

        expect(getV2News).not.toHaveBeenCalled();
    });
});

it("requests market news without a company and converts historic New York days", async () => {
    const { result } = renderHook(() => useNewsPage({ cursor: null, from: "2026-11-01", limit: 50, market: true, to: "2026-11-03" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(vi.mocked(getV2News).mock.calls[0][0].data).toMatchObject({ company: undefined, publishedAtGte: "2026-11-01T04:00:00.000Z", publishedAtLt: "2026-11-04T05:00:00.000Z" });
});

it("separates market and company cache entries and refreshes the rolling market anchor at midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    try {
        vi.setSystemTime(new Date("2026-11-28T04:59:55Z"));

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        const provider = ({ children}: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

        const { rerender, result } = renderHook(({ market}: { market: boolean }) => useNewsPage(market ? { cursor: null, limit: 50, market: true } : { company: "market", cursor: null, limit: 50 }), { initialProps: { market: true }, wrapper: provider });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        rerender({ market: false });

        await waitFor(() => expect(getV2News).toHaveBeenCalledTimes(2));

        expect(vi.mocked(getV2News).mock.lastCall?.[0].data.company).toBe("market");

        rerender({ market: true });

        expect(getV2News).toHaveBeenCalledTimes(2);

        vi.setSystemTime(new Date("2026-11-28T05:00:01Z"));

        rerender({ market: true });

        await waitFor(() => expect(getV2News).toHaveBeenCalledTimes(3));

        expect(vi.mocked(getV2News).mock.lastCall?.[0].data.company).toBeUndefined();
    }
    finally {
        vi.useRealTimers();
    }
});

describe("useV2NewsSearchInfinite", () => {
    it("searches on a submitted query only, the whole market without a company, the day window as instants", async () => {
        const { rerender, result } = renderHook(
            ({ q }) => useV2NewsSearchInfinite({ from: "2026-11-01", limit: 20, mode: "lexical", q, to: "2026-11-02" }),
            { initialProps: { q: "" }, wrapper },
        );

        expect(getV2NewsSearch).not.toHaveBeenCalled();

        rerender({ q: " buyback " });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(vi.mocked(getV2NewsSearch).mock.calls[0][0].data).toMatchObject({
            company: undefined,
            publishedAtGte: "2026-11-01T00:00:00.000Z",
            publishedAtLt: "2026-11-03T00:00:00.000Z",
            q: "buyback",
        });
    });
});

describe("news search error retry policy", () => {
    it.each([
        ["Search is temporarily unavailable", 2],
        ["News search is not enabled", 1],
    ] as const)("applies the five-second retry only to a timeout: %s", async (detail, expected) => {
        vi.useFakeTimers();

        try {
            vi.mocked(getV2NewsSearch).mockRejectedValue(new ApiRequestError(503, { error: "unavailable", message: detail }));

            const { unmount } = renderHook(() => useV2NewsSearchInfinite({ limit: 8, mode: "lexical", q: "revenue" }), { wrapper });

            await act(async () => {
                await vi.advanceTimersByTimeAsync(SEARCH_RETRY_DELAY_MS - 1);
            });

            expect(getV2NewsSearch).toHaveBeenCalledTimes(1);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });

            expect(getV2NewsSearch).toHaveBeenCalledTimes(expected);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2 * SEARCH_RETRY_DELAY_MS);
            });

            expect(getV2NewsSearch).toHaveBeenCalledTimes(expected);

            unmount();
        }
        finally {
            vi.useRealTimers();
        }
    });
});

describe("useV2AnnouncementsInfinite", () => {
    it("sends the company, topic, announced window and the effective range", async () => {
        const { result } = renderHook(
            () => useV2AnnouncementsInfinite({ company: "NVDA", effectiveFrom: "2027-01-01", effectiveTo: "2027-12-31", from: "2026-10-01", limit: 50, sort: "announced_at", topic: ["partnership"] }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(vi.mocked(getV2AnnouncementsList).mock.calls[0][0].data).toMatchObject({
            announcedAtGte: "2026-10-01T00:00:00.000Z",
            company: "NVDA",
            effectiveFromGte: "2027-01-01",
            effectiveToLte: "2027-12-31",
            sort: "announced_at",
            topic: ["partnership"],
        });
    });
});
