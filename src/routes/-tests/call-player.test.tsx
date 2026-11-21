// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2Event } from "@/lib/api/types";
import type { PlayerEngine, PlayerState } from "@/lib/player/engine";

import { ApiRequestError } from "@/lib/api/errors";
import { PLAYER_RATE_STORAGE_KEY } from "@/lib/player/engine";
import { CallPlayerProvider, usePlayer } from "@/lib/player/player-context";
import { CallAudioProvider } from "@/routes/$ticker/earnings-calls/-components/audio-context";
import { CallHeader } from "@/routes/$ticker/earnings-calls/-components/call-header";
import { CALL_TAB_VALUES } from "@/routes/$ticker/earnings-calls/-components/call-tabs";
import { CallPlayer } from "@/routes/$ticker/earnings-calls/-components/player/call-player";
import { recordingFilename, RecordingPlayer } from "@/routes/$ticker/earnings-calls/-components/player/recording-player";
import { SeekButton } from "@/routes/$ticker/earnings-calls/-components/seek-button";

// The provider's two requests, recorded: `/audio` must stay idle (empty id) until the first play / timestamp.
const queries = vi.hoisted(() => ({
    audioIds: [] as Array<string>,
    recording: null as null | { bytes: number; capture_path: string; codec: string; duration_seconds: number; url: string },
}));

vi.mock("@/lib/api/queries", () => ({
    // The live half of the provider stays idle (no live session in these tests).
    useApiBaseUrl: () => null,
    useV2Audio: (eventId: string) => {
        queries.audioIds.push(eventId);

        return { data: eventId ? queries.recording : undefined, error: null };
    },
    useV2LiveAudio: () => ({ data: undefined, error: null, refetch: () => Promise.resolve({ data: undefined, isError: false }) }),
    useV2Transcript: () => ({ data: undefined, error: null }),
}));

// The call tabs are imported only for their value list: keep every tab's requests unloaded.
vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/transcript-tab", () => ({ TranscriptTab: () => null }));

afterEach(cleanup);

beforeEach(() => {
    queries.audioIds = [];

    queries.recording = null;

    window.localStorage.clear();

    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());

    HTMLMediaElement.prototype.pause = vi.fn();
});

const EVENT_ID = "9655a5db-8968-40be-8c79-7cd1a8aed8e9";

function engineOf(state: PlayerState, overrides: Partial<PlayerEngine> = {}): PlayerEngine {
    return {
        behindMs: 0,
        buffering: false,
        capabilities: { download: true, rate: true, skip: true },
        endMs: 2_745_000,
        error: null,
        muted: false,
        pause: vi.fn(),
        paused: true,
        play: vi.fn(),
        positionMs: 0,
        rate: 1,
        seekMs: vi.fn(),
        setRate: vi.fn(),
        setVolume: vi.fn(),
        skip: vi.fn(),
        state,
        volume: 1,
        ...overrides,
    };
}

/** Shows the context's follow state, as task 3's follow hook will read it. */
function FollowProbe() {
    const { follow } = usePlayer();

    return <div data-testid="follow">{String(follow)}</div>;
}

function renderPlayer(engine: PlayerEngine, props: React.ComponentProps<typeof CallPlayer> = {}) {
    const mediaRef = { current: document.createElement("audio") };

    return render(
        <CallPlayerProvider canSeek engine={engine} mediaRef={mediaRef}>
            <CallPlayer {...props} />
            <FollowProbe />
            <input aria-label="Search this call" />
        </CallPlayerProvider>,
    );
}

