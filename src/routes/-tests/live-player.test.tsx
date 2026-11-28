// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2Event } from "@/lib/api/types";

import { INITIAL_LIVE_HIGHLIGHTS } from "@/lib/live/live-highlights";
import { INITIAL_LIVE_TRANSCRIPT } from "@/lib/live/live-transcript-reducer";
import { LIVE_MODE_STORAGE_KEY } from "@/lib/player/live-mode";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { CallAudioProvider } from "@/routes/$ticker/earnings-calls/-components/audio-context";
import { LivePlayerSlot } from "@/routes/$ticker/earnings-calls/-components/live-player-slot";
import { LiveTranscript } from "@/routes/$ticker/earnings-calls/-components/live/live-transcript-view";
import { CallPlayerBar, LIVE_WAITING_FOR_TEXT_TEXT, RECORDING_PREPARING_TEXT } from "@/routes/$ticker/earnings-calls/-components/player/live-call-player";

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

const RECORDING = { bytes: 1, capture_path: "live", codec: "mp3", duration_seconds: 3_600, url: "https://storage.example.com/calls/evt.mp3" };

const mocks = vi.hoisted(() => ({
    audioIds: [] as Array<string>,
    liveList: [] as Array<{ event_id: string }>,
    stream: {} as Record<string, unknown>,
    streamRequests: 0,
    transcript: {} as Record<string, unknown>,
}));

vi.mock("@/lib/live/live-clients", async importOriginal => ({
    ...await importOriginal<object>(),
    loadHls: () => Promise.resolve(FakeHls),
}));

vi.mock("@/lib/api/queries", () => ({
    useApiBaseUrl: () => "https://api.example.com",
    useV2Audio: (eventId: string) => {
        mocks.audioIds.push(eventId);

        return { data: eventId ? RECORDING : undefined, error: null };
    },
    useV2LiveAudio: (eventId: string) => ({
        data: eventId ? mocks.stream : undefined,
        error: null,
        refetch: () => {
            mocks.streamRequests += 1;

            return Promise.resolve({ data: mocks.stream, isError: false });
        },
    }),
    useV2LiveEvents: () => ({ data: { data: mocks.liveList } }),
    useV2Participants: () => ({ data: undefined }),
    useV2PriceAttribution: () => ({ data: undefined }),
    useV2Transcript: () => ({ data: undefined, error: null }),
}));

vi.mock("@/lib/live/use-live-transcript", () => ({ useLiveTranscript: () => mocks.transcript }));

vi.mock("@/routes/$ticker/earnings-calls/-components/live/live-price-chart", () => ({ LivePriceChart: () => null }));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>,
}));

const SESSION = { ended: false, isLive: true, recordingWait: null, sawLive: true } as const;

function eventOf(flags: { hasAudio?: boolean; hasTranscript?: boolean } = {}) {
    return { event_id: "evt", fiscal_quarter: 3, fiscal_year: 2026, has_audio: flags.hasAudio ?? false, has_transcript: flags.hasTranscript ?? false, symbol: "AAPL" } as unknown as V2Event;
}

function segment(seq: number, startMs: number, text: string, speakerLabel: null | string = "spk0") {
    return { endMs: startMs + 4_000, seq, speakerLabel, startMs, text };
}

function setTranscript(
    finals: ReadonlyArray<ReturnType<typeof segment>>,
    partials: ReadonlyArray<ReturnType<typeof segment>> = [],
    mode = "live",
    extra: Record<string, unknown> = {},
) {
    mocks.transcript = {
        error: null,
        highlights: INITIAL_LIVE_HIGHLIGHTS,
        malformedFrames: 0,
        mode,
        notice: null,
        prices: { last: null, ticks: [] },
        provisionalVersion: null,
        reconnecting: false,
        rescheduledTo: null,
        stalled: false,
        state: { ...INITIAL_LIVE_TRANSCRIPT, finals, partials },
        warning: null,
        ...extra,
    };
}

