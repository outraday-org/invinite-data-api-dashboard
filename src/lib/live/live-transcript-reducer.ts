/**
 * The live transcript's state, as a PURE reducer. Ported from the admin console
 * (`invinite/admin-dashboard/src/components/earnings-calls/live-transcript-reducer.ts`,
 * with its suite) — keep the two in step. The admin console feeds it a REST backlog + Ably;
 * here `use-live-transcript.ts` feeds it the `/v1/ws` `earnings-calls.live` frames: replayed
 * and live `transcript_segment`s are `final` / `partial`, `speaker_names` is `speakerNames`,
 * and a `backlog` with no segments marks the subscription start, the call's end and an
 * accepted gap (the API already reorders finals and reports each jump as a `gap` frame).
 * The only change to the port: `LiveSpeakerAssignment` is a local type instead of the
 * admin DTO. The rules below mention the admin transport; they hold for the WS one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FOUR RULES, ALL PINNED BY THE SUITE.
 *
 *   1. Finals are keyed by `seq`. The backlog and the push channel deliver the
 *      same final twice around every reconnect; the second copy is a no-op.
 *   2. Partials are the pieces of ONE seq — the newest — keyed by
 *      `(seq, speakerLabel)`. The pipeline sends one partial per provider
 *      utterance with `seq = lastSeq + 1` (`capture/live-stt.ts`), so a provider
 *      message split by speaker yields several pieces with the SAME seq; each
 *      label's piece replaces only that label's piece (PEP 2026-10-08: keeping
 *      the last piece alone left a long multi-label turn showing stale text). A
 *      newer seq replaces all pieces. A piece whose label the provider later
 *      drops stays until the seq's final — there is no message boundary to tell.
 *      The pieces never survive their final: a final with `seq ≥` their seq
 *      removes them all.
 *   3. A partial OLDER than what is already final (or than the current pieces)
 *      is ignored. Ably does not guarantee order across a reconnect, and a
 *      stale partial painted under a newer final would read as text going
 *      backwards.
 *   4. A pushed final whose `seq` skips (`> lastSeq + 1`) asks for ONE backlog
 *      refetch from the last contiguous `seq` (`refetchAfterSeq` +
 *      `gapRefetch`), DELAYED by `GAP_REFETCH_DELAY_MS`, and does not ask again
 *      until that backlog has been applied. The gap may be real (finals missed
 *      while the socket was away) or intentional: a relaunched capture attempt
 *      starts ≥ 1,000 numbers higher (capture-resilience task 7), and its first
 *      final reaches Ably ~1 s before the worker's DB flush — hence the delay.
 *   5. A backlog fetched FOR that gap (`forGap`) that holds nothing inside it
 *      ACCEPTS the gap: the contiguous run continues from the first final
 *      above it, and the next final asks nothing. A reconnect (`resync`) never
 *      accepts a gap — its backlog is not `forGap`, and it cancels a pending
 *      gap request so a late gap answer cannot be read as one.
 *
 * NAMES (live-call-quality task 8). `speakerNames` is the call's provisional live
 * speaker-name SNAPSHOT (`liveEarningsCalls.speakerNames`, or the backlog's
 * `speakerNames`): the one with the higher `revision` wins, a lower or equal one is
 * ignored. A pushed snapshot's revision is its publish time; a backlog's is the moment
 * its (last page's) request started — a snapshot published after that is newer than
 * what the backlog read. `liveTurns` names each turn from it and splits a label's
 * turn where its assignment changes.
 *
 * The reducer never reads the clock: `final` / `partial` / `backlog` carry `atMs`, and
 * `lastFinalAt` (the live player's stalled notice) is the `atMs` of the newest
 * NEW final — a backlog counts only after the initial load, so a call opened
 * mid-way does not look fresh.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** How long a gap waits for the worker's 1-s DB flush before the backlog is asked. */
export const GAP_REFETCH_DELAY_MS = 1_500;

