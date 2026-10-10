import type { TranscriptTurn } from "@/lib/earnings/transcript";

/**
 * Following a recording with its text, pure: the `format=words` transcript on ONE clock and
 * the turn / word the player is on. A port of the admin console's `caption-line.ts`
 * (`../invinite/admin-dashboard/src/components/earnings-calls/caption-line.ts`, keep in step)
 * over the API's compact words (`w`, `s` = start ms, `e` = end ms).
 */

/** One word of `format=words` (IDA `CompactWord`). */
export type TranscriptWord = { c: null | number; e: null | number; s: null | number; w: string };

/** One turn of `format=words` (IDA `WordTurn`). */
export type WordTurn = TranscriptTurn & { words: Array<TranscriptWord> };

/** A word on the call clock, as the caption line and the follow view render it. */
export type TimedWord = {
    /** Call ms; an untimed word is spread over its turn (an approximation, never shown as more). */
    startMs: number;
    text: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function toWord(value: unknown): null | TranscriptWord {
    if (!isRecord(value) || typeof value.w !== "string") return null;

    return { c: numberOrNull(value.c), e: numberOrNull(value.e), s: numberOrNull(value.s), w: value.w };
}

function toWordTurn(value: unknown): null | WordTurn {
    if (!isRecord(value) || typeof value.text !== "string") return null;

    const words = Array.isArray(value.words) ? value.words.map(toWord).filter((word): word is TranscriptWord => word !== null) : [];

    return {
        name: stringOrNull(value.name),
        role: stringOrNull(value.role),
        speaker_label: typeof value.speaker_label === "string" ? value.speaker_label : "",
        start_ms: numberOrNull(value.start_ms),
        text: value.text,
        title: stringOrNull(value.title),
        words,
    };
}

/** Narrows a `format=words` answer's `data`; unreadable → `[]`. */
export function toWordTurns(data: unknown): Array<WordTurn> {
    if (!Array.isArray(data)) return [];

    return data.map(toWordTurn).filter((turn): turn is WordTurn => turn !== null);
}

/**
 * The words of one turn on the call clock. Timed words keep their own start; a turn whose
 * words are not all timed is spread evenly from its start to `endMs` (the next turn's start),
 * so the line keeps moving through it instead of stalling. A turn without a start is untimed:
 * `null` (it is read, never followed).
 */
export function timedWordsOf(turn: WordTurn, endMs: null | number): Array<TimedWord> | null {
    if (turn.start_ms === null) return null;

    const words = turn.words.length > 0 ? turn.words : turn.text.split(/\s+/).map(w => ({ c: null, e: null, s: null, w }));

    const kept = words.filter(word => word.w.trim() !== "");

    if (kept.every(word => word.s !== null)) {
        return kept.map(word => ({ startMs: word.s as number, text: word.w.trim() }));
    }

    const spanMs = Math.max(0, (endMs ?? turn.start_ms) - turn.start_ms);

    const stepMs = kept.length > 0 ? spanMs / kept.length : 0;

    return kept.map((word, index) => ({ startMs: Math.round((turn.start_ms as number) + index * stepMs), text: word.w.trim() }));
}

/** A caption word: the turn's speaker on its first word, so the line can say who speaks. */
export type CaptionWord = TimedWord & { speakerName: null | string };

/** Every timed word of the call in one ascending list; untimed turns are left out. */
export function buildCaptionWords(
    turns: ReadonlyArray<WordTurn>,
    speakerNameOf: (turn: WordTurn) => string,
): Array<CaptionWord> {
    const words: Array<CaptionWord> = [];

    turns.forEach((turn, index) => {
        const next = turns.slice(index + 1).find(candidate => candidate.start_ms !== null);

        const timed = timedWordsOf(turn, next?.start_ms ?? null);

        if (timed === null) return;

        timed.forEach((word, wordIndex) => {
            words.push({ ...word, speakerName: wordIndex === 0 ? speakerNameOf(turn) : null });
        });
    });

    // Stable: a word timed before its own turn's start keeps its reading order.
    return [...words].sort((left, right) => left.startMs - right.startMs);
}

/** Index of the last entry starting at or before `positionMs`; `-1` before the first one. */
export function indexAt(entries: ReadonlyArray<{ startMs: number }>, positionMs: number): number {
    let low = 0;

    let high = entries.length - 1;

    let found = -1;

    while (low <= high) {
        const middle = (low + high) >>> 1;

        if (entries[middle].startMs <= positionMs) {
            found = middle;

            low = middle + 1;
        }
        else {
            high = middle - 1;
        }
    }

    return found;
}

/**
 * Index of the turn being heard at `positionMs`: the last timed turn starting at or before it;
 * `-1` before the first timed turn (untimed turns never match).
 */
export function activeTurnIndex(turns: ReadonlyArray<Pick<TranscriptTurn, "start_ms">>, positionMs: number): number {
    let found = -1;

    turns.forEach((turn, index) => {
        if (turn.start_ms !== null && turn.start_ms <= positionMs) found = index;
    });

    return found;
}

/** Words rendered per chunk; the window holds the chunk before, the active one and the one after. */
export const CAPTION_CHUNK = 40;

/**
 * The rendered slice `[start, end)` around `activeIndex`. It moves in whole chunks, so between
 * two chunk boundaries the DOM stays put and the line can glide by transform.
 */
export function captionWindow(activeIndex: number, total: number): { end: number; start: number } {
    const chunk = Math.floor(Math.max(0, activeIndex) / CAPTION_CHUNK);

    const start = Math.max(0, (chunk - 1) * CAPTION_CHUNK);

    return { end: Math.min(total, start + CAPTION_CHUNK * 3), start };
}
