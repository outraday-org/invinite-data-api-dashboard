import { describe, expect, it } from "vitest";

import type { EarningsEventVideo } from "@/lib/api/types";

import { httpsUrl, videoEmbedSrc } from "./video";

const GTC: EarningsEventVideo = {
    channel: "NVIDIA",
    embed_url: "https://www.youtube-nocookie.com/embed/v-NGxyPjcrE",
    embeddable: true,
    provider: "youtube",
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
        const src = videoEmbedSrc({ ...GTC, embed_url: "https://player.vimeo.com/video/123?dnt=1", provider: "vimeo" });

        expect(src).toBe("https://player.vimeo.com/video/123?dnt=1&autoplay=1");
    });

    it("embeds an unchecked video (embeddable null)", () => {
        expect(videoEmbedSrc({ ...GTC, embeddable: null })).not.toBeNull();
    });

    it("never embeds a non-embeddable video", () => {
        expect(videoEmbedSrc({ ...GTC, embeddable: false })).toBeNull();
    });

    it.each([
        "https://www.youtube.com/embed/v-NGxyPjcrE",
        "http://www.youtube-nocookie.com/embed/v-NGxyPjcrE",
        "https://player.vimeo.com/video/123",
        "not a url",
    ])("frames only the provider's privacy-enhanced host (%s → link)", (embedUrl) => {
        expect(videoEmbedSrc({ ...GTC, embed_url: embedUrl })).toBeNull();
    });
});

describe("httpsUrl", () => {
    it("accepts https only", () => {
        expect(httpsUrl("https://a.example/x")?.toString()).toBe("https://a.example/x");

        expect(httpsUrl("javascript:alert(1)")).toBeNull();

        expect(httpsUrl(null)).toBeNull();
    });
});