export type LiveSegment = {
    readonly seq: number;
    readonly startMs: number;
    readonly endMs: number;
    readonly speakerLabel: null | string;
    readonly text: string;
};

/**
 * One provisional name of a label over a seq range (`toSeq` null = open) — the camelCase of a
 * `speaker_names` frame's assignment (`toAssignments` in `ws-frames.ts`). `role` and `source`
 * are labels the pipeline owns; `confidence` is 0–1.
 */
export type LiveSpeakerAssignment = {
    readonly speakerLabel: string;
    readonly fromSeq: number;
    readonly toSeq: null | number;
    readonly name: string;
    readonly role: string;
    readonly title: null | string;
    readonly firm: null | string;
    readonly source: string;
    readonly confidence: number;
};

/** A names snapshot: replaced as a whole by one with a higher `revision`. */
export type LiveSpeakerNames = {
    readonly revision: number;
    readonly assignments: ReadonlyArray<LiveSpeakerAssignment>;
};

export type LiveTranscriptState = {
    /** Ascending by `seq`, unique. */
    readonly finals: ReadonlyArray<LiveSegment>;
    /** The newest partial seq's pieces, one per speaker label, ascending by `startMs` (`[]` = none). */
    readonly partials: ReadonlyArray<LiveSegment>;
    /** The highest CONTIGUOUS final `seq` known (`-1` = none). */
    readonly lastSeq: number;
    /** Set when a gap was seen: refetch the backlog after this `seq`. */
    readonly refetchAfterSeq: null | number;
    /** The backlog said the chain stopped producing finals. */
    readonly ended: boolean;
    /** `atMs` of the newest new final (`null` = none arrived since the initial load). */
    readonly lastFinalAt: null | number;
    /** `atMs` of the newest accepted partial piece (`null` = none yet). */
    readonly lastPartialAt: null | number;
    /** A pushed final skipped: ask the backlog after `afterSeq`, not before `notBeforeMs`. */
    readonly gapRefetch: null | { readonly afterSeq: number; readonly notBeforeMs: number };
    /** The first backlog (or its failure) has been applied. */
    readonly initialLoaded: boolean;
    /** The newest provisional speaker-name snapshot (`null` = none yet). */
    readonly speakerNames: LiveSpeakerNames | null;
};

export const INITIAL_LIVE_TRANSCRIPT: LiveTranscriptState = {
    ended: false,
    finals: [],
    gapRefetch: null,
    initialLoaded: false,
    lastFinalAt: null,
    lastPartialAt: null,
    lastSeq: -1,
    partials: [],
    refetchAfterSeq: null,
    speakerNames: null,
};

export type LiveTranscriptAction
    = | {
        readonly kind: "backlog";
        readonly segments: ReadonlyArray<LiveSegment>;
        readonly lastSeq: number;
        readonly ended: boolean;
        readonly atMs: number;
        /** Fetched because of `gapRefetch` (never set for a reconnect's backlog). */
        readonly forGap?: boolean;
        /** The backlog's names; `revision` = when its request started. Absent = it said nothing. */
        readonly speakerNames?: LiveSpeakerNames;
    }
    /** A pushed `liveEarningsCalls.speakerNames` snapshot. */
    | { readonly kind: "backlogFailed" }
    | { readonly kind: "final"; readonly segment: LiveSegment; readonly atMs: number }
    | { readonly kind: "partial"; readonly segment: LiveSegment; readonly atMs: number }
    /** A reconnect: whatever was missed must come from the backlog. */
    | { readonly kind: "reset" }
    /** The asked-for backlog failed: the next gap or reconnect may ask again. */
    | { readonly kind: "resync" }
    | { readonly kind: "speakerNames"; readonly names: LiveSpeakerNames };

function mergeFinals(existing: ReadonlyArray<LiveSegment>, incoming: ReadonlyArray<LiveSegment>): Array<LiveSegment> {
    const bySeq = new Map<number, LiveSegment>();

    for (const segment of existing) bySeq.set(segment.seq, segment);

    for (const segment of incoming) {
        if (!bySeq.has(segment.seq)) bySeq.set(segment.seq, segment);
    }

    return [...bySeq.values()].sort((left, right) => left.seq - right.seq);
}

