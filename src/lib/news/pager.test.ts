import { describe, expect, it } from "vitest";

import {
    firstNewsPage,
    newsPageCursor,
    newsPageNumber,
    newsPagerFor,
    nextNewsPage,
    previousNewsPage,
} from "./pager";

describe("the News pager's cursor stack", () => {
    it("starts at page 1 without a cursor", () => {
        const pager = firstNewsPage("MA");

        expect([newsPageNumber(pager), newsPageCursor(pager)]).toEqual([1, null]);
    });

    it("pushes next_cursor on Next and pops it on Previous, back to page 1 and no further", () => {
        const third = nextNewsPage(nextNewsPage(firstNewsPage("MA"), "c2"), "c3");

        expect([newsPageNumber(third), newsPageCursor(third)]).toEqual([3, "c3"]);

        const second = previousNewsPage(third);

        expect([newsPageNumber(second), newsPageCursor(second)]).toEqual([2, "c2"]);

        const first = previousNewsPage(previousNewsPage(second));

        expect([newsPageNumber(first), newsPageCursor(first)]).toEqual([1, null]);
    });

    it("keeps the page while the filters are the same and resets to page 1 when they change", () => {
        const second = nextNewsPage(firstNewsPage("MA"), "c2");

        expect(newsPagerFor(second, "MA")).toBe(second);

        expect(newsPagerFor(second, "MA|from=2024-01-01")).toEqual(firstNewsPage("MA|from=2024-01-01"));
    });
});
