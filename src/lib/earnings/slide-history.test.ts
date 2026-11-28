import { describe, expect, it } from "vitest";

import type { V2Slide } from "@/lib/api/types";

import { historicalSlideEvents, matchingHistoricalSlide, slideTitleKey } from "./slide-history";

const slide = (page: number, title: null | string): V2Slide => ({ image_url: `https://example.com/${page}.webp`, page, title });

describe("slide title correspondence", () => {
    it("matches unique titles regardless of page position, casing and spacing", () => {
        const current = slide(5, " Gross   Margin ");

        const earlier = slide(9, "gross margin");

        expect(matchingHistoricalSlide(current, [current], [slide(5, "Revenue"), earlier])).toBe(earlier);
    });

    it("never pairs duplicate or generic titles", () => {
        const current = slide(1, "Revenue");

        expect(matchingHistoricalSlide(current, [current, slide(2, "Revenue")], [current])).toBeNull();

        expect(matchingHistoricalSlide(current, [current], [current, slide(2, "Revenue")])).toBeNull();

        expect(matchingHistoricalSlide(slide(1, "Untitled"), [slide(1, "Untitled")], [slide(1, "Untitled")])).toBeNull();

        expect(slideTitleKey("Cover")).toBe("");

        expect(slideTitleKey(null)).toBe("");
    });

    it("preserves accounting qualifiers, period numbers and years", () => {
        const current = slide(1, "GAAP P&L Financial Measures");

        expect(matchingHistoricalSlide(current, [current], [slide(1, "Non-GAAP P&L Financial Measures")])).toBeNull();

        const outlook = slide(2, "Q4 FY2027 Outlook");

        expect(matchingHistoricalSlide(outlook, [outlook], [slide(2, "Q4 FY2026 Outlook")])).toBeNull();
    });
});

describe("earlier-year decks", () => {
    const event = {
        event_id: "current",
        event_type: "earnings_call" as const,
        fiscal_quarter: 3,
        fiscal_year: 2027,
        has_slides: true,
        scheduled_at: "2026-11-20T20:00:00Z",
    };

    it("keeps the same fiscal quarter in distinct earlier fiscal years and sorts newest first", () => {
        const previous = { ...event, event_id: "previous", fiscal_year: 2026, scheduled_at: "2025-11-20T20:00:00Z" };

        const older = { ...event, event_id: "older", fiscal_year: 2025, scheduled_at: "2024-11-20T20:00:00Z" };

        expect(historicalSlideEvents(event, [
            older,
            event,
            { ...previous, event_id: "wrong-quarter", fiscal_quarter: 2 },
            { ...previous, event_id: "no-slides", has_slides: false },
            { ...previous, event_id: "wrong-type", event_type: "agm" as const },
            { ...previous, event_id: "same-year", fiscal_year: 2027 },
            previous,
            { ...previous, event_id: "duplicate-year", scheduled_at: "2025-11-19T20:00:00Z" },
        ])).toEqual([previous, older]);
    });

    it("caps deck reads and excludes future calls even when their fiscal label is earlier", () => {
        const candidates = Array.from({ length: 8 }, (_, index) => ({ ...event, event_id: String(index), fiscal_year: 2026 - index, scheduled_at: `${2025 - index}-11-20T20:00:00Z` }));

        expect(historicalSlideEvents(event, [{ ...candidates[0], event_id: "future", scheduled_at: "2028-01-01T00:00:00Z" }, ...candidates])).toHaveLength(4);
    });
});
