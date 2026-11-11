// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsDevelopment } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { edgarItem, newsroomItem, newsText } from "@/lib/news/news-fixtures";
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
    useNewsAnnouncements: vi.fn(),
    useNewsItem: vi.fn(),
    useNewsPage: vi.fn(),
    useNewsText: vi.fn(),
    useV2Company: vi.fn(() => ({ data: null })),
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

    it("never looks empty while the page-side filters hid every row and older news follows: it offers the next page", () => {
        const onNext = vi.fn();

        render(<NewsPageView {...pageProps} hiddenByFilters={50} items={[]} pager={{ ...pageProps.pager, hasNext: true, onNext }} />);

        expect(screen.queryByText("No news in this window.")).toBeNull();

        const filtered = screen.getByTestId("news-filtered-out");

        expect(within(filtered).getByText(/None of the 50 items on this page match the filters; older news follows/u)).toBeTruthy();

        fireEvent.click(within(filtered).getByText("Load the next page"));

        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("says the filters hid the rest on the last page, and counts hidden rows under a shorter page", () => {
        render(<NewsPageView {...pageProps} hiddenByFilters={3} items={[]} />);

        expect(screen.getByText("No news on this page matches the filters.")).toBeTruthy();

        expect(screen.queryByText("Load the next page")).toBeNull();

        cleanup();

        render(<NewsPageView {...pageProps} hiddenByFilters={1} items={[edgarItem()]} />);

        expect(screen.getAllByTestId("news-row")).toHaveLength(1);

        expect(screen.getByText("1 more item on this page hidden by the filters.")).toBeTruthy();
    });

    it("renders the plan gate as a notice, not an error", () => {
        render(<NewsPageView {...pageProps} error={new ApiRequestError(403, { error: "Forbidden", message: "Upgrade" })} items={[]} />);

        expect(screen.getByText("Your plan does not include news")).toBeTruthy();
    });
});

