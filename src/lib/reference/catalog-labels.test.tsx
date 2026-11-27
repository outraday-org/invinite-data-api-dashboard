// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { useNewsKindCatalogInfinite } from "@/lib/api/queries";
import { getDividendTypeCatalog, getHaltReasonCatalog, getNewsKindCatalog } from "@/lib/api/server-functions";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { useDividendTypeNames, useHaltReasonNames, useNewsCatalogLabels } from "./catalog-labels";
import { DIVIDEND_TYPE_CATALOG_FIXTURE, HALT_REASON_CATALOG_FIXTURE, NEWS_KIND_CATALOG_FIXTURE } from "./reference-fixtures";

vi.mock("@/lib/api/server-functions", () => ({
    getDividendTypeCatalog: vi.fn(),
    getHaltReasonCatalog: vi.fn(),
    getNewsKindCatalog: vi.fn(),
}));

function provider() {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });

    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    return { client, wrapper };
}

const unavailable = () => new ApiRequestError(503, { error: "unavailable", message: "Catalog unavailable" });

beforeEach(() => {
    vi.mocked(getNewsKindCatalog).mockReset().mockResolvedValue(NEWS_KIND_CATALOG_FIXTURE);

    vi.mocked(getDividendTypeCatalog).mockReset().mockResolvedValue(DIVIDEND_TYPE_CATALOG_FIXTURE);

    vi.mocked(getHaltReasonCatalog).mockReset().mockResolvedValue(HALT_REASON_CATALOG_FIXTURE);

    useApiKeyStore.setState({ apiKey: "catalog-test-key", hasHydrated: true });
});

afterEach(() => cleanup());

