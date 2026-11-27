// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NEWS_KIND_CATALOG_FIXTURE } from "@/lib/reference/reference-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError } from "./errors";
import { useAlertTypeCatalogInfinite, useDividendTypeCatalogInfinite, useHaltReasonCatalogInfinite, useNewsKindCatalogInfinite } from "./queries";
import { getAlertTypeCatalog, getDividendTypeCatalog, getHaltReasonCatalog, getNewsKindCatalog } from "./server-functions";

vi.mock("./server-functions", () => ({ getAlertTypeCatalog: vi.fn(), getDividendTypeCatalog: vi.fn(), getHaltReasonCatalog: vi.fn(), getNewsKindCatalog: vi.fn() }));

const empty = { data: [], has_more: false, meta: {}, next_cursor: null };

beforeEach(() => {
    for (const fn of [getAlertTypeCatalog, getDividendTypeCatalog, getHaltReasonCatalog, getNewsKindCatalog]) vi.mocked(fn).mockReset().mockResolvedValue(empty);

    useApiKeyStore.setState({ apiKey: "reference-test-key", hasHydrated: true });
});

function provider(client: QueryClient) {
    return function Provider({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };
}

const clientOf = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("SDK 13 catalog cache", () => {
    it("all four reads are idle until their consumers enable them", () => {
        renderHook(() => [useAlertTypeCatalogInfinite({ enabled: false }), useNewsKindCatalogInfinite({ enabled: false }), useHaltReasonCatalogInfinite({ enabled: false }), useDividendTypeCatalogInfinite({ enabled: false })], { wrapper: provider(clientOf()) });

        for (const fn of [getAlertTypeCatalog, getDividendTypeCatalog, getHaltReasonCatalog, getNewsKindCatalog]) expect(fn).not.toHaveBeenCalled();
    });

    it("sends cursor pages and shares the hour-fresh result across observers", async () => {
        vi.mocked(getNewsKindCatalog).mockResolvedValueOnce({ ...NEWS_KIND_CATALOG_FIXTURE, data: NEWS_KIND_CATALOG_FIXTURE.data.slice(0, 25), has_more: true, next_cursor: "next" }).mockResolvedValueOnce({ ...NEWS_KIND_CATALOG_FIXTURE, data: NEWS_KIND_CATALOG_FIXTURE.data.slice(25) });

        const client = clientOf();

        const wrapper = provider(client);

        const first = renderHook(() => useNewsKindCatalogInfinite({ enabled: true }), { wrapper });

        await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

        await act(() => first.result.current.fetchNextPage());

        await waitFor(() => expect(first.result.current.data?.pages.flatMap(page => page.data)).toHaveLength(30));

        expect(vi.mocked(getNewsKindCatalog).mock.calls.map(call => call[0].data)).toEqual([{ apiKey: "reference-test-key", cursor: undefined, limit: 200 }, { apiKey: "reference-test-key", cursor: "next", limit: 200 }]);

        const second = renderHook(() => useNewsKindCatalogInfinite({ enabled: true }), { wrapper });

        await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

        expect(getNewsKindCatalog).toHaveBeenCalledTimes(2);

        const now = Date.now();

        vi.useFakeTimers({ toFake: ["Date"] });

        try {
            vi.setSystemTime(now + 3599000);

            renderHook(() => useNewsKindCatalogInfinite({ enabled: true }), { wrapper });

            expect(getNewsKindCatalog).toHaveBeenCalledTimes(2);

            vi.setSystemTime(now + 3601000);

            renderHook(() => useNewsKindCatalogInfinite({ enabled: true }), { wrapper });

            await waitFor(() => expect(getNewsKindCatalog).toHaveBeenCalledTimes(3));
        }
        finally {
            vi.useRealTimers();
        }
    });

    it("a refused catalog read preserves the status-aware problem", async () => {
        vi.mocked(getAlertTypeCatalog).mockRejectedValue(new ApiRequestError(503, { error: "unavailable", message: "Try later" }));

        const { result } = renderHook(() => useAlertTypeCatalogInfinite({ enabled: true }), { wrapper: provider(clientOf()) });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeInstanceOf(ApiRequestError);

        expect(getAlertTypeCatalog).toHaveBeenCalledTimes(1);
    });
});
