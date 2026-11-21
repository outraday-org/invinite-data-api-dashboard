// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FILL_PAGES_MAX, shouldFillPage, shouldLoadNextPage, useAutoLoadPages } from "./use-auto-load-pages";

const base = { filtering: true, hasNextPage: true, isFetching: false, nextPageFailed: false, pagesSinceChange: 1, shownRows: 0 };

describe("shouldLoadNextPage (THE rule of a list that loads its next page by itself)", () => {
    const state = { hasNextPage: true, isFetching: false, nextPageFailed: false, pagesLoaded: 3 };

    it("loads while a next page exists, nothing loads and the last page did not fail; unbounded by default", () => {
        expect(shouldLoadNextPage(state)).toBe(true);

        expect(shouldLoadNextPage({ ...state, pagesLoaded: 10_000 })).toBe(true);

        expect(shouldLoadNextPage({ ...state, hasNextPage: false })).toBe(false);

        expect(shouldLoadNextPage({ ...state, isFetching: true })).toBe(false);

        expect(shouldLoadNextPage({ ...state, nextPageFailed: true })).toBe(false);
    });

    it("stops at max", () => {
        expect(shouldLoadNextPage(state, 4)).toBe(true);

        expect(shouldLoadNextPage(state, 3)).toBe(false);
    });
});

describe("shouldFillPage (a client-side filter loads further pages by itself)", () => {
    it("loads while the filter shows nothing and a next page exists", () => {
        expect(shouldFillPage(base)).toBe(true);
    });

    it("stops at a row, at the window's end, while loading, without a filter", () => {
        expect(shouldFillPage({ ...base, shownRows: 1 })).toBe(false);

        expect(shouldFillPage({ ...base, hasNextPage: false })).toBe(false);

        expect(shouldFillPage({ ...base, isFetching: true })).toBe(false);

        expect(shouldFillPage({ ...base, filtering: false })).toBe(false);
    });

    it("stops after a failed page (a 429 / 5xx is not asked again in a loop; Load more retries it)", () => {
        expect(shouldFillPage({ ...base, nextPageFailed: true })).toBe(false);
    });

    it("at most ten pages per filter change (every page is billed); then the reader's Load more", () => {
        expect(shouldFillPage({ ...base, pagesSinceChange: FILL_PAGES_MAX - 1 })).toBe(true);

        expect(shouldFillPage({ ...base, pagesSinceChange: FILL_PAGES_MAX })).toBe(false);

        expect(FILL_PAGES_MAX).toBe(10);
    });
});

describe("useAutoLoadPages", () => {
    const query = (patch: Partial<Parameters<typeof useAutoLoadPages>[0]> = {}) => ({
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetching: false,
        isFetchNextPageError: false,
        pageCount: 1,
        ...patch,
    });

    it("every page: asks while a next page exists, never after a failed one", () => {
        const ok = query();

        renderHook(() => useAutoLoadPages(ok));

        expect(ok.fetchNextPage).toHaveBeenCalledTimes(1);

        const failed = query({ isFetchNextPageError: true });

        renderHook(() => useAutoLoadPages(failed));

        expect(failed.fetchNextPage).not.toHaveBeenCalled();
    });

    it("an event list: max counts every loaded page (no resetKey)", () => {
        const atMax = query({ pageCount: 10 });

        renderHook(() => useAutoLoadPages(atMax, { max: 10 }));

        expect(atMax.fetchNextPage).not.toHaveBeenCalled();
    });

    it("a client filter: max counts from the last resetKey change, and capped says the cap stopped it", () => {
        let props = { key: "a", pageCount: 12 };

        const fetchNextPage = vi.fn();

        const { rerender, result } = renderHook(() => useAutoLoadPages(query({ fetchNextPage, pageCount: props.pageCount }), { enabled: true, max: 2, resetKey: props.key }));

        // 12 pages already loaded before the filter: they do not count.
        expect(fetchNextPage).toHaveBeenCalledTimes(1);

        props = { key: "a", pageCount: 14 };

        rerender();

        expect(result.current.capped).toBe(true);

        props = { key: "b", pageCount: 14 };

        rerender();

        expect(result.current.capped).toBe(false);
    });

    it("disabled: no request and never capped", () => {
        const off = query({ pageCount: 50 });

        const { result } = renderHook(() => useAutoLoadPages(off, { enabled: false, max: 1, resetKey: "x" }));

        expect(off.fetchNextPage).not.toHaveBeenCalled();

        expect(result.current.capped).toBe(false);
    });
});
