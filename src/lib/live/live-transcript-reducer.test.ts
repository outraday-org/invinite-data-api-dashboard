import { describe, expect, it } from "vitest";

import type {
    LiveSegment,
    LiveSpeakerAssignment,
    LiveTranscriptState,
} from "./live-transcript-reducer";

import {
    assignmentAt,
    GAP_REFETCH_DELAY_MS,
    INITIAL_LIVE_TRANSCRIPT,
    liveTranscriptReducer,
    liveTurns,
    revealedText,
} from "./live-transcript-reducer";

function segment(seq: number, text = `s${seq}`, speakerLabel: null | string = "A"): LiveSegment {
    return { endMs: seq * 1000 + 900, seq, speakerLabel, startMs: seq * 1000, text };
}

function apply(state: LiveTranscriptState, ...actions: Array<Parameters<typeof liveTranscriptReducer>[1]>) {
    return actions.reduce(liveTranscriptReducer, state);
}

describe("live-transcript-reducer", () => {
    it("dedupes backlog + pushed finals by seq", () => {
        const state = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 0, ended: false, kind: "backlog", lastSeq: 1, segments: [segment(0), segment(1)] },
            { atMs: 0, kind: "final", segment: segment(1, "again") },
            { atMs: 0, kind: "final", segment: segment(2) },
            { atMs: 0, ended: false, kind: "backlog", lastSeq: 3, segments: [segment(2, "dup"), segment(3)] },
        );

        expect(state.finals.map(final => final.seq)).toStrictEqual([0, 1, 2, 3]);

        expect(state.finals[1].text).toBe("s1");

        expect(state.lastSeq).toBe(3);

        expect(state.refetchAfterSeq).toBeNull();
    });

    it("replaces a partial by its final, and the partial never survives it", () => {
        const withPartial = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 0, kind: "final", segment: segment(0) },
            { atMs: 0, kind: "partial", segment: segment(1, "and rev") },
        );

        expect(withPartial.partials.map(piece => piece.text)).toStrictEqual(["and rev"]);

        const finalised = apply(withPartial, { atMs: 0, kind: "final", segment: segment(1, "and revenue grew") });

        expect(finalised.partials).toStrictEqual([]);

        expect(finalised.finals.at(-1)?.text).toBe("and revenue grew");

        // A late copy of the same partial, after its final, does not come back.
        expect(apply(finalised, { atMs: 0, kind: "partial", segment: segment(1, "and rev") }).partials).toStrictEqual(
            [],
        );
    });

    it("ignores an out-of-order OLDER partial", () => {
        const state = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 0, kind: "final", segment: segment(0) },
            { atMs: 0, kind: "partial", segment: segment(2, "newer") },
            { atMs: 0, kind: "partial", segment: segment(1, "older") },
        );

        expect(state.partials.map(piece => piece.text)).toStrictEqual(["newer"]);
    });

    it("keeps every speaker's piece of one partial seq, and their final clears them all", () => {
        // One provider message split by speaker: two pieces, ONE seq (capture/live-stt.ts).
        const pieceA = { endMs: 2_000, seq: 1, speakerLabel: "A", startMs: 1_000, text: "Thank you." };

        const pieceB = { endMs: 4_000, seq: 1, speakerLabel: "B", startMs: 2_100, text: "Next question" };

        const withPieces = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 0, kind: "final", segment: segment(0, "Welcome.", "A") },
            { atMs: 10, kind: "partial", segment: pieceB },
            { atMs: 10, kind: "partial", segment: pieceA },
            // The same label's newer piece replaces only that label's piece.
            { atMs: 20, kind: "partial", segment: { ...pieceB, text: "Next question comes from" } },
        );

        expect(withPieces.partials.map(piece => [piece.speakerLabel, piece.text])).toStrictEqual([
            ["A", "Thank you."],
            ["B", "Next question comes from"],
        ]);

        expect(withPieces.lastPartialAt).toBe(20);

        expect(liveTurns(withPieces).map(turn => [turn.speakerLabel, turn.text, turn.partialText])).toStrictEqual([
            ["A", "Welcome.", "Thank you."],
            ["B", "", "Next question comes from"],
        ]);

        const finalised = apply(withPieces, { atMs: 30, kind: "final", segment: segment(1, "Thank you.", "A") });

        expect(finalised.partials).toStrictEqual([]);

        expect(liveTurns(finalised).every(turn => turn.partialText === null)).toBe(true);

        // A newer seq starts over: the older seq's pieces go.
        const newer = apply(withPieces, {
            atMs: 40,
            kind: "partial",
            segment: { ...pieceA, seq: 2, text: "Go ahead." },
        });

        expect(newer.partials.map(piece => [piece.seq, piece.text])).toStrictEqual([[2, "Go ahead."]]);
    });

    it("asks for exactly ONE backlog refetch when a final's seq skips", () => {
        const gapped = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 0, ended: false, kind: "backlog", lastSeq: 1, segments: [segment(0), segment(1)] },
            { atMs: 0, kind: "final", segment: segment(4) },
        );

        expect(gapped.refetchAfterSeq).toBe(1);

        // A second gap while the first request is outstanding does not re-ask.
        const again = apply(gapped, { atMs: 0, kind: "final", segment: segment(6) });

        expect(again.refetchAfterSeq).toBe(1);

        const filled = apply(again, {
            atMs: 0,
            ended: false,
            kind: "backlog",
            lastSeq: 6,
            segments: [segment(2), segment(3), segment(4), segment(5), segment(6)],
        });

        expect(filled.refetchAfterSeq).toBeNull();

        expect(filled.lastSeq).toBe(6);

        expect(filled.finals.map(final => final.seq)).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it("asks for the backlog after a reconnect", () => {
        const state = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 0, kind: "final", segment: segment(0) },
            { kind: "resync" },
        );

        expect(state.refetchAfterSeq).toBe(0);
    });

    it("groups consecutive same-speaker finals into turns, with the partial as a greyed tail", () => {
        const state = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 0, kind: "final", segment: segment(0, "Good afternoon", "A") },
            { atMs: 0, kind: "final", segment: segment(1, "and welcome.", null) },
            { atMs: 0, kind: "final", segment: segment(2, "Thanks.", "B") },
            { atMs: 0, kind: "partial", segment: segment(3, "Our revenue", "B") },
        );

        const turns = liveTurns(state);

        expect(turns.map(turn => [turn.speakerLabel, turn.text, turn.partialText])).toStrictEqual([
            ["A", "Good afternoon and welcome.", null],
            ["B", "Thanks.", "Our revenue"],
        ]);
    });
});

