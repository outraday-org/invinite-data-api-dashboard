import { describe, expect, it } from "vitest";

import type { V2EventVideo } from "@/lib/api/types";

import { httpsUrl, videoEmbedSrc, videoProvider, videoProviderLabel } from "./video";

const GTC: V2EventVideo = {
    channel: "NVIDIA",
    embed_url: "https://www.youtube-nocookie.com/embed/v-NGxyPjcrE",
    embeddable: true,
    thumbnail_url: "https://i.ytimg.com/vi/v-NGxyPjcrE/hqdefault.jpg",
    title: "NVIDIA GTC Berlin 2026 Keynote With CEO Jensen Huang",
    url: "https://www.youtube.com/watch?v=v-NGxyPjcrE",
    video_id: "v-NGxyPjcrE",
};

describe("videoEmbedSrc", () => {
    it("adds autoplay to the nocookie embed", () => {
        expect(videoEmbedSrc(GTC)).toBe("https://www.youtube-nocookie.com/embed/v-NGxyPjcrE?autoplay=1");
    });

    it("keeps Vimeo's dnt=1", () => {
        const src = videoEmbedSrc({ ...GTC, embed_url: "https://player.vimeo.com/video/123?dnt=1" });

        expect(src).toBe("https://player.vimeo.com/video/123?dnt=1&autoplay=1");
    });

    it("embeds an unchecked video (embeddable null)", () => {
        expect(videoEmbedSrc({ ...GTC, embeddable: null })).not.toBeNull();
    });

    it("forces Vimeo's dnt=1 even when the API's URL lacks it", () => {
        const src = videoEmbedSrc({
            ...GTC,
            embed_url: "https://player.vimeo.com/video/1084537",
            video_id: "1084537",
        });

        expect(src && new URL(src).searchParams.get("dnt")).toBe("1");
    });

    it("never embeds a non-embeddable video", () => {
        expect(videoEmbedSrc({ ...GTC, embeddable: false })).toBeNull();
    });

    it.each([
        "https://www.youtube.com/embed/v-NGxyPjcrE",
        "http://www.youtube-nocookie.com/embed/v-NGxyPjcrE",
        "https://vimeo.com/123",
        "not a url",
    ])("frames only the provider's privacy-enhanced host (%s → link)", (embedUrl) => {
        expect(videoEmbedSrc({ ...GTC, embed_url: embedUrl })).toBeNull();
    });
});

describe("videoProvider", () => {
    it("reads the platform from the embed / watch URL host (v2 has no provider field)", () => {
        expect(videoProvider(GTC)).toBe("youtube");

        expect(videoProvider({ embed_url: "https://player.vimeo.com/video/1", url: "https://vimeo.com/1" })).toBe("vimeo");

        expect(videoProvider({ embed_url: "https://cdn.example.com/x", url: "https://youtu.be/x" })).toBe("youtube");

        expect(videoProvider({ embed_url: "https://cdn.example.com/v.mp4", url: "https://example.com/v" })).toBeNull();

        expect(videoProviderLabel({ embed_url: "https://example.com/e", url: "https://example.com/v" })).toBe("video platform");
    });
});

describe("httpsUrl", () => {
    it("accepts https only", () => {
        expect(httpsUrl("https://a.example/x")?.toString()).toBe("https://a.example/x");

        expect(httpsUrl("javascript:alert(1)")).toBeNull();

        expect(httpsUrl(null)).toBeNull();
    });
});
