// @vitest-environment jsdom
import type * as React from "react";

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2QaPair } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { followWordDelta, useFollowScroll } from "@/lib/player/use-follow-scroll";
import { QaScoreBadges, qaSegments } from "@/routes/$ticker/earnings-calls/-components/tabs/qa-tab";
import { TranscriptTab } from "@/routes/$ticker/earnings-calls/-components/tabs/transcript-tab";
import { TranscriptTurns } from "@/routes/$ticker/earnings-calls/-components/tabs/transcript-turns";
import { TurnBlock } from "@/routes/$ticker/earnings-calls/-components/transcript/turn-block";

// The page's player, stubbed: the position, the play state, Follow and the engine's seek.
const player = vi.hoisted(() => ({
    follow: true,
    playing: false,
    positionMs: 0,
    seekMs: vi.fn(),
    setFollow: vi.fn(),
}));

// A speaker resolved to a person links the person page (`PersonLink`); the router's `Link` as a plain anchor.
vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, className, params, to }: { children: React.ReactNode; className?: string; params: Record<string, string>; to: string }) => (
        <a className={className} href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/player/player-context", () => ({
    usePlayer: () => ({
        canSeek: true,
        engine: { seekMs: player.seekMs, state: "recording" },
        follow: player.follow,
        setFollow: player.setFollow,
    }),
    usePlayerPosition: () => ({ bufferedMs: 0, durationMs: null, playing: player.playing, positionMs: player.positionMs }),
}));

// The Q&A tab module also imports the hooks and the audio host; nothing of them runs here.
// The Transcript tab's requests, stubbed: each call is recorded to check what is asked.
const requests = vi.hoisted(() => ({ cleanedError: null as Error | null, transcript: [] as Array<unknown>, versions: [] as Array<unknown> | null, versionsError: null as Error | null }));

