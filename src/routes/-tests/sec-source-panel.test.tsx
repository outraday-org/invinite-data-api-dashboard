// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SecDocumentResponse, SecFigureResponse, V2DocumentFigureResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { NO_PUBLIC_COPY, SecBlocksView, SecFigureView, SecManifestView, V2FilingDocumentsView } from "@/components/sec/sec-source-panel";
import { ApiRequestError } from "@/lib/api/errors";
import { SEC_DOCUMENT, SEC_MANIFEST } from "@/lib/sec/sec-fixtures";
import { isRecord } from "@/lib/sec/source";
import { V2_DOCUMENT_VERSION, V2_FILING_10K } from "@/lib/sec/v2-fixtures";

// The views are rendered with their data directly: keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useSecDocumentBlocks: vi.fn(),
    useSecFigure: vi.fn(),
    useSecFilingManifest: vi.fn(),
    useV2DocumentFigure: vi.fn(),
    useV2DocumentVersion: vi.fn(),
    useV2Filing: vi.fn(),
}));

afterEach(cleanup);

const VERSION = "402affed-8245-5fe1-814d-d025f60db4ac";

const block = (id: string, extra: Record<string, unknown> = {}) => ({
    citation: { block_id: id, page: 9, printed: "F-7", version_id: VERSION },
    footnote_refs: [],
    id,
    kind: "paragraph",
    neighbors: { next: null, prev: null },
    page: { ordinal: 9, printed: "F-7" },
    text: `Text of ${id}`,
    ...extra,
});

type DocumentPatch = Pick<Partial<SecDocumentResponse>, "blocks" | "footnotes" | "quality" | "readiness">;

const documentWith = (patch: DocumentPatch): SecDocumentResponse => ({ ...SEC_DOCUMENT, ...patch });

const noop = () => undefined;

describe("SecManifestView", () => {
    it("lists every document with role, MIME, true size, readiness and 'No public copy yet' for a null source", () => {
        render(<SecManifestView data={SEC_MANIFEST} error={null} isLoading={false} onRead={noop} selectedFilename={null} />);

        const row = screen.getByText("a8-kex991q4202609262026.htm").closest("tr")!;

        expect(within(row).getByText("Exhibit")).toBeInTheDocument();

        expect(within(row).getByText("text/html")).toBeInTheDocument();

        // size_bytes 172036 (the document), not stored_size_bytes 9686 (gzip).
        expect(within(row).getByText("168.0 KB")).toBeInTheDocument();

        expect(within(row).getByText("Text ready")).toBeInTheDocument();

        expect(within(row).getByText("Visual ready")).toBeInTheDocument();

        expect(within(row).getByText(NO_PUBLIC_COPY)).toBeInTheDocument();

        expect(within(row).queryByRole("link")).toBeNull();
    });

    it("partial OCR: visual availability and text status shown apart; no Read without a version", () => {
        render(<SecManifestView data={SEC_MANIFEST} error={null} isLoading={false} onRead={noop} selectedFilename={null} />);

        const graphic = screen.getByText("aapl-20261102_g1.jpg").closest("tr")!;

        expect(within(graphic).getByText("Text not ready")).toBeInTheDocument();

        expect(within(graphic).getByText("Visual ready")).toBeInTheDocument();

        expect(within(graphic).queryByRole("button", { name: /Read/ })).toBeNull();
    });

    it("Read opens a document with a canonical version", () => {
        const onRead = vi.fn();

        render(<SecManifestView data={SEC_MANIFEST} error={null} isLoading={false} onRead={onRead} selectedFilename={null} />);

        fireEvent.click(within(screen.getByText("aapl-20261102.htm").closest("tr")!).getByRole("button", { name: /Read/ }));

        expect(onRead).toHaveBeenCalledWith(expect.objectContaining({ filename: "aapl-20261102.htm" }));
    });

    it("a permanent public copy is linked", () => {
        const first = SEC_MANIFEST.documents?.[0];

        const data = {
            ...SEC_MANIFEST,
            documents: [isRecord(first) ? { ...first, source: { url: "https://storage-prod.invinite.com/sec/abc/aapl.htm" } } : {}],
        };

        render(<SecManifestView data={data} error={null} isLoading={false} onRead={noop} selectedFilename={null} />);

        expect(screen.getByRole("link", { name: /Original/ })).toHaveAttribute("href", "https://storage-prod.invinite.com/sec/abc/aapl.htm");
    });
});

