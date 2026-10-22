import { describe, expect, it } from "vitest";

import {
    categoryLabel,
    compareFolderKeys,
    documentHref,
    documentPageHref,
    earliestExpiry,
    groupDocumentFolders,
    pagesOf,
    sectionLabel,
    UNPLACED_CATEGORY,
    validateDocumentsSearch,
} from "./documents";

const doc = (id: string, category: null | string, group: null | string, section = "other", year: null | number = null) => ({
    category,
    group,
    group_label: group ? `label ${group}` : null,
    id,
    section,
    year,
});

describe("groupDocumentFolders", () => {
    it("orders categories by the spine, folders newest first, undated last", () => {
        const tree = groupDocumentFolders([
            doc("a", "reports", "reports/2024"),
            doc("b", "earnings", "earnings/fy2026/q4"),
            doc("c", "earnings", "earnings/undated"),
            doc("d", "earnings", "earnings/fy2027/q2"),
            doc("e", "earnings", "earnings/fy2027/q1"),
            doc("f", "earnings", "earnings/fy2027/q2"),
            doc("g", "shareholder", "shareholder/tax"),
            doc("h", "shareholder", "shareholder/dividends"),
        ]);

        expect(tree.map(group => group.category)).toEqual(["earnings", "reports", "shareholder"]);

        expect(tree[0].count).toBe(5);

        expect(tree[0].folders.map(folder => folder.key))
            .toEqual(["earnings/fy2027/q2", "earnings/fy2027/q1", "earnings/fy2026/q4", "earnings/undated"]);

        // The API's order within a folder is kept; the folder label is the API's group_label.
        expect(tree[0].folders[0].documents.map(d => d.id)).toEqual(["d", "f"]);

        expect(tree[0].folders[0].label).toBe("label earnings/fy2027/q2");

        // Named folders A–Z.
        expect(tree[2].folders.map(folder => folder.key)).toEqual(["shareholder/dividends", "shareholder/tax"]);
    });

    it("puts documents not placed yet last, by IR section and year", () => {
        const tree = groupDocumentFolders([
            doc("a", null, null, "annual_reports", 2025),
            doc("b", "zz_new", "zz_new/x"),
            doc("c", "other", "other/faq"),
            doc("d", null, null, "esg", null),
        ]);

        expect(tree.map(group => group.category)).toEqual(["other", "zz_new", UNPLACED_CATEGORY]);

        expect(tree[2].folders.map(folder => folder.label)).toEqual(["Annual reports · 2025", "ESG · Undated"]);

        expect(categoryLabel(UNPLACED_CATEGORY)).toBe("Not yet placed");

        expect(groupDocumentFolders([])).toEqual([]);
    });

    it("compares folder keys like the pipeline", () => {
        expect(compareFolderKeys("events/2026/09-10-a", "events/2025/12-01-b")).toBeLessThan(0);

        expect(compareFolderKeys("news/undated", "news/2020")).toBeGreaterThan(0);

        expect(compareFolderKeys("other/fact-sheets", "other/faq")).toBeLessThan(0);

        expect(compareFolderKeys("other/financial-data", "other/financial-data/2025")).toBeLessThan(0);
    });
});

describe("validateDocumentsSearch", () => {
    it("keeps valid filters and coerces the year", () => {
        expect(validateDocumentsSearch({ category: "esg", kind: "annual_report", section: "esg", year: "2025" }))
            .toEqual({ category: "esg", kind: "annual_report", section: "esg", year: 2025 });
    });

    it("drops invalid values instead of failing the route", () => {
        expect(validateDocumentsSearch({ category: "filings", kind: "nope", section: 7, year: "abc" }))
            .toEqual({ category: undefined, kind: undefined, section: undefined, year: undefined });

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
