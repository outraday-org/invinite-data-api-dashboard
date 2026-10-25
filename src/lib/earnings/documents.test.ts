import { describe, expect, it } from "vitest";

import type { CallEvent, TreeDocument, TreeNode } from "./documents";

import {
    allKeys,
    buildDocumentTree,
    callEntries,
    callPlacement,
    categoryLabel,
    compareFolderKeys,
    defaultOpenKeys,
    documentHref,
    documentPageHref,
    earliestExpiry,
    eventTitleMap,
    filterCallEntries,
    folderLabel,
    matchesQuery,
    pagesOf,
    sectionLabel,
    segmentLabel,
    UNPLACED_CATEGORY,
    validateDocumentsSearch,
} from "./documents";

type Doc = TreeDocument & { id: string };

const doc = (id: string, category: null | string, group: null | string, section: null | string = "other", year: null | number = null): Doc => ({
    category,
    event_date: null,
    event_id: null,
    group,
    group_label: group ? `label ${group}` : null,
    id,
    kind: "other",
    section,
    title: `Title ${id}`,
    year,
});

const event = (overrides: Partial<CallEvent> = {}): CallEvent => ({
    call_time_source: "wire",
    event_id: "e1",
    event_title: null,
    event_type: "earnings_call",
    fiscal_quarter: 2,
    fiscal_year: 2027,
    has_audio: true,
    has_documents: false,
    has_press_release: true,
    has_slides: true,
    has_transcript: true,
    // 2026-08-27 00:30 UTC = Aug 26, 8:30 PM in New York.
    scheduled_at: "2026-08-27T00:30:00.000Z",
    symbol: "ACME",
    ...overrides,
});

/** `[key, count]` of every node, depth-first. */
const shape = (nodes: ReadonlyArray<TreeNode<unknown>>): Array<[string, number]> =>
    nodes.flatMap(node => [[node.key, node.count] as [string, number], ...shape(node.children)]);

describe("segmentLabel", () => {
    it("labels the pipeline's folder segments", () => {
        expect(segmentLabel("earnings", 0)).toBe("Earnings");

        expect(segmentLabel(UNPLACED_CATEGORY, 0)).toBe("Not yet placed");

        expect(segmentLabel("fy2027", 1)).toBe("FY2027");

        expect(segmentLabel("q2", 2)).toBe("Q2");

        expect(segmentLabel("cy2026", 1)).toBe("2026");

        expect(segmentLabel("08-26", 2)).toBe("Aug 26");

        expect(segmentLabel("09-10-goldman-sachs-communacopia", 2)).toBe("Sep 10 · Goldman Sachs Communacopia");

        expect(segmentLabel("undated", 1)).toBe("Undated");

        expect(segmentLabel("2025", 1)).toBe("2025");

        expect(segmentLabel("financial-data", 1)).toBe("Financial Data");

        expect(segmentLabel("faq", 1)).toBe("FAQ");

        // The day without a leading zero, as the API's "Dec 5, 2016".
        expect(segmentLabel("12-05-event", 2)).toBe("Dec 5 · Event");
    });
});