function Page({ hasAudio = false, hasTranscript = false, historicalTicker }: { hasAudio?: boolean; hasTranscript?: boolean; historicalTicker?: string }) {
    const event = eventOf({ hasAudio, hasTranscript });

    return (
        <CallAudioProvider eventId="evt" hasAudio={hasAudio} live={SESSION}>
            <LivePlayerSlot event={event} historicalTicker={historicalTicker} session={SESSION} />
            <CallPlayerBar event={event} />
            <LiveTranscript eventId="evt" />
        </CallAudioProvider>
    );
}

function liveElement() {
    const element = document.querySelector<HTMLAudioElement>("audio[data-engine='live']");

    if (element === null) throw new Error("no live <audio>");

    return element;
}

function fileElement() {
    const element = document.querySelector<HTMLAudioElement>("audio[data-engine='file']");

    if (element === null) throw new Error("no file <audio>");

    return element;
}

/** Opens the bar's `⋯` menu and picks a playback mode. */
async function chooseMode(label: "as live as possible" | "synced to the transcript") {
    // A radio item keeps the menu open: open it only once.
    if (screen.queryByRole("menu") === null) fireEvent.click(screen.getByRole("button", { name: "Player details" }));

    fireEvent.click(await screen.findByRole("menuitemradio", { name: label }));
}

/** Tune in on a fake hls.js: `paused` follows `play()` / `pause()`, `tick` stands in for playback. */
async function tuneIn(from: "From the beginning" | "Tune in" = "Tune in") {
    const view = render(<Page />);

    const element = liveElement();

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

    mocks.audioIds = [];

    mocks.liveList = [];

    mocks.streamRequests = 0;

    // jsdom answers no ranges at all.
    Object.defineProperty(HTMLMediaElement.prototype, "seekable", { configurable: true, get: () => ({ length: 0 }) });

    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());

    HTMLMediaElement.prototype.pause = vi.fn();

    // jsdom has no layout: Follow's scroll is a no-op here.
    Element.prototype.scrollIntoView = vi.fn();

    window.localStorage.clear();

    useApiKeyStore.setState({ apiKey: "key", apiKeyUpdatedAt: 1, hasHydrated: true });

    mocks.stream = { call_t0: T0, expires_at: null, status: "available", url: "https://live.example.com/playlist.m3u8" };

    setTranscript([]);
});

afterEach(() => {
    cleanup();

    vi.restoreAllMocks();

    vi.useRealTimers();
});

describe("the live call on CallPlayer", () => {
    it("before tuning in: Tune in and From the beginning in the bar, no speed, no inner transcript box", () => {
        setTranscript([segment(0, 6_000, "Opening remarks.")]);

        render(<Page />);

        const bar = screen.getByRole("region", { name: "Call player" });

        expect(within(bar).getByRole("button", { name: "Tune in" })).toBeDefined();

        expect(within(bar).getByRole("button", { name: "From the beginning" })).toBeDefined();

        expect(within(bar).queryByRole("group", { name: "Speed" })).toBeNull();

        // The turn layout of a recording: the ▷ timestamp, the text, no 60vh box of its own.
        expect(screen.getByText("Opening remarks.")).toBeDefined();

        expect(document.querySelector(".overflow-y-auto")).toBeNull();
    });

    it("at the edge: the LIVE pill (LIVE · synced in Synced mode), no speed, no ±15 s", async () => {
        const { tick } = await tuneIn();

        tick(88, 100, 88_000);

        const bar = screen.getByRole("region", { name: "Call player" });

        expect(within(bar).getByRole("status").textContent).toContain("LIVE · synced");

        expect(within(bar).queryByRole("group", { name: "Speed" })).toBeNull();

        expect(within(bar).queryByRole("button", { name: "Back 15 seconds" })).toBeNull();

        expect(within(bar).getByRole("button", { name: "Pause" })).toBeDefined();
    });

    it("Live audio: the plain LIVE pill at the edge, −MM:SS behind it, a click back to live", async () => {
        window.localStorage.setItem(LIVE_MODE_STORAGE_KEY, "live");

        const { mediaTime, tick } = await tuneIn("From the beginning");

        tick(5, 500, 5_000);

        const behind = await screen.findByRole("button", { name: "8 minutes 15 seconds behind live, back to live" });

        expect(behind.textContent).toBe("−08:15");

        expect(screen.getByRole("button", { name: "Back 15 seconds" })).toBeDefined();

        fireEvent.click(behind);

        expect(mediaTime()).toBe(500);

        tick(500, 500, 500_000);

        expect(within(screen.getByRole("region", { name: "Call player" })).getByRole("status").textContent).toBe("LIVE");
    });
});

