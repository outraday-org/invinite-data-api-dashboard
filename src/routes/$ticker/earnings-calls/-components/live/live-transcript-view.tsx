import * as React from "react";

import type { PlaybackSegment } from "@/lib/earnings/follow-along";
import type { KeywordHighlight } from "@/lib/live/live-highlights";
import type { LiveTurn, LiveTurnSpeaker } from "@/lib/live/live-transcript-reducer";

import { Badge } from "@/components/ui/badge";
import { useV2Participants } from "@/lib/api/queries";
import { READING_COLUMN_CLASS } from "@/lib/layout";
import { liveTurns } from "@/lib/live/live-transcript-reducer";
import { activeTurnIndex, positionToCallMs } from "@/lib/live/position-to-call-ms";
import { cn } from "@/lib/utils";

import type { LiveCall } from "../audio-context";
import type { SpeakerImages } from "../tabs/transcript-turns";
import type { TurnSpeaker } from "../transcript/turn-block";

import { useLiveCall } from "../audio-context";
import { useSpeakerImagesByName } from "../tabs/transcript-turns";
import { PlaybackTurnBlock, PlaybackTurns } from "../transcript/playback-turns";

/**
 * The live transcript on the call page's ONE turn layout (backend `tasks/data-api-dashboard` O4; it was its own 60vh
 * box): `liveTurns` → `PlaybackTurns` + `PlaybackTurnBlock`, on the live engine's call clock (`usePlayerPosition()`
 * answers call ms through the provider's `clock`). The highlight rules are the recording's: while the audio plays the
 * heard turn is marked and what follows is faded; at the edge the newest turn is the heard one, so the page follows the
 * text as it arrives (Follow on). In Synced mode each word, partials too, shows once the audio reaches it.
 *
 * Provisional names: the name, "title, firm", and a "live" badge whose tooltip says where the name came from
 * ("provisional — from question cue, confidence 0.90"); no name → "Speaker N". Images by name from
 * `/v1/participants?event=` when it already has one. Keyword hits (`useLiveCall().transcript.highlights`) are marked in
 * the turn that holds them. The final transcript replaces all of it once `has_transcript` is true (`call-tabs.tsx`).
 */

/** "Speaker 1" for the pipeline's `spk0`; another label as is. */
export function liveSpeakerName(label: null | string): string {
    if (label === null) return "Speaker";

    return /^spk\d+$/i.test(label) ? `Speaker ${Number(label.slice(3)) + 1}` : `Speaker ${label}`;
}

function speakerSourceText(speaker: LiveTurnSpeaker): string {
    return `provisional — from ${speaker.source.replaceAll("_", " ")}, confidence ${speaker.confidence.toFixed(2)}`;
}

/** A live turn's speaker for `TurnBlock` (an unnamed label reads "Speaker N" through `speakerName`). */
function liveTurnSpeaker(turn: LiveTurn, images: SpeakerImages): TurnSpeaker {
    const unnamedLabel = liveSpeakerName(turn.speakerLabel).replace(/^Speaker ?/, "");

    if (turn.speaker === null) return { label: unnamedLabel, name: null };

    const detail = [turn.speaker.title, turn.speaker.firm].filter(part => part !== null && part.length > 0).join(", ");

    return {
        detail: detail.length > 0 ? detail : null,
        imageUrl: images.get(turn.speaker.name),
        label: turn.speakerLabel ?? unnamedLabel,
        name: turn.speaker.name,
        role: turn.speaker.role,
    };
}

/** The "live" badge of a provisional name; an `llm` name is lighter. */
function ProvisionalBadge({ speaker }: { speaker: LiveTurnSpeaker }) {
    return (
        <Badge className={speaker.source === "llm" ? "opacity-70" : undefined} title={speakerSourceText(speaker)} variant="outline">
            live
            <span className="sr-only">
                {" "}
                (
                {speakerSourceText(speaker)}
                )
            </span>
        </Badge>
    );
}

