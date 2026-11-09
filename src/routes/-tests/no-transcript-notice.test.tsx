// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2Event } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { CallTabs } from "@/routes/$ticker/earnings-calls/-components/call-tabs";
import { MediaState, NO_TRANSCRIPT_TITLE, NoTranscriptNotice } from "@/routes/$ticker/earnings-calls/-components/media-state";

// Every tab is a stub: a mounted tab would send its request, so a rendered stub = a request.
const { tabStub } = vi.hoisted(() => ({
    tabStub: (name: string) => () => <div data-testid={`tab-${name}`} />,
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/audio-tab", () => ({ AudioTab: tabStub("audio") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/documents-tab", () => ({ DocumentsTab: tabStub("documents") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/guidance-tab", () => ({ GuidanceTab: tabStub("guidance") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/metrics-diff-tab", () => ({ MetricsDiffTab: tabStub("metrics") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/participants-tab", () => ({ ParticipantsTab: tabStub("participants") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/press-release-tab", () => ({ PressReleaseTab: tabStub("press-release") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/price-attribution-tab", () => ({ PriceAttributionTab: tabStub("price-moves") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/prosody-tab", () => ({ ProsodyTab: tabStub("prosody") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/qa-tab", () => ({ QaTab: tabStub("qa") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/slides-tab", () => ({ SlidesTab: tabStub("slides") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/transcript-tab", () => ({ TranscriptTab: tabStub("transcript") }));

afterEach(cleanup);

const DERIVED_TABS = ["guidance", "qa", "participants", "metrics", "prosody"] as const;

function eventOf(overrides: Partial<V2Event>): V2Event {
    return {
        capture_status: "pending",
        event_id: "9655a5db-8968-40be-8c79-7cd1a8aed8e9",
        event_type: "earnings_call",
        has_audio: false,
        has_documents: false,
        has_press_release: false,
        has_slides: false,
        has_transcript: false,
        ...overrides,
    } as V2Event;
}

function renderTab(event: V2Event, tab: "price-moves" | (typeof DERIVED_TABS)[number]) {
    return render(
        <CallTabs
            event={event}
            onTabChange={() => {}}
            onTranscriptJumpHandled={() => {}}
            tab={tab}
            transcriptJump={null}
        />,
    );
}

describe("NoTranscriptNotice", () => {
    it("says the call has not been transcribed", () => {
        render(<NoTranscriptNotice captureStatus="pending" />);

        expect(screen.getByRole("status")).toHaveTextContent(NO_TRANSCRIPT_TITLE);

        expect(screen.getByText("The call has not been transcribed.")).toBeInTheDocument();
    });

    it.each(["missed", "expired"])("says no recording was captured for a %s capture", (status) => {
        render(<NoTranscriptNotice captureStatus={status} />);

        expect(screen.getByText("No recording was captured.")).toBeInTheDocument();
    });
});

describe("Notice card edge", () => {
    // A ring paints outside the box, so the call page's scroll viewport clipped the card's left edge; a real border
    // stays inside it, flush with the audio player's.
    it("draws its edge as a border, not an outside ring", () => {
        render(<NoTranscriptNotice captureStatus="pending" />);

        const card = screen.getByRole("status");

        expect(card).toHaveClass("border");

        expect(card.className).not.toMatch(/(^|\s)ring-1(\s|$)/);
    });
});

describe("CallTabs without a transcript", () => {
    it.each(DERIVED_TABS)("shows the notice on %s and never mounts the tab", (tab) => {
        renderTab(eventOf({}), tab);

        expect(screen.getByText(NO_TRANSCRIPT_TITLE)).toBeInTheDocument();

        expect(screen.queryByTestId(`tab-${tab}`)).toBeNull();

        expect(screen.queryByText("Not available for this call")).toBeNull();
    });

    it("keeps price moves mounted (its own 404 state)", () => {
        renderTab(eventOf({}), "price-moves");

        expect(screen.getByTestId("tab-price-moves")).toBeInTheDocument();
    });

    it("mounts a derived tab of a transcribed call", () => {
        renderTab(eventOf({ has_transcript: true }), "qa");

        expect(screen.getByTestId("tab-qa")).toBeInTheDocument();
    });

    it("hides the derived tabs of a non-earnings event", () => {
        renderTab(eventOf({ event_type: "conference" }), "qa");

        expect(screen.queryByRole("tab", { name: "Q&A" })).toBeNull();

        expect(screen.getByRole("tab", { name: "Price moves" })).toBeInTheDocument();
    });
});

describe("MediaState (v2 problems)", () => {
    it("reads 403 forbidden as the audio refusal, 503 unavailable as the outage, 404 not_found as the empty state", () => {
        const { rerender } = render(
            <MediaState error={new ApiRequestError(403, { error: "forbidden", message: "Audio is not available for this event" })} title="Failed" />,
        );

        expect(screen.getByText(/Audio for this call is not available/)).toBeInTheDocument();

        rerender(<MediaState error={new ApiRequestError(503, { error: "unavailable", message: "Media is temporarily unavailable" })} title="Failed" />);

        expect(screen.getByText("Media temporarily unavailable")).toBeInTheDocument();

        rerender(
            <MediaState error={new ApiRequestError(404, { error: "not_found", message: "No slide deck for this event" })} notFound="No slides stored for this call" title="Failed" />,
        );

        expect(screen.getByText("No slides stored for this call")).toBeInTheDocument();

        rerender(<MediaState error={new ApiRequestError(403, { error: "plan_required", message: "PRO" })} title="Failed" />);

        expect(screen.getByText("PRO plan required")).toBeInTheDocument();
    });
});