/** The highest seq reachable from `start` without a hole. */
function contiguousLastSeq(finals: ReadonlyArray<LiveSegment>, start: number): number {
    let last = start;

    for (const segment of finals) {
        if (segment.seq <= last) continue;

        if (segment.seq !== last + 1) break;

        last = segment.seq;
    }

    return last;
}

const NO_PARTIALS: ReadonlyArray<LiveSegment> = [];

/** All pieces share one seq: a final at or above it retires them together. */
function dropSupersededPartials(
    partials: ReadonlyArray<LiveSegment>,
    lastFinalSeq: number,
): ReadonlyArray<LiveSegment> {
    return partials.length > 0 && partials[0].seq <= lastFinalSeq ? NO_PARTIALS : partials;
}

/** The pieces after `segment` arrived: same seq → replace that label's piece, newer seq → start over. */
function withPartialPiece(partials: ReadonlyArray<LiveSegment>, segment: LiveSegment): ReadonlyArray<LiveSegment> {
    const sameSeq = partials.length > 0 && partials[0].seq === segment.seq;

    const others = sameSeq ? partials.filter(piece => piece.speakerLabel !== segment.speakerLabel) : [];

    return [...others, segment].sort((left, right) => left.startMs - right.startMs);
}

/** The higher revision wins; an equal or lower one (a late or duplicate snapshot) is ignored. */
function newerNames(current: LiveSpeakerNames | null, incoming: LiveSpeakerNames | undefined): LiveSpeakerNames | null {
    if (incoming === undefined) return current;

    return current === null || incoming.revision > current.revision ? incoming : current;
}

function highestSeq(finals: ReadonlyArray<LiveSegment>): number {
    return finals.length === 0 ? -1 : finals[finals.length - 1].seq;
}

/**
 * A `forGap` backlog that listed NOTHING inside the pending gap
 * (`gapRefetch.afterSeq`, first final above it) accepts it: the first final
 * above the gap, from which the contiguous run continues. `undefined` = not
 * accepted (no gap pending any more — a reconnect dropped it — or the backlog
 * filled some of it, which the normal backlog rule handles).
 */
function acceptedGapEnd(state: LiveTranscriptState, segments: ReadonlyArray<LiveSegment>): number | undefined {
    const gap = state.gapRefetch;

    if (gap === null) return undefined;

    const firstAbove = state.finals.find(segment => segment.seq > gap.afterSeq)?.seq;

    if (firstAbove === undefined) return undefined;

    const filled = segments.some(segment => segment.seq > gap.afterSeq && segment.seq < firstAbove);

    return filled ? undefined : firstAbove;
}

