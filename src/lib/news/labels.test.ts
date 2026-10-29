import { describe, expect, it } from "vitest";

import { fileTypeLabel, issuerLabels, matchesNewsFilters, mergeLiveItems, publishedBy, sourceLabel, validateNewsSearch } from "./labels";
import { edgarItem, newsroomItem } from "./news-fixtures";

describe("sourceLabel", () => {
    it("names EDGAR and a newsroom by host; no wire labels exist", () => {
        expect(sourceLabel("edgar")).toBe("SEC EDGAR");

        expect(sourceLabel("ir:nvidianews.nvidia.com")).toBe("Company newsroom (nvidianews.nvidia.com)");

        expect(sourceLabel("prnewswire")).toBe("prnewswire");
    });
});

describe("publishedBy", () => {
    it("names the verified issuer publishers, never a mentioned company", () => {
        expect(publishedBy(newsroomItem())).toEqual(["NVIDIA Corporation"]);

        expect(publishedBy(edgarItem())).toEqual([]);
    });
});

describe("validateNewsSearch", () => {
    it("keeps valid fields and drops invalid ones", () => {
        expect(validateNewsSearch({ item: "nope", kind: "guidance", scope: "market", source: "wire" })).toMatchObject({
            item: undefined,
            kind: "guidance",
            scope: "market",
            source: undefined,
        });
    });

    it("drops the publisher-only filters in the market scope and without Company-published", () => {
        expect(validateNewsSearch({ category: "Press Releases", published: true, scope: "market" })).toMatchObject({
            category: undefined,
            published: undefined,
        });

        expect(validateNewsSearch({ pubType: "press_release", tag: "AI" })).toMatchObject({ pubType: undefined, tag: undefined });

        expect(validateNewsSearch({ category: "Press Releases", published: true, pubType: "press_release" })).toMatchObject({
            category: "Press Releases",
            published: true,
            pubType: "press_release",
        });
    });
});

describe("validateNewsSearch media", () => {
    it("keeps the Has media switch in either scope and drops a non-boolean", () => {
        expect(validateNewsSearch({ media: true, scope: "market" }).media).toBe(true);

        expect(validateNewsSearch({ media: "yes" }).media).toBeUndefined();
    });
});

describe("fileTypeLabel", () => {
    it("names a file by its MIME subtype; null without one", () => {
        expect(fileTypeLabel("application/pdf")).toBe("PDF");

        expect(fileTypeLabel("image/jpeg")).toBe("JPEG");

        expect(fileTypeLabel("image/svg+xml; charset=utf-8")).toBe("SVG");

        expect(fileTypeLabel(null)).toBeNull();

        expect(fileTypeLabel("garbage")).toBeNull();
    });
});

describe("matchesNewsFilters (live items)", () => {
    it("applies kind, topic, source and earnings", () => {
        const item = newsroomItem();

        expect(matchesNewsFilters(item, {})).toBe(true);

        expect(matchesNewsFilters(item, { kind: "guidance" })).toBe(false);

        expect(matchesNewsFilters(item, { topic: "product_launch" })).toBe(true);

        expect(matchesNewsFilters(item, { source: "ir" })).toBe(true);

        expect(matchesNewsFilters(item, { source: "edgar" })).toBe(false);

        expect(matchesNewsFilters(item, { earnings: "true" })).toBe(false);

        expect(matchesNewsFilters(edgarItem(), { earnings: "true" })).toBe(true);
    });

    it("Has media keeps only a pushed item with media", () => {
        expect(matchesNewsFilters(newsroomItem(), { hasMedia: true })).toBe(false);

        expect(matchesNewsFilters(newsroomItem({ media_count: 2 }), { hasMedia: true })).toBe(true);

        expect(matchesNewsFilters(newsroomItem(), {})).toBe(true);
    });

    it("Company-published = the publisher's own publication (padded CIK too), with its type / category / tag", () => {
        expect(matchesNewsFilters(newsroomItem(), { publisherCik: "0001045810" })).toBe(true);

        expect(matchesNewsFilters(edgarItem(), { publisherCik: "1045810" })).toBe(false);

        expect(matchesNewsFilters(newsroomItem(), { publicationType: "company_blog", publisherCik: "1045810" })).toBe(false);

        expect(matchesNewsFilters(newsroomItem(), { category: "Press Releases", publisherCik: "1045810" })).toBe(true);

        expect(matchesNewsFilters(newsroomItem(), { category: "12", publisherCik: "1045810" })).toBe(true);

        expect(matchesNewsFilters(newsroomItem(), { publisherCik: "1045810", tag: "Gaming" })).toBe(false);
    });
});

describe("mergeLiveItems", () => {
    it("puts a pushed item on top once, newest first", () => {
        const listed = [newsroomItem(), edgarItem()];

        const pushed = newsroomItem({ id: "00000000-0000-4000-8000-0000000000aa", published_at: "2026-10-29T15:00:00.000Z" });

        const merged = mergeLiveItems([pushed, listed[0]], listed);

        expect(merged.map(item => item.id)).toEqual([pushed.id, listed[0].id, listed[1].id]);
    });
});

describe("issuerLabels", () => {
    it("lists the publisher's own categories / tags of the loaded items", () => {
        const items = [newsroomItem(), edgarItem()];

        expect(issuerLabels(items, "0001045810", "categories")).toEqual(["Press Releases"]);

        expect(issuerLabels(items, "1045810", "tags")).toEqual(["Data Center"]);

        expect(issuerLabels(items, "320193", "tags")).toEqual([]);
    });
});
