import * as React from "react";

import type { V2QaPair } from "@/lib/api/types";
import type { PlaybackSegment, TimedWord } from "@/lib/earnings/follow-along";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Participants, useV2QaInfinite } from "@/lib/api/queries";
import { buildCaptionWords, wordsBetween } from "@/lib/earnings/follow-along";
import { speakerName } from "@/lib/earnings/transcript";
import { cn } from "@/lib/utils";

import type { CallTabProps } from "../call-tabs";
import type { TurnSpeaker } from "../transcript/turn-block";
import type { SpeakerImages } from "./transcript-turns";

import { useCallAudio } from "../audio-context";
import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";
import { PlaybackTurnBlock, PlaybackTurns } from "../transcript/playback-turns";
import { useSpeakerImages } from "./transcript-turns";

const QA_PAGE_LIMIT = 50;

type QaScores = NonNullable<V2QaPair["scores"]>;

/** 0.72 → "0.72"; null → "—". */
const scoreText = (value: null | number) => (value === null ? "—" : value.toFixed(2));

/** `deferred` → "deferred", `not_addressed` → "not addressed". */
const nonAnswerText = (kind: null | string) => (kind ? kind.replaceAll("_", " ") : null);

function Quotes({ quotes }: { quotes: ReadonlyArray<string> }) {
    if (quotes.length === 0) return <p className="text-muted-foreground">No quote given.</p>;

    return (
        <ul className="flex flex-col gap-1">
            {quotes.map(quote => <li className="border-l-2 pl-2 italic" key={quote}>{`“${quote}”`}</li>)}
        </ul>
    );
}

/**
 * A pair's descriptive scores (`include=scores`) as small badges; a click opens the evidence: the verbatim quotes
 * behind difficulty and evasiveness, the kind of non-answer, the scorer. Absent scores (`null`) render nothing.
 */