export function liveTranscriptReducer(state: LiveTranscriptState, action: LiveTranscriptAction): LiveTranscriptState {
    switch (action.kind) {
        case "backlog": {
            const finals = mergeFinals(state.finals, action.segments);

            const added = finals.length > state.finals.length;

            // The backlog is authoritative up to its own `lastSeq`: everything at
            // or below it that it did not list does not exist, so the contiguous
            // run restarts from there.
            const authoritative = Math.max(contiguousLastSeq(finals, -1), action.lastSeq, state.lastSeq);

            const accepted = action.forGap === true ? acceptedGapEnd(state, action.segments) : undefined;

            return {
                ...state,
                ended: state.ended || action.ended,
                finals,
                gapRefetch: null,
                initialLoaded: true,
                lastFinalAt: added && state.initialLoaded ? action.atMs : state.lastFinalAt,
                lastSeq: contiguousLastSeq(finals, Math.max(authoritative, accepted ?? -1)),
                partials: dropSupersededPartials(state.partials, highestSeq(finals)),
                refetchAfterSeq: null,
                speakerNames: newerNames(state.speakerNames, action.speakerNames),
            };
        }

        case "backlogFailed":
            return { ...state, gapRefetch: null, initialLoaded: true, refetchAfterSeq: null };

        case "final": {
            if (state.finals.some(segment => segment.seq === action.segment.seq)) {
                // A duplicate final (a re-publish) still retires its partial, and is not news.
                return { ...state, partials: dropSupersededPartials(state.partials, action.segment.seq) };
            }

            const finals = mergeFinals(state.finals, [action.segment]);

            // ONE refetch per gap: an outstanding request is not re-asked.
            const asks = action.segment.seq > state.lastSeq + 1 && state.refetchAfterSeq === null;

            return {
                ...state,
                finals,
                gapRefetch: asks
                    ? { afterSeq: state.lastSeq, notBeforeMs: action.atMs + GAP_REFETCH_DELAY_MS }
                    : state.gapRefetch,
                lastFinalAt: action.atMs,
                lastSeq: contiguousLastSeq(finals, state.lastSeq),
                partials: dropSupersededPartials(state.partials, action.segment.seq),
                refetchAfterSeq: asks ? state.lastSeq : state.refetchAfterSeq,
            };
        }

        case "partial": {
            const newestFinal = highestSeq(state.finals);

            if (action.segment.seq <= newestFinal) return state;

            if (state.partials.length > 0 && action.segment.seq < state.partials[0].seq) return state;

            return {
                ...state,
                lastPartialAt: action.atMs,
                partials: withPartialPiece(state.partials, action.segment),
            };
        }

        case "reset":
            return INITIAL_LIVE_TRANSCRIPT;

        case "resync":
            // Immediate, and never `forGap`: a pending gap request is dropped.
            return { ...state, gapRefetch: null, refetchAfterSeq: state.refetchAfterSeq ?? state.lastSeq };

        case "speakerNames": {
            const speakerNames = newerNames(state.speakerNames, action.names);

            return speakerNames === state.speakerNames ? state : { ...state, speakerNames };
        }

        default:
            return state;
    }
}

/** The provisional name a turn shows (live-call-quality task 8). */
export type LiveTurnSpeaker = Pick<
    LiveSpeakerAssignment,
    "confidence" | "firm" | "name" | "role" | "source" | "title"
>;

/** One speaker turn of the live view — the call page's layout, built from finals. */
export type LiveTurn = {
    readonly key: string;
    readonly speakerLabel: null | string;
    /** The assignment covering the turn's FIRST seq; `null` = unnamed ("Speaker N"). */
    readonly speaker: LiveTurnSpeaker | null;
    readonly startMs: number;
    readonly endMs: number;
    readonly text: string;
    /** The greyed tail: the newest partial's piece(s) of this turn's speaker. */
    readonly partialText: null | string;
};

/**
 * The assignment of `label` covering `seq` (`[fromSeq, toSeq ?? ∞]`). Two active rows
 * covering one seq (a cue and an LLM row) → the higher confidence, then the later start.
 */
export function assignmentAt(
    assignments: ReadonlyArray<LiveSpeakerAssignment>,
    label: null | string,
    seq: number,
): LiveSpeakerAssignment | null {
    if (label === null) return null;

    let best: LiveSpeakerAssignment | null = null;

    for (const assignment of assignments) {
        if (assignment.speakerLabel !== label || seq < assignment.fromSeq) continue;

        if (assignment.toSeq !== null && seq > assignment.toSeq) continue;

        if (
            best === null
            || assignment.confidence > best.confidence
            || (assignment.confidence === best.confidence && assignment.fromSeq > best.fromSeq)
        ) {
            best = assignment;
        }
    }

    return best;
}

function toTurnSpeaker(assignment: LiveSpeakerAssignment | null): LiveTurnSpeaker | null {
    if (assignment === null) return null;

    return {
        confidence: assignment.confidence,
        firm: assignment.firm,
        name: assignment.name,
        role: assignment.role,
        source: assignment.source,
        title: assignment.title,
    };
}

