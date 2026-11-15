import type { V2QaPair } from "@/lib/api/types";

import { SpeakerAvatar } from "@/components/earnings/speaker-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Participants, useV2QaInfinite } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

import type { CallTabProps } from "../call-tabs";
import type { SpeakerImages } from "./transcript-turns";

import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";
import { SeekButton } from "../seek-button";
import { useSpeakerImages } from "./transcript-turns";

const QA_PAGE_LIMIT = 50;

const labelled = (name: null | string, label: string) => name ?? `Speaker ${label}`;

function QaCard({ images, pair }: { images: SpeakerImages; pair: V2QaPair }) {
    return (
        // A follow-up is indented under the question before it.
        <Card className={cn(pair.is_follow_up && "ml-6 border-l-2")} size="sm">
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{pair.is_follow_up ? "Follow-up" : "Question"}</Badge>
                        <span className="flex items-center gap-2">
                            <SpeakerAvatar imageUrl={images.get(pair.analyst.speaker_label)} name={pair.analyst.name} />
                            <span className="font-medium">{labelled(pair.analyst.name, pair.analyst.speaker_label)}</span>
                        </span>
                        {pair.analyst.firm && <span className="text-muted-foreground">{pair.analyst.firm}</span>}
                        {/* No people page in the dashboard (`/people/:id` is in the CLI): the id is shown as text. */}
                        {pair.analyst.person_id && <span className="text-muted-foreground/70 font-mono text-[0.625rem]">{pair.analyst.person_id}</span>}
                        <SeekButton startMs={pair.question_start_ms} />
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{pair.question}</p>
                </div>
                <div className="flex flex-col gap-1 border-l pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Answer</Badge>
                        {pair.answers.length === 0 && <span className="font-medium">Unknown speaker</span>}
                        {pair.answers.map(answer => (
                            <span className="flex items-center gap-2" key={answer.speaker_label}>
                                <SpeakerAvatar imageUrl={images.get(answer.speaker_label)} name={answer.name} />
                                <span className="font-medium">{labelled(answer.name, answer.speaker_label)}</span>
                                {answer.title && <span className="text-muted-foreground">{answer.title}</span>}
                            </span>
                        ))}
                        <SeekButton startMs={pair.answer_start_ms} />
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{pair.answer}</p>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Q&A tab: each analyst question with the answering executives and the answer; every named speaker with their round
 * image (`/v1/participants?event=` by speaker label), else initials (`SpeakerAvatar`).
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

    const pairs = data?.pages.flatMap(page => page.data) ?? [];

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} title="Failed to load Q&A" />;

    if (isLoading) return <Skeleton className="h-40 w-full" />;

    if (pairs.length === 0) return <Notice title="No Q&A pairs" />;

    return (
        <div className="flex flex-col gap-2">
            {pairs.map(pair => <QaCard images={images} key={pair.seq} pair={pair} />)}

            <LoadMoreButton
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
            />
        </div>
    );
}
