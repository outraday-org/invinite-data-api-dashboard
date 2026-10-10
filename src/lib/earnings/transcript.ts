import type { EarningsTranscriptFormat } from "@/lib/api/types";

/** One turn of `format=speakers` / `format=cleaned` (IDA `SpeakerTurn` / `CleanedTurn`). */
export type TranscriptTurn = {
    name: null | string;
    role: null | string;
    speaker_label: string;
    start_ms: null | number;
    text: string;
    title: null | string;
};

/** `format=sections`: the two blocks as text, plus where the Q&A starts (call ms; null = not found / untimed / live). */
export type TranscriptSections = {
    prepared_remarks: null | string;
    qa_start_ms: null | number;
    questions_and_answers: null | string;
};

/** The spec types the transcript's `data` as unknown; this is what the page renders. */
export type TranscriptView
    = | { kind: "empty" }
        | { kind: "sections"; sections: TranscriptSections }
        | { kind: "text"; text: string }
        | { kind: "turns"; turns: Array<TranscriptTurn> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function toTurn(value: unknown): null | TranscriptTurn {
    if (!isRecord(value) || typeof value.text !== "string") return null;

    return {
        name: stringOrNull(value.name),
        role: stringOrNull(value.role),
        speaker_label: typeof value.speaker_label === "string" ? value.speaker_label : "",
        start_ms: numberOrNull(value.start_ms),
        text: value.text,
        title: stringOrNull(value.title),
    };
}

/** Narrows a transcript answer's `data` for its `format`; anything unreadable or blank → `empty`. */
export function toTranscriptView(format: EarningsTranscriptFormat, data: unknown): TranscriptView {
    if (format === "text") {
        return typeof data === "string" && data.trim().length > 0 ? { kind: "text", text: data } : { kind: "empty" };
    }

    if (format === "sections") {
        if (!isRecord(data)) return { kind: "empty" };

        const sections = {
            prepared_remarks: stringOrNull(data.prepared_remarks),
            qa_start_ms: numberOrNull(data.qa_start_ms),
            questions_and_answers: stringOrNull(data.questions_and_answers),
        };

        return sections.prepared_remarks || sections.questions_and_answers
            ? { kind: "sections", sections }
            : { kind: "empty" };
    }

    if (!Array.isArray(data)) return { kind: "empty" };

    const turns = data.map(toTurn).filter((turn): turn is TranscriptTurn => turn !== null);

    return turns.length > 0 ? { kind: "turns", turns } : { kind: "empty" };
}

/** The speaker's name, else the raw label ("Speaker A"). */
export function speakerName(turn: Pick<TranscriptTurn, "name" | "speaker_label">) {
    if (turn.name) return turn.name;

    return turn.speaker_label ? `Speaker ${turn.speaker_label}` : "Unknown speaker";
}

/** Plain text of what is on screen (the copy button): turns as `Name: text`, blank-line separated. */
export function transcriptPlainText(view: TranscriptView): string {
    switch (view.kind) {
        case "empty":
            return "";
        case "sections":
            return [
                view.sections.prepared_remarks ? `Prepared remarks\n\n${view.sections.prepared_remarks}` : null,
                view.sections.questions_and_answers ? `Q&A\n\n${view.sections.questions_and_answers}` : null,
            ].filter(Boolean).join("\n\n");
        case "text":
            return view.text;
        case "turns":
            return view.turns.map(turn => `${speakerName(turn)}: ${turn.text}`).join("\n\n");
    }
}

/**
 * Index of the first turn of the Q&A (the first timed turn starting at or after `qaStartMs`);
 * `-1` when there is no Q&A start or no such turn. The turns view draws its "Q&A" header there.
 */
export function qaStartTurnIndex(turns: ReadonlyArray<Pick<TranscriptTurn, "start_ms">>, qaStartMs: null | number) {
    if (qaStartMs === null) return -1;

    return turns.findIndex(turn => turn.start_ms !== null && turn.start_ms >= qaStartMs);
}

/**
 * Index of the turn that contains `ms`: the last start ≤ `ms` (starts in call order), else
 * the first turn; `-1` for no starts. "Ask this call" scrolls there.
 */
export function turnIndexAt(starts: ReadonlyArray<number>, ms: number) {
    if (starts.length === 0) return -1;

    let found = 0;

    starts.forEach((start, index) => {
        if (start <= ms) found = index;
    });

    return found;
}
