import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorState } from "@/components/ui/error-state";
import { NotFound } from "@/components/ui/not-found";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError } from "@/lib/api/errors";
import { useV2Event } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";

import type { JumpToTranscript } from "../-components/ask-this-call";
import type { CallTab, TranscriptJump } from "../-components/call-tabs";

import { AskThisCall } from "../-components/ask-this-call";
import { CallAudioProvider } from "../-components/audio-context";
import { CallHeader } from "../-components/call-header";
import { CALL_TAB_VALUES, CallTabs, DEFAULT_CALL_TAB } from "../-components/call-tabs";
import { EventVideoSlot } from "../-components/event-video";
import { LivePlayerSlot } from "../-components/live-player-slot";
import { RecordingPlayer } from "../-components/player/recording-player";

// `tab` stays optional (every `EventLink` would otherwise have to pass search); an unknown
// value falls back to the transcript instead of failing the route.
const callSearchSchema = z.object({
    tab: z.enum(CALL_TAB_VALUES).optional().catch(undefined),
});

const eventIdSchema = z.string().uuid();

export const Route = createFileRoute("/$ticker/earnings-calls/$eventId/")({
    component: EarningsCallPage,
    head: ({ params }) => tickerHead(params.ticker, "Earnings Call"),
    validateSearch: (search: Record<string, unknown>) => callSearchSchema.parse(search),
});

function EarningsCallPage() {
    const { eventId } = Route.useParams();

    // Keyed: another call gets a fresh page (audio host, tab state, players).
    return <CallPage eventId={eventId} key={eventId} />;
}

/**
 * The call page. `$ticker` is informational: the event id is authoritative, and a call whose
 * symbol differs from the URL's ticker still renders (no redirect).
 */
function CallPage({ eventId }: { eventId: string }) {
    const { tab = DEFAULT_CALL_TAB } = Route.useSearch();

    const navigate = Route.useNavigate();

    const validId = eventIdSchema.safeParse(eventId).success;

    const { data: event, error, isLoading } = useV2Event(validId ? eventId : "");

    const [transcriptJump, setTranscriptJump] = React.useState<null | TranscriptJump>(null);

    const onTabChange = (next: CallTab) => {
        void navigate({ replace: true, resetScroll: false, search: prev => ({ ...prev, tab: next }) });
    };

    // A played search hit jumps along `quiet`ly: a call without a transcript just plays.
    const onJumpToTranscript: JumpToTranscript = (startMs, options) => {
        if (!event?.has_transcript) {
            if (!options?.quiet) toast.info("This call has no transcript to jump to");

            return;
        }

        onTabChange("transcript");

        setTranscriptJump(previous => ({ ms: startMs, nonce: (previous?.nonce ?? 0) + 1 }));
    };

    if (!validId || (error instanceof ApiRequestError && error.status === 404)) return <NotFound />;

    if (error) {
        return (
            <div className="flex flex-col gap-4">
                <ErrorState error={error} title="Failed to load the earnings call" />
            </div>
        );
    }

    if (isLoading || !event) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-6 w-72" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        // The recording is requested on the first play or timestamp click (never on page load, an old `?tab=audio`
        // link included), then stays loaded so timestamps on any tab can play it.
        <CallAudioProvider eventId={event.event_id} hasAudio={event.has_audio}>
            <div className="flex flex-col gap-4">
                <CallHeader event={event} />

                {/* The live player while the call is in progress (nothing for other calls). */}
                <LivePlayerSlot event={event} />

                {/* The company's public broadcast (click-to-load), collapsed while the call is captured live. */}
                <EventVideoSlot event={event} />

                <AskThisCall
                    scope={{
                        eventId: event.event_id,
                        kind: "event",
                        onJumpToTranscript,
                    }}
                />

                {/* The one player bar, sticky below the ticker header on every tab (nothing without a recording). */}
                <RecordingPlayer event={event} />

                <CallTabs
                    event={event}
                    onTabChange={onTabChange}
                    onTranscriptJumpHandled={() => setTranscriptJump(null)}
                    tab={tab}
                    transcriptJump={transcriptJump}
                />
            </div>
        </CallAudioProvider>
    );
}