describe("the sync modes", () => {
    it("defaults to Synced: 12 s behind the edge, no hls.js jump of its own", async () => {
        const { hls } = await tuneIn();

        expect(hls.config).toMatchObject({ liveSyncDuration: 12, lowLatencyMode: false, startPosition: -1 });

        expect(hls.config.liveSyncDurationCount).toBeUndefined();

        fireEvent.click(screen.getByRole("button", { name: "Player details" }));

        expect((await screen.findByRole("menuitemradio", { name: "synced to the transcript" })).getAttribute("aria-checked")).toBe("true");
    });

    it("the menu's choice persists; a switch to Live audio goes to the edge, a switch to Synced never seeks", async () => {
        const { hls, mediaTime, tick } = await tuneIn();

        tick(80, 100, 80_000);

        await chooseMode("as live as possible");

        expect(window.localStorage.getItem(LIVE_MODE_STORAGE_KEY)).toBe("live");

        expect(hls.targetLatency).toBe(6);

        expect(mediaTime()).toBe(100);

        await chooseMode("synced to the transcript");

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

        // A hold is not the listener's pause.
        expect(screen.getByRole("button", { name: "Pause" })).toBeDefined();

        setTranscript([segment(0, 6_000, "Opening remarks."), segment(1, 12_000, "Guidance.")]);

        view.rerender(<Page />);

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

    it("far behind it jumps forward to the newest final's start; an explicit seek back stays and reads −MM:SS", async () => {
        setTranscript([segment(0, 40_000, "Far ahead.")]);

        const { mediaTime, tick } = await tuneIn();

        tick(10, 100, 10_000);

        await waitFor(() => expect(mediaTime()).toBe(40));

        tick(42, 100, 42_000);

        fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: "ArrowLeft" });

        expect(mediaTime()).toBe(37);

        tick(37, 100, 37_000);

        expect(mediaTime()).toBe(37);

        const behind = await screen.findByRole("button", { name: "1 minute 3 seconds behind live, back to live" });

        fireEvent.click(behind);

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

        view.rerender(<Page />);

        expect(screen.getByRole("button", { name: "Play" })).toBeDefined();

        expect(element.play).not.toHaveBeenCalled();

        expect(playback.paused).toBe(true);
    });

    it("hls.js's sync position follows the measured distance; the diagnostics name the mode", async () => {
        const { hls, mediaTime, tick, view } = await tuneIn();

        hls.levels = [{ details: { fragments: [{ duration: 30, programDateTime: T0_MS, start: 0 }] } }];

        tick(8, 18, 8_000);

        setTranscript([segment(0, 10_000, "Opening remarks.")]);

        view.rerender(<Page />);

        await waitFor(() => expect(hls.targetLatency).toBe(21.5));

        expect(mediaTime()).toBe(8);

        expect(screen.getByText("Text behind edge")).toBeDefined();

        expect(screen.getByText("synced to the transcript", { selector: "dd" })).toBeDefined();
    });

    it("an unmount while hls.js loads leaves no player behind", async () => {
        const view = render(<Page />);

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

        fireEvent.click(await screen.findByRole("button", { name: /behind live, back to live/ }));

        tick(500, 500, 500_000);

        await waitFor(() => expect(hls.config.liveMaxLatencyDuration).toBe(30));
    });

    it("storage that refuses costs only the memory", async () => {
        const refuse = () => {
            throw new Error("denied");
        };

        const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse);

        const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse);

        render(<Page />);

        await chooseMode("as live as possible");

        expect((await screen.findByRole("menuitemradio", { name: "as live as possible" })).getAttribute("aria-checked")).toBe("true");

        read.mockRestore();

        write.mockRestore();
    });

    it("a refused transcript: no mode choice, plain Live audio", async () => {
        setTranscript([], [], "error");

        const { hls } = await tuneIn();

        expect(screen.queryByRole("button", { name: "Player details" })).toBeNull();

        expect(hls.config).toMatchObject({ liveSyncDurationCount: 3 });
    });
});