describe("catalog names", () => {
    it("falls back to raw values during loading, with no key, and while disabled", async () => {
        let resolve!: (value: typeof NEWS_KIND_CATALOG_FIXTURE) => void;

        vi.mocked(getNewsKindCatalog).mockReturnValue(new Promise((done) => {
            resolve = done;
        }));

        const { result } = renderHook(() => useNewsCatalogLabels(), provider());

        expect(result.current.kindLabel("other")).toBe("other");

        expect(result.current.topicLabel("partnership")).toBe("partnership");

        expect(result.current.developmentTopicLabel("research")).toBe("research");

        await act(() => resolve(NEWS_KIND_CATALOG_FIXTURE));

        await waitFor(() => expect(result.current.kindLabel("other")).toBe(NEWS_KIND_CATALOG_FIXTURE.data.find(row => row.group === "kind" && row.value === "other")!.name));

        cleanup();

        vi.mocked(getNewsKindCatalog).mockClear();

        useApiKeyStore.setState({ apiKey: null, hasHydrated: true });

        vi.mocked(getNewsKindCatalog).mockRejectedValue(new ApiRequestError(401, { error: "unauthorized", message: "No key" }));

        const unauthenticated = provider();

        const absent = renderHook(() => useNewsCatalogLabels(), unauthenticated);

        await waitFor(() => expect(unauthenticated.client.getQueryCache().getAll()[0].state.status).toBe("error"));

        expect(absent.result.current.kindLabel("guidance")).toBe("guidance");

        cleanup();

        useApiKeyStore.setState({ apiKey: "catalog-test-key", hasHydrated: true });

        const disabled = renderHook(() => ({ dividends: useDividendTypeNames(false), halt: useHaltReasonNames(false) }), provider());

        expect(disabled.result.current.dividends("CD")).toBe("CD");

        expect(disabled.result.current.halt("T1")).toBe("T1");

        expect(getDividendTypeCatalog).not.toHaveBeenCalled();

        expect(getHaltReasonCatalog).not.toHaveBeenCalled();
    });

    it("uses both group and value for duplicate news values, never a blank/unknown label", async () => {
        vi.mocked(getNewsKindCatalog).mockResolvedValue({
            ...NEWS_KIND_CATALOG_FIXTURE,
            data: NEWS_KIND_CATALOG_FIXTURE.data.map(row => ({ ...row, name: row.value === "other" ? `${row.group} other` : row.value === "product_launch" ? `${row.group} launch` : row.name })),
        });

        const { result } = renderHook(() => useNewsCatalogLabels(), provider());

        await waitFor(() => expect(result.current.kindLabel("other")).toBe("kind other"));

        expect(result.current.topicLabel("other")).toBe("topic other");

        expect(result.current.topicLabel("product_launch")).toBe("topic launch");

        expect(result.current.developmentTopicLabel("product_launch")).toBe("development_topic launch");

        expect(result.current.kindLabel("future_kind")).toBe("future_kind");

        expect(result.current.developmentTopicLabel("other")).toBe("other");
    });

    it("shares initial/next-page requests among label consumers and the catalog tab, fetching beyond 25", async () => {
        vi.mocked(getNewsKindCatalog).mockImplementation(({ data }) => Promise.resolve({
            ...NEWS_KIND_CATALOG_FIXTURE,
            data: NEWS_KIND_CATALOG_FIXTURE.data.slice(data.cursor ? 25 : 0, data.cursor ? undefined : 25),
            has_more: !data.cursor,
            next_cursor: data.cursor ? null : "news-page-2",
        }));

        const cache = provider();

        const { result, unmount } = renderHook(() => ({
            first: useNewsCatalogLabels(),
            second: useNewsCatalogLabels(),
            tab: useNewsKindCatalogInfinite({ enabled: true }),
        }), cache);

        const last = NEWS_KIND_CATALOG_FIXTURE.data.at(-1)!;

        await waitFor(() => expect(result.current.tab.data?.pages).toHaveLength(2));

        expect(result.current.first.topicLabel(last.value)).toBe(last.name);

        expect(result.current.second.topicLabel(last.value)).toBe(last.name);

        expect(getNewsKindCatalog).toHaveBeenCalledTimes(2);

        expect(vi.mocked(getNewsKindCatalog).mock.calls[1][0].data.cursor).toBe("news-page-2");

        expect(cache.client.getQueryCache().getAll()).toHaveLength(1);

        expect(cache.client.getQueryCache().getAll()[0].options).toMatchObject({ staleTime: 60 * 60 * 1000 });

        // An overlapping newly mounted picker reuses the same fresh catalog, without another billed read.
        renderHook(() => useNewsCatalogLabels(), cache);

        unmount();

        expect(getNewsKindCatalog).toHaveBeenCalledTimes(2);
    });

    it("falls back on first-page failure without a fetch loop", async () => {
        vi.mocked(getNewsKindCatalog).mockRejectedValue(unavailable());

        const cache = provider();

        const { result } = renderHook(() => useNewsCatalogLabels(), cache);

        await waitFor(() => expect(cache.client.getQueryCache().getAll()[0].state.status).toBe("error"));

        expect(result.current.kindLabel("guidance")).toBe("guidance");

        expect(result.current.topicLabel("other")).toBe("other");

        expect(getNewsKindCatalog).toHaveBeenCalledTimes(1);
    });

    it("stops failed next-page auto-loading and uses raw codes even when cached rows remain", async () => {
        vi.mocked(getNewsKindCatalog)
            .mockResolvedValueOnce({ ...NEWS_KIND_CATALOG_FIXTURE, data: NEWS_KIND_CATALOG_FIXTURE.data.slice(0, 25), has_more: true, next_cursor: "failed-page" })
            .mockRejectedValue(unavailable());

        const cache = provider();

        const { result } = renderHook(() => useNewsCatalogLabels(), cache);

        await waitFor(() => expect(cache.client.getQueryCache().getAll()[0].state.status).toBe("error"));

        expect(result.current.kindLabel("guidance")).toBe("guidance");

        expect(result.current.topicLabel("research")).toBe("research");

        expect(getNewsKindCatalog).toHaveBeenCalledTimes(2);
    });

    it("shares dividend names and resolves all halt pages; failures/unknown values stay visible", async () => {
        vi.mocked(getHaltReasonCatalog).mockImplementation(({ data }) => Promise.resolve({
            ...HALT_REASON_CATALOG_FIXTURE,
            data: HALT_REASON_CATALOG_FIXTURE.data.slice(data.cursor ? 25 : 0, data.cursor ? undefined : 25),
            has_more: !data.cursor,
            next_cursor: data.cursor ? null : "halt-page-2",
        }));

        const { result } = renderHook(() => ({ dividend: useDividendTypeNames(), dividendAgain: useDividendTypeNames(), halt: useHaltReasonNames(), haltAgain: useHaltReasonNames() }), provider());

        const last = HALT_REASON_CATALOG_FIXTURE.data.at(-1)!;

        await waitFor(() => expect(result.current.halt(last.code)).toBe(last.name));

        await waitFor(() => expect(result.current.dividend("CD")).toBe("Regular cash"));

        expect(result.current.dividendAgain("CD")).toBe("Regular cash");

        expect(result.current.dividend("unknown")).toBe("unknown");

        expect(result.current.haltAgain(last.code)).toBe(last.name);

        expect(result.current.halt("future_code")).toBe("future_code");

        expect(getDividendTypeCatalog).toHaveBeenCalledTimes(1);

        expect(getHaltReasonCatalog).toHaveBeenCalledTimes(2);

        cleanup();

        vi.mocked(getDividendTypeCatalog).mockRejectedValue(unavailable());

        const cache = provider();

        const failure = renderHook(() => useDividendTypeNames(), cache);

        await waitFor(() => expect(cache.client.getQueryCache().getAll()[0].state.status).toBe("error"));

        expect(failure.result.current("CD")).toBe("CD");
    });
});