/** Finals 0..40 from the initial backlog: the state a mid-call relaunch meets. */
function loaded(upTo = 40): LiveTranscriptState {
    return apply(INITIAL_LIVE_TRANSCRIPT, {
        atMs: 1_000,
        ended: false,
        kind: "backlog",
        lastSeq: upTo,
        segments: Array.from({ length: upTo + 1 }, (_unused, seq) => segment(seq)),
    });
}

describe("seq gaps (capture-resilience task 7: a relaunched attempt skips 1,000 numbers)", () => {
    it("1. a new-attempt jump asks ONE delayed backlog, which confirms it", () => {
        const jumped = apply(loaded(), { atMs: 50_000, kind: "final", segment: segment(1_041) });

        expect(jumped.gapRefetch).toStrictEqual({ afterSeq: 40, notBeforeMs: 50_000 + GAP_REFETCH_DELAY_MS });

        expect(jumped.refetchAfterSeq).toBe(40);

        // More finals of the new attempt while the request waits: no second request.
        const more = apply(jumped, { atMs: 50_400, kind: "final", segment: segment(1_042) });

        expect(more.gapRefetch).toBe(jumped.gapRefetch);

        const confirmed = apply(more, {
            atMs: 51_600,
            ended: false,
            forGap: true,
            kind: "backlog",
            lastSeq: 1_041,
            segments: [segment(1_041)],
        });

        expect(confirmed.lastSeq).toBe(1_042);

        expect(confirmed.gapRefetch).toBeNull();

        expect(confirmed.refetchAfterSeq).toBeNull();
    });

    it("2. a gap backlog that finds nothing inside the gap accepts it; the next final asks nothing", () => {
        const accepted = apply(
            loaded(),
            { atMs: 50_000, kind: "final", segment: segment(1_041) },
            { atMs: 51_600, ended: false, forGap: true, kind: "backlog", lastSeq: 40, segments: [] },
        );

        expect(accepted.lastSeq).toBe(1_041);

        expect(accepted.gapRefetch).toBeNull();

        expect(accepted.refetchAfterSeq).toBeNull();

        const next = apply(accepted, { atMs: 52_000, kind: "final", segment: segment(1_042) });

        expect(next.lastSeq).toBe(1_042);

        expect(next.refetchAfterSeq).toBeNull();

        expect(next.gapRefetch).toBeNull();
    });

    it("3. a real hole (41 missing, 42 present) asks once and is filled from the backlog or a re-publish", () => {
        const holed = apply(loaded(), { atMs: 50_000, kind: "final", segment: segment(42) });

        expect(holed.gapRefetch?.afterSeq).toBe(40);

        const filled = apply(holed, {
            atMs: 51_600,
            ended: false,
            forGap: true,
            kind: "backlog",
            lastSeq: 42,
            segments: [segment(41), segment(42)],
        });

        expect(filled.finals.map(final => final.seq).slice(-3)).toStrictEqual([40, 41, 42]);

        expect(filled.lastSeq).toBe(42);

        expect(filled.gapRefetch).toBeNull();

        // The database did not have 41 yet: the backlog's own lastSeq moves past the
        // hole, and task 14's re-publish fills it later without a request.
        const passed = apply(holed, {
            atMs: 51_600,
            ended: false,
            forGap: true,
            kind: "backlog",
            lastSeq: 42,
            segments: [segment(42)],
        });

        const republished = apply(passed, { atMs: 60_000, kind: "final", segment: segment(41, "late") });

        expect(passed.lastSeq).toBe(42);

        expect(republished.finals.find(final => final.seq === 41)?.text).toBe("late");

        expect(republished.refetchAfterSeq).toBeNull();
    });

    it("4. a duplicate after a re-publish is a no-op", () => {
        const state = apply(loaded(), { atMs: 50_000, kind: "final", segment: segment(41) });

        const again = apply(state, { atMs: 80_000, kind: "final", segment: segment(41, "republished") });

        expect(again.finals).toBe(state.finals);

        expect(again.lastFinalAt).toBe(50_000);

        expect(again.refetchAfterSeq).toBeNull();
    });

    it("5. a reconnect's empty backlog never accepts a gap", () => {
        const jumped = apply(loaded(), { atMs: 50_000, kind: "final", segment: segment(1_041) });

        const resynced = apply(jumped, { kind: "resync" });

        // Immediate, not delayed: the pending gap request is dropped.
        expect(resynced.gapRefetch).toBeNull();

        expect(resynced.refetchAfterSeq).toBe(40);

        const empty = { atMs: 50_500, ended: false, kind: "backlog", lastSeq: 40, segments: [] } as const;

        expect(apply(resynced, empty).lastSeq).toBe(40);

        // Even a gap answer that lands after the reconnect is read as an ordinary backlog.
        expect(apply(resynced, { ...empty, forGap: true }).lastSeq).toBe(40);
    });

    it("6. lastFinalAt: set by a pushed final, not by the initial backlog, by a later backlog that added finals", () => {
        expect(loaded().lastFinalAt).toBeNull();

        const pushed = apply(loaded(), { atMs: 70_000, kind: "final", segment: segment(41) });

        expect(pushed.lastFinalAt).toBe(70_000);

        const polled = apply(loaded(), {
            atMs: 73_000,
            ended: false,
            kind: "backlog",
            lastSeq: 41,
            segments: [segment(41)],
        });

        const nothingNew = apply(polled, { atMs: 76_000, ended: false, kind: "backlog", lastSeq: 41, segments: [] });

        expect(polled.lastFinalAt).toBe(73_000);

        expect(nothingNew.lastFinalAt).toBe(73_000);
    });
});

