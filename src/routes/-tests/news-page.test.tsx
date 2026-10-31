// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsAsset } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { useNewsAssetDownload } from "@/lib/api/queries";
import { edgarItem, newsDetail, newsroomItem } from "@/lib/news/news-fixtures";
import { NewsFilters } from "@/routes/$ticker/news/-components/news-filters";
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
    useNewsAssetDownload: vi.fn(() => ({ error: null, isPending: false, mutate: vi.fn(), mutateAsync: vi.fn(), reset: vi.fn() })),
    useNewsInfinite: vi.fn(),
    useNewsItem: vi.fn(),
}));

afterEach(() => {
    cleanup();

    vi.restoreAllMocks();
});

const SIGNED = "https://r2.example/news/deck.pdf?X-Amz-Signature=abc";

const pdfAsset = (overrides: Partial<NewsAsset> = {}): NewsAsset => ({
    alt: null,
    byte_size: 1_258_291,
    can_display: false,
    can_download: true,
    caption: null,
    content_type: "application/pdf",
    copyright_notice: null,
    credit: null,
    download_url: "/v1/news/x/assets/p1/download",
    height: null,
    id: "00000000-0000-4000-8000-0000000000b1",
    kind: "original_pdf",
    original_url: "https://nvidianews.nvidia.com/rubin.pdf",
    status: "ready",
    title: "Rubin press release",
    view_url: null,
    width: null,
    ...overrides,
});

const INLINE_ID = "00000000-0000-4000-8000-0000000000c1";

const GALLERY_ID = "00000000-0000-4000-8000-0000000000c2";

const HERO_ID = "00000000-0000-4000-8000-0000000000c3";

const viewUrl = (id: string) => `https://api.data.invinite.com/v1/news/x/assets/${id}/view?exp=1793530800&sig=s`;

/** A ready, displayable image served through its stable view URL. */
const imageAsset = (overrides: Partial<NewsAsset> & { id: string }): NewsAsset => pdfAsset({
    alt: null,
    can_display: true,
    can_download: false,
    content_type: "image/jpeg",
    kind: "gallery_image",
    title: null,
    view_url: viewUrl(overrides.id),
    ...overrides,
});

const ARTICLE_HTML = `<h2>Highlights</h2><p>NVIDIA unveiled <a href="https://nvidia.com/rubin">NVIDIA Rubin</a>.</p>
<figure><img src="${viewUrl(INLINE_ID)}" alt="Rubin" width="1200" height="800" loading="lazy" data-asset-id="${INLINE_ID}"><figcaption>The Rubin GPU</figcaption></figure>
<table><thead><tr><th>Segment</th><th>Q3</th></tr></thead><tbody><tr><td rowspan="2">Data center</td><td>$51.2B</td></tr><tr><td>+66%</td></tr></tbody></table>`;

