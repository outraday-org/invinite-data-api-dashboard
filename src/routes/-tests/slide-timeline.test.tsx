// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CallTabProps } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { SlideTimeline } from "@/routes/$ticker/earnings-calls/-components/slide-timeline";
import { SlidesTab } from "@/routes/$ticker/earnings-calls/-components/tabs/slides-tab";

// The page's audio host, stubbed: `loaded` / `seekMs` and the element's position.
const audio = vi.hoisted(() => ({
    loaded: false,
    positionMs: 0,
    seekMs: null as ((ms: number) => void) | null,
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ loaded: audio.loaded, seekMs: audio.seekMs }),
    useCallPlayback: () => ({ durationMs: null, playing: true, positionMs: audio.positionMs }),
}));

// The Slides tab's request, stubbed: an answer of an IDA released before `timeline`.
vi.mock("@/lib/api/queries", () => ({
    useEarningsSlides: () => ({
        data: {
            deck: null,
            event: {},
            slides: [{ image_url: "https://r2.example/page-1.webp", markdown: null, page: 1, title: "Cover" }],
        },
        dataUpdatedAt: 0,
        error: null,
        refetch: () => {},
    }),
}));

afterEach(cleanup);

beforeEach(() => {
    audio.loaded = false;

    audio.positionMs = 0;

    audio.seekMs = null;
});

const TIMELINE = [
    { at_ms: 0, image_url: "https://r2.example/slide-0.webp" },
    { at_ms: 65_000, image_url: "https://r2.example/slide-1.webp" },
    { at_ms: 130_000, image_url: "https://r2.example/slide-2.webp" },
];

function shownImage() {
    return screen.getByRole("img").getAttribute("src");
}

describe("SlideTimeline", () => {
    it("shows the slide whose at_ms is at or before the audio position", () => {
        audio.loaded = true;

        audio.seekMs = vi.fn();

        audio.positionMs = 129_999;

        render(<SlideTimeline onMediaError={() => {}} timeline={TIMELINE} />);

        expect(shownImage()).toBe(TIMELINE[1].image_url);

        expect(screen.getByText("Following the audio")).toBeInTheDocument();
    });

    it("seeks the audio to the slide on click", () => {
        const seekMs = vi.fn();

        audio.loaded = true;

        audio.seekMs = seekMs;

        audio.positionMs = 140_000;

        render(<SlideTimeline onMediaError={() => {}} timeline={TIMELINE} />);

        fireEvent.click(screen.getByRole("button", { name: "Play from 2:10" }));

        expect(seekMs).toHaveBeenCalledWith(130_000);

        fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));

        expect(seekMs).toHaveBeenLastCalledWith(65_000);
    });

    it("plays the call from a slide before the recording is loaded", () => {
        const seekMs = vi.fn();

        audio.seekMs = seekMs;

        render(<SlideTimeline onMediaError={() => {}} timeline={TIMELINE} />);

        fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

        expect(seekMs).not.toHaveBeenCalled();

        expect(shownImage()).toBe(TIMELINE[1].image_url);

        fireEvent.click(screen.getByRole("button", { name: "Play from 1:05" }));

        expect(seekMs).toHaveBeenCalledWith(65_000);
    });

    it("is a plain carousel without audio", () => {
        render(<SlideTimeline onMediaError={() => {}} timeline={TIMELINE} />);

        expect(screen.queryByRole("button", { name: /Play from/ })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

        fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

        expect(shownImage()).toBe(TIMELINE[2].image_url);

        expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();
    });

    it("renders nothing for an empty timeline", () => {
        const { container } = render(<SlideTimeline onMediaError={() => {}} timeline={[]} />);

        expect(container).toBeEmptyDOMElement();
    });
});

describe("SlidesTab", () => {
    it("renders the page strip when the API answers no timeline", () => {
        const props = { selector: { eventId: "e1" } } as CallTabProps;

        render(<SlidesTab {...props} />);

        expect(screen.getByRole("img", { name: "Cover" })).toBeInTheDocument();

        expect(screen.queryByText("Webcast slides")).toBeNull();
    });
});
