import { describe, expect, it } from "vitest";

import {
    blocksBefore,
    blocksFrom,
    blocksLeadingTo,
    citationText,
    latest13fPeriodEnd,
    metaSourceParts,
    pageLabel,
    printedLabelsTrusted,
    recentQuarterEnds,
    scalarEntries,
    secUrlOf,
    toBlocks,
    toMetaSource,
    toSecHitView,
    toSelection,
    toV2FilingDocuments,
    versionIdOf,
} from "./source";
import { V2_DOCUMENT_VERSION, V2_FILING_10K, V2_FILING_SEARCH } from "./v2-fixtures";

describe("blocks and page labels", () => {
    const blocks = toBlocks(V2_DOCUMENT_VERSION.blocks);

    it("reads page, neighbours, footnote refs and the citation of each block", () => {
        expect(blocks[1]).toMatchObject({
            citation: { blockId: "b00002", page: 1, printed: null, versionId: "8be0b759-1a9d-5f89-8308-bd86185f5e1f" },
            footnoteRefs: [],
            id: "b00002",
            kind: "heading",
            next: "b00003",
            page: { ordinal: 1, printed: null },
            prev: "b00001",
        });
    });

    it("shows a printed label only when present AND trusted, else the ordinal; never invents one", () => {
        expect(pageLabel({ ordinal: 9, printed: "F-7" }, true)).toBe("p. F-7");

        expect(pageLabel({ ordinal: 9, printed: "F-7" }, false)).toBe("p. 9 (ordinal)");

        expect(pageLabel({ ordinal: 3, printed: null }, true)).toBe("p. 3 (ordinal)");

        expect(pageLabel(null, true)).toBeNull();
    });

    it("trust comes from quality.printed_labels_trusted; absent = untrusted", () => {
        expect(printedLabelsTrusted(V2_DOCUMENT_VERSION.quality)).toBe(true);

        expect(printedLabelsTrusted({})).toBe(false);

        expect(printedLabelsTrusted(null)).toBe(false);
    });

    it("a citation is version + block (+ page), never a URL", () => {
        const text = citationText({ blockId: "b00002", page: 1, printed: null, versionId: "v1" }, true);

        expect(text).toBe("version v1 · block b00002 · p. 1 (ordinal)");

        expect(text).not.toContain("http");
    });

    it("selection names the next block of a truncated page", () => {
        expect(toSelection(V2_DOCUMENT_VERSION.selection)).toEqual({ nextBlock: "b00003", truncated: true });
    });

    it("EDGAR is an outbound link only for www.sec.gov", () => {
        expect(secUrlOf(V2_DOCUMENT_VERSION.source)).toMatch(/^https:\/\/www\.sec\.gov\//);

        expect(secUrlOf({ url: "https://evil.example/x" })).toBeNull();
    });
});

describe("block ranges (paging inside one version)", () => {
    it("from a block on, open-ended (the store clamps the end)", () => {
        expect(blocksFrom("b00007")).toBe("b00007-b9999999");
    });

    it("the page before a block keeps the id width; none before the first", () => {
        expect(blocksBefore("b00045", 40)).toBe("b00005-b00044");

        expect(blocksBefore("b00003", 40)).toBe("b00001-b00002");

        expect(blocksBefore("b00001", 40)).toBeNull();

        expect(blocksBefore("x1", 40)).toBeNull();
    });

    it("a citation opens a few blocks before its block", () => {
        expect(blocksLeadingTo("b00010", 3)).toBe("b00007-b9999999");

        expect(blocksLeadingTo("b00001", 3)).toBe("b00001-b9999999");
    });
});

describe("toSecHitView", () => {
    it("reads place and citation of a /v1/search/filings hit; the first span's first block is the cited block", () => {
        expect(toSecHitView(V2_FILING_SEARCH.data[0])).toEqual({
            accession: "0000320193-25-000079",
            blockId: "b00136",
            filename: "aapl-20250927.htm",
            filingDate: "2025-10-31",
            form: "10-K",
            publicUrl: "https://storage.invinite.com/sec/18cf21cf542b9c42832192ccfdaef882/aapl-20250927.htm",
            versionId: "d7bbe5c0-8708-521f-a720-15ef6d1bd1fa",
        });
    });

    it("a hit without spans has no block; a non-https original is not linked", () => {
        expect(toSecHitView({ citation: { source: { url: "http://x/a.htm" } }, document_spans: [], version_id: "v1" }))
            .toMatchObject({ blockId: null, publicUrl: null, versionId: "v1" });
    });
});

describe("helpers", () => {
    it("latest13fPeriodEnd = the newest quarter end whose reports are due (45 days)", () => {
        expect(latest13fPeriodEnd(new Date("2026-11-05T12:00:00Z"))).toBe("2026-06-30");

        expect(latest13fPeriodEnd(new Date("2026-11-20T12:00:00Z"))).toBe("2026-09-30");

        expect(latest13fPeriodEnd(new Date("2026-02-20T12:00:00Z"))).toBe("2025-12-31");
    });

    it("scalarEntries keeps scalars only, readable keys", () => {
        expect(scalarEntries({ a_b: 1, nested: { x: 1 }, none: null, status: "x" }, ["status"])).toEqual([["a b", "1"]]);
    });
});

describe("v2 filing documents (`expand=documents`)", () => {
    it("keeps current_version_id and the https public source_url; null stays null", () => {
        const [primary, exhibit, schema] = toV2FilingDocuments(V2_FILING_10K.documents);

        expect(primary).toEqual({
            currentVersionId: "8be0b759-1a9d-5f89-8308-bd86185f5e1f",
            description: "10-K",
            filename: "aapl-20260926.htm",
            publicUrl: "https://storage.invinite.com/sec/4765d5384d6b2195ff48ff775f9244f9/aapl-20260926.htm",
            type: "10-K",
        });

        expect(exhibit.publicUrl).toBeNull();

        expect(schema.currentVersionId).toBeNull();
    });

    it("guards: no filename = not listed, a non-https URL or an empty version id = absent, null documents = none", () => {
        expect(toV2FilingDocuments([{ current_version_id: "x", source_url: "https://a/b" }])).toEqual([]);

        expect(toV2FilingDocuments([{ current_version_id: "", filename: "a.htm", source_url: "http://a/a.htm" }])[0])
            .toMatchObject({ currentVersionId: null, publicUrl: null });

        expect(toV2FilingDocuments([{ current_version_id: 7, filename: "a.htm", source_url: 5 }])[0])
            .toMatchObject({ currentVersionId: null, publicUrl: null });

        expect(toV2FilingDocuments(null)).toEqual([]);
    });

    it("a v2 version: `version.id` and the EDGAR `source.url` (outbound only)", () => {
        expect(versionIdOf(V2_DOCUMENT_VERSION.version)).toBe("8be0b759-1a9d-5f89-8308-bd86185f5e1f");

        expect(secUrlOf(V2_DOCUMENT_VERSION.source)).toMatch(/^https:\/\/www\.sec\.gov\//);

        expect(secUrlOf({ url: "https://storage.invinite.com/sec/t/a.htm" })).toBeNull();
    });
});

describe("meta.source", () => {
    it("reads the four documented fields; anything else or nothing = null", () => {
        expect(toMetaSource({ accession: "0000320193-26-000026", dataset_release: "2026q3", fetched_at: "2026-11-09T06:00:00Z", version_id: "v1" }))
            .toEqual({ accession: "0000320193-26-000026", datasetRelease: "2026q3", fetchedAt: "2026-11-09T06:00:00Z", versionId: "v1" });

        expect(toMetaSource({ dataset_release: null })).toBeNull();

        expect(toMetaSource({ provider: "x" })).toBeNull();

        expect(toMetaSource(undefined)).toBeNull();

        expect(toMetaSource({ accession: 7, dataset_release: "2026q3" })).toMatchObject({ accession: null, datasetRelease: "2026q3" });
    });

    it("in words, stated parts only", () => {
        expect(metaSourceParts(toMetaSource({ dataset_release: "2026q3", fetched_at: "2026-11-09T06:00:00Z" })))
            .toEqual(["Dataset release 2026q3", "Fetched 2026-11-09T06:00:00Z"]);

        expect(metaSourceParts(null)).toEqual([]);
    });
});

describe("13F period picker", () => {
    it("quarter ends back from the newest due one", () => {
        expect(recentQuarterEnds("2026-09-30", 5)).toEqual(["2026-09-30", "2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30"]);
    });
});
