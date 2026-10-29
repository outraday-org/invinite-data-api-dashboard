// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { edgarItem, newsDetail, newsroomItem } from "@/lib/news/news-fixtures";
import { NewsItemView } from "@/routes/$ticker/news/-components/news-item-panel";
import { NewsPageView } from "@/routes/$ticker/news/index";

// The page module's route needs a router; the pure views do not.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));

// Keep the server functions (TanStack Start) unloaded; the asset button's mutation is idle.
vi.mock("@/lib/api/queries", () => ({
    useApiBaseUrl: vi.fn(() => null),
    useCompanyDetails: vi.fn(() => ({ data: null })),
    useNewsAssetDownload: vi.fn(() => ({ error: null, isPending: false, mutate: vi.fn() })),
    useNewsInfinite: vi.fn(),
    useNewsItem: vi.fn(),
}));

afterEach(cleanup);

const pageProps = {
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    onLoadMore: () => undefined,
    onOpen: () => undefined,
    scopeLabel: "News about NVDA",
};

describe("NewsPageView", () => {
    it("lists items with their publisher, source and kind; opens one; loads more by cursor", () => {
        const onOpen = vi.fn();

        const onLoadMore = vi.fn();

        render(
            <NewsPageView
                {...pageProps}
                hasNextPage
                items={[newsroomItem(), edgarItem()]}
                liveIds={new Set([newsroomItem().id])}
                onLoadMore={onLoadMore}
                onOpen={onOpen}
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

        fireEvent.click(screen.getByText("Load more"));

        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it("says when the window is empty", () => {
        render(<NewsPageView {...pageProps} items={[]} />);

        expect(screen.getByText("No news in this window.")).toBeTruthy();

        expect(screen.queryByText("Load more")).toBeNull();
    });

    it("renders the plan gate as a notice, not an error", () => {
        render(<NewsPageView {...pageProps} error={new ApiRequestError(403, { error: "Forbidden", message: "Upgrade" })} items={[]} />);

        expect(screen.getByText("Your plan does not include news")).toBeTruthy();
    });
});

describe("NewsItemView", () => {
    it("shows the attribution block above an EDGAR item's text (form + accession)", () => {
        const item = edgarItem();

        render(<NewsItemView data={newsDetail(item)} error={null} isLoading={false} onOpen={() => undefined} />);

        const block = screen.getByLabelText("Attribution");

        expect(within(block).getByText("8-K · 0001045810-26-000123")).toBeTruthy();

        expect(within(block).getByText(item.attribution.source_url)).toBeTruthy();

        expect(within(block).getByText(/Reproduced verbatim from the publisher/)).toBeTruthy();

        const body = screen.getByTestId("news-body");

        // The block comes first in document order.
        expect(block.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows headline-and-link only, never an empty text block, for an item without text", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                data={newsDetail(item, { body_text: null, content_status: "no_text", text_url: null })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        expect(screen.queryByTestId("news-body")).toBeNull();

        expect(screen.getByText("Headline and link only")).toBeTruthy();

        expect(screen.getByText("Open at source").getAttribute("href")).toBe(item.attribution.source_url);

        expect(within(screen.getByLabelText("Attribution")).getByText(/© NVIDIA Corporation/)).toBeTruthy();
    });

    it("labels a planned development as planned and cites its quote; keeps an image's credit; lists sightings", () => {
        const item = newsroomItem();

        render(
            <NewsItemView
                data={newsDetail(item, {
                    assets: [{
                        alt: "Rubin GPU",
                        byte_size: 120_000,
                        can_display: true,
                        can_download: false,
                        caption: "The Rubin GPU",
                        content_type: "image/jpeg",
                        copyright_notice: null,
                        credit: "Photo: NVIDIA",
                        download_url: `/v1/news/${item.id}/assets/a1/download`,
                        height: 800,
                        id: "00000000-0000-4000-8000-0000000000a1",
                        kind: "image",
                        original_url: "https://nvidianews.nvidia.com/rubin.jpg",
                        title: null,
                        width: 1200,
                    }],
                    developments: [{
                        announced_at: "2026-10-29T13:03:22.000Z",
                        claim_status: "planned",
                        confidence: "high",
                        counterparties: [],
                        date_precision: "quarter",
                        derived: true,
                        effective_date_text: "second half of 2027",
                        effective_from: null,
                        effective_to: null,
                        evidence: [{ block_id: "b1", end: 40, quote: "Rubin will be available in the second half of 2027", start: 0 }],
                        id: "00000000-0000-4000-8000-0000000000d1",
                        item_id: item.id,
                        model_processing_allowed: true,
                        products: [{ name: "Rubin" }],
                        revision: 1,
                        summary: "NVIDIA plans to ship Rubin in H2 2027.",
                        title: "Rubin availability",
                        topic: "availability",
                    }],
                })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        const development = screen.getByTestId("news-development");

        expect(within(development).getByText("Planned")).toBeTruthy();

        expect(within(development).getByText("Rubin will be available in the second half of 2027")).toBeTruthy();

        expect(screen.getByText("Credit: Photo: NVIDIA")).toBeTruthy();

        expect(screen.getByText("Show")).toBeTruthy();

        expect(screen.getByText("Company newsroom (nvidianews.nvidia.com)", { selector: "a" })).toBeTruthy();
    });

    it("renders 404 and the plan gate as states", () => {
        const { rerender } = render(
            <NewsItemView data={null} error={new ApiRequestError(404, { error: "not_found", message: "x" })} isLoading={false} onOpen={() => undefined} />,
        );

        expect(screen.getByText("This news item is not available")).toBeTruthy();

        rerender(<NewsItemView data={null} error={new ApiRequestError(403, { error: "Forbidden", message: "x" })} isLoading={false} onOpen={() => undefined} />);

        expect(screen.getByText("Your plan does not include news text")).toBeTruthy();
    });
});