vi.mock("@/lib/api/queries", () => ({
    useV2Participants: () => ({ data: null }),
    useV2QaInfinite: vi.fn(),
    useV2Transcript: (input: { eventId: string; layer?: string }) => {
        requests.transcript.push(input);

        return {
            data: input.eventId
                ? { event: { symbol: "NVDA" }, pdf: null, published_at: "2026-11-20T21:00:00Z", qa_start_ms: null, turns: [{ ...TURNS_FIXTURE[0], words: [] }], version: 3, version_kind: "final", word_count: 9000 }
                : null,
            error: input.layer === "cleaned" ? requests.cleanedError : null,
        };
    },
    useV2TranscriptDiff: () => ({ data: null, error: null, isLoading: false }),
    useV2TranscriptText: (input: { eventId: string }) => ({
        data: input.eventId ? { blocks: [{ section: "prepared_remarks", text: "Good morning everyone" }], qa_start_ms: null, version: 3 } : null,
        error: null,
    }),
    // `versions: null` = the list is still pending (the hook answers `data: null`).
    useV2TranscriptVersions: () => ({ data: requests.versions === null ? null : { data: requests.versions }, error: requests.versionsError }),
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({ useCallAudio: () => ({ recording: null }) }));

const TURNS_FIXTURE = vi.hoisted(() => [{ name: "Ann Lee", person_id: null, role: "executive", speaker_label: "A", start_ms: 0, text: "Good morning everyone", title: "CEO" }]);

afterEach(cleanup);

beforeEach(() => {
    // jsdom has no scrolling: Follow's `scrollIntoView` is a no-op here.
    Element.prototype.scrollIntoView = vi.fn();

    player.follow = true;

    player.playing = false;

    player.positionMs = 0;

    player.seekMs.mockClear();

    player.setFollow.mockClear();
});

const words = (start: number, texts: Array<string>) => texts.map((text, index) => ({ startMs: start + index * 1000, text }));

const TURNS = [
    { name: "Ann Lee", person_id: null, role: "executive", speaker_label: "A", start_ms: 0, text: "Good morning everyone", title: "CEO" },
    { name: "Bo Chan", person_id: "6f1c2d3e-0000-4000-8000-000000000001", role: "analyst", speaker_label: "B", start_ms: 10_000, text: "Thanks for taking my question", title: null },
];

const TURN_WORDS = [words(0, ["Good", "morning", "everyone"]), words(10_000, ["Thanks", "for", "taking", "my", "question"])];

function stateOf(name: string) {
    return screen.getByText(name).closest("[data-state]")?.getAttribute("data-state");
}

describe("TurnBlock", () => {
    it("renders image or initials, name, title and the ▷ timestamp; a word click plays from that word", () => {
        render(<TurnBlock activeWord={-1} index={0} speaker={{ detail: "CEO", label: "A", name: "Ann Lee" }} startMs={65_000} state="idle" text="x" words={words(65_000, ["Good", "morning"])} />);

        expect(screen.getByText("AL")).toBeInTheDocument();

        expect(screen.getByText("CEO")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Play from 1:05" })).toBeInTheDocument();

        fireEvent.click(screen.getByText("morning"));

        expect(player.seekMs).toHaveBeenCalledWith(66_000);
    });

    it("marks the active word and fades what comes after it", () => {
        render(<TurnBlock activeWord={1} index={0} speaker={{ label: "A", name: "Ann Lee" }} startMs={0} state="active" text="x" words={words(0, ["one", "two", "three"])} />);

        expect(screen.getByText("two").className).toContain("bg-primary/15");

        expect(screen.getByText("one").className).not.toContain("text-muted-foreground/40");

        expect(screen.getByText("three").className).toContain("text-muted-foreground/40");
    });
});

describe("TranscriptTurns (playback)", () => {
    const view = { kind: "turns" as const, turns: TURNS };

    it("playing: the heard turn is active, the later one faded", () => {
        player.playing = true;

        player.positionMs = 1_500;

        render(<TranscriptTurns qaStartMs={null} view={view} words={TURN_WORDS} />);

        expect(stateOf("Ann Lee")).toBe("active");

        expect(stateOf("Bo Chan")).toBe("upcoming");

        expect(screen.getByText("morning").className).toContain("bg-primary/15");

        expect(screen.getByText("question").className).toContain("text-muted-foreground/40");
    });

    it("marks prepared remarks and Q&A within the same speaker transcript", () => {
        render(<TranscriptTurns qaStartMs={10_000} view={view} />);

        expect(screen.getByRole("heading", { name: "Prepared remarks" })).toBeInTheDocument();

        expect(screen.getByRole("heading", { name: /Q&A/ })).toBeInTheDocument();

        expect(screen.getByText("Ann Lee")).toBeInTheDocument();

        expect(screen.getByText("Bo Chan")).toBeInTheDocument();
    });

    it("paused: nothing is faded", () => {
        player.positionMs = 11_000;

        const { container } = render(<TranscriptTurns qaStartMs={null} view={view} words={TURN_WORDS} />);

        expect(stateOf("Ann Lee")).toBe("idle");

        expect(stateOf("Bo Chan")).toBe("idle");

        expect(container.querySelector(".text-muted-foreground\\/40")).toBeNull();
    });

    it("a speaker resolved to a person links the person page; an unresolved one stays text", () => {
        render(<TranscriptTurns qaStartMs={null} view={view} />);

        expect(screen.getByText("Bo Chan").closest("a")?.getAttribute("href")).toBe("/people/6f1c2d3e-0000-4000-8000-000000000001");

        expect(screen.getByText("Ann Lee").closest("a")).toBeNull();
    });

    it("without words (the cleaned layer) the turns get the turn-level state", () => {
        player.playing = true;

        player.positionMs = 11_000;

        render(<TranscriptTurns qaStartMs={null} view={view} />);

        expect(stateOf("Ann Lee")).toBe("spoken");

        expect(stateOf("Bo Chan")).toBe("active");

        expect(screen.getByText("Thanks for taking my question")).toBeInTheDocument();
    });
});

const TAB_EVENT = { event_id: "e1", fiscal_quarter: 3, fiscal_year: 2027, has_audio: true, symbol: "NVDA" };

function tabProps(search: Record<string, unknown>, onSearchChange = vi.fn(), jump: null | object = null, onTranscriptJumpHandled = vi.fn()) {
    return { event: TAB_EVENT, eventId: "e1", onSearchChange, onTranscriptJumpHandled, search, transcriptJump: jump } as unknown as React.ComponentProps<typeof TranscriptTab>;
}

describe("TranscriptTab", () => {
    beforeEach(() => {
        requests.transcript.length = 0;

        requests.versions = [];

        requests.versionsError = null;

        requests.cleanedError = null;
    });

    it("always reads current cleaned speaker turns, ignoring legacy format and version parameters", () => {
        render(<TranscriptTab {...tabProps({ format: "text", version: 2 })} />);

        expect(requests.transcript).toContainEqual({ eventId: "e1", layer: "cleaned" });

        expect(requests.transcript).not.toContainEqual(expect.objectContaining({ eventId: "e1", words: true }));

        expect(screen.getByText("Ann Lee")).toBeInTheDocument();

        expect(screen.getByText("Good morning everyone")).toBeInTheDocument();

        expect(screen.queryByRole("group", { name: "Transcript format" })).toBeNull();

        expect(screen.queryByRole("button", { name: "Cleaned" })).toBeNull();

        expect(screen.queryByRole("button", { name: /Transcript version/ })).toBeNull();

        expect(screen.queryByRole("button", { name: "Compare" })).toBeNull();

        expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();

        expect(screen.getByText("· 9,000 words")).toBeInTheDocument();
    });

    it("does not wait for the versions list to read the transcript or show its metadata", () => {
        requests.versions = null;

        render(<TranscriptTab {...tabProps({ version: 9 })} />);

        expect(requests.transcript).toContainEqual({ eventId: "e1", layer: "cleaned" });

        expect(screen.getByText("· 9,000 words")).toBeInTheDocument();
    });

    it("uses current raw speaker turns only when the cleaned layer is not found", () => {
        requests.cleanedError = new ApiRequestError(404, { error: "not_found", message: "No cleaned layer" });

        render(<TranscriptTab {...tabProps({})} />);

        expect(requests.transcript).toContainEqual({ eventId: "e1", words: true });

        expect(screen.getByText("Ann Lee")).toBeInTheDocument();
    });

    it("keeps an API refusal visible instead of falling back to raw", () => {
        requests.cleanedError = new ApiRequestError(503, { error: "unavailable", message: "Unavailable" });

        render(<TranscriptTab {...tabProps({})} />);

        expect(requests.transcript).not.toContainEqual(expect.objectContaining({ eventId: "e1", words: true }));

        expect(screen.getByText("Media temporarily unavailable")).toBeInTheDocument();
    });

    it("a timestamp jump locates a turn without changing the format", () => {
        const onSearchChange = vi.fn();

        const handled = vi.fn();

        render(<TranscriptTab {...tabProps({ format: "text" }, onSearchChange, { fromLink: true, ms: 0, nonce: 1 }, handled)} />);

        expect(onSearchChange).not.toHaveBeenCalled();

        expect(handled).toHaveBeenCalled();

        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
});

describe("useFollowScroll", () => {
    function setup(enabled: boolean) {
        const container = document.createElement("div");

        container.innerHTML = "<div data-follow-index=\"0\"></div><div data-follow-index=\"1\"></div>";

        document.body.append(container);

        const scrolled = vi.fn();

        container.querySelectorAll<HTMLElement>("[data-follow-index]").forEach((node) => {
            node.scrollIntoView = () => scrolled(node.dataset.followIndex);
        });

        const ref = { current: container } as React.RefObject<HTMLElement | null>;

        const hook = renderHook(({ index }) => useFollowScroll({ activeIndex: index, containerRef: ref, enabled }), { initialProps: { index: 0 } });

        return { container, hook, scrolled };
    }

    it("scrolls the active element while Follow is on and the audio plays; the reader's wheel switches Follow off", () => {
        const { container, hook, scrolled } = setup(true);

        expect(scrolled).toHaveBeenLastCalledWith("0");

        hook.rerender({ index: 1 });

        expect(scrolled).toHaveBeenLastCalledWith("1");

        act(() => {
            window.dispatchEvent(new WheelEvent("wheel"));
        });

        expect(player.setFollow).toHaveBeenCalledWith(false);

        container.remove();
    });

    it("in a timed turn follows the heard word's line, not the turn's middle", () => {
        const container = document.createElement("div");

        container.innerHTML = "<div data-follow-index=\"0\"><span data-word-index=\"0\"></span><span data-word-index=\"1\"></span></div>";

        document.body.append(container);

        const turn = container.querySelector<HTMLElement>("[data-follow-index]")!;

        const centred = vi.fn();

        turn.scrollIntoView = centred;

        const word = container.querySelector<HTMLElement>("[data-word-index=\"1\"]")!;

        word.getBoundingClientRect = () => ({ bottom: 1520, top: 1500 }) as DOMRect;

        const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});

        const ref = { current: container } as React.RefObject<HTMLElement | null>;

        renderHook(() => useFollowScroll({ activeIndex: 0, activeWord: 1, containerRef: ref }));

        expect(centred).not.toHaveBeenCalled();

        expect(scrollBy).toHaveBeenCalledWith({ behavior: "smooth", top: followWordDelta({ bottom: 1520, insetTop: 0, top: 1500, viewportHeight: window.innerHeight }) });

        scrollBy.mockRestore();

        container.remove();
    });

    it("followWordDelta: nothing inside the band, else the line back to 30 % below the pinned bars", () => {
        expect(followWordDelta({ bottom: 420, insetTop: 200, top: 400, viewportHeight: 1000 })).toBe(0);

        // Below the band (65 % of 800 under a 200 px inset = 720): back to 200 + 240 = 440.
        expect(followWordDelta({ bottom: 900, insetTop: 200, top: 880, viewportHeight: 1000 })).toBe(440);

        // Above the band, under the pinned bars: scrolls up.
        expect(followWordDelta({ bottom: 120, insetTop: 200, top: 100, viewportHeight: 1000 })).toBe(-340);
    });

    it("ignores Space and arrow keys on a control; a PageDown counts", () => {
        const { container } = setup(true);

        const slider = document.createElement("div");

        slider.setAttribute("role", "slider");

        container.append(slider);

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

            slider.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
        });

        expect(player.setFollow).not.toHaveBeenCalled();

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
        });

        expect(player.setFollow).toHaveBeenCalledWith(false);

        container.remove();
    });

    it("a press on the page's scrollbar switches Follow off; a press in the page does not", () => {
        const { container } = setup(true);

        Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1000 });

        act(() => {
            container.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 1005, clientY: 10 }));
        });

        expect(player.setFollow).not.toHaveBeenCalled();

        act(() => {
            document.documentElement.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 1005, clientY: 10 }));
        });

        expect(player.setFollow).toHaveBeenCalledWith(false);

        container.remove();
    });

    it("keeps Follow on for a touch drag on the seek bar and a wheel inside an open menu; a page touch scroll counts", () => {
        const { container } = setup(true);

        const slider = document.createElement("div");

        slider.setAttribute("role", "slider");

        const menu = document.createElement("div");

        menu.setAttribute("role", "menu");

        container.append(slider, menu);

        act(() => {
            slider.dispatchEvent(new Event("touchmove", { bubbles: true }));

            menu.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        });

        expect(player.setFollow).not.toHaveBeenCalled();

        act(() => {
            container.dispatchEvent(new Event("touchmove", { bubbles: true }));
        });

        expect(player.setFollow).toHaveBeenCalledWith(false);

        container.remove();
    });

    it("neither scrolls nor listens while paused or with Follow off", () => {
        const paused = setup(false);

        expect(paused.scrolled).not.toHaveBeenCalled();

        act(() => {
            window.dispatchEvent(new WheelEvent("wheel"));
        });

        expect(player.setFollow).not.toHaveBeenCalled();

        paused.container.remove();
    });
});

