import type { EarningsQaPair } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEarningsQaInfinite } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

import type { CallTabProps } from "../call-tabs";

import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";
import { SeekButton } from "../seek-button";

const QA_PAGE_LIMIT = 50;

const labelled = (name: null | string, label: string) => name ?? `Speaker ${label}`;

function QaCard({ pair }: { pair: EarningsQaPair }) {
    const answerers = pair.answers
        .map(answer => [labelled(answer.name, answer.speaker_label), answer.title].filter(Boolean).join(", "))
        .join(" · ");

    return (
        // A follow-up is indented under the question before it.
        <Card className={cn(pair.is_follow_up && "ml-6 border-l-2")} size="sm">
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{pair.is_follow_up ? "Follow-up" : "Question"}</Badge>
                        <span className="font-medium">{labelled(pair.analyst.name, pair.analyst.speaker_label)}</span>
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
                        <span className="font-medium">{answerers || "Unknown speaker"}</span>
                        <SeekButton startMs={pair.answer_start_ms} />
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{pair.answer}</p>
                </div>
            </CardContent>
        </Card>
    );
}

/** Q&A tab: each analyst question with the answering executives and the answer. */
export function QaTab({ selector }: CallTabProps) {
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useEarningsQaInfinite({ ...selector, limit: QA_PAGE_LIMIT });

    const pairs = data?.pages.flatMap(page => page.pairs) ?? [];

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} title="Failed to load Q&A" />;

    if (isLoading) return <Skeleton className="h-40 w-full" />;

    if (pairs.length === 0) return <Notice title="No Q&A pairs" />;

    return (
        <div className="flex flex-col gap-2">
            {pairs.map(pair => <QaCard key={pair.seq} pair={pair} />)}

            <LoadMoreButton
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
            />
        </div>
    );
}
