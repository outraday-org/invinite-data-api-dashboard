// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayedUrl } from "./file-engine";

import { useFileEngine } from "./file-engine";

type Props = { error: unknown; hit: null | PlayedUrl; recordingUrl: null | string; requested: boolean };

const RECORDING = "https://storage.example.com/calls/t/AAPL-q3.mp3";

let element: HTMLAudioElement;

let readyState = 0;

let play: ReturnType<typeof vi.fn>;

function setup(initial: Partial<Props> = {}) {
    const onRequest = vi.fn();

    const mediaRef = { current: element };

    const view = renderHook(
        (props: Props) => useFileEngine({ ...props, mediaRef, onRequest }),
        { initialProps: { error: null, hit: null, recordingUrl: null, requested: false, ...initial } },
    );

    return { onRequest, view };
}

/** jsdom loads nothing: the test says when the metadata is in. */
function metadataLoaded() {
    readyState = HTMLMediaElement.HAVE_METADATA;

    act(() => {
        element.dispatchEvent(new Event("loadedmetadata"));
    });
}

beforeEach(() => {
    readyState = 0;

    element = document.createElement("audio");

    play = vi.fn(() => Promise.resolve());

    Object.defineProperty(element, "readyState", { configurable: true, get: () => readyState });

    Object.defineProperty(element, "duration", { configurable: true, get: () => 600 });

    element.play = play as unknown as HTMLMediaElement["play"];

    element.pause = vi.fn();
});

describe("useFileEngine", () => {
    it("is idle and requests nothing until played", () => {
        const { onRequest, view } = setup();

        expect(view.result.current.state).toBe("idle");

        expect(view.result.current.capabilities).toEqual({ download: true, rate: true, skip: true });

        expect(onRequest).not.toHaveBeenCalled();

        act(() => view.result.current.play());

        expect(onRequest).toHaveBeenCalledTimes(1);

        view.rerender({ error: null, hit: null, recordingUrl: null, requested: true });

        expect(view.result.current.state).toBe("loading");
    });

    it("keeps a seek asked before the recording and plays from there once it is in", () => {
        const { onRequest, view } = setup();

        act(() => view.result.current.seekMs(90_000));

        expect(onRequest).toHaveBeenCalledTimes(1);

        view.rerender({ error: null, hit: null, recordingUrl: RECORDING, requested: true });

        expect(element.getAttribute("src")).toBe(RECORDING);

        expect(view.result.current.state).toBe("recording");

        expect(play).not.toHaveBeenCalled();

        metadataLoaded();

        expect(element.currentTime).toBe(90);

        expect(play).toHaveBeenCalledTimes(1);
    });

    it("seeks without playing when asked (the seek bar)", () => {
        const { view } = setup({ recordingUrl: RECORDING, requested: true });

        metadataLoaded();

        act(() => view.result.current.seekMs(30_000, { play: false }));

        expect(element.currentTime).toBe(30);

        expect(play).not.toHaveBeenCalled();
    });

    it("skips within the recording and sets the speed for later sources too", () => {
        const { view } = setup({ recordingUrl: RECORDING, requested: true });

        metadataLoaded();

        element.currentTime = 595;

        act(() => view.result.current.skip(15));

        expect(element.currentTime).toBe(600);

        act(() => view.result.current.skip(-700));

        expect(element.currentTime).toBe(0);

        act(() => view.result.current.setRate(1.5));

        expect(element.playbackRate).toBe(1.5);

        expect(element.defaultPlaybackRate).toBe(1.5);

        act(() => {
            element.dispatchEvent(new Event("ratechange"));
        });

        expect(view.result.current.rate).toBe(1.5);
    });

    it("plays a search hit's URL without requesting the recording", () => {
        const { onRequest, view } = setup();

        view.rerender({ error: null, hit: { nonce: 1, url: `${RECORDING}#t=42` }, recordingUrl: null, requested: false });

        expect(element.getAttribute("src")).toBe(`${RECORDING}#t=42`);

        expect(play).toHaveBeenCalledTimes(1);

        expect(onRequest).not.toHaveBeenCalled();

        expect(view.result.current.state).toBe("recording");
    });

    it("reports the request's error while nothing plays", () => {
        const failure = new Error("forbidden");

        const { view } = setup({ error: failure, requested: true });

        expect(view.result.current.state).toBe("error");

        expect(view.result.current.error).toBe(failure);
    });

    it("swaps a changed recording URL in at the same position", () => {
        const { view } = setup({ recordingUrl: RECORDING, requested: true });

        metadataLoaded();

        element.currentTime = 120;

        const next = `${RECORDING}?v=2`;

        view.rerender({ error: null, hit: null, recordingUrl: next, requested: true });

        expect(element.getAttribute("src")).toBe(next);

        element.currentTime = 0;

        act(() => {
            element.dispatchEvent(new Event("loadedmetadata"));
        });

        expect(element.currentTime).toBe(120);
    });
});
