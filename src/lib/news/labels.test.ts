import { describe, expect, it } from "vitest";

import { issuerLabels, matchesNewsFilters, mergeLiveItems, publishedBy, sourceLabel, validateNewsFeedSearch, validateNewsSearch } from "./labels";
import { edgarItem, newsroomItem } from "./news-fixtures";

describe("sourceLabel", () => {
    it("names EDGAR and a newsroom by host; no wire labels exist", () => {
        expect(sourceLabel({ host: "www.sec.gov", id: "edgar" })).toBe("SEC EDGAR");

        // v2 states `ir` and the host apart (live 2026-11-21); a publication's source id still reads `ir:<host>`.
        expect(sourceLabel({ host: "nvidianews.nvidia.com", id: "ir" })).toBe("Company newsroom (nvidianews.nvidia.com)");

        expect(sourceLabel({ host: null, id: "ir" })).toBe("Company newsroom");

        expect(sourceLabel({ id: "ir:nvidianews.nvidia.com" })).toBe("Company newsroom (nvidianews.nvidia.com)");

        expect(sourceLabel({ id: "prnewswire" })).toBe("prnewswire");
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
    it("drops the removed Has media switch (API 2.0.0 serves no media)", () => {
        expect("media" in validateNewsSearch({ media: true, scope: "market" })).toBe(false);
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

describe("validateNewsSearch (O7 group 2)", () => {
    it("keeps the event, the order, the Announcements view and its filters; drops invalid values", () => {
        const event = "00000000-0000-4000-8000-0000000000e1";

        expect(validateNewsSearch({ aFrom: "2026-01-01", aSort: "oldest", aTopic: "partnership", effTo: "2027-12-31", event, sort: "oldest", view: "announcements" }))
            .toMatchObject({ aFrom: "2026-01-01", aSort: "oldest", aTopic: "partnership", effTo: "2027-12-31", event, sort: "oldest", view: "announcements" });

        expect(validateNewsSearch({ aTopic: "other", event: "e1", sort: "newest", view: "news" }))
            .toMatchObject({ aTopic: undefined, event: undefined, sort: undefined, view: undefined });
    });
});

describe("validateNewsFeedSearch", () => {
    it("keeps the list filters, never writes the default scope, and drops the window and order in the live-only market scope", () => {
        expect(validateNewsFeedSearch({ from: "2026-11-01", kind: "dividend", published: true, scope: "company", sort: "oldest" }))
            .toEqual({ from: "2026-11-01", kind: "dividend", scope: undefined, sort: "oldest" });

        expect(validateNewsFeedSearch({ from: "2026-11-01", live: true, scope: "market", sort: "oldest", topic: "partnership" }))
            .toEqual({ from: undefined, live: true, scope: "market", sort: undefined, to: undefined, topic: "partnership" });
    });
});
