// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsItemPublic } from "@/lib/api/types";

import { useNewsPage } from "@/lib/api/queries";
import { edgarItem, newsroomItem } from "@/lib/news/news-fixtures";
import { useNewsList } from "@/routes/$ticker/news/-components/use-news-list";

vi.mock("@/lib/api/queries", () => ({ useApiBaseUrl: vi.fn(() => null), useNewsPage: vi.fn() }));

const live = { items: [] as Array<NewsItemPublic> };

vi.mock("@/lib/live/use-live-news", () => ({ useLiveNews: () => ({ items: live.items, mode: "connecting" }) }));

afterEach(() => {
    vi.mocked(useNewsPage).mockReset();

    live.items = [];
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
