// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfDocumentSection } from "@/components/pdf/pdf-inline-viewer";

const pdf = (version: number) => ({ bytes: 79_457, pages: 14, url: `https://storage.example.com/transcript-v${version}.pdf` });

afterEach(() => {
    cleanup();

    vi.unstubAllGlobals();

    vi.restoreAllMocks();
});

describe("PdfDocumentSection", () => {
    it("is hidden without a PDF", () => {
        render(<PdfDocumentSection filename="a.pdf" pdf={null} />);

        expect(screen.queryByTestId("pdf-document")).toBeNull();
    });

    it("the version picker moves the open viewer to that version's URL", () => {
        const { rerender } = render(<PdfDocumentSection filename="v2.pdf" pdf={pdf(2)} />);

        expect(screen.getByTestId("pdf-document").textContent).toContain("14 pages");

        fireEvent.click(screen.getByText("View"));

        expect(screen.getByTestId("news-pdf-viewer").getAttribute("src")).toBe(pdf(2).url);

        rerender(<PdfDocumentSection filename="v3.pdf" pdf={pdf(3)} />);

        expect(screen.getByTestId("news-pdf-viewer").getAttribute("src")).toBe(pdf(3).url);

        fireEvent.click(screen.getByText("Hide"));

        expect(screen.queryByTestId("news-pdf-viewer")).toBeNull();
    });

    it("downloads through a blob, under the file name", async () => {
        const blob = new Blob(["%PDF"]);

        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob), ok: true }));

        URL.createObjectURL = vi.fn(() => "blob:local");

        URL.revokeObjectURL = vi.fn();

        const names: Array<string> = [];

        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            names.push(this.download);
        });

        render(<PdfDocumentSection filename="FDX-transcript-v2.pdf" pdf={pdf(2)} />);

        fireEvent.click(screen.getByText("Download"));

        await waitFor(() => expect(names).toEqual(["FDX-transcript-v2.pdf"]));

        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local");
    });

    it("opens a new tab when the storage refuses the fetch (no CORS for this origin)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

        const open = vi.spyOn(window, "open").mockImplementation(() => null);

        render(<PdfDocumentSection filename="a.pdf" pdf={pdf(2)} />);

        fireEvent.click(screen.getByText("Download"));

        await waitFor(() => expect(open).toHaveBeenCalledWith(pdf(2).url, "_blank", "noopener"));
    });
});
