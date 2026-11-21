// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TranscriptDownloads } from "@/routes/$ticker/earnings-calls/-components/transcript/transcript-toolbar";

import { TranscriptToolbar } from "@/routes/$ticker/earnings-calls/-components/transcript/transcript-toolbar";

const saved = vi.hoisted(() => ({ json: vi.fn(), public: vi.fn(), text: vi.fn() }));

vi.mock("@/lib/download", () => ({ saveJsonFile: saved.json, savePublicFile: saved.public, saveTextFile: saved.text }));

// The browser-native PDF view is the viewer's own test; here only that the dialog mounts it.
vi.mock("@/components/pdf/pdf-inline-viewer", () => ({
    PdfInlineViewer: ({ filename, url }: { filename: string; url: string }) => <div data-testid="pdf-viewer">{`${filename} ${url}`}</div>,
}));

// The Q&A start button needs the call player; its own test covers it.
vi.mock("@/routes/$ticker/earnings-calls/-components/tabs/transcript-turns", () => ({ QaStart: () => null }));

afterEach(() => {
    cleanup();

    vi.clearAllMocks();
});

const DOWNLOADS: TranscriptDownloads = {
    audio: { download: { filename: "NVDA-Q3-FY2027-call.mp3", url: "https://storage.example/call.mp3" } },
    baseName: "NVDA-Q3-FY2027-transcript-v3",
    json: { version: 3 },
    pdf: { url: "https://storage.example/transcript.pdf" },
    text: "Ann Lee: Good morning",
};

function renderToolbar(downloads: TranscriptDownloads = DOWNLOADS) {
    render(
        <TranscriptToolbar
            canCopy
            downloads={downloads}
            format="speakers"
            onCompare={null}
            onCopy={() => {}}
            onFormatChange={() => {}}
            onVersionChange={() => {}}
            qaStartMs={null}
            shownVersion={3}
            versions={[]}
        />,
    );
}

async function pick(item: string) {
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    fireEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("TranscriptToolbar", () => {
    it("saves the PDF, the plain text, the JSON and the recording under the call's file names", async () => {
        renderToolbar();

        await pick("PDF (.pdf)");

        expect(saved.public).toHaveBeenLastCalledWith("https://storage.example/transcript.pdf", "NVDA-Q3-FY2027-transcript-v3.pdf");

        await pick("Plain text (.txt)");

        expect(saved.text).toHaveBeenCalledWith("Ann Lee: Good morning", "NVDA-Q3-FY2027-transcript-v3.txt");

        await pick("JSON of this answer (.json)");

        expect(saved.json).toHaveBeenCalledWith({ version: 3 }, "NVDA-Q3-FY2027-transcript-v3.json");

        await pick("Audio");

        expect(saved.public).toHaveBeenLastCalledWith("https://storage.example/call.mp3", "NVDA-Q3-FY2027-call.mp3");
    });

    it("opens \"View PDF\" in a dialog", async () => {
        renderToolbar();

        expect(screen.queryByTestId("pdf-viewer")).toBeNull();

        await pick("View PDF");

        await waitFor(() => expect(screen.getByTestId("pdf-viewer")).toHaveTextContent("NVDA-Q3-FY2027-transcript-v3.pdf https://storage.example/transcript.pdf"));
    });

    it("offers no PDF without one and no audio for a call without a recording", async () => {
        renderToolbar({ ...DOWNLOADS, audio: null, pdf: null });

        fireEvent.click(screen.getByRole("button", { name: "Download" }));

        await screen.findByRole("menuitem", { name: "Plain text (.txt)" });

        expect(screen.queryByRole("menuitem", { name: "View PDF" })).toBeNull();

        expect(screen.queryByRole("menuitem", { name: /Audio/ })).toBeNull();
    });
});
