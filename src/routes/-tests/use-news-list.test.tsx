// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsItemPublic } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { useNewsPage } from "@/lib/api/queries";
import { useLiveNews } from "@/lib/live/use-live-news";
import { edgarItem, newsroomItem } from "@/lib/news/news-fixtures";
import { useNewsList } from "@/routes/$ticker/news/-components/use-news-list";

vi.mock("@/lib/api/queries", () => ({ useApiBaseUrl: vi.fn(() => null), useNewsPage: vi.fn() }));

const live = { arrivals: new Map<string, string>(), items: [] as Array<NewsItemPublic> };

vi.mock("@/lib/live/use-live-news", () => ({ useLiveNews: vi.fn(() => ({ arrivals: live.arrivals, items: live.items, mode: "connecting" })) }));

afterEach(() => {
    vi.mocked(useNewsPage).mockReset();

    live.items = [];

    live.arrivals.clear();

    vi.useRealTimers();
});

/** Every page holds only newsroom items (hidden by `source=edgar`) and names a next page, except the cursor `match`. */
function answerByCursor() {
    vi.mocked(useNewsPage).mockImplementation((input) => {
        const matches = input.cursor === "c3";

        return {
            data: { data: [matches ? edgarItem() : newsroomItem()], has_more: true, meta: {}, next_cursor: `c${Number((input.cursor ?? "c0").slice(1)) + 1}` },
            error: null,
            isFetching: false,
            isLoading: false,
            refetch: vi.fn(),
        } as never;
    });
}

const cursorsAsked = () => vi.mocked(useNewsPage).mock.calls.map(([input]) => input.cursor);

const base = { company: "NVDA", filters: {}, liveTickers: ["NVDA"], onLiveStop: vi.fn(), search: {} };

describe("useNewsList auto-advance", () => {
    it("asks the next pages by itself while a page-side filter hides every row, and stops at the first match", () => {
        answerByCursor();

        const { result } = renderHook(() => useNewsList({ ...base, filters: { source: "edgar" } }));

        expect(cursorsAsked()).toEqual(expect.arrayContaining([null, "c1", "c2", "c3"]));

        expect(cursorsAsked()).not.toContain("c4");

        expect(result.current.page).toBe(4);

        expect(result.current.skippedPages).toBe(3);

        expect(result.current.items).toHaveLength(1);
    });

    it("never advances without a page-side filter, nor away from a matching live item on page 1", () => {
        answerByCursor();

        renderHook(() => useNewsList(base));

        expect(cursorsAsked()).not.toContain("c1");

        vi.mocked(useNewsPage).mockClear();

        live.items = [edgarItem({ id: "00000000-0000-4000-8000-00000000live" })];

        renderHook(() => useNewsList({ ...base, filters: { source: "edgar" }, search: { live: true } }));

        expect(cursorsAsked()).not.toContain("c1");
    });

    it("pauses after Previous (an all-hidden page is not skipped again)", () => {
        answerByCursor();

        const { result } = renderHook(() => useNewsList({ ...base, filters: { source: "edgar" } }));

        expect(result.current.page).toBe(4);

        act(() => result.current.pager.onPrevious());

        expect(result.current.page).toBe(3);
    });
});

describe("market feed recovery and arrivals", () => {
    it("discards yesterday's cursor and reopens page one after New York midnight", () => {
        vi.useFakeTimers();

        vi.setSystemTime(new Date("2026-11-28T04:59:59Z"));

        answerByCursor();

        const { result } = renderHook(() => useNewsList({ ...base, company: undefined, market: true }));

        act(() => result.current.pager.onNext());

        expect(result.current.page).toBe(2);

        vi.setSystemTime(new Date("2026-11-28T05:00:01Z"));

        act(() => vi.mocked(useLiveNews).mock.lastCall?.[0].onResubscribed?.());

        expect(result.current.page).toBe(1);

        expect(cursorsAsked().at(-1)).toBeNull();
    });

    it("forces a fresh first page once when the server rejects a market cursor", () => {
        vi.mocked(useNewsPage).mockImplementation(input => ({
            data: input.cursor ? null : { data: [], next_cursor: "rejected" },
            error: input.cursor ? new ApiRequestError(400, { error: "cursor_mismatch", message: "Window changed" }) : null,
            isFetching: false, isLoading: false, refetch: vi.fn(),
        }) as never);

        const { result } = renderHook(() => useNewsList({ ...base, company: undefined, market: true }));

        act(() => result.current.pager.onNext());

        expect(result.current.page).toBe(1);

        expect(vi.mocked(useNewsPage).mock.lastCall?.[0]).toMatchObject({ cursor: null, recovery: 1 });
    });

    it("keeps the eligible stream mounted during search and recovers only the first visible list", () => {
        const refetch = vi.fn();

        vi.mocked(useNewsPage).mockReturnValue({ data: { data: [], next_cursor: "p2" }, isFetching: false, isLoading: false, refetch } as never);

        const opts = { ...base, company: undefined, market: true as const, search: { live: true }, visible: true };

        const { rerender, result } = renderHook(props => useNewsList(props), { initialProps: opts });

        act(() => vi.mocked(useLiveNews).mock.lastCall?.[0].onResubscribed?.());

        expect(refetch).toHaveBeenCalledTimes(1);

        act(() => result.current.pager.onNext());

        act(() => vi.mocked(useLiveNews).mock.lastCall?.[0].onResubscribed?.());

        expect(refetch).toHaveBeenCalledTimes(1);

        rerender({ ...opts, visible: false });

        expect(vi.mocked(useLiveNews).mock.lastCall?.[0].enabled).toBe(true);

        expect(vi.mocked(useNewsPage).mock.lastCall?.[0].enabled).toBe(false);

        act(() => vi.mocked(useLiveNews).mock.lastCall?.[0].onResubscribed?.());

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("flashes only an in-window socket receipt seen after page one settled", () => {
        vi.useFakeTimers();

        vi.setSystemTime(new Date("2026-11-27T17:00:00Z"));

        let ready = false;

        vi.mocked(useNewsPage).mockImplementation(() => ({ data: ready ? { data: [], next_cursor: null } : null, isFetching: !ready, isLoading: !ready, refetch: vi.fn() }) as never);

        const frame = (id: string, published_at: string) => newsroomItem({ id, published_at });

        const now = new Date().toISOString();

        live.items = [frame("before", now)];

        live.arrivals.set("before", now);

        const { rerender, result } = renderHook(() => useNewsList({ ...base, company: undefined, market: true, search: { live: true } }));

        ready = true;

        rerender();

        live.items = [frame("after", now), frame("stale", "2025-01-01T00:00:00Z"), ...live.items];

        live.arrivals.set("after", now);

        live.arrivals.set("stale", now);

        rerender();

        act(() => vi.advanceTimersByTime(1));

        expect([...result.current.flashing]).toEqual(["after"]);

        expect(result.current.items.map(r => r.id)).toEqual(["after", "before"]);

        act(() => vi.advanceTimersByTime(2500));

        expect(result.current.flashing.size).toBe(0);
    });
});
