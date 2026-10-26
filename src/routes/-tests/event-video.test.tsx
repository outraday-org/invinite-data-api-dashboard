// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EarningsEventVideo } from "@/lib/api/types";

import { EventVideo, EventVideoSlot } from "@/routes/$ticker/earnings-calls/-components/event-video";

afterEach(cleanup);

// NVDA "GTC Berlin 2026 Keynote" (event 9655a5db-…), as IDA's event example serves it.
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

describe("EventVideo", () => {
    it("shows the facade and requests nothing from the platform before the click", () => {
        const { container } = render(<EventVideo video={GTC} />);

        expect(screen.getByText(GTC.title!)).toBeInTheDocument();

        // Neither the thumbnail nor the player: a neutral placeholder until the click (GDPR).
        expect(container.querySelector("img")).toBeNull();

        expect(container.querySelector("iframe")).toBeNull();

        expect(screen.getByText(/Played from the company's YouTube channel/)).toBeInTheDocument();
    });

    it("loads the nocookie player on click", () => {
        const { container } = render(<EventVideo video={GTC} />);

        fireEvent.click(screen.getByRole("button", { name: `Play video: ${GTC.title}` }));

        const iframe = container.querySelector("iframe");

        expect(iframe).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/v-NGxyPjcrE?autoplay=1");

        expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");

        expect(iframe).toHaveAttribute("title", GTC.title);
    });

    it("links a non-embeddable video", () => {
        const { container } = render(<EventVideo video={{ ...GTC, embeddable: false }} />);

        const link = screen.getByRole("link", { name: /Watch on YouTube/ });

        expect(link).toHaveAttribute("href", GTC.url);

        expect(link).toHaveAttribute("rel", "noopener noreferrer");

        expect(container.querySelector("iframe")).toBeNull();

        expect(screen.queryByRole("button")).toBeNull();
    });

    it("renders nothing for video: null", () => {
        const { container } = render(<EventVideo video={null} />);

        expect(container).toBeEmptyDOMElement();
    });
});

describe("EventVideoSlot", () => {
    it("shows the video before and after the call", () => {
        render(<EventVideoSlot event={{ capture_status: "published", video: GTC }} />);

        expect(screen.getByRole("button", { name: `Play video: ${GTC.title}` })).toBeInTheDocument();
    });

    it("collapses the video under \"Watch the broadcast\" during a live capture", () => {
        render(<EventVideoSlot event={{ capture_status: "capturing", video: GTC }} />);

        expect(screen.queryByRole("button", { name: `Play video: ${GTC.title}` })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Watch the broadcast" }));

        expect(screen.getByRole("button", { name: `Play video: ${GTC.title}` })).toBeInTheDocument();
    });
});
