import { describe, expect, it } from "vitest";

import { qaStartTurnIndex, speakerName, toTranscriptView, transcriptPlainText, turnIndexAt } from "./transcript";

const TURN = {
    end_ms: 4200,
    name: "Tim Cook",
    person_id: null,
    role: "management",
    speaker_label: "A",
    start_ms: 1000,
    text: "Good afternoon.",
    title: "CEO",
};

describe("toTranscriptView", () => {
    it("reads speaker turns and drops unreadable entries", () => {
        const view = toTranscriptView("speakers", [TURN, { speaker_label: "B" }, 3]);

        expect(view).toEqual({
            kind: "turns",
            turns: [{ name: "Tim Cook", role: "management", speaker_label: "A", start_ms: 1000, text: "Good afternoon.", title: "CEO" }],
        });
    });

    it("keeps a null start (company-published transcript)", () => {
        const view = toTranscriptView("cleaned", [{ ...TURN, start_ms: null }]);

        expect(view.kind === "turns" && view.turns[0]?.start_ms).toBeNull();
    });

    it("reads text and sections", () => {
        expect(toTranscriptView("text", "Hello")).toEqual({ kind: "text", text: "Hello" });

        expect(toTranscriptView("sections", { prepared_remarks: "PR", questions_and_answers: null })).toEqual({
            kind: "sections",
            sections: { prepared_remarks: "PR", qa_start_ms: null, questions_and_answers: null },
        });

        expect(toTranscriptView("sections", { prepared_remarks: "PR", qa_start_ms: 1_200_000, questions_and_answers: "QA" })).toEqual({
            kind: "sections",
            sections: { prepared_remarks: "PR", qa_start_ms: 1_200_000, questions_and_answers: "QA" },
        });
    });

    it("is empty for blank or mismatched data", () => {
        expect(toTranscriptView("text", "  ")).toEqual({ kind: "empty" });

        expect(toTranscriptView("speakers", [])).toEqual({ kind: "empty" });

        expect(toTranscriptView("speakers", "text")).toEqual({ kind: "empty" });

        expect(toTranscriptView("sections", { prepared_remarks: null, questions_and_answers: null })).toEqual({ kind: "empty" });
    });
});

describe("transcriptPlainText", () => {
    it("joins turns as Name: text", () => {
        const view = toTranscriptView("speakers", [TURN, { ...TURN, name: null, speaker_label: "B", text: "Thanks." }]);

        expect(transcriptPlainText(view)).toBe("Tim Cook: Good afternoon.\n\nSpeaker B: Thanks.");
    });

    it("labels the sections", () => {
        const view = toTranscriptView("sections", { prepared_remarks: "PR", questions_and_answers: "QA" });

        expect(transcriptPlainText(view)).toBe("Prepared remarks\n\nPR\n\nQ&A\n\nQA");
    });
});

describe("speakerName", () => {
    it("falls back to the label", () => {
        expect(speakerName({ name: null, speaker_label: "C" })).toBe("Speaker C");

        expect(speakerName({ name: null, speaker_label: "" })).toBe("Unknown speaker");
    });
});

describe("turnIndexAt", () => {
    it("picks the turn whose start is the last one at or before the position", () => {
        expect(turnIndexAt([0, 5000, 12_000], 7000)).toBe(1);

        expect(turnIndexAt([0, 5000, 12_000], 12_000)).toBe(2);

        expect(turnIndexAt([0, 5000, 12_000], 99_000)).toBe(2);
    });

    it("falls back to the first turn before every start and to -1 without turns", () => {
        expect(turnIndexAt([3000, 5000], 1000)).toBe(0);

        expect(turnIndexAt([], 1000)).toBe(-1);
    });
});

describe("qaStartTurnIndex", () => {
    const turns = [{ start_ms: 0 }, { start_ms: null }, { start_ms: 60_000 }, { start_ms: 90_000 }];

    it("finds the first timed turn at or after the Q&A start", () => {
        expect(qaStartTurnIndex(turns, 60_000)).toBe(2);

        expect(qaStartTurnIndex(turns, 61_000)).toBe(3);
    });

    it("is -1 without a Q&A start or a turn after it", () => {
        expect(qaStartTurnIndex(turns, null)).toBe(-1);

        expect(qaStartTurnIndex(turns, 120_000)).toBe(-1);
    });
});