describe("provisional live speaker names (live-call-quality task 8)", () => {
    function named(
        speakerLabel: string,
        fromSeq: number,
        toSeq: null | number,
        name: string,
        overrides: Partial<LiveSpeakerAssignment> = {},
    ): LiveSpeakerAssignment {
        return {
            confidence: 0.9,
            firm: null,
            fromSeq,
            name,
            role: "executive",
            source: "question_cue",
            speakerLabel,
            title: null,
            toSeq,
            ...overrides,
        };
    }

    const OPERATOR = named("spk00", 0, null, "Operator", { confidence: 0.95, role: "operator", source: "operator" });

    const ANALYST = named("spk03", 0, null, "Lauren Lieberman", { firm: "Barclays", role: "analyst" });

    it("keeps the snapshot with the higher revision and ignores a lower or equal one", () => {
        const newer = { assignments: [OPERATOR, ANALYST], revision: 2_000 };

        const older = { assignments: [OPERATOR], revision: 1_000 };

        const state = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { kind: "speakerNames", names: newer },
            { kind: "speakerNames", names: older },
            { kind: "speakerNames", names: { assignments: [], revision: 2_000 } },
        );

        expect(state.speakerNames).toBe(newer);
    });

    it("takes the backlog's names at its request time; a later push wins, an older push does not", () => {
        const fromBacklog = { assignments: [OPERATOR], revision: 5_000 };

        const afterBacklog = apply(INITIAL_LIVE_TRANSCRIPT, {
            atMs: 5_100,
            ended: false,
            kind: "backlog",
            lastSeq: 0,
            segments: [segment(0, "Welcome.", "spk00")],
            speakerNames: fromBacklog,
        });

        expect(afterBacklog.speakerNames).toBe(fromBacklog);

        expect(apply(afterBacklog, { kind: "speakerNames", names: { assignments: [], revision: 4_000 } }).speakerNames).toBe(
            fromBacklog,
        );

        const pushed = { assignments: [OPERATOR, ANALYST], revision: 6_000 };

        expect(apply(afterBacklog, { kind: "speakerNames", names: pushed }).speakerNames).toBe(pushed);

        // A backlog without names (an older pipeline) leaves them alone.
        expect(
            apply(afterBacklog, { atMs: 7_000, ended: false, kind: "backlog", lastSeq: 0, segments: [] }).speakerNames,
        ).toBe(fromBacklog);
    });

    it("keeps the newest partial time across a backlog", () => {
        const state = apply(
            INITIAL_LIVE_TRANSCRIPT,
            { atMs: 1_234, kind: "partial", segment: segment(0, "Wel") },
            { atMs: 2_000, ended: false, kind: "backlog", lastSeq: -1, segments: [] },
        );

        expect(state.lastPartialAt).toBe(1_234);
    });

    it("names a turn from the assignment covering its FIRST seq; no assignment stays unnamed", () => {
        const finals = [
            segment(0, "Welcome to the call.", "spk00"),
            segment(1, "Thank you, operator.", "spk01"),
            segment(2, "Our first question.", "spk00"),
        ];

        const turns = liveTurns({ finals, partials: [] }, [named("spk00", 0, null, "Operator")]);

        expect(turns.map(turn => [turn.speakerLabel, turn.speaker?.name ?? null])).toStrictEqual([
            ["spk00", "Operator"],
            ["spk01", null],
            ["spk00", "Operator"],
        ]);

        expect(liveTurns({ finals, partials: [] }).every(turn => turn.speaker === null)).toBe(true);
    });

    it("splits one label's consecutive finals where its assignment changes (label drift)", () => {
        const finals = [
            segment(10, "Thanks, Lauren.", "spk03"),
            segment(11, "Revenue grew.", "spk03"),
            segment(12, "Your line is open.", "spk03"),
            segment(13, "Hi, thanks.", "spk03"),
        ];

        const assignments = [
            named("spk03", 10, 11, "Steve Smith", { source: "hand_off", title: "CFO" }),
            named("spk03", 12, 12, "Operator", { role: "operator", source: "operator" }),
            named("spk03", 13, null, "Lauren Lieberman", { firm: "Barclays", role: "analyst", source: "llm" }),
        ];

        const turns = liveTurns({ finals, partials: [] }, assignments);

        expect(turns.map(turn => [turn.key, turn.speaker?.name, turn.text])).toStrictEqual([
            ["turn-10", "Steve Smith", "Thanks, Lauren. Revenue grew."],
            ["turn-12", "Operator", "Your line is open."],
            ["turn-13", "Lauren Lieberman", "Hi, thanks."],
        ]);

        expect(turns[2].speaker).toStrictEqual({
            confidence: 0.9,
            firm: "Barclays",
            name: "Lauren Lieberman",
            role: "analyst",
            source: "llm",
            title: null,
        });
    });

    it("a label-less final continues the turn; a partial of a new range starts its own named turn", () => {
        const assignments = [
            named("spk01", 0, 1, "Steve Smith", { title: "CFO" }),
            named("spk01", 2, null, "Operator", { role: "operator", source: "operator" }),
        ];

        const turns = liveTurns(
            { finals: [segment(0, "Revenue grew.", "spk01"), segment(1, "And margins.", null)], partials: [segment(2, "Next", "spk01")] },
            assignments,
        );

        expect(turns.map(turn => [turn.speaker?.name, turn.text, turn.partialText])).toStrictEqual([
            ["Steve Smith", "Revenue grew. And margins.", null],
            ["Operator", "", "Next"],
        ]);
    });

    it("prefers the stronger of two rows covering one seq", () => {
        const assignments = [
            named("spk02", 0, null, "Guess Name", { confidence: 0.6, source: "llm" }),
            named("spk02", 5, null, "Steve Smith", { confidence: 0.95, source: "self_introduction" }),
        ];

        expect(assignmentAt(assignments, "spk02", 6)?.name).toBe("Steve Smith");

        expect(assignmentAt(assignments, "spk02", 3)?.name).toBe("Guess Name");

        expect(assignmentAt(assignments, null, 6)).toBeNull();
    });
});