describe("folderLabel", () => {
    const GTC = "events/2025/05-18-gtc-taipei-2025";

    const titles = new Map([["ev1", "Computex 2025 Keynote"]]);

    const at = (group: string, overrides: Partial<Doc> = {}): Doc => ({ ...doc("x", group.split("/")[0], group), ...overrides });

    it("names an event folder by the stored name of the API's group_label", () => {
        const docs = [at(GTC, { event_id: "ev1", group_label: "May 18, 2025 · GTC Taipei 2025" })];

        expect(folderLabel(GTC.split("/"), docs, titles)).toBe("May 18 · GTC Taipei 2025");
    });

    it("falls back to the title of a document's event, then to the slug", () => {
        // The API's computed label (no stored name) is not a name.
        const computed = at(GTC, { event_id: "ev1", group_label: "2025-05-18 · gtc-taipei-2025" });

        expect(folderLabel(GTC.split("/"), [computed], titles)).toBe("May 18 · Computex 2025 Keynote");

        expect(folderLabel(GTC.split("/"), [{ ...computed, event_id: "unknown" }], titles)).toBe("May 18 · Gtc Taipei 2025");

        expect(folderLabel(GTC.split("/"), [], titles)).toBe("May 18 · Gtc Taipei 2025");
    });

    it("never repeats the parent's words: every other folder names its own segment", () => {
        const label = (group: string, groupLabel: string) => folderLabel(group.split("/"), [at(group, { group_label: groupLabel })], titles);

        expect(label("earnings/fy2027/q2", "Q2 FY2027")).toBe("Q2");

        expect(label("earnings/cy2026/08-26", "Earnings call 2026-08-26")).toBe("Aug 26");

        expect(label("reports/2025", "Reports 2025")).toBe("2025");

        expect(label("esg/2025", "ESG 2025")).toBe("2025");

        expect(label("esg/undated", "ESG (undated)")).toBe("Undated");

        expect(label("shareholder/tax", "Shareholder · Tax")).toBe("Tax");

        expect(label("other/faq", "Other · FAQ")).toBe("FAQ");

        expect(label("other/fact-sheets", "Other · Fact sheets")).toBe("Fact Sheets");

        expect(label("other/financial-data/2025", "Other · Financial data 2025")).toBe("2025");

        expect(label("events/2025", "Events 2025")).toBe("2025");

        // A month-led label outside an event day folder is never read as a name.
        expect(label("events/2025", "May 18, 2025 · GTC Taipei 2025")).toBe("2025");
    });

    it("maps the loaded events to their trimmed titles, untitled ones left out", () => {
        expect([...eventTitleMap([{ event_id: "a", event_title: " Investor Day " }, { event_id: "b", event_title: null }, { event_id: "c", event_title: " " }])])
            .toEqual([["a", "Investor Day"]]);
    });
});