describe("the live transcript on TurnBlock", () => {
    it("names, the provisional badge, ▷ timestamps, the partial tail; a keyword hit is marked and listed", () => {
        const assignment = { confidence: 0.9, firm: "Acme", fromSeq: 0, name: "Jane Doe", role: "executive", source: "question_cue", speakerLabel: "spk0", title: "CFO", toSeq: null };

        const hit = { context_before: null, end_ms: 10_000, keyword: "tariffs", latency_ms: 1, layer: "live", seq: 0, speaker_label: "spk0", speaker_name: "Jane Doe", speaker_role: "executive", start_ms: 6_000, text: "Tariffs weigh.", type: "keyword_hit" };

        const flash = { currency: "USD", high: 96e9, low: 94e9, metric: "revenue", metric_normalized: "revenue", period_label: "Q4 FY2026", point: null, revision: 1, seq: 1, source_sentence: "Revenue of 94 to 96 billion.", start_ms: 20_000, type: "guidance_flash", unit: "USD" };

        setTranscript(
            [segment(0, 6_000, "Tariffs weigh on margins."), segment(1, 20_000, "Next quarter revenue.", "spk1")],
            [segment(2, 25_000, "and the rest", "spk1")],
            "live",
            {
                highlights: {
                    guidance: [{ key: "revenue|Q4 FY2026", metric: "revenue", periodLabel: "Q4 FY2026", revision: 1, sourceSentence: flash.source_sentence, startMs: 20_000, value: "$94B–$96B" }],
                    keywords: [{ key: "live-0-tariffs", keyword: hit.keyword, layer: "live", speakerName: hit.speaker_name, startMs: 6_000, text: hit.text }],
                },
                state: { ...INITIAL_LIVE_TRANSCRIPT, finals: [segment(0, 6_000, "Tariffs weigh on margins."), segment(1, 20_000, "Next quarter revenue.", "spk1")], partials: [segment(2, 25_000, "and the rest", "spk1")], speakerNames: { assignments: [assignment], revision: 1 } },
            },
        );

        render(<Page />);

        const transcript = screen.getByRole("region", { name: "Live transcript" });

        expect(within(transcript).getByText("Jane Doe")).toBeDefined();

        expect(within(transcript).getByText("CFO, Acme")).toBeDefined();

        expect(within(transcript).getByText("Speaker 2")).toBeDefined();

        expect(within(transcript).getByText("live").closest("[title]")?.getAttribute("title")).toBe("provisional — from question cue, confidence 0.90");

        expect(within(transcript).getByText("and the rest").className).toContain("italic");

        expect(within(transcript).getAllByRole("button", { name: /0:06|0:20/ }).length).toBeGreaterThanOrEqual(2);

        expect(transcript.querySelector("mark[data-keyword-mark]")?.textContent).toBe("Tariffs");

        const highlights = screen.getByRole("region", { name: "Live highlights" });

        expect(highlights.querySelector("[data-highlight='keyword']")?.textContent).toContain("Tariffs weigh.");

        expect(highlights.querySelector("[data-highlight='guidance']")?.textContent).toContain("$94B–$96B");
    });
});

