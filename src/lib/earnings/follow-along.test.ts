import { describe, expect, it } from "vitest";

import type { WordTurn } from "./follow-along";

import {
    activeTurnIndex,
    buildCaptionWords,
    CAPTION_CHUNK,
    captionWindow,
    indexAt,
    timedWordsOf,
    toWordTurns,

} from "./follow-along";

const turn = (start_ms: null | number, words: Array<[string, null | number]>, name = "Ann"): WordTurn => ({
    name,
    role: null,
    speaker_label: "A",
    start_ms,
    text: words.map(([w]) => w).join(" "),
    title: null,
    words: words.map(([w, s]) => ({ c: null, e: s === null ? null : s + 100, s, w })),
});

describe("toWordTurns", () => {
    it("narrows the words answer and drops unreadable entries", () => {
        const turns = toWordTurns([
            { name: "Ann", speaker_label: "A", start_ms: 0, text: "hi there", words: [{ c: 0.9, e: 90, s: 0, w: "hi" }, { s: 100, w: "there" }, 5] },
            { text: 7 },
            "nope",
        ]);

        expect(turns).toHaveLength(1);

        expect(turns[0].words).toEqual([{ c: 0.9, e: 90, s: 0, w: "hi" }, { c: null, e: null, s: 100, w: "there" }]);
    });

    it("answers [] for a non-array", () => {
        expect(toWordTurns({ text: "x" })).toEqual([]);
    });
});

describe("timedWordsOf", () => {
    it("keeps the words' own timings", () => {
        expect(timedWordsOf(turn(1000, [["a", 1000], ["b", 1400]]), 5000)).toEqual([
            { startMs: 1000, text: "a" },
            { startMs: 1400, text: "b" },
        ]);
    });

    it("spreads a turn with untimed words over its span", () => {
        expect(timedWordsOf(turn(1000, [["a", null], ["b", 1200], ["c", null], ["d", null]]), 3000)).toEqual([
            { startMs: 1000, text: "a" },
            { startMs: 1500, text: "b" },
            { startMs: 2000, text: "c" },
            { startMs: 2500, text: "d" },
        ]);
    });

    it("falls back to the text when the answer carries no words", () => {
        const bare = { ...turn(0, []), text: "one two" };

        expect(timedWordsOf(bare, 1000)).toEqual([{ startMs: 0, text: "one" }, { startMs: 500, text: "two" }]);
    });

    it("is null for an untimed turn", () => {
        expect(timedWordsOf(turn(null, [["a", null]]), 1000)).toBeNull();
    });
});

describe("buildCaptionWords", () => {
    it("names the speaker on the first word of each turn and keeps the call order", () => {
        const words = buildCaptionWords(
            [turn(0, [["hello", 0], ["all", 300]], "Ann"), turn(null, [["skipped", null]]), turn(1000, [["thanks", 1000]], "Bob")],
            candidate => candidate.name ?? "?",
        );

        expect(words).toEqual([
            { speakerName: "Ann", startMs: 0, text: "hello" },
            { speakerName: null, startMs: 300, text: "all" },
            { speakerName: "Bob", startMs: 1000, text: "thanks" },
        ]);
    });

    it("spreads an untimed turn up to the next timed turn", () => {
        const words = buildCaptionWords([turn(0, [["a", null], ["b", null]]), turn(2000, [["c", 2000]])], () => "x");

        expect(words.map(word => word.startMs)).toEqual([0, 1000, 2000]);
    });
});

describe("indexAt / activeTurnIndex", () => {
    const entries = [{ startMs: 0 }, { startMs: 500 }, { startMs: 1500 }];

    it("finds the last entry at or before the position", () => {
        expect(indexAt(entries, -1)).toBe(-1);

        expect(indexAt(entries, 0)).toBe(0);

        expect(indexAt(entries, 1499)).toBe(1);

        expect(indexAt(entries, 99999)).toBe(2);

        expect(indexAt([], 10)).toBe(-1);
    });

    it("skips untimed turns and is -1 before the first timed one", () => {
        const turns = [{ start_ms: null }, { start_ms: 1000 }, { start_ms: null }, { start_ms: 3000 }];

        expect(activeTurnIndex(turns, 500)).toBe(-1);

        expect(activeTurnIndex(turns, 2999)).toBe(1);

        expect(activeTurnIndex(turns, 3000)).toBe(3);
    });
});

describe("captionWindow", () => {
    it("holds the chunk before, the active one and the one after", () => {
        expect(captionWindow(-1, 500)).toEqual({ end: CAPTION_CHUNK * 3, start: 0 });

        expect(captionWindow(CAPTION_CHUNK * 2 + 3, 500)).toEqual({ end: CAPTION_CHUNK * 4, start: CAPTION_CHUNK });

        expect(captionWindow(490, 500)).toEqual({ end: 500, start: CAPTION_CHUNK * 11 });
    });
});
