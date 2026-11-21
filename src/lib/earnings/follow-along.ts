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
        person_id: stringOrNull(value.person_id),
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

/** `timedWordsOf` of every turn, each spread to the next timed turn's start. */
export function timedWordsOfTurns(turns: ReadonlyArray<WordTurn>): Array<Array<TimedWord> | null> {
    return turns.map((turn, index) => {
        const next = turns.slice(index + 1).find(candidate => candidate.start_ms !== null);

        return timedWordsOf(turn, next?.start_ms ?? null);
    });
}

/** A caption word: the turn's speaker on its first word, so the line can say who speaks. */
export type CaptionWord = TimedWord & { speakerName: null | string };

/** Every timed word of the call in one ascending list; untimed turns are left out. */
export function buildCaptionWords(
    turns: ReadonlyArray<WordTurn>,
    speakerNameOf: (turn: WordTurn) => string,
): Array<CaptionWord> {
    const words: Array<CaptionWord> = [];

    timedWordsOfTurns(turns).forEach((timed, index) => {
        timed?.forEach((word, wordIndex) => {
            words.push({ ...word, speakerName: wordIndex === 0 ? speakerNameOf(turns[index]) : null });
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

/**
 * How a turn reads against the player: `idle` = paused or nothing loaded (full text, nothing faded), else what was
 * said (`spoken`), the turn being heard (`active`) and what comes next (`upcoming`, faded).
 */
export type TurnPlaybackState = "active" | "idle" | "spoken" | "upcoming";

/**
 * One block of a played list (a transcript turn, a Q&A question or answer): where it starts, optionally where it ends
 * (a Q&A block: between two pairs nothing is heard), and its timed words (null = turn-level state only).
 */
export type PlaybackSegment = { endMs?: null | number; startMs: null | number; words: Array<TimedWord> | null };

/** The segment the position falls in: the last timed one starting at or before it; `within` = before its end. */
export type HeardSegment = { index: number; within: boolean };

export function heardSegment(segments: ReadonlyArray<PlaybackSegment>, positionMs: number): HeardSegment {
    let index = -1;

    segments.forEach((segment, at) => {
        if (segment.startMs !== null && segment.startMs <= positionMs) index = at;
    });

    if (index < 0) return { index, within: false };

    const endMs = segments[index].endMs;

    return { index, within: endMs === null || endMs === undefined || positionMs < endMs };
}

/**
 * A segment's state: `idle` while paused (or untimed: it is read, never followed); else spoken before the heard one,
 * `active` for the heard one while the position is inside it (past its end it reads as spoken), upcoming after it.
 */
export function segmentState(segment: Pick<PlaybackSegment, "startMs">, index: number, heard: HeardSegment, playing: boolean): TurnPlaybackState {
    if (!playing || segment.startMs === null) return "idle";

    if (index < heard.index) return "spoken";

    if (index === heard.index) return heard.within ? "active" : "spoken";

    return "upcoming";
}

/**
 * The words of `[startMs, endMs)` out of one ascending list (a Q&A question or answer cut from the words transcript);
 * `null` without a start, or when no word falls inside (the block then renders its own text, turn-level).
 */
export function wordsBetween(words: ReadonlyArray<TimedWord>, startMs: null | number, endMs: null | number): Array<TimedWord> | null {
    if (startMs === null || words.length === 0) return null;

    const from = indexAt(words, startMs - 1) + 1;

    const to = endMs === null ? words.length : indexAt(words, endMs - 1) + 1;

    const slice = words.slice(from, Math.max(from, to));

    return slice.length > 0 ? slice : null;
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
