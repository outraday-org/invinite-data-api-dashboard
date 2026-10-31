// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EarningsEventResponse } from "@/lib/api/types";

import { INITIAL_LIVE_TRANSCRIPT } from "@/lib/live/live-transcript-reducer";
import { LIVE_WAITING_FOR_TEXT_TEXT } from "@/routes/$ticker/earnings-calls/-components/live/live-audio-section";
import { LIVE_MODE_STORAGE_KEY, LivePlayer } from "@/routes/$ticker/earnings-calls/-components/live/live-player";

const T0 = "2026-10-31T14:00:00.000Z";

const T0_MS = Date.parse(T0);

class FakeHls {
    static ErrorDetails = { BUFFER_STALLED_ERROR: "bufferStalledError" };

    static ErrorTypes = { MEDIA_ERROR: "mediaError" };

    static Events = { ERROR: "hlsError", LEVEL_LOADED: "hlsLevelLoaded" };

    static instances: Array<FakeHls> = [];

    readonly attachMedia = vi.fn();

    readonly config: Record<string, unknown>;

    currentLevel = 0;

    readonly destroy = vi.fn();

    levelLoaded: (() => void) | undefined;

    levels = [{ details: { fragments: [{ duration: 600, programDateTime: T0_MS, start: 0 }] } }];

    liveSyncPosition: null | number = null;

    readonly loadSource = vi.fn();

    playingDate: Date | null = null;

    readonly recoverMediaError = vi.fn();

    readonly startLoad = vi.fn();

    readonly stopLoad = vi.fn();

    targetLatency: null | number = null;

    constructor(config: Record<string, unknown>) {
        this.config = config;

        FakeHls.instances.push(this);
    }

    static isSupported() {
        return true;
    }

    on() {
        return undefined;
    }

    once(event: string, handler: () => void) {
        if (event === "hlsLevelLoaded") this.levelLoaded = handler;
    }
}

const mocks = vi.hoisted(() => ({ stream: {} as Record<string, unknown>, transcript: {} as Record<string, unknown> }));

vi.mock("@/lib/live/live-clients", async importOriginal => ({
    ...await importOriginal<object>(),
    loadHls: () => Promise.resolve(FakeHls),
}));

vi.mock("@/lib/api/queries", () => ({
    isEarningsEventLiveish: () => true,
    useApiBaseUrl: () => "https://api.example.com",
    useEarningsLiveStream: () => ({ data: mocks.stream, error: null, refetch: () => Promise.resolve({ data: mocks.stream, isError: false }) }),
    useEarningsPriceAttribution: () => ({ data: undefined }),
}));

vi.mock("@/lib/live/use-live-transcript", () => ({ useLiveTranscript: () => mocks.transcript }));

vi.mock("@/routes/$ticker/earnings-calls/-components/live/live-price-chart", () => ({ LivePriceChart: () => null }));

vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

const EVENT = { event_id: "evt", has_transcript: false, symbol: "AAPL" } as unknown as EarningsEventResponse;

function segment(seq: number, startMs: number, text: string) {
    return { endMs: startMs + 4_000, seq, speakerLabel: "spk00", startMs, text };
}

function setTranscript(finals: ReadonlyArray<ReturnType<typeof segment>>, partials: ReadonlyArray<ReturnType<typeof segment>> = [], mode = "live") {
    mocks.transcript = {
        error: null,
        mode,
        notice: null,
        prices: { last: null, ticks: [] },
        provisionalVersion: null,
        reconnecting: false,
        rescheduledTo: null,
        stalled: false,
        state: { ...INITIAL_LIVE_TRANSCRIPT, finals, partials },
    };
}

function player() {
    return <LivePlayer apiKey="key" apiKeyUpdatedAt={1} event={EVENT} liveAudio />;
}

/** Tune in on a fake hls.js: `paused` follows `play()` / `pause()`, `tick` stands in for playback. */
async function tuneIn(from: "From the beginning" | "Tune in" = "Tune in") {
    const view = render(player());

    const element = document.querySelector("audio");

    if (element === null) throw new Error("no <audio>");

    let mediaTime = 0;

    const playback = { paused: false };

    Object.defineProperty(element, "currentTime", {
        configurable: true,
        get: () => mediaTime,
        set: (value: number) => {
            mediaTime = value;
        },
    });

    Object.defineProperty(element, "paused", { configurable: true, get: () => playback.paused });

    element.play = vi.fn(() => {
        playback.paused = false;

        fireEvent(element, new Event("playing"));

        return Promise.resolve();
    });

    element.pause = vi.fn(() => {
        playback.paused = true;

        fireEvent(element, new Event("pause"));
    });

    fireEvent.click(screen.getByRole("button", { name: from }));

    await waitFor(() => expect(FakeHls.instances).toHaveLength(1));

    const hls = FakeHls.instances.at(-1) as FakeHls;

    await act(async () => {
        await Promise.resolve();
    });

    fireEvent(element, new Event("playing"));

    const tick = (time: number, edge: number, callMs: number) => {
        mediaTime = time;

        hls.liveSyncPosition = edge;

        hls.playingDate = new Date(T0_MS + callMs);

        fireEvent(element, new Event("timeupdate"));
    };

    return { element, hls, mediaTime: () => mediaTime, playback, tick, view };
}