describe("revealed text (the live player synced to the audio)", () => {
    it("spreads a segment's words evenly over its time", () => {
        expect(revealedText("one two three four", 1_000, 5_000, 500)).toBe("");

        expect(revealedText("one two three four", 1_000, 5_000, 1_000)).toBe("");

        expect(revealedText("one two three four", 1_000, 5_000, 2_000)).toBe("one");

        expect(revealedText("one two three four", 1_000, 5_000, 3_999)).toBe("one two");

        expect(revealedText("one two three four", 1_000, 5_000, 5_000)).toBe("one two three four");

        expect(revealedText("one  two", 1_000, 1_000, 1_000)).toBe("one  two");
    });

    it("holds finals and partial pieces back to the position, opening no empty turn", () => {
        const state = {
            finals: [segment(0, "zero zero", "A"), segment(1, "one one", "A"), segment(5, "five five", "B")],
            partials: [{ ...segment(6, "six six six", "B"), endMs: 6_600, startMs: 6_000 }],
        };

        expect(liveTurns(state, [], 950).map(turn => [turn.text, turn.partialText])).toStrictEqual([["zero zero", null]]);

        // Inside final 1 (1,000–1,900): half its words; the B turn has nothing yet.
        expect(liveTurns(state, [], 1_450).map(turn => [turn.text, turn.partialText])).toStrictEqual([
            ["zero zero one", null],
        ]);

        expect(liveTurns(state, [], 6_200).map(turn => [turn.text, turn.partialText])).toStrictEqual([
            ["zero zero one one", null],
            ["five five", "six"],
        ]);

        // No position: everything, as before.
        expect(liveTurns(state).map(turn => [turn.text, turn.partialText])).toStrictEqual([
            ["zero zero one one", null],
            ["five five", "six six six"],
        ]);
    });
});
