import * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { SCROLL_ROW_CLASS, ScrollEdgeFades, useActiveItemInView, useScrollEdges } from "@/components/ui/scroll-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { CallSearch, CallTab } from "./call-search";

import { useLiveCall } from "./audio-context";
import { CALL_TAB_VALUES } from "./call-search";
import { LiveTranscript } from "./live/live-transcript-view";
import { Notice, NoTranscriptNotice } from "./media-state";
import { DocumentsTab } from "./tabs/documents-tab";
import { GuidanceTab } from "./tabs/guidance-tab";
import { KpiSeriesTab } from "./tabs/kpi-series-tab";
import { MetricsDiffTab } from "./tabs/metrics-diff-tab";
import { NonGaapTab } from "./tabs/non-gaap-tab";
import { ParticipantsTab } from "./tabs/participants-tab";
import { PressReleaseTab } from "./tabs/press-release-tab";
import { PriceAttributionTab } from "./tabs/price-attribution-tab";
import { ProsodyTab } from "./tabs/prosody-tab";
import { QaTab } from "./tabs/qa-tab";
import { SlidesTab } from "./tabs/slides-tab";
import { TranscriptTab } from "./tabs/transcript-tab";

// The tab list lives in `call-search.ts` (the URL schema reads it; a value import back here was a module cycle).
export { CALL_TAB_VALUES, type CallTab, DEFAULT_CALL_TAB } from "./call-search";

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
    /** Only an earnings call has it (the results release's figures, the company's KPI series): hidden on any other event. */
    earningsOnly?: boolean;
    /** `false` on the event → muted label and a "Not available" panel; the tab sends no request. */
    flag?: AvailabilityFlag;
    label: string;
    render: (props: CallTabProps) => React.ReactNode;
};

// The transcript-derived tabs (guidance … prosody) carry `has_transcript`: without a transcript they show
// `NoTranscriptNotice` and send no request; a transcribed but underived call shows each tab's own empty state
// ("No guidance extracted", "not derived yet"). Price moves keeps no flag (its own 404 state). Non-GAAP and KPI series
// (Data API 12.1) keep no flag either (their own empty states) and exist on an earnings call only.
const CALL_TABS: Record<CallTab, CallTabDefinition> = {
    "documents": { flag: "has_documents", label: "Documents", render: props => <DocumentsTab {...props} /> },
    "guidance": { flag: "has_transcript", label: "Guidance & KPIs", render: props => <GuidanceTab {...props} /> },
    "kpi-series": { earningsOnly: true, label: "KPI series", render: props => <KpiSeriesTab {...props} /> },
    "metrics": { flag: "has_transcript", label: "Metrics & diff", render: props => <MetricsDiffTab {...props} /> },
    "non-gaap": { earningsOnly: true, label: "Non-GAAP", render: props => <NonGaapTab {...props} /> },
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
 * The bar is ONE row at every width (ui-redesign task 10): where it does not fit it scrolls sideways inside itself, a
 * fade marks a cut edge and the active tab is kept in view (the row scrolls, never the page). The requests of the open
 * tab are in the top bar's request panel.
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

    const scroller = React.useRef<HTMLDivElement>(null);

    const edges = useScrollEdges(scroller);

    // A non-earnings event (investor day, conference, AGM) hides the flagged tabs the API says it lacks (no press
    // release, no transcript-derived tabs without a transcript); an earnings call keeps them, muted. The Transcript tab
    // always stays (muted): an event not transcribed yet opens on "No transcript yet", never on Price moves (UI walk F070).
    const hidden = (value: CallTab) => {
        const { earningsOnly, flag } = CALL_TABS[value];

        if (event.event_type === "earnings_call") return false;

        return earningsOnly === true || (value !== "transcript" && flag !== undefined && !event[flag]);
    };

    const visibleTabs = CALL_TAB_VALUES.filter(value => !hidden(value));

    const shownTab = hidden(tab) ? (visibleTabs[0] ?? tab) : tab;

    const active = CALL_TABS[shownTab];

    const available = active.flag === undefined || event[active.flag];

    useActiveItemInView(scroller, shownTab);

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
            {/* One row: it scrolls inside itself (the page never scrolls sideways); the bottom padding keeps the active */}
            {/* tab's underline inside the scroller. */}
            <div className="relative min-w-0 border-b">
                <div className={cn(SCROLL_ROW_CLASS, "pb-1.5")} ref={scroller}>
                    <TabsList className="w-max flex-nowrap justify-start" variant="line">
                        {visibleTabs.map((value) => {
                            const { flag, label } = CALL_TABS[value];

                            const muted = flag !== undefined && !event[flag] && !(value === "transcript" && liveText);

                            return (
                                <TabsTrigger className={cn(muted && "text-muted-foreground/50")} key={value} value={value}>
                                    {label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>
                <ScrollEdgeFades edges={edges} testId="call-tabs-fade" />
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
