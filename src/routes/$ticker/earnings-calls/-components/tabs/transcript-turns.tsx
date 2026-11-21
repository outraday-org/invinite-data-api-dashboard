import * as React from "react";

import type { V2ParticipantsResponse } from "@/lib/api/types";
import type { PlaybackSegment, TimedWord } from "@/lib/earnings/follow-along";
import type { TranscriptTurn, TranscriptView } from "@/lib/earnings/transcript";

import { Badge } from "@/components/ui/badge";
import { formatDecimal, isLowSpeakerConfidence } from "@/lib/earnings/labels";
import { qaStartTurnIndex } from "@/lib/earnings/transcript";

import type { TurnSpeaker } from "../transcript/turn-block";

import { SeekButton } from "../seek-button";
import { PlaybackTurnBlock, PlaybackTurns } from "../transcript/playback-turns";

/** speaker label → its participation's public image URL (`/v1/participants?event=`); missing = initials. */
export type SpeakerImages = ReadonlyMap<string, null | string>;

const NO_IMAGES: SpeakerImages = new Map();

/** The speaker images of a `/v1/participants?event=` answer (undefined while unanswered = initials everywhere). */
export function useSpeakerImages(participants: null | undefined | V2ParticipantsResponse): SpeakerImages {
    return React.useMemo(
        () => new Map((participants?.data ?? []).map(participant => [participant.speaker_label, participant.image_url ?? null])),
        [participants],
    );
}

/** The speaker images by NAME (a search hit names its speaker, not always its label); missing = initials. */
export function useSpeakerImagesByName(participants: null | undefined | V2ParticipantsResponse): SpeakerImages {
    return React.useMemo(
        () => new Map((participants?.data ?? []).flatMap(participant => (participant.name ? [[participant.name, participant.image_url ?? null] as const] : []))),
        [participants],
    );
}

/** A transcript turn's speaker for `TurnBlock`. */
function turnSpeaker(turn: TranscriptTurn, images: SpeakerImages): TurnSpeaker {
    return { detail: turn.title, imageUrl: images.get(turn.speaker_label), label: turn.speaker_label, name: turn.name, personId: turn.person_id, role: turn.role };
}

/** A named turn whose speaker attribution is weak (`speaker_confidence` below 0.8): marked, the value in the tooltip. */
export function SpeakerConfidenceBadge({ turn }: { turn: Pick<TranscriptTurn, "name" | "speaker_confidence"> }) {
    if (!isLowSpeakerConfidence(turn.name, turn.speaker_confidence)) return null;

    return (
        <Badge
            className="order-last"
            title={`Speaker attribution confidence ${formatDecimal(turn.speaker_confidence ?? 0, 2)}: the name may be wrong`}
            variant="outline"
        >
            Speaker uncertain
        </Badge>
    );
}

/** "Q&A starts at m:ss" — a button that plays from there when the call has a recording. */
export function QaStart({ qaStartMs }: { qaStartMs: null | number }) {
    if (qaStartMs === null) return null;

    return (
        <span className="text-muted-foreground inline-flex items-baseline gap-1 text-xs font-normal">
            Q&A starts at
            <SeekButton startMs={qaStartMs} />
        </span>
    );
}

function Section({ qaStartMs = null, text, title }: { qaStartMs?: null | number; text: null | string; title: string }) {
    if (!text) return null;

    return (
        <section className="flex flex-col gap-2">
            <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                {title}
                <QaStart qaStartMs={qaStartMs} />
            </h3>
            <p className="whitespace-pre-wrap">{text}</p>
        </section>
    );
}

/** The header the turns view draws above the first Q&A turn. */
function QaDivider({ qaStartMs }: { qaStartMs: number }) {
    return (
        <div className="flex items-center gap-3 pt-2">
            <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                Q&A
                <QaStart qaStartMs={qaStartMs} />
            </h3>
            <div className="bg-border h-px grow" />
        </div>
    );
}

/**
 * The turns on `TurnBlock`, played by one `PlaybackTurns` (the heard turn, its words, Follow). `words[i]` = the timed
 * words of turn `i` (the Speakers format), or null for turn-level state only (the cleaned layer, no words asked).
 */
function Turns({
    images,
    qaStartMs,
    turns,
    words,
}: {
    images: SpeakerImages;
    qaStartMs: null | number;
    turns: ReadonlyArray<TranscriptTurn>;
    words: null | ReadonlyArray<Array<TimedWord> | null>;
}) {
    const qaIndex = qaStartTurnIndex(turns, qaStartMs);

    const segments = React.useMemo<Array<PlaybackSegment>>(
        () => turns.map((turn, index) => ({ startMs: turn.start_ms, words: words?.[index] ?? null })),
        [turns, words],
    );

    const speakers = React.useMemo(() => turns.map(turn => turnSpeaker(turn, images)), [images, turns]);

    return (
        <PlaybackTurns className="flex flex-col gap-4" segments={segments}>
            {turns.map((turn, index) => (
                // Turns have no id; their order within one answer is stable.
                <React.Fragment key={index}>
                    {index === qaIndex && qaStartMs !== null && <QaDivider qaStartMs={qaStartMs} />}
                    <PlaybackTurnBlock
                        badge={isLowSpeakerConfidence(turn.name, turn.speaker_confidence) ? <SpeakerConfidenceBadge turn={turn} /> : undefined}
                        index={index}
                        speaker={speakers[index]}
                        startMs={turn.start_ms}
                        text={turn.text}
                        words={segments[index].words}
                    />
                </React.Fragment>
            ))}
        </PlaybackTurns>
    );
}

/**
 * The transcript body of one format (`empty` is handled by the tab). `qaStartMs` (the
 * response's `qa_start_ms`) heads the Q&A: on the sections' Q&A block, and as a divider above
 * the first Q&A turn of the speakers / cleaned formats. Each turn of a named speaker carries its round image
 * (`speakerImages`), else its initials; an unnamed one none (`SpeakerAvatar`).
 */
export function TranscriptTurns({
    qaStartMs,
    speakerImages = NO_IMAGES,
    view,
    words = null,
}: {
    qaStartMs: null | number;
    speakerImages?: SpeakerImages;
    view: TranscriptView;
    /** Per turn of a `turns` view: its timed words (word highlight), else turn-level only. */
    words?: null | ReadonlyArray<Array<TimedWord> | null>;
}) {
    switch (view.kind) {
        case "empty":
            return null;
        case "sections":
            return (
                <div className="flex flex-col gap-6">
                    <Section text={view.sections.prepared_remarks} title="Prepared remarks" />
                    <Section
                        qaStartMs={view.sections.qa_start_ms ?? qaStartMs}
                        text={view.sections.questions_and_answers}
                        title="Q&A"
                    />
                </div>
            );
        case "text":
            return <pre className="whitespace-pre-wrap break-words font-sans">{view.text}</pre>;
        case "turns":
            return <Turns images={speakerImages} qaStartMs={qaStartMs} turns={view.turns} words={words} />;
    }
}
