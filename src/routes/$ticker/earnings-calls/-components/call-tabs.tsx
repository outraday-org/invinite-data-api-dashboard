import type * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { ApiButton } from "@/components/api/api-sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { CallSearch } from "./call-search";

import { useLiveCall } from "./audio-context";
import { LiveTranscript } from "./live/live-transcript-view";
import { Notice, NoTranscriptNotice } from "./media-state";
import { DocumentsTab } from "./tabs/documents-tab";
import { GuidanceTab } from "./tabs/guidance-tab";
import { MetricsDiffTab } from "./tabs/metrics-diff-tab";
import { ParticipantsTab } from "./tabs/participants-tab";
import { PressReleaseTab } from "./tabs/press-release-tab";
import { PriceAttributionTab } from "./tabs/price-attribution-tab";
import { ProsodyTab } from "./tabs/prosody-tab";
import { QaTab } from "./tabs/qa-tab";
import { SlidesTab } from "./tabs/slides-tab";
import { TranscriptTab } from "./tabs/transcript-tab";

/**
 * Every tab of the call page, in bar order (`?tab=`; the route's `validateSearch` reads this list). No Audio tab since
 * O2: the player sits above every tab, and an old `?tab=audio` falls back to the transcript.
 */
export const CALL_TAB_VALUES = [
    "transcript",
    "slides",
    "press-release",
    "documents",
    "guidance",
    "qa",
    "participants",
    "metrics",
    "prosody",
    "price-moves",
] as const;

export type CallTab = (typeof CALL_TAB_VALUES)[number];

export const DEFAULT_CALL_TAB: CallTab = "transcript";

/** The call tab bar wraps (like the Holders tabs): no tab is hidden in a sideways scroll box. */
export const CALL_TAB_LIST_CLASS = "flex-wrap justify-start gap-y-2 group-data-horizontal/tabs:h-auto";

/**
 * A "Jump to transcript" request: the Transcript tab scrolls to `ms`; `nonce` repeats a jump to the same spot.
 * `fromLink` = the page's `?t=`: the URL's format is kept and nothing is announced when the spot cannot be shown.
 */
export type TranscriptJump = { fromLink?: boolean; ms: number; nonce: number };

/** What every tab panel gets. */
export type CallTabProps = {
    event: V2Event;
    /** The event every per-event read names (`/v1/events/{event_id}/…`). */
    eventId: string;
    /** The Transcript tab clears the pending jump once it has scrolled (or told why it could not). */
    onTranscriptJumpHandled: () => void;
    onTabChange: (tab: CallTab) => void;
    /** Merges into the page's URL state (`IN_PLACE`): the Transcript tab's `format` / `version`. */
    onSearchChange: (patch: Partial<CallSearch>) => void;
    /** The page's URL state (`?format=`, `?version=`, `?t=`). */
    search: CallSearch;
    transcriptJump: null | TranscriptJump;
};

type AvailabilityFlag = "has_audio" | "has_documents" | "has_press_release" | "has_slides" | "has_transcript";

type CallTabDefinition = {
    /** `false` on the event → muted label and a "Not available" panel; the tab sends no request. */
    flag?: AvailabilityFlag;
    label: string;
    render: (props: CallTabProps) => React.ReactNode;
};

