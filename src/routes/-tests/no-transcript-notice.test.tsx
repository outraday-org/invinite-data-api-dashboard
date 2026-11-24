// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2Event } from "@/lib/api/types";

import { tierLabel } from "@/components/ui/credit-hint";
import { ApiRequestError } from "@/lib/api/errors";
import { shareWithRequests } from "@/lib/api/request-meta";
import { CallTabs } from "@/routes/$ticker/earnings-calls/-components/call-tabs";
import { MediaState, NO_TRANSCRIPT_TITLE, NoTranscriptNotice } from "@/routes/$ticker/earnings-calls/-components/media-state";

// Every tab is a stub: a mounted tab would send its request, so a rendered stub = a request.
const { live, tabStub } = vi.hoisted(() => ({
    // The live session the tabs see (`useLiveCall`): null = not a live call.
    live: { call: null as null | object },
    tabStub: (name: string) => () => <div data-testid={`tab-${name}`} />,
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/documents-tab", () => ({ DocumentsTab: tabStub("documents") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/guidance-tab", () => ({ GuidanceTab: tabStub("guidance") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/metrics-diff-tab", () => ({ MetricsDiffTab: tabStub("metrics") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/participants-tab", () => ({ ParticipantsTab: tabStub("participants") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/press-release-tab", () => ({ PressReleaseTab: tabStub("press-release") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/price-attribution-tab", () => ({ PriceAttributionTab: tabStub("price-moves") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/prosody-tab", () => ({ ProsodyTab: tabStub("prosody") }));

// The Q&A stub asks like the real tab: a query whose answer carries the request the server recorded (O6 inspector).
vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/qa-tab", async () => {
    const { useQuery } = await import("@tanstack/react-query");

    const { fileRequests } = await import("@/lib/api/request-meta");

    const answer = { data: [], has_more: false, next_cursor: null };

    fileRequests(answer, [{ credits: 2, method: "GET", operationId: "listQa", path: "/v1/events/e1/qa", query: { include: "scores" }, requestId: "req_qa", status: 200 }]);

    return {
        QaTab: () => {
            useQuery({ initialData: answer, queryFn: () => answer, queryKey: ["qa"], staleTime: Number.POSITIVE_INFINITY });

            return <div data-testid="tab-qa" />;
        },
    };
});

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/slides-tab", () => ({ SlidesTab: tabStub("slides") }));

vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/transcript-tab", () => ({ TranscriptTab: tabStub("transcript") }));

vi.mock("@/lib/api/server-functions", () => ({ getApiBaseUrl: vi.fn(() => Promise.resolve({ url: "https://api.test" })) }));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({ useLiveCall: () => live.call }));

vi.mock("@/routes/$ticker/earnings-calls/-components/live/live-transcript-view", () => ({ LiveTranscript: tabStub("live-transcript") }));

afterEach(() => {
    cleanup();

    live.call = null;
});

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

function renderTab(event: V2Event, tab: "price-moves" | "transcript" | (typeof DERIVED_TABS)[number]) {
    const client = new QueryClient({ defaultOptions: { queries: { structuralSharing: shareWithRequests } } });

    return render(
        <QueryClientProvider client={client}>
            <CallTabs
                event={event}
                onSearchChange={() => {}}
                onTabChange={() => {}}
                onTranscriptJumpHandled={() => {}}
                search={{}}
                tab={tab}
                transcriptJump={null}
            />
        </QueryClientProvider>,
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
    // stays inside it. Since ui-redesign task 6 a notice's edge is its left accent bar.
    it("draws its edge as a border, not an outside ring", () => {
        render(<NoTranscriptNotice captureStatus="pending" />);

        const card = screen.getByRole("status");

        expect(card).toHaveClass("border-l-2");

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

    it("keeps the Transcript tab of a non-earnings event without a transcript: it opens on the notice (UI walk F070)", () => {
        renderTab(eventOf({ event_type: "conference" }), "transcript");

        expect(screen.getByRole("tab", { name: "Transcript" })).toBeInTheDocument();

        expect(screen.getByText(NO_TRANSCRIPT_TITLE)).toBeInTheDocument();

        expect(screen.queryByTestId("tab-price-moves")).toBeNull();
    });
});

describe("CallTabs: the tab bar (UI walk F067)", () => {
    it("keeps the tabs on one row that scrolls inside itself (never wraps, never the page)", () => {
        renderTab(eventOf({ has_transcript: true }), "qa");

        const list = screen.getByRole("tablist");

        expect(list).toHaveClass("flex-nowrap");

        expect(list).not.toHaveClass("flex-wrap");

        expect(list.parentElement?.className).toMatch(/overflow-x-auto/);

        expect(screen.getByRole("tab", { name: "Q&A", selected: true })).toHaveAttribute("data-active");
    });
});

describe("MediaState (v2 problems)", () => {
    it("reads 403 forbidden as the audio refusal, 503 unavailable as the outage, 404 not_found as the empty state", () => {
        const { rerender } = render(
            <MediaState error={new ApiRequestError(403, { error: "forbidden", message: "Audio is not available for this event" })} operationId="getAudio" title="Failed" />,
        );

        expect(screen.getByText(/Audio for this call is not available/)).toBeInTheDocument();

        rerender(<MediaState error={new ApiRequestError(503, { error: "unavailable", message: "Media is temporarily unavailable" })} operationId="getAudio" title="Failed" />);

        expect(screen.getByText("Media temporarily unavailable")).toBeInTheDocument();

        rerender(
            <MediaState
                error={new ApiRequestError(404, { error: "not_found", message: "No slide deck for this event" })}
                notFound="No slides stored for this call"
                operationId="getSlides"
                title="Failed"
            />,
        );

        expect(screen.getByText("No slides stored for this call")).toBeInTheDocument();

        rerender(<MediaState error={new ApiRequestError(403, { error: "plan_required", message: "PRO" })} operationId="getTranscript" title="Failed" />);

        expect(screen.getByText("PRO plan required")).toBeInTheDocument();
    });

    // A plan refusal names the plan of the route that refused (its `x-tier`), never one typed for every media view:
    // guidance is LITE since Data API 10.0, the transcript PRO.
    it.each([
        ["listGuidance", "LITE"],
        ["getTranscript", "PRO"],
    ] as const)("badges %s's plan refusal with its own tier (%s)", (operationId, expected) => {
        const label = tierLabel(operationId);

        expect(label).toBe(expected);

        render(<MediaState error={new ApiRequestError(403, { error: "plan_required", message: "Upgrade" })} operationId={operationId} title="Failed" />);

        expect(screen.getByText(`${label} plan required`)).toBeInTheDocument();

        expect(screen.getByText(label ?? "")).toBeInTheDocument();
    });
});

describe("CallTabs on a live call (O4)", () => {
    it("the Transcript tab is the live transcript until has_transcript, then the final one", () => {
        live.call = {};

        const view = renderTab(eventOf({ capture_status: "capturing" }), "transcript");

        expect(screen.getByTestId("tab-live-transcript")).toBeInTheDocument();

        expect(screen.queryByText(NO_TRANSCRIPT_TITLE)).toBeNull();

        expect(screen.getByRole("tab", { name: "Transcript" }).className).not.toContain("text-muted-foreground/50");

        view.unmount();

        renderTab(eventOf({ has_transcript: true }), "transcript");

        expect(screen.getByTestId("tab-transcript")).toBeInTheDocument();

        expect(screen.queryByTestId("tab-live-transcript")).toBeNull();
    });
});
