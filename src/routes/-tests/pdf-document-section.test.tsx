// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfDocumentSection } from "@/components/pdf/pdf-inline-viewer";
import { PdfViewerError } from "@/components/pdf/pdf-viewer";
import { OBJECT_URL_REVOKE_DELAY_MS } from "@/lib/download";

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

        // The object URL outlives the click (a browser still reading the blob fails a save revoked at once).
        const timers = vi.spyOn(globalThis, "setTimeout");

        render(<PdfDocumentSection filename="FDX-transcript-v2.pdf" pdf={pdf(2)} />);

        fireEvent.click(screen.getByText("Download"));

        await waitFor(() => expect(names).toEqual(["FDX-transcript-v2.pdf"]));

        expect(URL.revokeObjectURL).not.toHaveBeenCalled();

        const revoke = timers.mock.calls.find(([, delay]) => delay === OBJECT_URL_REVOKE_DELAY_MS)?.[0];

        expect(revoke).toBeTypeOf("function");

        (revoke as () => void)();

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

describe("PdfViewerError", () => {
    it("names the reason and links the file instead of a bare error (UI walk F061)", () => {
        render(<PdfViewerError message="Failed to fetch" url="https://storage.example.com/deck.pdf" />);

        expect(screen.getByRole("status").textContent).toContain("The PDF cannot be shown here (Failed to fetch).");

        const link = screen.getByRole("link", { name: "Open the PDF in a new tab" });

        expect(link.getAttribute("href")).toBe("https://storage.example.com/deck.pdf");

        expect(link.getAttribute("target")).toBe("_blank");

        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
});