describe("SecBlocksView", () => {
    it("live answer: no printed label → the ordinal, citation version + block, EDGAR as an outbound link", () => {
        render(<SecBlocksView data={SEC_DOCUMENT} error={null} isLoading={false} onSelect={noop} renderFigure={() => null} />);

        expect(screen.getAllByText("p. 1 (ordinal)").length).toBe(3);

        expect(screen.getByText(`version ${VERSION} · block b00002 · p. 1 (ordinal)`)).toBeInTheDocument();

        expect(screen.getByRole("link", { name: /View on EDGAR/ })).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.sec\.gov\//));
    });

    it("a trusted printed label is shown exactly; an untrusted one falls back to the ordinal", () => {
        const trusted = documentWith({ blocks: [block("b00010")], quality: { printed_labels_trusted: true } });

        const { unmount } = render(<SecBlocksView data={trusted} error={null} isLoading={false} onSelect={noop} renderFigure={() => null} />);

        expect(screen.getByText("p. F-7")).toBeInTheDocument();

        unmount();

        const untrusted = documentWith({ blocks: [block("b00010")], quality: { printed_labels_trusted: false } });

        render(<SecBlocksView data={untrusted} error={null} isLoading={false} onSelect={noop} renderFigure={() => null} />);

        expect(screen.queryByText("p. F-7")).toBeNull();

        expect(screen.getByText("p. 9 (ordinal)")).toBeInTheDocument();

        expect(screen.getByText(/Printed page labels not trusted/)).toBeInTheDocument();
    });

    it("next / previous blocks stay in the same version (block selectors)", () => {
        const onSelect = vi.fn();

        render(<SecBlocksView data={documentWith({ blocks: [block("b00045")] })} error={null} isLoading={false} onSelect={onSelect} renderFigure={() => null} />);

        fireEvent.click(screen.getByRole("button", { name: /Next blocks/ }));

        expect(onSelect).toHaveBeenLastCalledWith("b00007-b9999999");

        fireEvent.click(screen.getByRole("button", { name: /Previous blocks/ }));

        expect(onSelect).toHaveBeenLastCalledWith("b00005-b00044");
    });

    it("footnotes: the referenced text beside the block, a click navigates to it", () => {
        const onSelect = vi.fn();

        const data = documentWith({
            blocks: [block("b00010", { footnote_refs: ["b00099"] })],
            footnotes: [block("b00099", { kind: "footnote", text: "(1) Excludes restricted cash." })],
        });

        render(<SecBlocksView data={data} error={null} isLoading={false} onSelect={onSelect} renderFigure={() => null} />);

        expect(screen.getByText("(1) Excludes restricted cash.")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Footnote b00099" }));

        expect(onSelect).toHaveBeenCalledWith("b00099-b9999999");
    });

    it("a figure block opens its figure on a click (and only then)", () => {
        const renderFigure = vi.fn(() => <div>figure body</div>);

        const data = documentWith({ blocks: [block("b00020", { figure: { alt: "Chart", caption: null, image_status: "stored" }, kind: "figure" })] });

        render(<SecBlocksView data={data} error={null} isLoading={false} onSelect={noop} renderFigure={renderFigure} />);

        expect(screen.queryByText("figure body")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /Open figure/ }));

        expect(screen.getByText("figure body")).toBeInTheDocument();

        expect(renderFigure).toHaveBeenCalledWith(expect.objectContaining({ id: "b00020" }), VERSION);
    });

    it("pending text (202): the pending notice, never 'no blocks'", () => {
        const data = documentWith({ blocks: [], readiness: { reason: "ocr_pending", recoverable: true, status: "pending" } });

        render(<SecBlocksView data={data} error={null} isLoading={false} onSelect={noop} renderFigure={() => null} />);

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.getByText("ocr pending")).toBeInTheDocument();

        expect(screen.queryByText("No blocks in this selection.")).toBeNull();
    });
});

describe("SecFigureView", () => {
    const base: SecFigureResponse = {
        api_schema: "secdoors.v1",
        citation: { block_id: "b00020", version_id: VERSION },
        figure: { alt: "Revenue chart", caption: null, image_status: "stored" },
        image: { url: "https://storage-prod.invinite.com/sec/tok/g1.jpg" },
        readiness: { reason: null, recoverable: false, status: "ready" },
        version_id: VERSION,
    };

    it("shows the permanent public image", () => {
        render(<SecFigureView data={base} error={null} isLoading={false} />);

        expect(screen.getByRole("img", { name: "Revenue chart" })).toHaveAttribute("src", "https://storage-prod.invinite.com/sec/tok/g1.jpg");
    });

    it("no public image: the not_ready notice, no <img>", () => {
        render(<SecFigureView data={{ ...base, image: null, readiness: { reason: "image_not_public", recoverable: false, status: "not_ready" } }} error={null} isLoading={false} />);

        expect(screen.queryByRole("img")).toBeNull();

        expect(screen.getByText("The image has no public copy yet")).toBeInTheDocument();
    });
});

