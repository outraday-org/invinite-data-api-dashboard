import type * as React from "react";

import type { EarningsEventSelector } from "@/lib/api/queries";
import type { EarningsEventResponse } from "@/lib/api/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { Notice, NoTranscriptNotice } from "./media-state";
import { AudioTab } from "./tabs/audio-tab";
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

/** Every tab of the call page, in bar order (`?tab=`; the route's `validateSearch` reads this list). */
export const CALL_TAB_VALUES = [
    "transcript",
    "audio",
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

/** A "Jump to transcript" request: the Transcript tab scrolls to `ms`; `nonce` repeats a jump to the same spot. */
export type TranscriptJump = { ms: number; nonce: number };

/** What every tab panel gets. */
export type CallTabProps = {
    event: EarningsEventResponse;
    /** The Transcript tab clears the pending jump once it has scrolled (or told why it could not). */
    onTranscriptJumpHandled: () => void;
    onTabChange: (tab: CallTab) => void;
    selector: EarningsEventSelector;
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
    "audio": { flag: "has_audio", label: "Audio", render: () => <AudioTab /> },
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
 * unselected tab never sends its request. `aboveContent` (the audio host) stays mounted
 * between the bar and the panel on every tab.
 */
export function CallTabs({
    aboveContent,
    event,
    onTabChange,
    onTranscriptJumpHandled,
    tab,
    transcriptJump,
}: {
    aboveContent?: React.ReactNode;
    event: EarningsEventResponse;
    onTabChange: (tab: CallTab) => void;
    onTranscriptJumpHandled: () => void;
    tab: CallTab;
    transcriptJump: null | TranscriptJump;
}) {
    // A non-earnings event (investor day, conference, AGM) hides the flagged tabs the API says it lacks (no press
    // release, no transcript-derived tabs without a transcript); an earnings call keeps them, muted.
    const hidden = (value: CallTab) => {
        const { flag } = CALL_TABS[value];

        return event.event_type !== "earnings_call" && flag !== undefined && !event[flag];
    };

    const visibleTabs = CALL_TAB_VALUES.filter(value => !hidden(value));

    const shownTab = hidden(tab) ? (visibleTabs[0] ?? tab) : tab;

    const active = CALL_TABS[shownTab];

    const available = active.flag === undefined || event[active.flag];

    const props: CallTabProps = {
        event,
        onTabChange,
        onTranscriptJumpHandled,
        selector: { eventId: event.event_id },
        transcriptJump,
    };

    return (
        <Tabs onValueChange={value => onTabChange(value as CallTab)} value={shownTab}>
            <div className="overflow-x-auto">
                <TabsList variant="line">
                    {visibleTabs.map((value) => {
                        const { flag, label } = CALL_TABS[value];

                        const muted = flag !== undefined && !event[flag];

                        return (
                            <TabsTrigger className={cn(muted && "text-muted-foreground/50")} key={value} value={value}>
                                {label}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </div>

            {aboveContent}

            <TabsContent className="pt-2" value={shownTab}>
                {available
                    ? active.render(props)
                    : active.flag === "has_transcript"
                        ? <NoTranscriptNotice captureStatus={event.capture_status} />
                        : <Notice title="Not available for this call" />}
            </TabsContent>
        </Tabs>
    );
}