/**
 * Pure: the words of `text` spoken by `untilMs`, the segment's words taken as spread
 * evenly over `[startMs, endMs]` (a live segment carries no word timings). Everything
 * at or past `endMs`, nothing before `startMs`.
 */
export function revealedText(text: string, startMs: number, endMs: number, untilMs: number): string {
    if (untilMs >= endMs) return text;

    if (untilMs <= startMs || endMs <= startMs) return "";

    const words = text.split(/\s+/).filter(word => word.length > 0);

    const count = Math.floor((words.length * (untilMs - startMs)) / (endMs - startMs));

    return words.slice(0, count).join(" ");
}

/**
 * Consecutive finals of one speaker → one turn (a label-less final continues the
 * current turn, as task 21's live version builder does). A labelled final continues
 * the turn only under the SAME assignment: the same label with another name (label
 * drift, a misattributed interjection) starts a new turn. Every partial piece, in
 * `startMs` order, is the tail of the last turn when it is the same speaker (or
 * unlabelled), else a turn of its own — so all pieces of the newest seq show.
 *
 * `revealUntilMs` (a live player in Synced mode, HOVR 2026-10-09): only the words
 * spoken by that call millisecond are shown, so no word, partials included, runs
 * ahead of the audio (`revealedText` per final and per partial
 * piece; a segment with nothing to show yet opens no turn). Absent = everything.
 */
export function liveTurns(
    state: Pick<LiveTranscriptState, "finals" | "partials">,
    assignments: ReadonlyArray<LiveSpeakerAssignment> = [],
    revealUntilMs?: number,
): Array<LiveTurn> {
    const turns: Array<{
        key: string;
        speakerLabel: null | string;
        assignment: LiveSpeakerAssignment | null;
        startMs: number;
        endMs: number;
        texts: Array<string>;
        partialText: null | string;
    }> = [];

    const continuesTurn = (current: (typeof turns)[number] | undefined, piece: LiveSegment) =>
        current !== undefined
        && (piece.speakerLabel === null
            || (piece.speakerLabel === current.speakerLabel
                && assignmentAt(assignments, piece.speakerLabel, piece.seq) === current.assignment));

    const shown = (segment: LiveSegment): null | string => {
        if (revealUntilMs === undefined) return segment.text;

        const text = revealedText(segment.text, segment.startMs, segment.endMs, revealUntilMs);

        return text.length === 0 ? null : text;
    };

    for (const segment of state.finals) {
        const text = shown(segment);

        if (text === null) continue;

        const current = turns.at(-1);

        if (current !== undefined && continuesTurn(current, segment)) {
            current.texts.push(text);

            current.endMs = Math.max(current.endMs, segment.endMs);
        }
        else {
            turns.push({
                assignment: assignmentAt(assignments, segment.speakerLabel, segment.seq),
                endMs: segment.endMs,
                key: `turn-${segment.seq}`,
                partialText: null,
                speakerLabel: segment.speakerLabel,
                startMs: segment.startMs,
                texts: [text],
            });
        }
    }

    for (const partial of state.partials) {
        const text = shown(partial);

        if (text === null) continue;

        const current = turns.at(-1);

        if (current !== undefined && continuesTurn(current, partial)) {
            current.partialText = current.partialText === null ? text : `${current.partialText} ${text}`;
        }
        else {
            turns.push({
                assignment: assignmentAt(assignments, partial.speakerLabel, partial.seq),
                endMs: partial.endMs,
                key: `partial-${partial.seq}-${partial.speakerLabel ?? "none"}`,
                partialText: text,
                speakerLabel: partial.speakerLabel,
                startMs: partial.startMs,
                texts: [],
            });
        }
    }

    return turns.map(turn => ({
        endMs: turn.endMs,
        key: turn.key,
        partialText: turn.partialText,
        speaker: toTurnSpeaker(turn.assignment),
        speakerLabel: turn.speakerLabel,
        startMs: turn.startMs,
        text: turn.texts.join(" "),
    }));
}