export function QaScoreBadges({ scores }: { scores: null | QaScores | undefined }) {
    if (!scores) return null;

    const nonAnswer = nonAnswerText(scores.evidence.non_answer);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={(
                    <Button
                        aria-label="Q&A scores and their evidence"
                        className="h-auto flex-wrap justify-start gap-1 self-start px-1 py-0.5"
                        size="sm"
                        type="button"
                        variant="ghost"
                    />
                )}
            >
                <Badge variant="outline">{`Difficulty ${scoreText(scores.difficulty)}`}</Badge>
                <Badge variant="outline">{`Evasiveness ${scoreText(scores.evasiveness)}`}</Badge>
                {scores.non_answer && <Badge variant="destructive">{nonAnswer ? `Non-answer · ${nonAnswer}` : "Non-answer"}</Badge>}
                {scores.question_tone !== null && <Badge variant="outline">{`Tone ${scores.question_tone > 0 ? "+" : ""}${scores.question_tone.toFixed(2)}`}</Badge>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
                <div className="flex flex-col gap-3 p-2 text-xs">
                    <section className="flex flex-col gap-1">
                        <span className="font-medium">{`Difficulty ${scoreText(scores.difficulty)}`}</span>
                        <span className="text-muted-foreground">0 = softball, 1 = pointed, quantified, adversarial</span>
                        <Quotes quotes={scores.evidence.difficulty} />
                    </section>
                    <section className="flex flex-col gap-1">
                        <span className="font-medium">{`Evasiveness ${scoreText(scores.evasiveness)}`}</span>
                        <span className="text-muted-foreground">0 = direct, 1 = no substantive content</span>
                        <Quotes quotes={scores.evidence.evasiveness} />
                    </section>
                    <p>
                        {scores.non_answer ? `Non-answer${nonAnswer ? ` (${nonAnswer})` : ""}: evasiveness ≥ 0.7.` : "Answered."}
                        {` Analyst called on #${scores.analyst_casting_order} in the call's question order.`}
                    </p>
                    <p className="text-muted-foreground">{`Scored by ${scores.scored_by}`}</p>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** The analyst asking (the raw `person_id` is kept for task 7's person link, never printed). */
function analystSpeaker(pair: V2QaPair, images: SpeakerImages): TurnSpeaker {
    const { analyst } = pair;

    return { detail: analyst.firm, imageUrl: images.get(analyst.speaker_label), label: analyst.speaker_label, name: analyst.name, personId: analyst.person_id, role: "analyst" };
}

/** The answering executives: the first leads the header, the others follow with their avatars. */
function answerSpeakers(pair: V2QaPair, images: SpeakerImages): { coSpeakers: Array<TurnSpeaker>; speaker: TurnSpeaker } {
    const speakers = pair.answers.map<TurnSpeaker>(answer => ({
        detail: answer.title,
        imageUrl: images.get(answer.speaker_label),
        label: answer.speaker_label,
        name: answer.name,
        personId: answer.person_id,
    }));

    // No answerer named: "Unknown speaker".
    if (speakers.length === 0) return { coSpeakers: [], speaker: { label: "", name: null } };

    return { coSpeakers: speakers.slice(1), speaker: speakers[0] };
}

/** Question = segment `2 × i`, answer = `2 × i + 1` of the tab's `PlaybackTurns`. */
const QaCard = React.memo(function QaCard({
    images,
    index,
    pair,
    segments,
}: {
    images: SpeakerImages;
    index: number;
    pair: V2QaPair;
    segments: ReadonlyArray<PlaybackSegment>;
}) {
    const answer = answerSpeakers(pair, images);

    return (
        // A follow-up is indented under the question before it.
        <Card className={cn(pair.is_follow_up && "ml-6 border-l-2")} size="sm">
            <CardContent className="flex flex-col gap-3">
                <QaScoreBadges scores={pair.scores} />
                <PlaybackTurnBlock
                    badge={<Badge variant="outline">{pair.is_follow_up ? "Follow-up" : "Question"}</Badge>}
                    index={2 * index}
                    speaker={analystSpeaker(pair, images)}
                    startMs={pair.question_start_ms}
                    text={pair.question}
                    words={segments[2 * index]?.words ?? null}
                />
                <div className="border-l pl-3">
                    <PlaybackTurnBlock
                        badge={<Badge variant="secondary">Answer</Badge>}
                        coSpeakers={answer.coSpeakers}
                        index={2 * index + 1}
                        speaker={answer.speaker}
                        startMs={pair.answer_start_ms}
                        text={pair.answer}
                        words={segments[2 * index + 1]?.words ?? null}
                    />
                </div>
            </CardContent>
        </Card>
    );
});

/** Each pair's question and answer as played segments, their words cut from the words transcript by their ms range. */
export function qaSegments(pairs: ReadonlyArray<V2QaPair>, words: ReadonlyArray<TimedWord>): Array<PlaybackSegment> {
    return pairs.flatMap(pair => [
        { endMs: pair.question_end_ms, startMs: pair.question_start_ms, words: wordsBetween(words, pair.question_start_ms, pair.question_end_ms) },
        { endMs: pair.answer_end_ms, startMs: pair.answer_start_ms, words: wordsBetween(words, pair.answer_start_ms, pair.answer_end_ms) },
    ]);
}

/**
 * Q&A tab: each analyst question and its answer on `TurnBlock` (round images by speaker label, else initials), the
 * pair being heard highlighted word by word once a recording is loaded (the provider's words transcript, cut by
 * `question_start_ms` … `question_end_ms` / `answer_start_ms` … `answer_end_ms`; plain text before), and the pair's
 * scores (`include=scores`) as badges with their evidence.
 */
export function QaTab({ eventId }: CallTabProps) {
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2QaInfinite({ eventId, limit: QA_PAGE_LIMIT });

    const participants = useV2Participants(eventId);

    const images = useSpeakerImages(participants.data);

    const { wordTurns } = useCallAudio();

    const words = React.useMemo(() => buildCaptionWords(wordTurns, speakerName), [wordTurns]);

    const pairs = React.useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

    const segments = React.useMemo(() => qaSegments(pairs, words), [pairs, words]);

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} operationId="listQa" title="Failed to load Q&A" />;

    if (isLoading) return <Skeleton className="h-40 w-full" />;

    if (pairs.length === 0) return <Notice title="No Q&A pairs" />;

    return (
        <div className="flex flex-col gap-2">
            <PlaybackTurns className="flex flex-col gap-2" segments={segments}>
                {pairs.map((pair, index) => <QaCard images={images} index={index} key={pair.seq} pair={pair} segments={segments} />)}
            </PlaybackTurns>

            <LoadMoreButton
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
            />
        </div>
    );
}