beforeEach(() => {
    FakeHls.instances = [];

    // jsdom answers no ranges at all.
    Object.defineProperty(HTMLMediaElement.prototype, "seekable", { configurable: true, get: () => ({ length: 0 }) });

    window.localStorage.clear();

    mocks.stream = { call_t0: T0, expires_at: null, status: "available", url: "https://live.example.com/playlist.m3u8" };

    setTranscript([]);
});

afterEach(() => {
    cleanup();

    vi.useRealTimers();
});

describe("the sync modes", () => {
    it("defaults to Synced: 12 s behind the edge, no hls.js jump of its own", async () => {
        const { hls } = await tuneIn();

        expect(screen.getByRole("button", { name: "Synced" }).getAttribute("aria-pressed")).toBe("true");

        expect(hls.config).toMatchObject({ liveSyncDuration: 12, lowLatencyMode: false, startPosition: -1 });

        expect(hls.config.liveSyncDurationCount).toBeUndefined();
    });

    it("the toggle persists; a switch to Live audio goes to the edge, a switch to Synced never seeks", async () => {
        const { hls, mediaTime, tick } = await tuneIn();

        tick(80, 100, 80_000);

        fireEvent.click(screen.getByRole("button", { name: "Live audio" }));

        expect(window.localStorage.getItem(LIVE_MODE_STORAGE_KEY)).toBe("live");

        expect(hls.targetLatency).toBe(6);

        expect(mediaTime()).toBe(100);

        fireEvent.click(screen.getByRole("button", { name: "Synced" }));

        expect(window.localStorage.getItem(LIVE_MODE_STORAGE_KEY)).toBe("synced");

        expect(hls.targetLatency).toBe(12);

        expect(mediaTime()).toBe(100);
    });

    it("Live audio from storage: the edge config and the text as released", async () => {
        window.localStorage.setItem(LIVE_MODE_STORAGE_KEY, "live");

        setTranscript([segment(0, 6_000, "Opening remarks."), segment(1, 40_000, "Not yet heard.")]);

        const { element, hls, tick } = await tuneIn();

        expect(hls.config).toMatchObject({ liveSyncDurationCount: 3 });

        tick(18, 18, 18_000);

        expect(screen.getByText(/Not yet heard\./)).toBeDefined();

        expect(screen.queryByTestId("live-waiting-for-text")).toBeNull();

        expect(element.pause).not.toHaveBeenCalled();
    });

    it("slows past the point, waits past it by 3 s and resumes when the text arrives, never seeking back", async () => {
        setTranscript([segment(0, 6_000, "Opening remarks.")]);

        const { element, mediaTime, playback, tick, view } = await tuneIn();

        // The final ends at 10 s: the point is 8.5 s.
        tick(9.5, 20, 9_500);

        expect(element.playbackRate).toBe(0.9);

        expect(element.pause).not.toHaveBeenCalled();

        tick(12, 20, 12_000);

        expect(element.pause).toHaveBeenCalledTimes(1);

        expect(screen.getByTestId("live-waiting-for-text").textContent).toContain(LIVE_WAITING_FOR_TEXT_TEXT);

        expect(screen.getByRole("button", { name: "Pause" })).toBeDefined();

        setTranscript([segment(0, 6_000, "Opening remarks."), segment(1, 12_000, "Guidance.")]);

        view.rerender(player());

        await waitFor(() => expect(element.play).toHaveBeenCalled());

        expect(playback.paused).toBe(false);

        expect(screen.queryByTestId("live-waiting-for-text")).toBeNull();

        expect(element.playbackRate).toBe(1);

        expect(mediaTime()).toBe(12);
    });

    it("a partial neither moves the point nor shows ahead of the audio", async () => {
        setTranscript([segment(0, 6_000, "Opening remarks.")], [segment(1, 30_000, "Not yet heard")]);

        const { element, tick } = await tuneIn();

        tick(14, 40, 14_000);

        expect(element.pause).toHaveBeenCalled();

        expect(screen.queryByText(/Not yet heard/)).toBeNull();
    });

    it("far behind it jumps forward to the newest final's start; an explicit seek back stays", async () => {
        setTranscript([segment(0, 40_000, "Far ahead.")]);

        const { mediaTime, tick } = await tuneIn();

        tick(10, 100, 10_000);

        await waitFor(() => expect(mediaTime()).toBe(40));

        tick(42, 100, 42_000);

        fireEvent.change(screen.getByLabelText("Position in the call"), { target: { value: "5" } });

        expect(mediaTime()).toBe(5);

        tick(5, 100, 5_000);

        expect(mediaTime()).toBe(5);

        expect(screen.getByText("following the audio")).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "Back to synced" }));

        expect(mediaTime()).toBeCloseTo(42.5, 1);
    });

    it("no new final for 25 s: the audio plays on", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        setTranscript([segment(0, 6_000, "Opening remarks.")]);

        const { element, tick } = await tuneIn();

        tick(14, 40, 14_000);

        expect(element.pause).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(25_100);
        });

        expect(element.play).toHaveBeenCalled();

        expect(screen.queryByTestId("live-waiting-for-text")).toBeNull();
    });

    it("the listener's pause during a hold stays when the text arrives", async () => {
        setTranscript([segment(0, 6_000, "Opening remarks.")]);

        const { element, playback, tick, view } = await tuneIn();

        tick(14, 40, 14_000);

        vi.mocked(element.play).mockClear();

        fireEvent.click(screen.getByRole("button", { name: "Pause" }));

        setTranscript([segment(0, 6_000, "Opening remarks."), segment(1, 14_000, "More.")]);

        view.rerender(player());

        expect(screen.getByRole("button", { name: "Play" })).toBeDefined();

        expect(element.play).not.toHaveBeenCalled();

        expect(playback.paused).toBe(true);
    });

    it("hls.js's sync position follows the measured distance; the diagnostics name the mode", async () => {
        const { hls, mediaTime, tick, view } = await tuneIn();

        hls.levels = [{ details: { fragments: [{ duration: 30, programDateTime: T0_MS, start: 0 }] } }];

        tick(8, 18, 8_000);

        setTranscript([segment(0, 10_000, "Opening remarks.")]);

        view.rerender(player());

        await waitFor(() => expect(hls.targetLatency).toBe(21.5));

        expect(mediaTime()).toBe(8);

        expect(screen.getByText("Text behind edge")).toBeDefined();

        expect(screen.getByText("synced to the transcript", { selector: "dd" })).toBeDefined();
    });

    it("an unmount while hls.js loads leaves no player behind", async () => {
        const view = render(player());

        await act(async () => {
            await Promise.resolve();
        });

        fireEvent.click(screen.getByRole("button", { name: "Tune in" }));

        view.unmount();

        await act(async () => {
            await Promise.resolve();
        });

        expect(FakeHls.instances).toHaveLength(0);
    });

    it("a Synced start takes its distance from the released text, with the first playlist", async () => {
        setTranscript([segment(1, 100_000, "the words")]);

        const { hls } = await tuneIn();

        hls.levels = [{ details: { fragments: [{ duration: 130, programDateTime: T0_MS, start: 0 }] } }];

        hls.liveSyncPosition = 98.5;

        act(() => hls.levelLoaded?.());

        expect(hls.targetLatency).toBe(31.5);

        expect(hls.startLoad).toHaveBeenCalledWith(98.5);
    });

    it("Live audio: From the beginning lifts hls.js's own jump until the audio is back at the edge", async () => {
        window.localStorage.setItem(LIVE_MODE_STORAGE_KEY, "live");

        const { hls, tick } = await tuneIn("From the beginning");

        expect(hls.config.liveMaxLatencyDuration).toBe(86_400);

        tick(5, 500, 5_000);

        fireEvent.click(await screen.findByRole("button", { name: "Jump to live" }));

        tick(500, 500, 500_000);

        await waitFor(() => expect(hls.config.liveMaxLatencyDuration).toBe(30));
    });

    it("storage that refuses costs only the memory", () => {
        const refuse = () => {
            throw new Error("denied");
        };

        const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse);

        const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse);

        render(player());

        expect(screen.getByRole("button", { name: "Synced" }).getAttribute("aria-pressed")).toBe("true");

        fireEvent.click(screen.getByRole("button", { name: "Live audio" }));

        expect(screen.getByRole("button", { name: "Live audio" }).getAttribute("aria-pressed")).toBe("true");

        read.mockRestore();

        write.mockRestore();
    });

    it("a refused transcript: no toggle, plain Live audio", async () => {
        setTranscript([], [], "error");

        const { hls } = await tuneIn();

        expect(screen.queryByRole("button", { name: "Synced" })).toBeNull();

        expect(hls.config).toMatchObject({ liveSyncDurationCount: 3 });
    });
});
