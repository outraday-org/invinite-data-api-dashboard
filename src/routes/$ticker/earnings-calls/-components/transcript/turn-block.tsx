import * as React from "react";

import type { TimedWord, TurnPlaybackState } from "@/lib/earnings/follow-along";

import { SpeakerAvatar } from "@/components/earnings/speaker-avatar";
import { PersonLink } from "@/components/people/person-link";
import { speakerName } from "@/lib/earnings/transcript";
import { splitByKeywords } from "@/lib/live/live-highlights";
import { usePlayer } from "@/lib/player/player-context";
import { FOLLOW_SCROLL_MARGIN_CLASS } from "@/lib/player/use-follow-scroll";
import { cn } from "@/lib/utils";

import { SeekButton } from "../seek-button";

/** Who speaks a turn. `personId` (the API resolved the speaker to a person) turns the name into a person-page link. */
export type TurnSpeaker = {
    /** Detail after the name: title · firm. */
    detail?: null | string;
    imageUrl?: null | string;
    /** The transcript's speaker label ("A"): the name of an unnamed speaker ("Speaker A"). */
    label: string;
    name: null | string;
    personId?: null | string;
    role?: null | string;
};

export type TurnBlockProps = {
    speaker: TurnSpeaker;
    /** More speakers of the same text (a Q&A answer given by several executives): their avatars and names follow. */
    coSpeakers?: ReadonlyArray<TurnSpeaker>;
    startMs: null | number;
    /** Plain text; used when `words` is null (untimed, the cleaned layer, a Q&A block without words yet). */
    text: string;
    /** Timed words (`timedWordsOf` / `wordsBetween`), or null = turn-level state only. */
    words: Array<TimedWord> | null;
    /** From the playback subscriber (`PlaybackTurns`): this turn's state and its active word (-1 = none). */
    state: TurnPlaybackState;
    activeWord: number;
    badge?: React.ReactNode;
    /** Position in its list: `data-follow-index`, what the player's Follow scrolls to. */
    index: number;
    /** A live turn's unfinished tail (a partial segment), in italics after `text`. */
    partialText?: null | string;
    /** Words marked in the text (a live call's keyword hits); plain text only. Keep the array stable (memo). */
    marks?: ReadonlyArray<string>;
};

function SpeakerChip({ speaker }: { speaker: TurnSpeaker }) {
    const detail = [speaker.detail, speaker.name ? null : speaker.role].filter(Boolean).join(" · ");

    return (
        <span className="inline-flex min-w-0 items-center gap-2">
            <SpeakerAvatar imageUrl={speaker.imageUrl} name={speaker.name} speakerRole={speaker.role} />
            <PersonLink className="font-medium" personId={speaker.personId}>{speakerName({ name: speaker.name, speaker_label: speaker.label })}</PersonLink>
            {detail && <span className="text-muted-foreground">{detail}</span>}
        </span>
    );
}

/**
 * A turn's header line: round image (else initials), name, title · firm, the ▷ m:ss button (plays from there; text
 * without media; nothing untimed), then an optional badge. `timestamp` (given, even `null`) replaces the button where no call player is
 * mounted (the calls list's search hits) or where the position plays something else (a search hit's own audio).
 */
export function TurnHeader({
    badge,
    coSpeakers = [],
    speaker,
    startMs,
    timestamp,
}: {
    badge?: React.ReactNode;
    coSpeakers?: ReadonlyArray<TurnSpeaker>;
    /** null = no speaker (a slide search hit): the badge and the time only. */
    speaker: null | TurnSpeaker;
    startMs: null | number;
    timestamp?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {badge}
            {speaker && <SpeakerChip speaker={speaker} />}
            {coSpeakers.map(other => <SpeakerChip key={other.label} speaker={other} />)}
            {timestamp === undefined ? <SeekButton startMs={startMs} /> : timestamp}
        </div>
    );
}

const WORD_CLASSES: Record<TurnPlaybackState, string> = {
    active: "",
    idle: "",
    spoken: "",
    upcoming: "text-muted-foreground/40",
};

/** The words of a turn as spans; the active one marked, the ones after it faded while the audio plays. */
function TurnWords({ activeWord, canSeek, state, words }: { activeWord: number; canSeek: boolean; state: TurnPlaybackState; words: Array<TimedWord> }) {
    return words.map((word, wordIndex) => {
        const wordState: TurnPlaybackState = state === "active"
            ? wordIndex === activeWord ? "active" : wordIndex < activeWord ? "spoken" : "upcoming"
            : state;

        return (
            <span
                className={cn(
                    "rounded-sm transition-colors duration-150",
                    WORD_CLASSES[wordState],
                    wordState === "active" && "bg-primary/15 font-medium",
                    canSeek && "cursor-pointer hover:underline",
                )}
                data-ms={word.startMs}
                // Words have no id; their order within one turn is stable.
                key={wordIndex}
            >
                {word.text}
                {" "}
            </span>
        );
    });
}

/**
 * THE turn layout of the call page (task O3): the Transcript tab, the Q&A tab and (its header) the search hits.
 * While the audio plays the heard turn has a soft background, its spoken word is marked, what was said is full colour
 * and everything after the playhead is faded; paused (`idle`) nothing is faded. A word click plays from that word.
 * Memoised: only the turns whose state or active word changes re-render (the active one at word rate).
 */
/** Plain text with its keyword marks (`<mark>`). */
function MarkedText({ marks, text }: { marks: ReadonlyArray<string>; text: string }) {
    return splitByKeywords(text, marks).map((piece, at) => (piece.marked
    // Pieces of one text: their order is stable.

        ? <mark className="bg-primary/15 text-foreground rounded-sm px-0.5" data-keyword-mark key={at}>{piece.text}</mark>
        : piece.text));
}

export const TurnBlock = React.memo(function TurnBlock({
    activeWord,
    badge,
    coSpeakers,
    index,
    marks,
    partialText,
    speaker,
    startMs,
    state,
    text,
    words,
}: TurnBlockProps) {
    const { canSeek, engine } = usePlayer();

    const seekWord = canSeek && words !== null
        ? (event: React.MouseEvent<HTMLElement>) => {
                const ms = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-ms]")?.dataset.ms : undefined;

                if (ms !== undefined) engine.seekMs(Number(ms));
            }
        : undefined;

    return (
        // `data-start-ms`: "Jump to transcript" (`scrollToTurn`) finds the turn holding a position.
        <div
            aria-current={state === "active" ? "true" : undefined}
            className={cn(
                "-mx-2 flex flex-col gap-1 rounded-md px-2 py-1 transition-colors",
                FOLLOW_SCROLL_MARGIN_CLASS,
                state === "active" && "bg-accent/60",
            )}
            data-follow-index={index}
            data-start-ms={startMs ?? undefined}
            data-state={state}
        >
            <TurnHeader badge={badge} coSpeakers={coSpeakers} speaker={speaker} startMs={startMs} />
            {words === null
                ? (
                        <p className={cn("whitespace-pre-wrap", WORD_CLASSES[state])}>
                            {marks && marks.length > 0 ? <MarkedText marks={marks} text={text} /> : text}
                            {partialText && (
                                <span className="text-muted-foreground italic">
                                    {text.length > 0 ? " " : ""}
                                    {partialText}
                                </span>
                            )}
                        </p>
                    )
                : (
                        // A word click seeks there; the ▷ timestamp is the keyboard path to the same turn.
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                        <p onClick={seekWord}>
                            <TurnWords activeWord={activeWord} canSeek={seekWord !== undefined} state={state} words={words} />
                        </p>
                    )}
        </div>
    );
});
