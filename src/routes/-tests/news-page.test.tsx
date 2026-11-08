// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsDevelopment } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { edgarItem, newsDetail, newsroomItem, SUMMARY_TEXT } from "@/lib/news/news-fixtures";
import { NewsFilters } from "@/routes/$ticker/news/-components/news-filters";
import { NewsItemView } from "@/routes/$ticker/news/-components/news-item-panel";
import { NewsPageView } from "@/routes/$ticker/news/index";

// The page module's route needs a router; the pure views do not.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useApiBaseUrl: vi.fn(() => null),
    useCompanyDetails: vi.fn(() => ({ data: null })),
    useNewsItem: vi.fn(),
    useNewsPage: vi.fn(),
}));

afterEach(() => {
    cleanup();

    vi.restoreAllMocks();
});

const pageProps = {
    error: null,
    isLoading: false,
    onOpen: () => undefined,
    pager: { hasNext: false, isFetching: false, onNext: () => undefined, onPrevious: () => undefined, page: 1 },
    scopeLabel: "News about NVDA",
};

describe("NewsPageView", () => {
    it("lists items with their publisher, source and kind; opens one; pages on by cursor", () => {
        const onOpen = vi.fn();

        const onNext = vi.fn();

        render(
            <NewsPageView
                {...pageProps}
                items={[newsroomItem(), edgarItem()]}
                liveIds={new Set([newsroomItem().id])}
                onOpen={onOpen}
                pager={{ ...pageProps.pager, hasNext: true, onNext }}
            />,
        );

        const rows = screen.getAllByTestId("news-row");

        expect(rows).toHaveLength(2);

        expect(within(rows[0]).getByText("Published by NVIDIA Corporation")).toBeTruthy();

        expect(within(rows[0]).getByText("Company newsroom (nvidianews.nvidia.com)")).toBeTruthy();

        expect(within(rows[0]).getByText("New")).toBeTruthy();

        // An SEC filing names its publisher, but no issuer published it on a newsroom.
        expect(within(rows[1]).getByText("By NVIDIA Corporation")).toBeTruthy();

        expect(within(rows[1]).getByText("SEC EDGAR")).toBeTruthy();

        expect(within(rows[1]).getByText("Earnings")).toBeTruthy();

        fireEvent.click(within(rows[1]).getByText("NVIDIA Announces Financial Results for Third Quarter Fiscal 2027"));

        expect(onOpen).toHaveBeenCalledWith(edgarItem().id);

        const pager = screen.getByTestId("news-pager");

        expect(within(pager).getByText("Page 1")).toBeTruthy();

        expect((within(pager).getByText("Previous").closest("button") as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(within(pager).getByText("Next"));

        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("pages back from a later page and ends Next on the last page", () => {
        const onPrevious = vi.fn();

        render(<NewsPageView {...pageProps} items={[edgarItem()]} pager={{ ...pageProps.pager, onPrevious, page: 3 }} />);

        const pager = screen.getByTestId("news-pager");

        expect(within(pager).getByText("Page 3")).toBeTruthy();

        expect((within(pager).getByText("Next").closest("button") as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(within(pager).getByText("Previous"));

        expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it("has no media column (API 2.0.0 serves no media)", () => {
        render(<NewsPageView {...pageProps} items={[newsroomItem(), edgarItem()]} />);

        expect(screen.queryByText("Media")).toBeNull();

        expect(screen.queryByTestId("news-media")).toBeNull();
    });

    it("says when the window is empty", () => {
        render(<NewsPageView {...pageProps} items={[]} />);

        expect(screen.getByText("No news in this window.")).toBeTruthy();

        // One page: no pager.
        expect(screen.queryByTestId("news-pager")).toBeNull();
    });

    it("renders the plan gate as a notice, not an error", () => {
        render(<NewsPageView {...pageProps} error={new ApiRequestError(403, { error: "Forbidden", message: "Upgrade" })} items={[]} />);

        expect(screen.getByText("Your plan does not include news")).toBeTruthy();
    });
});

describe("NewsFilters", () => {
    it("offers no Has media filter", () => {
        render(<NewsFilters categories={[]} onChange={vi.fn()} search={{}} tags={[]} ticker="NVDA" />);

        expect(screen.queryByText("Has media")).toBeNull();

        expect(screen.getByText("Company-published")).toBeTruthy();
    });
});

const DEVELOPMENT: Omit<NewsDevelopment, "item_id"> = {
    announced_at: "2026-10-29T13:03:22.000Z",
    claim_status: "planned",
    confidence: "high",
    counterparties: [],
    date_precision: "quarter",
    derived: true,
    effective_date_text: "second half of 2027",
    effective_from: null,
    effective_to: null,
    id: "00000000-0000-4000-8000-0000000000d1",
    model_processing_allowed: true,
    products: [{ name: "Rubin" }],
    revision: 1,
    summary: "NVIDIA plans to ship Rubin in H2 2027.",
    title: "Rubin availability",
    topic: "availability",
};

const PDF = { bytes: 184_233, generated_at: "2026-10-30T00:03:11.000Z", pages: 3, sha256: "ab", url: "https://storage.example.com/r1.pdf", version: 1 };

describe("NewsItemView", () => {
    it("shows the attribution block above an EDGAR item's summary (form + accession)", () => {
        const item = edgarItem();

        render(<NewsItemView data={newsDetail(item)} error={null} isLoading={false} onOpen={() => undefined} />);

        const block = screen.getByLabelText("Attribution");

        expect(within(block).getByText("8-K · 0001045810-26-000123")).toBeTruthy();

        expect(within(block).getByText(item.attribution.source_url)).toBeTruthy();

        expect(within(block).getByText(/Summary written by Invinite/)).toBeTruthy();

        const body = screen.getByTestId("news-summary");

        // The block comes first in document order.
        expect(block.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders header → lede → summary → developments → PDF, in that order", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                data={newsDetail(item, { developments: [{ ...DEVELOPMENT, item_id: item.id }], pdf: PDF })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        const order = [
            screen.getByLabelText("Attribution"),
            screen.getByTestId("news-lede"),
            screen.getByTestId("news-summary"),
            screen.getByTestId("news-development"),
            screen.getByTestId("pdf-document"),
        ];

        for (const [index, node] of order.slice(1).entries()) {
            expect(order[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }

        expect(screen.getByTestId("news-lede").textContent).toBe(item.description);

        expect(screen.getByText("Summary by Invinite · 180 of 260 words")).toBeTruthy();
    });

    it("renders summary_html: headings, paragraphs and lists", () => {
        render(<NewsItemView data={newsDetail(newsroomItem())} error={null} isLoading={false} onOpen={() => undefined} />);

        const body = screen.getByTestId("news-summary");

        expect(within(body).getByRole("heading", { level: 2, name: "Availability" })).toBeTruthy();

        expect([...body.querySelectorAll("li")].map(li => li.textContent)).toEqual(["Six new chips", "One rack-scale system"]);

        expect(body.querySelectorAll("p")).toHaveLength(2);
    });

    it("keeps only h2, p, ul, li, strong, em and no attribute of summary_html", () => {
        render(
            <NewsItemView
                data={newsDetail(newsroomItem(), {
                    summary_html: `<p>Text <strong>bold</strong> <em>it</em></p><script>window.pwned = 1</script><img src="https://x.example/p.gif" onerror="window.pwned = 1"><a href="https://x.example">link</a><h3>Deep</h3><table><tr><td>cell</td></tr></table><p style="color:red" class="x" onclick="x()">Styled</p>`,
                })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        const body = screen.getByTestId("news-summary");

        expect(body.querySelector("script, img, a, h3, table, td")).toBeNull();

        expect(body.innerHTML).not.toMatch(/onerror|onclick|style=|class=|href=|src=/);

        expect(body.querySelector("strong")?.textContent).toBe("bold");

        expect(body.querySelector("em")?.textContent).toBe("it");

        // The text of a dropped tag stays.
        expect(body.textContent).toContain("link");
    });

    it("renders summary_text as paragraphs when there is no html", () => {
        render(<NewsItemView data={newsDetail(newsroomItem(), { summary_html: null })} error={null} isLoading={false} onOpen={() => undefined} />);

        const paragraphs = screen.getByTestId("news-summary").querySelectorAll("p");

        expect([...paragraphs].map(p => p.textContent)).toEqual(SUMMARY_TEXT.split("\n\n"));
    });

    it("falls back to summary_text when nothing of summary_html survives the allow-list", () => {
        render(<NewsItemView data={newsDetail(newsroomItem(), { summary_html: "<script>window.pwned = 1</script><img src=\"x\">" })} error={null} isLoading={false} onOpen={() => undefined} />);

        const paragraphs = screen.getByTestId("news-summary").querySelectorAll("p");

        expect([...paragraphs].map(p => p.textContent)).toEqual(SUMMARY_TEXT.split("\n\n"));
    });

    it("shows headline-and-link only, never an empty text block, for an item without a summary", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                data={newsDetail(item, { content_status: "no_text", description: null, source_words: null, summarized_at: null, summary_html: null, summary_text: null, summary_words: null, text_url: null })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        expect(screen.queryByTestId("news-summary")).toBeNull();

        expect(screen.queryByTestId("news-lede")).toBeNull();

        expect(screen.getByText("Headline and link only")).toBeTruthy();

        expect(screen.getByText("Open at source").getAttribute("href")).toBe(item.attribution.source_url);

        expect(within(screen.getByLabelText("Attribution")).getByText(/© NVIDIA Corporation/)).toBeTruthy();
    });

    it("labels a planned development as planned, without evidence quotes; lists sightings; no media section", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                data={newsDetail(item, { developments: [{ ...DEVELOPMENT, item_id: item.id }] })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        const development = screen.getByTestId("news-development");

        expect(within(development).getByText("Planned")).toBeTruthy();

        expect(development.querySelector("blockquote")).toBeNull();

        expect(screen.getByText("Company newsroom (nvidianews.nvidia.com)", { selector: "a" })).toBeTruthy();

        expect(screen.queryByText("Images and files")).toBeNull();

        expect(screen.queryByTestId("news-image")).toBeNull();

        expect(screen.queryByTestId("news-asset")).toBeNull();
    });

    it("shows the item's branded PDF inline, hidden without one", () => {
        const { unmount } = render(<NewsItemView data={newsDetail(newsroomItem())} error={null} isLoading={false} onOpen={() => undefined} />);

        expect(screen.queryByTestId("pdf-document")).toBeNull();

        unmount();

        render(<NewsItemView data={newsDetail(newsroomItem(), { pdf: PDF })} error={null} isLoading={false} onOpen={() => undefined} />);

        expect(screen.getByTestId("pdf-document").textContent).toContain("3 pages");

        expect(screen.getByText("Open in new tab").closest("a")?.getAttribute("href")).toBe(PDF.url);

        fireEvent.click(screen.getByText("View"));

        expect(screen.getByTestId("news-pdf-viewer").getAttribute("src")).toBe(PDF.url);
    });

    it("renders 404 and the plan gate as states", () => {
        const { rerender } = render(
            <NewsItemView data={null} error={new ApiRequestError(404, { error: "not_found", message: "x" })} isLoading={false} onOpen={() => undefined} />,
        );

        expect(screen.getByText("This news item is not available")).toBeTruthy();

        rerender(<NewsItemView data={null} error={new ApiRequestError(403, { error: "Forbidden", message: "x" })} isLoading={false} onOpen={() => undefined} />);

        expect(screen.getByText("Your plan does not include news summaries")).toBeTruthy();
    });
});
