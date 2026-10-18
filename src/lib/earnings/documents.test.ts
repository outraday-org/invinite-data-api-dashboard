import { describe, expect, it } from "vitest";

import {
    documentHref,
    documentPageHref,
    earliestExpiry,
    groupDocumentTree,
    pagesOf,
    sectionLabel,
    validateDocumentsSearch,
} from "./documents";

const doc = (id: string, section: string, year: null | number) => ({ id, section, year });

describe("groupDocumentTree", () => {
    it("orders sections by the IR section list, years newest first, undated last", () => {
        const tree = groupDocumentTree([
            doc("a", "proxy", 2024),
            doc("b", "annual_reports", 2023),
            doc("c", "annual_reports", null),
            doc("d", "annual_reports", 2025),
            doc("e", "quarterly_results", 2025),
            doc("f", "annual_reports", 2025),
        ]);

        expect(tree.map(group => group.section)).toEqual(["quarterly_results", "annual_reports", "proxy"]);

        expect(tree[1].count).toBe(4);

        expect(tree[1].years.map(group => group.year)).toEqual([2025, 2023, null]);

        // The API's order within a year is kept.
        expect(tree[1].years[0].documents.map(d => d.id)).toEqual(["d", "f"]);
    });

    it("puts an unknown section after the known ones", () => {
        const tree = groupDocumentTree([doc("a", "zz_new", 2025), doc("b", "other", 2025), doc("c", "faq", 2025)]);

        expect(tree.map(group => group.section)).toEqual(["faq", "other", "zz_new"]);

        expect(groupDocumentTree([])).toEqual([]);
    });
});

describe("validateDocumentsSearch", () => {
    it("keeps valid filters and coerces the year", () => {
        expect(validateDocumentsSearch({ kind: "annual_report", section: "esg", year: "2025" }))
            .toEqual({ kind: "annual_report", section: "esg", year: 2025 });
    });

    it("drops invalid values instead of failing the route", () => {
        expect(validateDocumentsSearch({ kind: "nope", section: 7, year: "abc" }))
            .toEqual({ kind: undefined, section: undefined, year: undefined });

        expect(validateDocumentsSearch({})).toEqual({});
    });
});

describe("links", () => {
    it("opens the stored copy, else the source page of a link-only row", () => {
        expect(documentHref({ source_url: "https://ir.example.com/a", url: "https://r2.example.com/a.pdf?sig=1" }))
            .toBe("https://r2.example.com/a.pdf?sig=1");

        expect(documentHref({ source_url: "https://ir.example.com/webcast", url: null })).toBe("https://ir.example.com/webcast");
    });

    it("adds #page= only on a PDF with a page", () => {
        expect(documentPageHref("https://r2.example.com/x/report.PDF?X-Amz-Signature=s", 12))
            .toBe("https://r2.example.com/x/report.PDF?X-Amz-Signature=s#page=12");

        expect(documentPageHref("https://r2.example.com/x/page.html?sig=s", 3)).toBe("https://r2.example.com/x/page.html?sig=s");

        expect(documentPageHref("https://r2.example.com/x/report.pdf", null)).toBe("https://r2.example.com/x/report.pdf");

        expect(documentPageHref("not a url", 2)).toBe("not a url");
    });

    it("finds the earliest expiry", () => {
        expect(earliestExpiry([{ expires_at: null }])).toBeNull();

        expect(earliestExpiry([
            { expires_at: "2026-10-18T12:15:00Z" },
            { expires_at: null },
            { expires_at: "2026-10-18T12:05:00Z" },
        ])).toBe("2026-10-18T12:05:00Z");
    });
});

describe("pagesOf / sectionLabel", () => {
    it("reads the pages JSON and tolerates anything else", () => {
        expect(pagesOf({ pages: [{ n: 1, sections: [], text: "Hello", title: "Cover" }, { text: "Two", title: " " }] }))
            .toEqual([{ n: 1, text: "Hello", title: "Cover" }, { n: 2, text: "Two", title: null }]);

        expect(pagesOf(undefined)).toEqual([]);

        expect(pagesOf({ pages: "x" })).toEqual([]);

        expect(pagesOf([1, 2])).toEqual([]);
    });

    it("labels known sections and falls back to the raw name", () => {
        expect(sectionLabel("annual_reports")).toBe("Annual reports");

        expect(sectionLabel("brand_new")).toBe("brand new");
    });
});
