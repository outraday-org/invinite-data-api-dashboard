// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2Slide } from "@/lib/api/types";

import { SlidePageViewer } from "@/routes/$ticker/earnings-calls/-components/slide-deck-viewer";

const slides: Array<V2Slide> = [
    { image_url: "https://example.com/slide-2.webp", markdown: "Revenue grew", page: 2, title: "Revenue" },
    { image_url: "https://example.com/slide-5.webp", markdown: null, page: 5, title: "Outlook" },
];

function Viewer() {
    const [page, setPage] = React.useState(2);

    return <SlidePageViewer label="Q3 FY2026" onPageChange={setPage} selectedPage={page} slides={slides} />;
}

afterEach(() => {
    cleanup();

    vi.unstubAllGlobals();
});

describe("SlidePageViewer", () => {
    it("loads the selected page before spending bandwidth on thumbnails", () => {
        render(<Viewer />);

        const activeImage = screen.getByRole("img", { name: "Revenue" });

        const thumbnail = screen.getByRole("button", { name: "Show slide 5: Outlook" }).querySelector("img");

        expect(activeImage).toHaveAttribute("fetchpriority", "high");

        expect(activeImage).toHaveAttribute("loading", "eager");

        expect(thumbnail).not.toHaveAttribute("src");

        fireEvent.load(activeImage);

        expect(thumbnail).toHaveAttribute("src", slides[1].image_url);

        expect(thumbnail).toHaveAttribute("fetchpriority", "low");
    });

    it("warms only the neighboring pages after the selected image loads", () => {
        const warmed: Array<string> = [];

        vi.stubGlobal("Image", class {
            set src(url: string) {
                warmed.push(url);
            }
        });

        const deck = Array.from({ length: 5 }, (_, index) => ({ image_url: `https://example.com/${index + 1}.webp`, markdown: null, page: index + 1, title: `Page ${index + 1}` }));

        render(<SlidePageViewer label="Deck" onPageChange={vi.fn()} selectedPage={3} slides={deck} />);

        expect(warmed).toEqual([]);

        fireEvent.load(screen.getByRole("img", { name: "Page 3" }));

        expect(warmed).toEqual([deck[1].image_url, deck[3].image_url]);
    });

    it("does not warm extra pages when data saving is enabled", () => {
        const image = vi.fn();

        vi.stubGlobal("Image", image);

        vi.stubGlobal("navigator", { connection: { saveData: true } });

        render(<Viewer />);

        fireEvent.load(screen.getByRole("img", { name: "Revenue" }));

        expect(image).not.toHaveBeenCalled();
    });

    it("navigates actual page numbers and disables the boundaries", () => {
        render(<Viewer />);

        expect(screen.getByRole("button", { name: "Previous slide in Q3 FY2026" })).toBeDisabled();

        expect(screen.getByRole("img", { name: "Revenue" })).toHaveAttribute("src", slides[0].image_url);

        fireEvent.click(screen.getByRole("button", { name: "Next slide in Q3 FY2026" }));

        expect(screen.getByRole("img", { name: "Outlook" })).toHaveAttribute("src", slides[1].image_url);

        expect(screen.getByRole("button", { name: "Next slide in Q3 FY2026" })).toBeDisabled();

        fireEvent.keyDown(screen.getByRole("button", { name: "Previous slide in Q3 FY2026" }), { key: "ArrowLeft" });

        expect(screen.getByRole("img", { name: "Revenue" })).toBeInTheDocument();
    });

    it("zooms the page and resets to fit when navigating", () => {
        render(<Viewer />);

        fireEvent.click(screen.getByRole("button", { name: "Zoom in on Q3 FY2026" }));

        expect(screen.getByRole("button", { name: "Fit slide in Q3 FY2026" })).toHaveTextContent("125%");

        expect(screen.getByRole("img", { name: "Revenue" }).parentElement).toHaveStyle({ width: "125%" });

        fireEvent.click(screen.getByRole("button", { name: "Fit slide in Q3 FY2026" }));

        expect(screen.getByRole("img", { name: "Revenue" }).parentElement).toHaveStyle({ width: "100%" });

        fireEvent.click(screen.getByRole("button", { name: "Zoom in on Q3 FY2026" }));

        fireEvent.click(screen.getByRole("button", { name: "Show slide 5: Outlook" }));

        expect(screen.getByRole("button", { name: "Fit slide in Q3 FY2026" })).toHaveTextContent("Fit");

        expect(screen.getByRole("button", { name: "Show slide 5: Outlook" })).toHaveAttribute("aria-pressed", "true");
    });

    it("offers the original image if a slide cannot load and recovers on page change", () => {
        render(<Viewer />);

        fireEvent.error(screen.getByRole("img", { name: "Revenue" }));

        expect(screen.getByRole("status")).toHaveTextContent("This slide image could not be loaded.");

        expect(screen.getByRole("link", { name: "Open the slide in a new tab" })).toHaveAttribute("href", slides[0].image_url);

        expect(screen.getByRole("button", { name: "Show slide 5: Outlook" }).querySelector("img")).toHaveAttribute("src", slides[1].image_url);

        fireEvent.click(screen.getByRole("button", { name: "Next slide in Q3 FY2026" }));

        expect(screen.getByRole("img", { name: "Outlook" })).toBeInTheDocument();

        expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows extracted text only when requested", () => {
        render(<Viewer />);

        expect(screen.queryByText("Revenue grew")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Show slide text in Q3 FY2026" }));

        expect(screen.getByText("Revenue grew")).toBeInTheDocument();
    });
});
