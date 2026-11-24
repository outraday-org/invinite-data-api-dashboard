import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AlertEntryPoints, ENTRY_TYPES } from "@/components/alerts/create-alert-button";
import { ErrorState } from "@/components/ui/error-state";
import { NotFound } from "@/components/ui/not-found";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/api/errors";
import { useV2Event } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";

import type { JumpToTranscript } from "../-components/ask-this-call";
import type { CallSearch } from "../-components/call-search";
import type { CallTab, TranscriptJump } from "../-components/call-tabs";
import type { LiveSessionClock } from "../-components/live/use-call-live-session";

import { AskThisCall } from "../-components/ask-this-call";
import { CallAudioProvider } from "../-components/audio-context";
import { CallHeader } from "../-components/call-header";
import { callSearchSchema, copyCallLinkAt } from "../-components/call-search";
import { CallTabs, DEFAULT_CALL_TAB } from "../-components/call-tabs";
import { EventVideoSlot } from "../-components/event-video";
import { LivePlayerSlot } from "../-components/live-player-slot";
import { recordingWaitInterval, useCallLiveSession } from "../-components/live/use-call-live-session";
import { CallPlayerBar } from "../-components/player/live-call-player";

const eventIdSchema = z.string().uuid();

export const Route = createFileRoute("/$ticker/earnings-calls/$eventId/")({
    component: EarningsCallPage,
    head: ({ params }) => tickerHead(params.ticker, "Earnings Call"),
    // Every field optional (an `EventLink` passes no search); an unknown value falls back to its default.
    validateSearch: callSearchSchema,
});

function EarningsCallPage() {
    const { eventId, ticker } = Route.useParams();

    // Keyed: another call gets a fresh page (audio host, tab state, players).
    return <CallPage eventId={eventId} key={eventId} ticker={ticker} />;
}

/**
 * The call page. `$ticker` is informational: the event id is authoritative, and a call whose
 * symbol differs from the URL's ticker still renders (no redirect).
 */
function CallPage({ eventId, ticker }: { eventId: string; ticker: string }) {
    const search = Route.useSearch();

    const { tab = DEFAULT_CALL_TAB } = search;

    const navigate = Route.useNavigate();

    const validId = eventIdSchema.safeParse(eventId).success;

    // What the live session knows, read by the event's poll (outside render): a call this page saw live is polled
    // every 30 s until its recording is published, for at most an hour after the end (`recordingWaitInterval`).
    const liveClockRef = React.useRef<LiveSessionClock>({ endedAtMs: null, sawLive: false });

    const { data: event, error, isLoading } = useV2Event(validId ? eventId : "", {
        refetchInterval: current => recordingWaitInterval(current, liveClockRef.current, Date.now()),
    });

    const liveSession = useCallLiveSession(event);

    React.useEffect(() => {
        liveClockRef.current = liveSession.clock;
    }, [liveSession.clock]);

    const [transcriptJump, setTranscriptJump] = React.useState<null | TranscriptJump>(null);

    // The link's `?t=` as it was when the page opened (a later "Copy link" rewrites `t`, never re-jumps).
    const [linkTimeMs] = React.useState(() => (search.t === undefined ? null : search.t * 1000));

    // `?t=` opens the final transcript at that moment once the event is in (the Transcript tab scrolls there; a live
    // call has no final transcript yet, so nothing scrolls — documented in the dashboard CLAUDE.md).
    const linkJumpDoneRef = React.useRef(false);

    React.useEffect(() => {
        if (linkJumpDoneRef.current || linkTimeMs === null || !event) return;

        linkJumpDoneRef.current = true;

        if (event.has_transcript && tab === "transcript") setTranscriptJump({ fromLink: true, ms: linkTimeMs, nonce: 1 });
    }, [event, linkTimeMs, tab]);

    const onSearchChange = React.useCallback((patch: Partial<CallSearch>) => {
        void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });
    }, [navigate]);

    const onTabChange = (next: CallTab) => onSearchChange({ tab: next });

    // The player's `⋯` → "Copy link at current time" (`copyCallLinkAt`: address bar first, then the clipboard).
    const onCopyLinkAt = (seconds: number) => void copyCallLinkAt(seconds, onSearchChange);

    // A played search hit jumps along `quiet`ly: a call without a transcript just plays.
    const onJumpToTranscript: JumpToTranscript = (startMs, options) => {
        if (!event?.has_transcript) {
            if (!options?.quiet) toast.info("This call has no transcript to jump to");

            return;
        }

        onTabChange("transcript");

        setTranscriptJump(previous => ({ ms: startMs, nonce: (previous?.nonce ?? 0) + 1 }));
    };

    if (!validId || isNotFound(error)) return <NotFound />;

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
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-4 w-96 max-w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        // The recording is requested on the first play or timestamp click (never on page load, an old `?tab=audio`
        // link included), then stays loaded so timestamps on any tab can play it.
        <CallAudioProvider eventId={event.event_id} hasAudio={event.has_audio} live={liveSession} startAtMs={linkTimeMs ?? undefined}>
            <div className="flex flex-col gap-4">
                {/* "Create alert" for the call's company and its alerts link (alerts task 4) as the header's action. */}
                <CallHeader actions={<AlertEntryPoints symbol={event.symbol} types={ENTRY_TYPES.calls} />} event={event} pageSymbol={ticker} />

                {/* The live call's notices, highlights, price and diagnostics (nothing for other calls). */}
                <LivePlayerSlot event={event} session={liveSession} />

                {/* The company's public broadcast (click-to-load), collapsed while the call is captured live. */}
                <EventVideoSlot event={event} />

                {/* The one player bar, sticky below the ticker header on every tab: the live stream while the call is */}
                {/* followed live, the recording once it is published (nothing without either). Above the search since */}
                {/* ui-redesign task 10. */}
                <CallPlayerBar event={event} onCopyLinkAt={onCopyLinkAt} />

                <AskThisCall
                    scope={{
                        eventId: event.event_id,
                        kind: "event",
                        onJumpToTranscript,
                    }}
                />

                <CallTabs
                    event={event}
                    onSearchChange={onSearchChange}
                    onTabChange={onTabChange}
                    onTranscriptJumpHandled={() => setTranscriptJump(null)}
                    search={search}
                    tab={tab}
                    transcriptJump={transcriptJump}
                />
            </div>
        </CallAudioProvider>
    );
}