/** The download mutation answering `purpose` at once (the server function is not loaded). */
function mockDelivery(purpose: "display" | "download") {
    const delivered = { content_type: "application/pdf", credit: null, expires_at: "2026-10-29T20:00:00Z", purpose, url: SIGNED };

    const mutate = vi.fn((_vars: unknown, options?: { onSuccess?: (d: typeof delivered) => void }) => options?.onSuccess?.(delivered));

    const mutateAsync = vi.fn((_vars: { assetId: string; id: string; purpose: string }) => Promise.resolve(delivered));

    const reset = vi.fn();

    vi.mocked(useNewsAssetDownload).mockReturnValue({ error: null, isPending: false, mutate, mutateAsync, reset } as unknown as ReturnType<typeof useNewsAssetDownload>);

    return { mutate, mutateAsync, reset };
}

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

    it("marks an item with media by a paperclip and its count, nothing without", () => {
        render(<NewsPageView {...pageProps} items={[newsroomItem({ media_count: 2 }), edgarItem()]} />);

        const rows = screen.getAllByTestId("news-row");

        expect(within(rows[0]).getByLabelText("2 files").textContent).toBe("2");

        expect(within(rows[1]).queryByTestId("news-media")).toBeNull();
    });

    it("names the Has media filter in the empty state", () => {
        render(<NewsPageView {...pageProps} emptyText="No news with media in this window." items={[]} />);

        expect(screen.getByText("No news with media in this window.")).toBeTruthy();
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

describe("NewsFilters", () => {
    it("toggles Has media in the URL search", () => {
        const onChange = vi.fn();

        const { rerender } = render(<NewsFilters categories={[]} onChange={onChange} search={{}} tags={[]} ticker="NVDA" />);

        fireEvent.click(screen.getByText("Has media"));

        expect(onChange).toHaveBeenLastCalledWith({ media: true });

        rerender(<NewsFilters categories={[]} onChange={onChange} search={{ media: true }} tags={[]} ticker="NVDA" />);

        expect(screen.getByText("Has media").getAttribute("aria-pressed")).toBe("true");

        fireEvent.click(screen.getByText("Has media"));

        expect(onChange).toHaveBeenLastCalledWith({ media: undefined });
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
                        kind: "gallery_image",
                        original_url: "https://nvidianews.nvidia.com/rubin.jpg",
                        status: "ready",
                        title: null,
                        view_url: null,
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

    it("downloads a file in one click: the signed URL is followed at once and kept nowhere", () => {
        const { mutate, reset } = mockDelivery("download");

        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.href).toBe(SIGNED);
        });

        const item = newsroomItem();

        render(<NewsItemView data={newsDetail(item, { assets: [pdfAsset()] })} error={null} isLoading={false} onOpen={() => undefined} />);

        const row = screen.getByTestId("news-asset");

        expect(within(row).getByText("PDF · 1.2 MB")).toBeTruthy();

        expect(within(row).queryByText("Show")).toBeNull();

        fireEvent.click(within(row).getByText("Download"));

        expect(mutate).toHaveBeenCalledWith({ assetId: pdfAsset().id, id: item.id, purpose: "download" }, expect.anything());

        expect(click).toHaveBeenCalledTimes(1);

        expect(reset).toHaveBeenCalled();

        // No link to the signed URL is left in the page, and a single file has no "Download all".
        expect(document.querySelector(`a[href="${SIGNED}"]`)).toBeNull();

        expect(screen.queryByText(/Download all/)).toBeNull();
    });

    it("views a downloadable PDF inline in the panel: View asks for purpose=display", () => {
        const { mutate } = mockDelivery("display");

        const item = newsroomItem();

        render(<NewsItemView data={newsDetail(item, { assets: [pdfAsset()] })} error={null} isLoading={false} onOpen={() => undefined} />);

        expect(screen.queryByTestId("news-pdf-viewer")).toBeNull();

        fireEvent.click(screen.getByText("View"));

        expect(mutate).toHaveBeenCalledWith({ assetId: pdfAsset().id, id: item.id, purpose: "display" }, expect.anything());

        expect(screen.getByTestId("news-pdf-viewer").getAttribute("src")).toBe(SIGNED);

        // Download stays beside the viewer.
        expect(screen.getByText("Download")).toBeTruthy();

        fireEvent.click(screen.getByText("Hide"));

        expect(screen.queryByTestId("news-pdf-viewer")).toBeNull();
    });

    it("opens a PDF in a new tab on a fresh display URL, the tab opened on the click", () => {
        const { mutate } = mockDelivery("display");

        const tab = { close: vi.fn(), location: { href: "" }, opener: {} as unknown };

        const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);

        render(<NewsItemView data={newsDetail(newsroomItem(), { assets: [pdfAsset()] })} error={null} isLoading={false} onOpen={() => undefined} />);

        fireEvent.click(screen.getByText("Open in new tab"));

        expect(open).toHaveBeenCalledWith("", "_blank");

        expect(mutate.mock.calls[0]?.[0]).toMatchObject({ purpose: "display" });

        expect(tab.location.href).toBe(SIGNED);

        expect(tab.opener).toBeNull();
    });

    it("offers no View for a PDF without either grant, nor for an image", () => {
        render(
            <NewsItemView
                data={newsDetail(newsroomItem(), {
                    assets: [
                        pdfAsset({ can_download: false, download_url: null }),
                        pdfAsset({ can_display: true, can_download: false, content_type: "image/png", id: "00000000-0000-4000-8000-0000000000b5", kind: "hero_image" }),
                    ],
                })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        expect(screen.queryByText("View")).toBeNull();

        expect(screen.getByText("Show")).toBeTruthy();

        expect(screen.getByText("At the source")).toBeTruthy();
    });

    it("never follows an inline URL as a download", () => {
        mockDelivery("display");

        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

        render(<NewsItemView data={newsDetail(newsroomItem(), { assets: [pdfAsset()] })} error={null} isLoading={false} onOpen={() => undefined} />);

        fireEvent.click(screen.getByText("Download"));

        expect(click).not.toHaveBeenCalled();

        expect(screen.getByText("This file cannot be downloaded right now.")).toBeTruthy();
    });

    it("downloads all downloadable files of the item, skipping display-only and link-only ones", async () => {
        const { mutateAsync } = mockDelivery("download");

        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

        const second = pdfAsset({ id: "00000000-0000-4000-8000-0000000000b2", title: "Deck" });

        const displayOnly = pdfAsset({ can_display: true, can_download: false, content_type: "image/png", id: "00000000-0000-4000-8000-0000000000b3", kind: "hero_image" });

        const linkOnly = pdfAsset({ can_download: false, download_url: null, id: "00000000-0000-4000-8000-0000000000b4", title: "Logo" });

        const item = newsroomItem();

        render(
            <NewsItemView
                data={newsDetail(item, { assets: [pdfAsset(), second, displayOnly, linkOnly] })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        expect(screen.getAllByText("At the source")).toHaveLength(1);

        fireEvent.click(screen.getByText("Download all (2)"));

        await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(2));

        expect(mutateAsync.mock.calls.map(([vars]) => vars.assetId)).toEqual([pdfAsset().id, second.id]);

        expect(mutateAsync.mock.calls.every(([vars]) => vars.purpose === "download")).toBe(true);
    });

    it("renders body_html as the article: headings, a sideways-scrolling table, inline images with captions, links in a new tab", () => {
        const item = newsroomItem();

        const inline = imageAsset({ caption: "The Rubin GPU", id: INLINE_ID });

        render(
            <NewsItemView
                data={newsDetail(item, { assets: [inline, imageAsset({ caption: "Rubin rack", id: GALLERY_ID })], body_html: ARTICLE_HTML, content_formats: ["text", "html"] })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        const body = screen.getByTestId("news-body");

        expect(within(body).getByRole("heading", { level: 2, name: "Highlights" })).toBeTruthy();

        expect(within(body).getByRole("table").parentElement?.className).toBe("article-table");

        expect(body.querySelector("td[rowspan='2']")).not.toBeNull();

        const image = body.querySelector(`img[data-asset-id='${INLINE_ID}']`);

        expect(image?.getAttribute("src")).toBe(viewUrl(INLINE_ID));

        expect(within(body).getByText("The Rubin GPU", { selector: "figcaption" })).toBeTruthy();

        const link = within(body).getByText("NVIDIA Rubin");

        expect(link.getAttribute("target")).toBe("_blank");

        expect(link.getAttribute("rel")).toBe("noopener noreferrer");

        // The inline image is not repeated below; the other one is.
        const images = screen.getAllByTestId("news-image");

        expect(images).toHaveLength(1);

        expect(within(images[0]).getByText("Rubin rack")).toBeTruthy();
    });

    it("strips scripts, event handlers and non-https URLs from body_html", () => {
        render(
            <NewsItemView
                data={newsDetail(newsroomItem(), {
                    body_html: `<p>Text</p><script>window.pwned = 1</script><img src="${viewUrl(INLINE_ID)}" onerror="window.pwned = 1" data-asset-id="${INLINE_ID}"><img src="http://tracker.example/p.gif"><a href="javascript:alert(1)">bad link</a><p style="color:red" class="x" onclick="x()">Styled</p>`,
                })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        const body = screen.getByTestId("news-body");

        expect(body.querySelector("script")).toBeNull();

        expect(body.innerHTML).not.toMatch(/onerror|onclick|style=|class=|javascript:|tracker\.example/);

        expect(body.querySelectorAll("img")).toHaveLength(1);

        expect(within(body).getByText("bad link").hasAttribute("href")).toBe(false);
    });

    it("renders a text-only item as paragraphs", () => {
        render(
            <NewsItemView data={newsDetail(newsroomItem(), { body_text: "First paragraph.\n\nSecond paragraph,\nsame paragraph." })} error={null} isLoading={false} onOpen={() => undefined} />,
        );

        const paragraphs = screen.getByTestId("news-body").querySelectorAll("p");

        expect([...paragraphs].map(p => p.textContent)).toEqual(["First paragraph.", "Second paragraph,\nsame paragraph."]);
    });

    it("places the hero above the article, unless the article shows it inline; lists PDFs below", () => {
        const hero = imageAsset({ caption: "Hero", id: HERO_ID, kind: "hero_image" });

        const view = (bodyHtml: string) => newsDetail(newsroomItem(), { assets: [hero, pdfAsset()], body_html: bodyHtml });

        const { rerender } = render(<NewsItemView data={view("<p>Article</p>")} error={null} isLoading={false} onOpen={() => undefined} />);

        const figure = screen.getByTestId("news-image");

        expect(within(figure).getByText("Hero")).toBeTruthy();

        expect(figure.compareDocumentPosition(screen.getByTestId("news-body")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        expect(within(screen.getByTestId("news-asset")).getByText("Download")).toBeTruthy();

        rerender(<NewsItemView data={view(`<figure><img src="${viewUrl(HERO_ID)}" data-asset-id="${HERO_ID}"></figure>`)} error={null} isLoading={false} onOpen={() => undefined} />);

        // Contract (defect C): an inline hero is shown once, in the article — neither above it nor in the media below.
        expect(screen.queryByTestId("news-image")).toBeNull();

        expect(screen.getByTestId("news-body").querySelectorAll("img")).toHaveLength(1);

        expect(screen.getAllByTestId("news-asset")).toHaveLength(1);

        expect(within(screen.getByTestId("news-asset")).queryByText("Hero")).toBeNull();
    });

    it("keeps a link-only inline image as the API's \"Image at source\" link and does not list it again below", () => {
        const linkOnly = imageAsset({ caption: "Plant", id: GALLERY_ID, status: "link_only", view_url: null });

        render(
            <NewsItemView
                data={newsDetail(newsroomItem(), {
                    assets: [linkOnly, pdfAsset()],
                    body_html: `<p>Plant <a href="http://example.com/plant.jpg" rel="noopener nofollow" data-asset-id="${GALLERY_ID}">Image at source</a></p>`,
                })}
                error={null}
                isLoading={false}
                onOpen={() => undefined}
            />,
        );

        const link = within(screen.getByTestId("news-body")).getByText("Image at source");

        expect(link.getAttribute("href")).toBe("http://example.com/plant.jpg");

        expect(link.getAttribute("target")).toBe("_blank");

        expect(link.getAttribute("rel")).toBe("noopener noreferrer");

        expect(screen.getAllByTestId("news-asset")).toHaveLength(1);

        expect(screen.queryByTestId("news-image")).toBeNull();
    });

    it("reports an image error of the article and of the hero (the panel then refetches the item)", () => {
        const onImageError = vi.fn();

        render(
            <NewsItemView
                data={newsDetail(newsroomItem(), {
                    assets: [imageAsset({ id: HERO_ID, kind: "hero_image" })],
                    body_html: `<figure><img src="${viewUrl(INLINE_ID)}" data-asset-id="${INLINE_ID}"></figure>`,
                })}
                error={null}
                isLoading={false}
                onImageError={onImageError}
                onOpen={() => undefined}
            />,
        );

        fireEvent.error(screen.getByTestId("news-body").querySelector("img") as HTMLImageElement);

        fireEvent.error(screen.getByTestId("news-image").querySelector("img") as HTMLImageElement);

        expect(onImageError).toHaveBeenCalledTimes(2);
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
