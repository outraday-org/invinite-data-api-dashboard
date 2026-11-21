import { describe, expect, it } from "vitest";

import { FILL_PAGES_MAX, shouldFillPage } from "./use-fill-pages";

const base = { filtering: true, hasNextPage: true, isFetching: false, pagesSinceChange: 1, shownRows: 0 };

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

    it("at most ten pages per filter change (every page is billed); then the reader's Load more", () => {
        expect(shouldFillPage({ ...base, pagesSinceChange: FILL_PAGES_MAX - 1 })).toBe(true);

        expect(shouldFillPage({ ...base, pagesSinceChange: FILL_PAGES_MAX })).toBe(false);

        expect(FILL_PAGES_MAX).toBe(10);
    });
});
