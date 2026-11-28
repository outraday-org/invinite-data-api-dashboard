import { describe, expect, it } from "vitest";

import type { V2Slide } from "@/lib/api/types";

import { historicalSlideEvents, historicalSlideMatch, matchingHistoricalSlide, slideHeadlineEvidence, slideTitleKey } from "./slide-history";

const slide = (page: number, title: null | string): V2Slide => ({ image_url: `https://example.com/${page}.webp`, markdown: title ? `# ${title}` : null, page, title });

describe("slide title correspondence", () => {
    it("rejects stale Revenue metadata on either page, even when both decks share the error", () => {
        // backend pdf-parser/tests/fixtures/slide_headline_evidence.json: NVIDIA FY24 Q3 p12.
        const stale = { ...slide(12, "Revenue"), markdown: "Revenue\n#### **Q4 FY24 Outlook**\n**$20.0 billion**, plus or minus 2%" };

        const valid = slide(3, "Revenue");

        for (const [current, prior] of [[valid, stale], [stale, valid], [stale, stale]]) {
            expect(historicalSlideMatch(current, [current], [prior]).reason).toBe("conflict");
        }
    });

    it("requires usable evidence and refuses competing main headings", () => {
        const current = slide(3, "Revenue");

        for (const markdown of [null, "", " ", "| Revenue | Forecast |", "$20 billion"]) {
            expect(historicalSlideMatch(current, [current], [{ ...current, markdown }]).reason).toBe("insufficient");
        }

        expect(slideHeadlineEvidence({ ...current, markdown: "# Revenue\n# Outlook" })).toBe("conflict");

        expect(slideHeadlineEvidence({ ...current, markdown: "# Revenue\n# revenue" })).toBe("verified");
    });

    it("accepts plain, bold and strongest-heading titles without classifying body keywords", () => {
        const current = slide(3, "Revenue");

        for (const markdown of ["Revenue\nGuidance and outlook are discussed here.", "**Revenue**\nA revenue forecast follows.", "# Revenue\n## Outlook\nForecast", "# Revenue\n[…] More\n[...] More"]) {
            expect(slideHeadlineEvidence({ ...current, markdown })).toBe("verified");
        }

        expect(slideHeadlineEvidence({ ...slide(7, "Consumer & Community Banking [1]"), markdown: "**CCB** **CIB** **CB**\n#### Consumer & Community Banking [1]\n**SELECTED INCOME STATEMENT DATA ($MM)**" })).toBe("verified");

        expect(slideHeadlineEvidence({ ...slide(3, "3Q23 Financial results [1]"), markdown: "#### 3Q23 Financial results [1]\n**$B, EXCEPT PER SHARE DATA**\nManaged revenue" })).toBe("verified");

        expect(slideHeadlineEvidence({ ...slide(1, "Content Q3 FY24 Earnings Summary"), markdown: "# **Content**\nQ3 FY24 Earnings Summary\nKey Announcements" })).toBe("verified");
    });

    it("withholds speaker labels, numeric callouts, footer and body-like titles", () => {
        for (const title of ["Jane Doe:", "$20 billion", "Copyright 2026", "www.example.com", "This is a very long sentence containing thirteen separate words about the financial results"]) {
            expect(slideHeadlineEvidence({ ...slide(1, title), markdown: `# ${title}` })).toBe("insufficient");
        }

        expect(slideHeadlineEvidence({ ...slide(1, "Jane Doe"), markdown: "# Jane Doe\nChief Financial Officer" })).toBe("insufficient");
    });

    it("does not use literal code headings as main-heading evidence", () => {
        const revenue = slide(3, "Revenue");

        expect(slideHeadlineEvidence({ ...revenue, markdown: "```markdown\n# Revenue\n```" })).toBe("insufficient");

        expect(slideHeadlineEvidence({ ...revenue, markdown: "# Revenue\n```markdown\n# Outlook\n```" })).toBe("verified");

        expect(slideHeadlineEvidence({ ...revenue, markdown: "# Revenue\n    # Outlook" })).toBe("verified");

        expect(slideHeadlineEvidence({ ...slide(3, "# Revenue"), markdown: "# Revenue" })).toBe("conflict");
    });

    it("withholds an ambiguous unstyled leading label instead of treating it as proved", () => {
        const revenue = slide(3, "Revenue");

        expect(slideHeadlineEvidence({ ...revenue, markdown: "Revenue\nQ4 FY24 Outlook\n$20 billion" })).toBe("insufficient");

        expect(slideHeadlineEvidence({ ...revenue, markdown: "Revenue\nOur chief financial officer discussed guidance." })).toBe("verified");
    });

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