describe("SecReadinessNotice", () => {
    const state = (status: number, error: string, code: string) => new ApiRequestError(status, { code, error, message: "server words" });

    it.each([
        [403, "excluded", "Outside the SEC store's coverage"],
        [404, "unknown", "Not known to the SEC store"],
        [424, "failed", "The SEC store could not process this"],
        [503, "not_ready", "This SEC capability is not switched on yet"],
    ])("%i %s renders its state", (status, error, title) => {
        render(<SecReadinessNotice error={state(status, error, "some_reason")} />);

        expect(screen.getByText(title)).toBeInTheDocument();

        expect(screen.getByText("some reason")).toBeInTheDocument();
    });

    it("202 pending (an answer, not an error) renders the pending notice", () => {
        render(<SecReadinessNotice readiness={{ reason: "sections_not_projected", status: "pending" }} />);

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.getByText("The section outline is not built yet")).toBeInTheDocument();
    });

    it("the plan gate names STANDARD; a ready answer renders nothing", () => {
        const { container, unmount } = render(<SecReadinessNotice readiness={{ reason: null, status: "ready" }} />);

        expect(container).toBeEmptyDOMElement();

        unmount();

        render(<SecReadinessNotice error={new ApiRequestError(403, { error: "Forbidden", message: "x" })} />);

        expect(screen.getByText("STANDARD")).toBeInTheDocument();
    });
});

describe("v2 filing documents (`/v2/filings/{accession}?expand=documents`)", () => {
    it("lists filename, EDGAR type, description, the public copy or 'No public copy yet', and Read only with a current version", () => {
        const onRead = vi.fn();

        render(<V2FilingDocumentsView data={V2_FILING_10K} error={null} isLoading={false} onRead={onRead} selectedFilename={null} />);

        const primary = screen.getByText("aapl-20260926.htm").closest("tr")!;

        expect(within(primary).getByRole("link", { name: /Original/ })).toHaveAttribute("href", expect.stringMatching(/^https:\/\/storage\.invinite\.com\/sec\//));

        fireEvent.click(within(primary).getByRole("button", { name: /Read/ }));

        expect(onRead).toHaveBeenCalledWith(expect.objectContaining({ currentVersionId: "8be0b759-1a9d-5f89-8308-bd86185f5e1f" }));

        const exhibit = screen.getByText("a10-kexhibit4109262026.htm").closest("tr")!;

        expect(within(exhibit).getByText(NO_PUBLIC_COPY)).toBeInTheDocument();

        const schema = screen.getByText("aapl-20260926.xsd").closest("tr")!;

        expect(within(schema).queryByRole("button")).toBeNull();

        expect(within(schema).getByText("No readable version")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: /EDGAR index/ })).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.sec\.gov\//));
    });

    it("a v2 problem (404 not_covered) is a state, not an empty list", () => {
        const problem = new ApiRequestError(404, { error: "not_covered", message: "This filing is not in the SEC store" });

        render(<V2FilingDocumentsView data={null} error={problem} isLoading={false} onRead={noop} selectedFilename={null} />);

        expect(screen.getByText("Not known to the SEC store")).toBeInTheDocument();

        expect(screen.getByText("This filing is not in the SEC store")).toBeInTheDocument();
    });
});

describe("SecBlocksView over a v2 document version", () => {
    it("reads version.id, the EDGAR source.url and pages inside the version", () => {
        const onSelect = vi.fn();

        render(<SecBlocksView data={V2_DOCUMENT_VERSION} error={null} isLoading={false} onSelect={onSelect} renderFigure={() => null} />);

        expect(screen.getByText("Version 8be0b759-1a9d-5f89-8308-bd86185f5e1f")).toBeInTheDocument();

        expect(screen.getByText("65 pages")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: /View on EDGAR/ })).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.sec\.gov\//));

        fireEvent.click(screen.getByRole("button", { name: /Next blocks/ }));

        expect(onSelect).toHaveBeenLastCalledWith("b00003-b9999999");
    });

    it("an empty v2 selection says so (no readiness on v2: an answer is ready)", () => {
        render(<SecBlocksView data={{ ...V2_DOCUMENT_VERSION, blocks: [] }} error={null} isLoading={false} onSelect={noop} renderFigure={() => null} />);

        expect(screen.getByText("No blocks in this selection.")).toBeInTheDocument();
    });

    it("a v2 figure without an image: 'The image has no public copy yet'", () => {
        const figure: V2DocumentFigureResponse = { citation: {}, figure: { alt: "Chart" }, image: null, version_id: "8be0b759-1a9d-5f89-8308-bd86185f5e1f" };

        render(<SecFigureView data={figure} error={null} isLoading={false} />);

        expect(screen.queryByRole("img")).toBeNull();

        expect(screen.getByText("The image has no public copy yet")).toBeInTheDocument();
    });
});