describe("NewsFilters", () => {
    it("offers no Has media filter", () => {
        render(<NewsFilters categories={[]} onChange={vi.fn()} search={{}} tags={[]} />);

        expect(screen.queryByText("Has media")).toBeNull();

        // v2 has no market-wide feed (a company scope is required): no scope switch.
        expect(screen.queryByText("Whole market")).toBeNull();

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
    item: {
        attribution: newsroomItem().attribution,
        title: newsroomItem().title,
        url: newsroomItem().url,
    },
    model_processing_allowed: true,
    products: [{ name: "Rubin" }],
    revision: 1,
    summary: "NVIDIA plans to ship Rubin in H2 2027.",
    title: "Rubin availability",
    topic: "availability",
};

const PDF = { bytes: 184_233, generated_at: "2026-10-30T00:03:11.000Z", pages: 3, sha256: "ab", url: "https://storage.example.com/r1.pdf", version: 1 };

describe("NewsItemView (v2: the item row + /text blocks + /v1/announcements?item=)", () => {
    it("shows the attribution block above an EDGAR item's summary (form + accession)", () => {
        const item = edgarItem();

        render(<NewsItemView announcements={[]} error={null} isLoading={false} item={item} text={newsText(item)} />);

        const block = screen.getByLabelText("Attribution");

        expect(within(block).getByText("8-K · 0001045810-26-000123")).toBeTruthy();

        expect(within(block).getByText(item.attribution.source_url)).toBeTruthy();

        expect(within(block).getByText(/Summary written by Invinite/)).toBeTruthy();

        const body = screen.getByTestId("news-summary");

        // The block comes first in document order.
        expect(block.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders header → lede → summary → announcements, in that order (no sightings or companies in v2)", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                announcements={[{ ...DEVELOPMENT, item_id: item.id }]}
                error={null}
                isLoading={false}
                item={item}
                text={newsText(item)}
            />,
        );

        const order = [
            screen.getByLabelText("Attribution"),
            screen.getByTestId("news-lede"),
            screen.getByTestId("news-summary"),
            screen.getByTestId("news-development"),
        ];

        for (const [index, node] of order.slice(1).entries()) {
            expect(order[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }

        expect(screen.getByTestId("news-lede").textContent).toBe(item.description);

        expect(screen.getByText("Summary by Invinite · 180 words")).toBeTruthy();

        expect(screen.queryByTestId("pdf-document")).toBeNull();

        expect(screen.queryByText("Seen on")).toBeNull();
    });

    it("shows the item's branded PDF inline from the v2 item's pdf (owner decision 2026-11-09), hidden without one", () => {
        const item = newsroomItem({ pdf: PDF });

        render(<NewsItemView announcements={[]} error={null} isLoading={false} item={item} text={newsText(item)} />);

        expect(screen.getByTestId("pdf-document").textContent).toContain("3 pages");

        expect(screen.getByText("Open in new tab").closest("a")?.getAttribute("href")).toBe(PDF.url);

        fireEvent.click(screen.getByText("View"));

        expect(screen.getByTestId("news-pdf-viewer").getAttribute("src")).toBe(PDF.url);

        // After the summary and the announcements.
        expect(screen.getByTestId("news-summary").compareDocumentPosition(screen.getByTestId("pdf-document")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders the blocks as React elements: headings, paragraphs and lists (bullets dropped), no injected HTML", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                announcements={[]}
                error={null}
                isLoading={false}
                item={item}
                text={newsText(item, {
                    blocks: [
                        ...newsText(item).blocks,
                        { block_id: "00000000-0000-4000-8000-0000000000b9", heading: null, index: 4, kind: "paragraph", text: "<script>window.pwned = 1</script>" },
                    ],
                })}
            />,
        );

        const body = screen.getByTestId("news-summary");

        expect(within(body).getByRole("heading", { level: 2, name: "Availability" })).toBeTruthy();

        expect([...body.querySelectorAll("li")].map(li => li.textContent)).toEqual(["Six new chips", "One rack-scale system"]);

        expect(body.querySelectorAll("p")).toHaveLength(3);

        expect(body.querySelector("script")).toBeNull();

        expect(body.textContent).toContain("<script>");
    });

    it("shows headline-and-link only, never an empty text block, for an item without a summary", () => {
        const item = newsroomItem({ description: null, summary_words: null });

        render(
            <NewsItemView
                announcements={[]}
                error={null}
                isLoading={false}
                item={item}
                text={newsText(item, { blocks: [], content_status: "no_text" })}
            />,
        );

        expect(screen.queryByTestId("news-summary")).toBeNull();

        expect(screen.queryByTestId("news-lede")).toBeNull();

        expect(screen.getByText("Headline and link only")).toBeTruthy();

        expect(screen.getByText("Open at source").getAttribute("href")).toBe(item.attribution.source_url);

        expect(within(screen.getByLabelText("Attribution")).getByText(/© NVIDIA Corporation/)).toBeTruthy();
    });

    it("labels a planned announcement as planned, without evidence quotes; no media section", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                announcements={[{ ...DEVELOPMENT, item_id: item.id }]}
                error={null}
                isLoading={false}
                item={item}
                text={newsText(item)}
            />,
        );

        const development = screen.getByTestId("news-development");

        expect(within(development).getByText("Planned")).toBeTruthy();

        expect(development.querySelector("blockquote")).toBeNull();

        expect(screen.queryByText("Images and files")).toBeNull();

        expect(screen.queryByTestId("news-image")).toBeNull();
    });

    it("renders the item while its text loads, and a failed text read as an error state", () => {
        const item = newsroomItem();

        const { rerender } = render(<NewsItemView announcements={[]} error={null} isLoading={false} item={item} text={null} />);

        expect(screen.getByLabelText("Attribution")).toBeTruthy();

        expect(screen.queryByTestId("news-summary")).toBeNull();

        rerender(
            <NewsItemView
                announcements={[]}
                error={null}
                isLoading={false}
                item={item}
                text={null}
                textError={new ApiRequestError(500, { error: "internal", message: "x" })}
            />,
        );

        expect(screen.getByText("Failed to load the summary")).toBeTruthy();
    });

    it("renders 404 and the plan gate as states", () => {
        const { rerender } = render(
            <NewsItemView announcements={[]} error={new ApiRequestError(404, { error: "not_found", message: "x" })} isLoading={false} item={null} text={null} />,
        );

        expect(screen.getByText("This news item is not available")).toBeTruthy();

        rerender(<NewsItemView announcements={[]} error={new ApiRequestError(403, { error: "Forbidden", message: "x" })} isLoading={false} item={null} text={null} />);

        expect(screen.getByText("Your plan does not include news summaries")).toBeTruthy();
    });
});
