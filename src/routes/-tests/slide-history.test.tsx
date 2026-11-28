// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2Event, V2Slide } from "@/lib/api/types";

import { AAPL_Q4_EVENT } from "@/lib/earnings/o7-earnings-fixtures";
import { HistorySlides } from "@/routes/$ticker/earnings-calls/-components/slide-history";

const api = vi.hoisted(() => {
    const events: Array<V2Event> = [];

    const decks: Record<string, Array<V2Slide>> = {};

    return {
        decks,
        events,
        useV2EventsInfinite: vi.fn((input: { enabled?: boolean }) => ({
            data: input.enabled ? { pages: [{ data: events }] } : undefined,
            error: null,
            hasNextPage: false,
            isLoading: false,
        })),
        useV2Slides: vi.fn((input: { eventId: string }) => ({
            data: { deck: { origin: "ir_page", url: `https://example.com/${input.eventId}.pdf` }, slides: decks[input.eventId] ?? [] },
            error: null,
        })),
    };
});

vi.mock("@/lib/api/queries", () => ({
    useV2EventsInfinite: api.useV2EventsInfinite,
    useV2Slides: api.useV2Slides,
}));

afterEach(cleanup);

beforeEach(() => {
    api.events.length = 0;

    for (const key of Object.keys(api.decks)) delete api.decks[key];

    api.useV2EventsInfinite.mockClear();

    api.useV2Slides.mockClear();
});

const current: V2Event = { ...AAPL_Q4_EVENT, fiscal_quarter: 4, fiscal_year: 2027, scheduled_at: "2026-11-20T20:00:00Z" };

const slide = (page: number, title: null | string): V2Slide => ({ image_url: `https://example.com/page-${page}.webp`, markdown: title ? `# ${title}` : null, page, title });

const revenue = slide(3, "Revenue");

function earlierEvent(year: number): V2Event {
    return { ...current, event_id: `event-${year}`, fiscal_year: year, has_slides: true, scheduled_at: `${year - 1}-11-20T20:00:00Z` };
}

describe("historical slide discovery", () => {
    it("invalidates a selected event when fresh event data no longer satisfies the fiscal rules", () => {
        const event = earlierEvent(2026);

        api.events.push(event);

        api.decks[event.event_id] = [slide(7, "Revenue")];

        const onSelectionInvalidated = vi.fn();

        const props = { currentSlide: revenue, currentSlides: [revenue], event: current, onSelect: vi.fn(), onSelectionInvalidated, selectedEventId: event.event_id };

        const view = render(<HistorySlides {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        expect(onSelectionInvalidated).not.toHaveBeenCalled();

        api.events[0] = { ...event, fiscal_quarter: 3 };

        view.rerender(<HistorySlides {...props} />);

        expect(onSelectionInvalidated).toHaveBeenCalledOnce();
    });

    it("keeps historical loading and API-error states honest", () => {
        api.events.push(earlierEvent(2026));

        api.useV2Slides.mockReturnValueOnce({ data: undefined, error: null } as never);

        const { rerender } = render(<HistorySlides currentSlide={revenue} currentSlides={[revenue]} event={current} onSelect={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        expect(screen.getByLabelText("Loading Q4 FY2026 slides")).toBeInTheDocument();

        api.useV2Slides.mockReturnValueOnce({ data: undefined, error: new Error("Network unavailable") } as never);

        rerender(<HistorySlides currentSlide={revenue} currentSlides={[revenue]} event={current} onSelect={vi.fn()} />);

        expect(screen.getByText("Failed to load historical slides")).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: /^Compare/ })).toBeNull();
    });

    it("explains conflicting and missing evidence separately and preserves image failure", () => {
        const event = earlierEvent(2026);

        api.events.push(event);

        api.decks[event.event_id] = [{ ...slide(12, "Revenue"), markdown: "Revenue\n#### **Q4 FY24 Outlook**\n**$20 billion**" }];

        const props = { currentSlide: revenue, currentSlides: [revenue], event: current, onSelect: vi.fn() };

        const { rerender } = render(<HistorySlides {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        expect(api.useV2Slides).toHaveBeenCalledWith({ eventId: event.event_id, include: ["markdown"] });

        expect(screen.getByText("The slide headings do not support this comparison.")).toBeInTheDocument();

        api.decks[event.event_id] = [{ ...slide(7, "Revenue"), markdown: null }];

        rerender(<HistorySlides {...props} />);

        expect(screen.getByText("There is not enough slide text to verify this comparison.")).toBeInTheDocument();

        api.decks[event.event_id] = [slide(7, "Revenue")];

        rerender(<HistorySlides {...props} />);

        fireEvent.error(screen.getByRole("button", { name: /^Compare/ }).querySelector("img")!);

        expect(screen.getByText("Preview unavailable")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /^Compare/ })).toBeEnabled();
    });

    it("reads no earlier decks before opting in and caps discovery at four distinct years", () => {
        for (let year = 2026; year >= 2020; year--) {
            const event = earlierEvent(year);

            api.events.push(event);

            api.decks[event.event_id] = [slide(7, "Revenue")];
        }

        render(<HistorySlides currentSlide={revenue} currentSlides={[revenue]} event={current} onSelect={vi.fn()} />);

        expect(api.useV2EventsInfinite).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));

        expect(api.useV2Slides).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        expect(api.useV2EventsInfinite).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true, fiscalQuarter: 4, scheduledAtLte: "2026-11-20" }));

        expect(api.useV2Slides).toHaveBeenCalledTimes(4);

        expect(screen.getAllByRole("button", { name: /^Compare/ })).toHaveLength(4);

        expect(api.useV2Slides).not.toHaveBeenCalledWith(expect.objectContaining({ eventId: "event-2022" }));
    });

    it("selects the actual historical page rather than the current slide's page number", () => {
        const event = earlierEvent(2026);

        const match = slide(9, "Revenue");

        api.events.push(event);

        api.decks[event.event_id] = [slide(3, "Gross margin"), match];

        const onSelect = vi.fn();

        render(<HistorySlides currentSlide={revenue} currentSlides={[revenue]} event={current} onSelect={onSelect} selectedEventId={event.event_id} />);

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        const compare = screen.getByRole("button", { name: "Compare Q4 FY2026, slide 9: Revenue" });

        expect(compare).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(compare);

        expect(onSelect).toHaveBeenCalledWith({ deckUrl: "https://example.com/event-2026.pdf", eventId: event.event_id, label: "Q4 FY2026", slide: match, slides: api.decks[event.event_id] });
    });

    it("shows no comparison control when a title is missing or ambiguous", () => {
        const missing = earlierEvent(2026);

        const ambiguous = earlierEvent(2025);

        api.events.push(missing, ambiguous);

        api.decks[missing.event_id] = [slide(1, null)];

        api.decks[ambiguous.event_id] = [slide(5, "Revenue"), slide(8, "Revenue")];

        const onSelect = vi.fn();

        render(<HistorySlides currentSlide={revenue} currentSlides={[revenue]} event={current} onSelect={onSelect} />);

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        expect(screen.queryByRole("button", { name: /^Compare/ })).toBeNull();

        expect(screen.getAllByText("No unique matching slide title.")).toHaveLength(2);

        expect(onSelect).not.toHaveBeenCalled();
    });
});