describe("live → recording without a reload", () => {
    it.each([
        ["together with has_transcript", true],
        ["a poll after has_transcript", false],
    ])("has_audio %s: the recording player takes over at the same call position, hls.js goes", async (_label, together) => {
        setTranscript([segment(0, 6_000, "Opening remarks.")]);

        const { hls, tick, view } = await tuneIn();

        tick(50, 100, 60_000);

        if (!together) {
            setTranscript([segment(0, 6_000, "Opening remarks.")], [], "ended", { state: { ...INITIAL_LIVE_TRANSCRIPT, ended: true, finals: [segment(0, 6_000, "Opening remarks.")] } });

            view.rerender(<Page hasTranscript />);

            // Still the live engine: the recording is not published yet.
            expect(screen.queryByRole("group", { name: "Speed" })).toBeNull();

            expect(mocks.audioIds.every(id => id === "")).toBe(true);
        }

        view.rerender(<Page hasAudio hasTranscript />);

        expect(hls.destroy).toHaveBeenCalled();

        await waitFor(() => expect(mocks.audioIds.at(-1)).toBe("evt"));

        const file = fileElement();

        Object.defineProperty(file, "readyState", { configurable: true, get: () => HTMLMediaElement.HAVE_METADATA });

        act(() => {
            file.dispatchEvent(new Event("loadedmetadata"));
        });

        // 50 s of media at call ms 60 000: the recording starts at the same call position.
        expect(file.currentTime).toBe(60);

        expect(await screen.findByRole("group", { name: "Speed" })).toBeDefined();

        expect(screen.getByRole("button", { name: "Download the recording" })).toBeDefined();
    });

    it("the call ended before the recording: the bar neutrally reports unavailable audio, the transcript stays", () => {
        setTranscript([segment(0, 6_000, "Opening remarks.")], [], "ended", { state: { ...INITIAL_LIVE_TRANSCRIPT, ended: true, finals: [segment(0, 6_000, "Opening remarks.")] } });

        render(<Page />);

        expect(screen.getByRole("region", { name: "Call player" }).textContent).toContain(RECORDING_PREPARING_TEXT);

        expect(screen.getByText("Opening remarks.")).toBeDefined();
    });


});

describe("quality pass", () => {
    it("a stream not started yet is never polled: Check again asks once more on a click", () => {
        mocks.stream = { call_t0: T0, expires_at: null, status: "not_started", url: null };

        render(<Page />);

        const bar = screen.getByRole("region", { name: "Call player" });

        expect(bar.textContent).toContain("No live audio yet");

        expect(mocks.streamRequests).toBe(0);

        fireEvent.click(within(bar).getByRole("button", { name: "Check again" }));

        expect(mocks.streamRequests).toBe(1);
    });

    it("the key removed mid-call: hls.js stops, no /audio request (nothing is published)", async () => {
        setTranscript([segment(0, 6_000, "Opening remarks.")]);

        const { hls, tick, view } = await tuneIn();

        tick(50, 100, 60_000);

        act(() => useApiKeyStore.setState({ apiKey: null }));

        view.rerender(<Page />);

        expect(hls.destroy).toHaveBeenCalled();

        expect(mocks.audioIds.every(id => id === "")).toBe(true);
    });


});

it("the rescheduled-call return link preserves historical parent scope and the default event symbol", () => {
    setTranscript([], [], "live", { rescheduledTo: "2026-12-01T12:00:00Z" });

    const { rerender } = render(<Page historicalTicker="OLDCO" />);

    expect(screen.getByRole("link", { name: /All calls of/ })).toHaveAttribute("href", "/OLDCO/earnings-calls");

    rerender(<Page />);

    expect(screen.getByRole("link", { name: /All calls of/ })).toHaveAttribute("href", `/${eventOf({}).symbol}/earnings-calls`);
});