/** The turns the page shows: in Synced mode, while the listener is at the sync point, only what the audio reached. */
export function shownLiveTurns(live: Pick<LiveCall, "audio" | "callT0" | "mode" | "onAir" | "transcript">): Array<LiveTurn> {
    const { audio, callT0, mode, onAir, transcript } = live;

    const assignments = transcript.state.speakerNames?.assignments ?? [];

    // A seek clears `playingDate` until the next `timeupdate`: the text stays where the audio last was.
    const heardMs = positionToCallMs(audio.position.heardDate, callT0);

    const tracked = onAir && audio.started && !audio.canJumpToLive && audio.phase !== "ended";

    const revealMs = mode === "synced" && tracked && heardMs !== null ? heardMs : undefined;

    return liveTurns(transcript.state, assignments, revealMs);
}

const NO_MARKS: ReadonlyArray<string> = [];

/** The turns' starts as `"6000,20000"`: a string, so the memos below change only when a turn is added. */
function startsOf(key: string): Array<number> {
    return key.length === 0 ? [] : key.split(",").map(Number);
}

/** One segment per turn, on the call clock; no word timings live, and the newest turn is still being spoken. */
function useLiveSegments(startsKey: string): ReadonlyArray<PlaybackSegment> {
    return React.useMemo(() => startsOf(startsKey).map(startMs => ({ startMs, words: null })), [startsKey]);
}

/** Each live hit marks its keyword in the turn holding its start. */
function useKeywordMarks(hits: ReadonlyArray<KeywordHighlight> | undefined, startsKey: string): ReadonlyMap<number, ReadonlyArray<string>> {
    return React.useMemo(() => {
        const marks = new Map<number, Array<string>>();

        const starts = startsOf(startsKey).map(startMs => ({ startMs }));

        for (const hit of hits ?? []) {
            if (hit.layer !== "live" || hit.startMs === null) continue;

            const index = activeTurnIndex(starts, hit.startMs);

            if (index < 0) continue;

            const list = marks.get(index) ?? [];

            if (!list.includes(hit.keyword)) marks.set(index, [...list, hit.keyword]);
        }

        return marks;
    }, [hits, startsKey]);
}

/** The live transcript of the Transcript tab while the call is live (nothing without a live session). */
export function LiveTranscript({ eventId }: { eventId: string }) {
    const live = useLiveCall();

    const participants = useV2Participants(live === null ? "" : eventId);

    const images = useSpeakerImagesByName(participants.data);

    const turns = live === null ? [] : shownLiveTurns(live);

    const startsKey = turns.map(turn => turn.startMs).join(",");

    const segments = useLiveSegments(startsKey);

    const marksByTurn = useKeywordMarks(live?.transcript.highlights.keywords, startsKey);

    if (live === null) return null;

    const { transcript } = live;

    return (
        <section aria-label="Live transcript" className="flex flex-col gap-3">
            {transcript.error !== null && <p className="text-destructive text-sm" role="alert">{transcript.error}</p>}
            {transcript.notice !== null && <p className="text-muted-foreground text-xs" role="status">{transcript.notice}</p>}
            {transcript.mode === "retrying" && (
                <p className="text-muted-foreground text-xs" role="status">The live transcript is unavailable right now; retrying in 10 s.</p>
            )}
            {transcript.provisionalVersion !== null && (
                <p className="text-muted-foreground text-xs">
                    A provisional transcript (version
                    {" "}
                    {transcript.provisionalVersion}
                    ) is ready; the final one, with speaker names, follows.
                </p>
            )}
            {turns.length === 0
                ? <p className="text-muted-foreground text-xs">No transcript yet.</p>
                : (
                        <PlaybackTurns className={cn("flex flex-col gap-3", READING_COLUMN_CLASS)} segments={segments}>
                            {turns.map((turn, index) => (
                                <PlaybackTurnBlock
                                    badge={turn.speaker === null ? undefined : <ProvisionalBadge speaker={turn.speaker} />}
                                    index={index}
                                    key={turn.key}
                                    marks={marksByTurn.get(index) ?? NO_MARKS}
                                    partialText={turn.partialText}
                                    speaker={liveTurnSpeaker(turn, images)}
                                    startMs={turn.startMs}
                                    text={turn.text}
                                    words={null}
                                />
                            ))}
                        </PlaybackTurns>
                    )}
        </section>
    );
}