// The transcript-derived tabs (guidance … prosody) carry `has_transcript`: without a transcript they show
// `NoTranscriptNotice` and send no request; a transcribed but underived call shows each tab's own empty state
// ("No guidance extracted", "not derived yet"). Price moves keeps no flag (its own 404 state).
const CALL_TABS: Record<CallTab, CallTabDefinition> = {
    "documents": { flag: "has_documents", label: "Documents", render: props => <DocumentsTab {...props} /> },
    "guidance": { flag: "has_transcript", label: "Guidance & KPIs", render: props => <GuidanceTab {...props} /> },
    "metrics": { flag: "has_transcript", label: "Metrics & diff", render: props => <MetricsDiffTab {...props} /> },
    "participants": { flag: "has_transcript", label: "Participants", render: props => <ParticipantsTab {...props} /> },
    "press-release": { flag: "has_press_release", label: "Press release", render: props => <PressReleaseTab {...props} /> },
    "price-moves": { label: "Price moves", render: props => <PriceAttributionTab {...props} /> },
    "prosody": { flag: "has_transcript", label: "Prosody", render: props => <ProsodyTab {...props} /> },
    "qa": { flag: "has_transcript", label: "Q&A", render: props => <QaTab {...props} /> },
    "slides": { flag: "has_slides", label: "Slides", render: props => <SlidesTab {...props} /> },
    "transcript": { flag: "has_transcript", label: "Transcript", render: props => <TranscriptTab {...props} /> },
};

/**
 * The call page's tab bar and the active panel. Only the selected panel is mounted, so an
 * unselected tab never sends its request. The player (`CallPlayer`) is the page's, above the bar.
 * While the page follows the call live and the final transcript is not published, the Transcript tab is the live
 * transcript (`LiveTranscript`); `has_transcript` turning true swaps in the final one.
 * The bar's "API" button (O6-final; the call page has no `PageHeader`) lists the requests on screen: the event's, the
 * open tab's and the player's — whatever query is mounted, so nothing per tab registers.
 */
export function CallTabs({
    event,
    onSearchChange,
    onTabChange,
    onTranscriptJumpHandled,
    search,
    tab,
    transcriptJump,
}: {
    event: V2Event;
    onSearchChange: (patch: Partial<CallSearch>) => void;
    onTabChange: (tab: CallTab) => void;
    onTranscriptJumpHandled: () => void;
    search: CallSearch;
    tab: CallTab;
    transcriptJump: null | TranscriptJump;
}) {
    const liveText = useLiveCall() !== null && !event.has_transcript;

    // A non-earnings event (investor day, conference, AGM) hides the flagged tabs the API says it lacks (no press
    // release, no transcript-derived tabs without a transcript); an earnings call keeps them, muted. The Transcript tab
    // always stays (muted): an event not transcribed yet opens on "No transcript yet", never on Price moves (UI walk F070).
    const hidden = (value: CallTab) => {
        const { flag } = CALL_TABS[value];

        return event.event_type !== "earnings_call" && value !== "transcript" && flag !== undefined && !event[flag];
    };

    const visibleTabs = CALL_TAB_VALUES.filter(value => !hidden(value));

    const shownTab = hidden(tab) ? (visibleTabs[0] ?? tab) : tab;

    const active = CALL_TABS[shownTab];

    const available = active.flag === undefined || event[active.flag];

    const props: CallTabProps = {
        event,
        eventId: event.event_id,
        onSearchChange,
        onTabChange,
        onTranscriptJumpHandled,
        search,
        transcriptJump,
    };

    return (
        <Tabs onValueChange={value => onTabChange(value as CallTab)} value={shownTab}>
            <div className="flex items-start gap-2">
                {/* The tabs wrap onto a second row instead of scrolling sideways behind the API button (UI walk F067). */}
                <div className="min-w-0 grow">
                    <TabsList className={CALL_TAB_LIST_CLASS} variant="line">
                        {visibleTabs.map((value) => {
                            const { flag, label } = CALL_TABS[value];

                            const muted = flag !== undefined && !event[flag] && !(value === "transcript" && liveText);

                            return (
                                <TabsTrigger className={cn("flex-none", muted && "text-muted-foreground/50")} key={value} value={value}>
                                    {label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>
                <ApiButton />
            </div>

            <TabsContent className="pt-2" value={shownTab}>
                {shownTab === "transcript" && liveText
                    ? <LiveTranscript eventId={event.event_id} />
                    : available
                        ? active.render(props)
                        : active.flag === "has_transcript"
                            ? <NoTranscriptNotice captureStatus={event.capture_status} />
                            : <Notice title="Not available for this call" />}
            </TabsContent>
        </Tabs>
    );
}