const PAIR: V2QaPair = {
    analyst: { firm: "Acme Securities", name: "Bo Chan", person_id: "6f1c2d3e-0000-4000-8000-000000000001", speaker_label: "B" },
    answer: "We are confident.",
    answer_end_ms: 30_000,
    answer_start_ms: 20_000,
    answers: [{ name: "Ann Lee", person_id: null, speaker_label: "A", title: "CEO" }],
    is_follow_up: false,
    question: "What about margins?",
    question_end_ms: 19_000,
    question_start_ms: 12_000,
    scores: {
        analyst_casting_order: 2,
        difficulty: 0.72,
        evasiveness: 0.38,
        evidence: { difficulty: ["what gives you the confidence"], evasiveness: ["we feel confident"], non_answer: null },
        non_answer: false,
        question_tone: null,
        scored_by: "model@rubric-v1",
    },
    seq: 1,
};

describe("Q&A", () => {
    it("cuts each question and answer out of the words transcript by its ms range", () => {
        const all = words(0, Array.from({ length: 40 }, (_, index) => `w${index}`));

        const [question, answer] = qaSegments([PAIR], all);

        expect(question.words?.map(word => word.text)).toEqual(["w12", "w13", "w14", "w15", "w16", "w17", "w18"]);

        expect(answer.words?.at(0)?.text).toBe("w20");

        expect(answer.words?.at(-1)?.text).toBe("w29");

        expect(answer.endMs).toBe(30_000);

        // Before the recording is in: no words, plain text.
        expect(qaSegments([PAIR], [])[0].words).toBeNull();
    });

    it("shows the scores as badges; absent scores render nothing; the raw person id is never printed", () => {
        const { container, rerender } = render(<QaScoreBadges scores={PAIR.scores} />);

        expect(screen.getByText("Difficulty 0.72")).toBeInTheDocument();

        expect(screen.getByText("Evasiveness 0.38")).toBeInTheDocument();

        expect(screen.queryByText(/Non-answer/)).toBeNull();

        expect(container.textContent).not.toContain(PAIR.analyst.person_id);

        rerender(<QaScoreBadges scores={null} />);

        expect(container).toBeEmptyDOMElement();
    });
});