describe("CallPlayer: controls by state", () => {
    it("idle: one Play button that asks the engine to load", () => {
        const engine = engineOf("idle", { endMs: null });

        renderPlayer(engine);

        fireEvent.click(screen.getByRole("button", { name: "Play the recording" }));

        expect(engine.play).toHaveBeenCalledTimes(1);

        expect(screen.queryByRole("slider")).toBeNull();
    });

    it("loading: a progress line, no controls", () => {
        renderPlayer(engineOf("loading"));

        expect(screen.getByText("Loading the recording…")).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    });

    it("error: the media state inline", () => {
        const error = new ApiRequestError(403, { error: "forbidden", message: "Forbidden" });

        renderPlayer(engineOf("error", { error }));

        expect(screen.getByText(/Audio for this call is not available/)).toBeInTheDocument();
    });

    it("recording: play, time, seek bar with the Q&A marker, skip, speed, volume, follow, download, details", () => {
        const engine = engineOf("recording");

        const { container } = renderPlayer(engine, {
            details: [{ label: "Codec", value: "mp3" }],
            download: { filename: "AAPL-Q3-FY2026-call.mp3", url: "https://storage.example.com/a.mp3" },
            markers: [{ label: "Q&A", ms: 1_200_000 }],
        });

        const slider = screen.getByRole("slider", { name: "Seek" });

        expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 45:45");

        expect(container.querySelector("[data-marker]")).toHaveAttribute("data-marker", "Q&A");

        expect(screen.getByText("0:00 / 45:45")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Play" }));

        expect(engine.play).toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Forward 15 seconds" }));

        expect(engine.skip).toHaveBeenLastCalledWith(15);

        fireEvent.click(screen.getByRole("button", { name: "1.5×" }));

        expect(engine.setRate).toHaveBeenCalledWith(1.5);

        expect(window.localStorage.getItem(PLAYER_RATE_STORAGE_KEY)).toBe("1.5");

        fireEvent.click(screen.getByRole("button", { name: "Mute" }));

        expect(engine.setVolume).toHaveBeenCalledWith(1, true);

        expect(screen.getByRole("button", { name: "Download the recording" })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Player details" })).toBeInTheDocument();
    });

    it("the seek bar's keyboard: arrows skip, Home / End seek without playing", () => {
        const engine = engineOf("recording");

        renderPlayer(engine);

        const slider = screen.getByRole("slider", { name: "Seek" });

        fireEvent.keyDown(slider, { key: "ArrowRight" });

        expect(engine.skip).toHaveBeenLastCalledWith(5);

        fireEvent.keyDown(slider, { key: "ArrowLeft", shiftKey: true });

        expect(engine.skip).toHaveBeenLastCalledWith(-15);

        fireEvent.keyDown(slider, { key: "End" });

        expect(engine.seekMs).toHaveBeenLastCalledWith(2_745_000, { play: false });

        fireEvent.keyDown(slider, { key: "Home" });

        expect(engine.seekMs).toHaveBeenLastCalledWith(0, { play: false });
    });

    it("the seek bar's drag seeks on release without playing; a cancelled drag or a right click seeks nothing", () => {
        const engine = engineOf("recording");

        renderPlayer(engine);

        const slider = screen.getByRole("slider", { name: "Seek" });

        slider.setPointerCapture = vi.fn();

        slider.getBoundingClientRect = () => ({ bottom: 16, height: 16, left: 0, right: 1000, toJSON: () => ({}), top: 0, width: 1000, x: 0, y: 0 });

        fireEvent.pointerDown(slider, { button: 0, clientX: 500, pointerId: 1 });

        fireEvent.pointerUp(slider, { button: 0, clientX: 500, pointerId: 1 });

        expect(engine.seekMs).toHaveBeenLastCalledWith(1_372_500, { play: false });

        fireEvent.pointerDown(slider, { button: 0, clientX: 250, pointerId: 2 });

        expect(slider).toHaveAttribute("aria-valuetext", "11:26 of 45:45");

        fireEvent.pointerCancel(slider, { pointerId: 2 });

        // The thumb is back on the playhead and the release after a cancel seeks nowhere.
        expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 45:45");

        fireEvent.pointerUp(slider, { button: 0, clientX: 250, pointerId: 2 });

        fireEvent.pointerDown(slider, { button: 2, clientX: 750, pointerId: 3 });

        fireEvent.pointerUp(slider, { button: 2, clientX: 750, pointerId: 3 });

        expect(engine.seekMs).toHaveBeenCalledTimes(1);
    });

    it("hides speed, skip and download when the engine cannot do them", () => {
        renderPlayer(engineOf("live-edge", { capabilities: { download: false, rate: false, skip: false } }), {
            download: { filename: "x.mp3", url: "https://storage.example.com/x.mp3" },
        });

        expect(screen.queryByRole("button", { name: "1.5×" })).toBeNull();

        expect(screen.queryByRole("button", { name: "Forward 15 seconds" })).toBeNull();

        expect(screen.queryByRole("button", { name: "Download the recording" })).toBeNull();

        expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    });

    it("Follow toggles the context's follow state (on by default)", () => {
        renderPlayer(engineOf("recording"));

        expect(screen.getByTestId("follow")).toHaveTextContent("true");

        fireEvent.click(screen.getByRole("button", { name: "Follow" }));

        expect(screen.getByTestId("follow")).toHaveTextContent("false");

        fireEvent.click(screen.getByRole("button", { name: "Follow" }));

        expect(screen.getByTestId("follow")).toHaveTextContent("true");
    });

    it("page shortcuts: Space plays / pauses, J / L skip; never while typing", () => {
        const engine = engineOf("recording");

        renderPlayer(engine);

        fireEvent.keyDown(document.body, { key: " " });

        expect(engine.play).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(document.body, { key: "j" });

        expect(engine.skip).toHaveBeenLastCalledWith(-15);

        fireEvent.keyDown(document.body, { key: "L" });

        expect(engine.skip).toHaveBeenLastCalledWith(15);

        fireEvent.keyDown(screen.getByRole("textbox", { name: "Search this call" }), { key: " " });

        expect(engine.play).toHaveBeenCalledTimes(1);
    });

    it("page shortcuts stay off inside an open dialog or menu", () => {
        const engine = engineOf("recording");

        renderPlayer(engine);

        const dialog = document.createElement("div");

        dialog.setAttribute("role", "dialog");

        dialog.tabIndex = -1;

        document.body.append(dialog);

        fireEvent.keyDown(dialog, { key: " " });

        fireEvent.keyDown(dialog, { key: "j" });

        expect(engine.play).not.toHaveBeenCalled();

        expect(engine.skip).not.toHaveBeenCalled();

        dialog.remove();
    });

    it("applies the remembered speed", () => {
        window.localStorage.setItem(PLAYER_RATE_STORAGE_KEY, "2");

        const engine = engineOf("idle");

        renderPlayer(engine);

        expect(engine.setRate).toHaveBeenCalledWith(2);
    });

    it("sees only the engine contract (no file or live engine import)", () => {
        const source = readFileSync(resolve(__dirname, "../$ticker/earnings-calls/-components/player/call-player.tsx"), "utf8");

        expect(source).not.toMatch(/file-engine|use-live-audio|audio-context/);
    });
});

describe("RecordingPlayer on the file engine", () => {
    const event = { event_id: EVENT_ID, fiscal_quarter: 3, fiscal_year: 2026, symbol: "AAPL" } as V2Event;

    it("requests /audio only on the first play, never on page load", () => {
        queries.recording = {
            bytes: 1_000,
            capture_path: "direct_download",
            codec: "mp3",
            duration_seconds: 2_745,
            url: "https://storage.example.com/calls/t/AAPL.mp3",
        };

        render(
            <CallAudioProvider eventId={EVENT_ID} hasAudio>
                <RecordingPlayer event={event} />
            </CallAudioProvider>,
        );

        expect(queries.audioIds.every(id => id === "")).toBe(true);

        act(() => {
            fireEvent.click(screen.getByRole("button", { name: "Play the recording" }));
        });

        expect(queries.audioIds.at(-1)).toBe(EVENT_ID);

        expect(document.querySelector("audio")?.getAttribute("src")).toBe(queries.recording.url);

        expect(screen.getByRole("button", { name: "Download the recording" })).toBeInTheDocument();
    });

    it("a timestamp click is the other first request", () => {
        render(
            <CallAudioProvider eventId={EVENT_ID} hasAudio>
                <SeekButton startMs={65_000} />
            </CallAudioProvider>,
        );

        expect(queries.audioIds.every(id => id === "")).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: "Play from 1:05" }));

        expect(queries.audioIds.at(-1)).toBe(EVENT_ID);
    });

    it("a link's ?t= labels the first Play, which asks for /audio then and starts there (never on page load)", () => {
        queries.recording = { bytes: 1_000, capture_path: "direct_download", codec: "mp3", duration_seconds: 2_745, url: "https://storage.example.com/calls/t/AAPL.mp3" };

        render(
            <CallAudioProvider eventId={EVENT_ID} hasAudio startAtMs={95_000}>
                <RecordingPlayer event={event} />
            </CallAudioProvider>,
        );

        expect(queries.audioIds.every(id => id === "")).toBe(true);

        act(() => {
            fireEvent.click(screen.getByRole("button", { name: "Play from 1:35" }));
        });

        expect(queries.audioIds.at(-1)).toBe(EVENT_ID);

        const audio = document.querySelector<HTMLAudioElement>("audio[data-engine='file']");

        act(() => {
            audio?.dispatchEvent(new Event("loadedmetadata"));
        });

        expect(audio?.currentTime).toBe(95);

        expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    it("a link's ?t= is not applied to a call without a recording at load (a live call keeps Tune in)", () => {
        render(
            <CallAudioProvider eventId={EVENT_ID} hasAudio={false} startAtMs={95_000}>
                <RecordingPlayer event={event} />
            </CallAudioProvider>,
        );

        expect(screen.queryByRole("button", { name: /Play from/ })).toBeNull();
    });

    it("⋯ → Copy link at current time hands the page the position in whole seconds", async () => {
        queries.recording = { bytes: 1_000, capture_path: "direct_download", codec: "mp3", duration_seconds: 2_745, url: "https://storage.example.com/calls/t/AAPL.mp3" };

        const onCopyLinkAt = vi.fn();

        render(
            <CallAudioProvider eventId={EVENT_ID} hasAudio>
                <RecordingPlayer event={event} onCopyLinkAt={onCopyLinkAt} />
            </CallAudioProvider>,
        );

        act(() => {
            fireEvent.click(screen.getByRole("button", { name: "Play the recording" }));
        });

        const audio = document.querySelector<HTMLAudioElement>("audio[data-engine='file']");

        if (audio) audio.currentTime = 754.8;

        fireEvent.click(screen.getByRole("button", { name: "Player details" }));

        fireEvent.click(await screen.findByRole("menuitem", { name: "Copy link at current time" }));

        expect(onCopyLinkAt).toHaveBeenCalledWith(754);
    });

    it("renders no bar for a call without a recording (timestamps are text)", () => {
        const { container } = render(
            <CallAudioProvider eventId={EVENT_ID} hasAudio={false}>
                <RecordingPlayer event={event} />
                <SeekButton startMs={65_000} />
            </CallAudioProvider>,
        );

        expect(screen.queryByRole("region", { name: "Call player" })).toBeNull();

        expect(screen.queryByRole("button")).toBeNull();

        expect(container).toHaveTextContent("1:05");
    });

    it("names the download <SYMBOL>-<fiscal period>-call.<ext>", () => {
        expect(recordingFilename(event, { codec: "aac", url: "https://storage.example.com/calls/t/file.m4a" })).toBe("AAPL-Q3-FY2026-call.m4a");

        expect(recordingFilename({ ...event, fiscal_year: null }, { codec: "mp3", url: "not a url" })).toBe("AAPL-call.mp3");
    });

    it("the call header shows the event id with its copy button", () => {
        render(<CallHeader event={{ ...event, company_name: "Apple", event_type: "earnings_call", observations: [], reschedule_count: 0 } as V2Event} />);

        expect(screen.getByText(EVENT_ID)).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Copy event id" })).toBeInTheDocument();
    });

    it("has no Audio tab: an old ?tab=audio is not a tab value", () => {
        expect(CALL_TAB_VALUES).not.toContain("audio");
    });
});
