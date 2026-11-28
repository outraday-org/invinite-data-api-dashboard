// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CallTabProps } from "@/routes/$ticker/earnings-calls/-components/call-tabs";
import type { HistoricalSlideSelection } from "@/routes/$ticker/earnings-calls/-components/slide-history";
import type * as HistoryModule from "@/routes/$ticker/earnings-calls/-components/slide-history";

import { SlidesTab } from "@/routes/$ticker/earnings-calls/-components/tabs/slides-tab";

const slides = [
    { image_url: "https://example.com/revenue.webp", markdown: "# Revenue", page: 1, title: "Revenue" },
    { image_url: "https://example.com/margin.webp", markdown: "# Gross margin", page: 2, title: "Gross margin" },
];

const historical = { slides: [{ image_url: "https://example.com/prior.webp", markdown: "# Revenue", page: 4, title: "Revenue" }] };

vi.mock("@/lib/api/queries", () => ({
    useV2Slides: ({ eventId }: { eventId: string }) => ({ data: { deck: null, slides: eventId === "prior" ? historical.slides : slides, timeline: [] }, error: null }),
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/audio-context", () => ({
    useCallAudio: () => ({ setSlideMarkers: vi.fn() }),
}));

vi.mock("@/routes/$ticker/earnings-calls/-components/slide-history", async importOriginal => ({
    ...await importOriginal<typeof HistoryModule>(),
    HistorySlides: ({ onSelect }: { onSelect: (selection: HistoricalSlideSelection) => void }) => (
        <button
            onClick={() => onSelect({
                eventId: "prior",
                label: "Q3 FY2025",
                slide: { image_url: "https://example.com/prior.webp", markdown: null, page: 4, title: "Revenue" },
                slides: [{ image_url: "https://example.com/prior.webp", markdown: null, page: 4, title: "Revenue" }],
            })}
            type="button"
        >
            Compare Q3 FY2025
        </button>
    ),
}));

afterEach(cleanup);

HTMLElement.prototype.scrollIntoView = vi.fn();

function TestSlides({ initialSlide }: { initialSlide?: number }) {
    const [search, setSearch] = React.useState({ slide: initialSlide });

    return <SlidesTab {...props} onSearchChange={patch => setSearch(previous => ({ ...previous, ...patch }))} search={search} />;
}

const props = {
    event: { cik: "123", event_type: "earnings_call", fiscal_quarter: 3, fiscal_year: 2026, symbol: "TEST" },
    eventId: "current",
} as CallTabProps;

describe("SlidesTab historical comparison", () => {
    it("does not restore a previous selection after URL navigation away and back", () => {
        const onSearchChange = vi.fn();

        const view = render(<SlidesTab {...props} onSearchChange={onSearchChange} search={{ slide: 1 }} />);

        fireEvent.click(screen.getByRole("button", { name: "Compare Q3 FY2025" }));

        expect(screen.getByRole("region", { name: "Historical comparison" })).toBeInTheDocument();

        view.rerender(<SlidesTab {...props} onSearchChange={onSearchChange} search={{ slide: 2 }} />);

        view.rerender(<SlidesTab {...props} onSearchChange={onSearchChange} search={{ slide: 1 }} />);

        expect(screen.queryByRole("region", { name: "Historical comparison" })).toBeNull();
    });

    it("browses fresh historical pages independently while preserving a valid anchor", () => {
        const original = historical.slides;

        historical.slides = [...original, { image_url: "https://example.com/prior-margin.webp", markdown: "# Gross margin", page: 5, title: "Gross margin" }];

        render(<TestSlides />);

        fireEvent.click(screen.getByRole("button", { name: "Compare Q3 FY2025" }));

        const comparison = screen.getByRole("region", { name: "Historical comparison" });

        fireEvent.click(within(comparison).getByRole("button", { name: "Next slide in Q3 FY2025" }));

        expect(within(comparison).getByRole("img", { name: "Gross margin" })).toHaveAttribute("src", "https://example.com/prior-margin.webp");

        expect(screen.getByRole("img", { name: "Revenue" })).toHaveAttribute("src", slides[0].image_url);

        historical.slides = original;
    });

    it("revalidates either side on same-key refresh and uses fresh historical pages", () => {
        const { rerender } = render(<TestSlides />);

        fireEvent.click(screen.getByRole("button", { name: "Compare Q3 FY2025" }));

        expect(screen.getByRole("region", { name: "Historical comparison" })).toBeInTheDocument();

        const original = historical.slides;

        historical.slides = [];

        rerender(<TestSlides />);

        expect(screen.queryByRole("region", { name: "Historical comparison" })).toBeNull();

        historical.slides = [{ ...original[0], markdown: "# Q4 FY24 Outlook" }];

        rerender(<TestSlides />);

        expect(screen.getByText("The slide headings do not support this comparison.")).toBeInTheDocument();

        historical.slides = original;

        const oldMarkdown = slides[0].markdown;

        slides[0].markdown = "# Outlook";

        rerender(<TestSlides />);

        expect(screen.queryByRole("region", { name: "Historical comparison" })).toBeNull();

        slides[0].markdown = oldMarkdown;
    });

    it("opens the requested slide from the URL and scrolls to the viewer", () => {
        render(<TestSlides initialSlide={2} />);

        expect(screen.getByRole("img", { name: "Gross margin" })).toHaveAttribute("src", "https://example.com/margin.webp");

        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    });

    it("opens the matched prior slide below the current viewer and can close it", () => {
        render(<TestSlides />);

        expect(screen.queryByRole("region", { name: "Historical comparison" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Compare Q3 FY2025" }));

        const comparison = screen.getByRole("region", { name: "Historical comparison" });

        expect(within(comparison).getByRole("img", { name: "Revenue" })).toHaveAttribute("src", "https://example.com/prior.webp");

        expect(screen.getAllByRole("img", { name: "Revenue" })).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: "Close comparison" }));

        expect(screen.queryByRole("region", { name: "Historical comparison" })).toBeNull();
    });

    it("clears comparison on current slide navigation without restoring a stale selection", () => {
        render(<TestSlides />);

        fireEvent.click(screen.getByRole("button", { name: "Compare Q3 FY2025" }));

        fireEvent.click(screen.getAllByRole("button", { name: "Next slide in Q3 FY2026" })[0]);

        expect(screen.queryByRole("region", { name: "Historical comparison" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Previous slide in Q3 FY2026" }));

        expect(screen.queryByRole("region", { name: "Historical comparison" })).toBeNull();
    });
});
