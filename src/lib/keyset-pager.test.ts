import { describe, expect, it } from "vitest";

import {
    firstPage,
    nextPage,
    pageCursor,
    pageNumber,
    pagerFor,
    previousPage,
} from "./keyset-pager";

describe("the keyset pager's cursor stack", () => {
    it("starts at page 1 without a cursor", () => {
        const pager = firstPage("MA");

        expect([pageNumber(pager), pageCursor(pager)]).toEqual([1, null]);
    });

    it("pushes next_cursor on Next and pops it on Previous, back to page 1 and no further", () => {
        const third = nextPage(nextPage(firstPage("MA"), "c2"), "c3");

        expect([pageNumber(third), pageCursor(third)]).toEqual([3, "c3"]);

        const second = previousPage(third);

        expect([pageNumber(second), pageCursor(second)]).toEqual([2, "c2"]);

        const first = previousPage(previousPage(second));

        expect([pageNumber(first), pageCursor(first)]).toEqual([1, null]);
    });

    it("keeps the page while the filters are the same and resets to page 1 when they change", () => {
        const second = nextPage(firstPage("MA"), "c2");

        expect(pagerFor(second, "MA")).toBe(second);

        expect(pagerFor(second, "MA|from=2024-01-01")).toEqual(firstPage("MA|from=2024-01-01"));
    });
});