describe("buildDocumentTree", () => {
    it("nests on the group path, counts every descendant, newest first, undated last", () => {
        const tree = buildDocumentTree([
            doc("a", "reports", "reports/2024"),
            doc("b", "earnings", "earnings/fy2026/q4"),
            doc("c", "earnings", "earnings/undated"),
            doc("d", "earnings", "earnings/fy2027/q2"),
            doc("e", "earnings", "earnings/fy2027/q1"),
            doc("f", "earnings", "earnings/fy2027/q2"),
            doc("g", "shareholder", "shareholder/tax"),
            doc("h", "shareholder", "shareholder/dividends"),
            doc("i", "events", "events/2026/09-10-goldman-sachs-communacopia"),
            doc("j", "events", "events/2026/01-07-ces"),
            doc("k", "other", "other/financial-data"),
            doc("l", "other", "other/financial-data/2025"),
        ], [], "");

        expect(tree.map(node => node.key)).toEqual(["earnings", "events", "reports", "shareholder", "other"]);

        expect(shape(tree.slice(0, 2))).toEqual([
            ["earnings", 5],
            ["earnings/fy2027", 3],
            ["earnings/fy2027/q2", 2],
            ["earnings/fy2027/q1", 1],
            ["earnings/fy2026", 1],
            ["earnings/fy2026/q4", 1],
            ["earnings/undated", 1],
            ["events", 2],
            ["events/2026", 2],
            ["events/2026/09-10-goldman-sachs-communacopia", 1],
            ["events/2026/01-07-ces", 1],
        ]);

        const q2 = tree[0].children[0].children[0];

        // The API's order within a folder; a folder names its own segment, not the full group_label.
        expect(q2.documents.map(d => d.id)).toEqual(["d", "f"]);

        expect(q2.label).toBe("Q2");

        expect(tree[0].children[0].label).toBe("FY2027");

        // Named folders A–Z; a folder holds documents and subfolders.
        expect(tree[3].children.map(node => node.segment)).toEqual(["dividends", "tax"]);

        expect(shape([tree[4]])).toEqual([["other", 2], ["other/financial-data", 2], ["other/financial-data/2025", 1]]);
    });

    it("puts documents not placed yet last, by IR section and year", () => {
        const tree = buildDocumentTree([
            doc("a", null, null, "annual_reports", 2025),
            doc("b", "zz_new", "zz_new/x"),
            doc("c", "other", "other/faq"),
            doc("d", null, null, "esg", null),
            doc("e", null, null, null, 2024),
        ], [], "");

        expect(tree.map(node => node.key)).toEqual(["other", "zz_new", UNPLACED_CATEGORY]);

        expect(tree[2].label).toBe("Not yet placed");

        expect(tree[2].children.map(node => node.label)).toEqual(["Annual reports · 2025", "ESG · Undated", "Other · 2024"]);

        expect(categoryLabel(UNPLACED_CATEGORY)).toBe("Not yet placed");

        expect(buildDocumentTree([], [], "")).toEqual([]);
    });

    it("labels event folders from all their documents and the event titles, also under a filter", () => {
        const documents = [
            { ...doc("a", "events", "events/2025/05-18-gtc-taipei-2025"), group_label: "May 18, 2025 · GTC Taipei 2025", title: "Keynote" },
            { ...doc("b", "events", "events/2025/05-18-gtc-taipei-2025"), group_label: "May 18, 2025 · GTC Taipei 2025", title: "Deck" },
            { ...doc("c", "events", "events/2024/03-18-microsoft-t-nlg"), event_id: "ev1", group_label: "2024-03-18 · microsoft-t-nlg" },
        ];

        const titles = new Map([["ev1", "GTC 2024"]]);

        const labels = (nodes: ReadonlyArray<TreeNode<unknown>>): Array<string> => nodes.flatMap(node => [node.label, ...labels(node.children)]);

        expect(labels(buildDocumentTree(documents, [], "", titles)))
            .toEqual(["Events", "2025", "May 18 · GTC Taipei 2025", "2024", "Mar 18 · GTC 2024"]);

        // "deck" keeps b only; the folder still reads its stored name. "GTC 2024" matches the event-title label.
        expect(labels(buildDocumentTree(documents, [], "deck", titles))).toEqual(["Events", "2025", "May 18 · GTC Taipei 2025"]);

        expect(shape(buildDocumentTree(documents, [], "gtc 2024", titles))).toEqual([["events", 1], ["events/2024", 1], ["events/2024/03-18-microsoft-t-nlg", 1]]);
    });

    it("labels a folder holding only a call row like its siblings", () => {
        const tree = buildDocumentTree([doc("a", "earnings", "earnings/fy2027/q2")], callEntries([event({ fiscal_quarter: 1 })], []), "");

        expect(tree[0].children[0].children.map(node => node.label)).toEqual(["Q2", "Q1"]);
    });

    it("places call rows before the folder's documents and counts them", () => {
        const calls = callEntries([event()], []);

        const tree = buildDocumentTree([doc("a", "earnings", "earnings/fy2027/q2")], calls, "");

        const q2 = tree[0].children[0].children[0];

        expect(q2.calls.map(call => call.label)).toEqual(["Q2 FY2027"]);

        expect(q2.count).toBe(2);

        expect(tree[0].count).toBe(2);
    });

    it("keeps only the matches under a text query, with their ancestors, and drops empty folders", () => {
        const documents = [
            { ...doc("a", "reports", "reports/2025"), kind: "proxy_statement", title: "Notice of meeting" },
            doc("b", "reports", "reports/2024"),
            doc("c", "earnings", "earnings/fy2027/q2"),
        ];

        const tree = buildDocumentTree(documents, callEntries([event({ fiscal_quarter: 1 })], []), "PROXY");

        expect(shape(tree)).toEqual([["reports", 1], ["reports/2025", 1]]);

        // "Q2" matches the folder label of c (and its path), not the Q1 call.
        expect(shape(buildDocumentTree(documents, callEntries([event({ fiscal_quarter: 1 })], []), "q2")))
            .toEqual([["earnings", 1], ["earnings/fy2027", 1], ["earnings/fy2027/q2", 1]]);

        expect(buildDocumentTree(documents, [], "nothing like it")).toEqual([]);
    });

    it("opens every category and its newest path by default, every folder under a query", () => {
        const tree = buildDocumentTree([
            doc("a", "earnings", "earnings/fy2027/q2"),
            doc("b", "earnings", "earnings/fy2026/q4"),
            doc("c", "reports", "reports/2025"),
            doc("d", "reports", "reports/2024"),
        ], [], "");

        expect([...defaultOpenKeys(tree)])
            .toEqual(["earnings", "earnings/fy2027", "earnings/fy2027/q2", "reports", "reports/2025"]);

        expect(allKeys(tree)).toHaveLength(8);
    });

    it("compares folder keys like the pipeline", () => {
        expect(compareFolderKeys("events/2026/09-10-a", "events/2025/12-01-b")).toBeLessThan(0);

        expect(compareFolderKeys("reports/undated", "reports/2020")).toBeGreaterThan(0);

        expect(compareFolderKeys("other/fact-sheets", "other/faq")).toBeLessThan(0);

        expect(compareFolderKeys("other/financial-data", "other/financial-data/2025")).toBeLessThan(0);
    });
});

