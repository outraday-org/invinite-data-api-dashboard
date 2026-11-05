import { describe, expect, it } from "vitest";

import { SEC_DOCUMENT, SEC_MANIFEST } from "./sec-fixtures";
import {
    blocksBefore,
    blocksFrom,
    blocksLeadingTo,
    citationText,
    latest13fPeriodEnd,
    pageLabel,
    printedLabelsTrusted,
    scalarEntries,
    secUrlOf,
    toBlocks,
    toManifestDocuments,
    toSecHitView,
    toSelection,
} from "./source";

describe("toManifestDocuments", () => {
    const docs = toManifestDocuments(SEC_MANIFEST.documents);

    it("keeps the true size, role, MIME and both readiness flags; a null source has no public URL", () => {
        const exhibit = docs.find(doc => doc.filename === "a8-kex991q4202609262026.htm");

        expect(exhibit).toMatchObject({
            canonical: { status: "published", textReady: true, versionId: "402affed-8245-5fe1-814d-d025f60db4ac", visualReady: true },
            mimeType: "text/html",
            publicUrl: null,
            role: "exhibit",
            sizeBytes: 172036,
        });
    });

    it("a graphic is visual without text and has no canonical version to read", () => {
        const graphic = docs.find(doc => doc.filename === "aapl-20261102_g1.jpg");

        expect(graphic?.canonical).toMatchObject({ textReady: false, versionId: null, visualReady: true });
    });

    it("only an https public copy counts", () => {
        const [doc] = toManifestDocuments([{ filename: "a.htm", source: { url: "http://x/a.htm" } }]);

        expect(doc.publicUrl).toBeNull();

        expect(toManifestDocuments([{ filename: "a.htm", source: { url: "https://storage-prod.invinite.com/sec/t/a.htm" } }])[0].publicUrl)
            .toBe("https://storage-prod.invinite.com/sec/t/a.htm");
    });
});

describe("blocks and page labels", () => {
    const blocks = toBlocks(SEC_DOCUMENT.blocks);

    it("reads page, neighbours, footnote refs and the citation of each block", () => {
        expect(blocks[1]).toMatchObject({
            citation: { blockId: "b00002", page: 1, printed: null, versionId: "402affed-8245-5fe1-814d-d025f60db4ac" },
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
        expect(printedLabelsTrusted(SEC_DOCUMENT.quality)).toBe(true);

        expect(printedLabelsTrusted({})).toBe(false);

        expect(printedLabelsTrusted(null)).toBe(false);
    });

    it("a citation is version + block (+ page), never a URL", () => {
        const text = citationText({ blockId: "b00002", page: 1, printed: null, versionId: "v1" }, true);

        expect(text).toBe("version v1 · block b00002 · p. 1 (ordinal)");

        expect(text).not.toContain("http");
    });

    it("selection names the next block of a truncated page", () => {
        expect(toSelection(SEC_DOCUMENT.selection)).toEqual({ nextBlock: "b00007", truncated: true });
    });

    it("EDGAR is an outbound link only for www.sec.gov", () => {
        expect(secUrlOf(SEC_DOCUMENT.source)).toMatch(/^https:\/\/www\.sec\.gov\//);

        expect(secUrlOf({ sec_url: "https://evil.example/x" })).toBeNull();
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
    it("reads filer, place and citation of a hit; the cited block gives block id and page", () => {
        const view = toSecHitView({
            accession: "0000320193-26-000024",
            citation: { source: null, version_id: "v1" },
            cited: [{ citation: { block_id: "b00042", page: 3, printed: "3", version_id: "v1" }, id: "b00042", page: { ordinal: 3, printed: "3" } }],
            filename: "a.htm",
            filer: { cik: "320193", name: "Apple Inc." },
            filing_date: "2026-11-02",
            form: "8-K",
            version_id: "v1",
        });

        expect(view).toEqual({
            accession: "0000320193-26-000024",
            blockId: "b00042",
            filename: "a.htm",
            filerCik: "320193",
            filerName: "Apple Inc.",
            filingDate: "2026-11-02",
            form: "8-K",
            page: { ordinal: 3, printed: "3" },
            publicUrl: null,
            versionId: "v1",
        });
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