describe("callPlacement / callEntries", () => {
    it("uses the group of the call's documents first", () => {
        expect(callPlacement(event(), new Map([["e1", "earnings/fy2027/q3"]]))).toBe("earnings/fy2027/q3");
    });

    it("places an earnings call by its fiscal period, else its New York day", () => {
        expect(callPlacement(event(), new Map())).toBe("earnings/fy2027/q2");

        expect(callPlacement(event({ fiscal_quarter: null, fiscal_year: null }), new Map())).toBe("earnings/cy2026/08-26");
    });

    it("places a date-only call on its UTC date, never the previous New York day", () => {
        const dateOnly = event({ call_time_source: null, fiscal_quarter: null, fiscal_year: null, scheduled_at: "2027-01-01T00:00:00.000Z" });

        expect(callPlacement(dateOnly, new Map())).toBe("earnings/cy2027/01-01");

        expect(callEntries([{ ...dateOnly, has_documents: true }], [])[0]?.date).toBe("2027-01-01");
    });

    it("places any other event in its year under events", () => {
        expect(callPlacement(event({ event_title: "Investor Day", event_type: "investor_day" }), new Map())).toBe("events/2026");
    });

    it("lists calls with a press release, slides or documents, placed by their loaded documents", () => {
        const entries = callEntries([
            event({ event_id: "e1", has_documents: true }),
            event({ event_id: "e2", has_documents: false, has_press_release: false, has_slides: false }),
        ], [{ ...doc("x", "earnings", "earnings/fy2027/q3"), event_id: "e1" }]);

        expect(entries).toEqual([{ date: "2026-08-26", event: expect.objectContaining({ event_id: "e1" }), key: "earnings/fy2027/q3", label: "Q2 FY2027" }]);
    });

    it("follows the route's category and year filters, none under a section or kind filter", () => {
        const entries = callEntries([event()], []);

        expect(filterCallEntries(entries, { category: "earnings", year: 2027 })).toHaveLength(1);

        expect(filterCallEntries(entries, { category: "reports" })).toEqual([]);

        expect(filterCallEntries(entries, { year: 2026 })).toEqual([]);

        expect(filterCallEntries(entries, { kind: "annual_report" })).toEqual([]);
    });
});

describe("matchesQuery", () => {
    const report = { ...doc("a", "reports", "reports/2025"), event_date: "2025-03-14", kind: "proxy_statement", title: "Notice of Meeting", year: 2025 };

    it("matches title, kind label, folder path and labels, year and date, case-insensitively", () => {
        expect(matchesQuery(report, "notice")).toBe(true);

        expect(matchesQuery(report, "Proxy Statement")).toBe(true);

        expect(matchesQuery(report, "reports/2025")).toBe(true);

        expect(matchesQuery(report, "label reports")).toBe(true);

        // The full group_label, though the folder itself reads "May 18 · GTC Taipei 2025".
        expect(matchesQuery({ ...report, group: "events/2025/05-18-gtc-taipei-2025", group_label: "May 18, 2025 · GTC Taipei 2025" }, "May 18, 2025")).toBe(true);

        expect(matchesQuery(report, "2025-03")).toBe(true);

        expect(matchesQuery({ ...doc("b", "earnings", "earnings/fy2027/q2"), group_label: null }, "FY2027")).toBe(true);

        expect(matchesQuery(report, "dividend")).toBe(false);

        expect(matchesQuery(report, "  ")).toBe(true);
    });
});

describe("validateDocumentsSearch", () => {
    it("keeps valid filters and coerces the year", () => {
        expect(validateDocumentsSearch({ category: "esg", kind: "annual_report", q: "  proxy ", section: "esg", year: "2025" }))
            .toEqual({ category: "esg", kind: "annual_report", q: "proxy", section: "esg", year: 2025 });
    });

    it("drops invalid values instead of failing the route", () => {
        expect(validateDocumentsSearch({ category: "news", kind: "nope", q: "   ", section: 7, year: "abc" }))
            .toEqual({ category: undefined, kind: undefined, q: undefined, section: undefined, year: undefined });

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
