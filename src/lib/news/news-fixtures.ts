import type { NewsDevelopment, NewsItemPublic, V2NewsBlock, V2NewsSearchResponse, V2NewsText } from "@/lib/api/types";

/** Test fixtures of the News page (`labels.test.ts`, `src/routes/-tests/news-page.test.tsx`); imported by no app code. */

const NVIDIA_CIK = "1045810";

/** A newsroom-first NVIDIA press release (published by NVIDIA, also filed on EDGAR). */
export function newsroomItem(overrides: Partial<NewsItemPublic> = {}): NewsItemPublic {
    return {
        attribution: {
            edgar: null,
            published_at: "2026-10-29T13:03:22.000Z",
            publisher: "NVIDIA Corporation",
            publisher_host: "nvidianews.nvidia.com",
            rights: "issuer",
            source_url: "https://nvidianews.nvidia.com/news/nvidia-announces-rubin",
            statement: "Summary written by Invinite from the publication above; not the publisher's text. Source and date above.",
        },
        ciks: [NVIDIA_CIK],
        description: "NVIDIA today announced Rubin.",
        earnings: null,
        first_seen_at: "2026-10-29T13:03:40.000Z",
        id: "4c1d9e62-3b7a-4f2e-8d1c-9e0a7b6c5d4f",
        is_earnings_news: false,
        kind: "other",
        model_processing_allowed: true,
        pdf: null,
        publications: [{
            categories: [{ id: "12", label: "Press Releases", url: null }],
            modified_at: null,
            publication_type: "press_release",
            published_at: "2026-10-29T13:03:22.000Z",
            publisher: { cik: NVIDIA_CIK, name: "NVIDIA Corporation", symbol: "NVDA" },
            source_id: "ir:nvidianews.nvidia.com",
            tags: [{ id: null, label: "Data Center", url: null }],
            url: "https://nvidianews.nvidia.com/news/nvidia-announces-rubin",
        }],
        publications_truncated: false,
        published_at: "2026-10-29T13:03:22.000Z",
        revision: 1,
        rights: "issuer",
        source: { host: "nvidianews.nvidia.com", id: "ir", name: "NVIDIA Newsroom" },
        summary_words: 180,
        supersedes_id: null,
        symbols: ["NVDA"],
        title: "NVIDIA Announces Rubin Platform",
        topics: ["product_launch"],
        url: "https://nvidianews.nvidia.com/news/nvidia-announces-rubin",
        ...overrides,
    };
}

/** An EDGAR-first 8-K item (public record) mentioning NVIDIA, published by no issuer newsroom. */
export function edgarItem(overrides: Partial<NewsItemPublic> = {}): NewsItemPublic {
    return newsroomItem({
        attribution: {
            edgar: { accession: "0001045810-26-000123", form: "8-K" },
            published_at: "2026-10-28T20:05:10.000Z",
            publisher: "NVIDIA Corporation",
            publisher_host: null,
            rights: "public_record",
            source_url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000123/0001045810-26-000123-index.htm",
            statement: "Summary written by Invinite from the publication above; not the publisher's text. Source and date above.",
        },
        description: null,
        id: "7d2e1f00-0000-4000-8000-000000000002",
        is_earnings_news: true,
        kind: "earnings_results",
        publications: [],
        published_at: "2026-10-28T20:05:10.000Z",
        rights: "public_record",
        source: { host: "www.sec.gov", id: "edgar", name: "SEC EDGAR" },
        title: "NVIDIA Announces Financial Results for Third Quarter Fiscal 2027",
        topics: [],
        url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000123/0001045810-26-000123-index.htm",
        ...overrides,
    });
}

/** Invinite's summary of the Rubin release, as the API renders it (`summary_text` blocks, `summary_html` from them). */
const block = (index: number, kind: V2NewsBlock["kind"], text: string, heading: null | string = null): V2NewsBlock => ({
    block_id: `00000000-0000-4000-8000-0000000000b${index}`,
    heading,
    index,
    kind,
    text,
});

/** Invinite's summary of `newsroomItem()` in blocks (`GET /v1/news/{id}/text`). */
export const SUMMARY_BLOCKS: Array<V2NewsBlock> = [
    block(0, "paragraph", "NVIDIA introduced Rubin, its next data-center platform."),
    block(1, "heading", "Availability"),
    block(2, "paragraph", "Partners can order systems from the second half of 2027.", "Availability"),
    block(3, "list", "• Six new chips\n• One rack-scale system", "Availability"),
];

/** `GET /v1/news/{id}/text` of `item` (summary available unless overridden). */
export function newsText(item: NewsItemPublic, overrides: Partial<V2NewsText> = {}): V2NewsText {
    return {
        attribution: item.attribution,
        blocks: SUMMARY_BLOCKS,
        content_status: "available",
        coverage: { blocks_through: SUMMARY_BLOCKS.length, blocks_total: SUMMARY_BLOCKS.length },
        has_more: false,
        item_id: item.id,
        model_processing_allowed: item.model_processing_allowed,
        next_cursor: null,
        revision: item.revision,
        title: item.title,
        ...overrides,
    };
}

/** A `/v1/search/news` page (O7 group 2): a headline hit and a summary passage of `newsroomItem()`. */
export function newsSearchPage(overrides: Partial<V2NewsSearchResponse> = {}): V2NewsSearchResponse {
    const item = newsroomItem();

    return {
        data: [
            {
                block: null,
                chunk_index: -1,
                field: "title",
                item,
                match: { lexical_rank: 1, spans: [{ end: 22, start: 17 }], type: "lexical" },
                model_processing_allowed: true,
                score: 0.4213,
                text: item.title,
                text_truncated: false,
            },
            {
                block: { heading: "Availability", id: "b2", index: 2 },
                chunk_index: 2,
                field: "summary",
                item,
                match: { lexical_rank: 2, spans: [{ end: 31, start: 27 }], type: "lexical" },
                model_processing_allowed: true,
                score: 0.0821,
                text: "Partners can order systems from the second half of 2027.",
                text_truncated: false,
            },
        ],
        has_more: false,
        meta: { query: "Rubin" },
        next_cursor: null,
        ...overrides,
    };
}

/** One `/v1/announcements?company=` row read from `newsroomItem()`. */
export function announcementRow(overrides: Partial<NewsDevelopment> = {}): NewsDevelopment {
    const item = newsroomItem();

    return {
        announced_at: "2026-10-29T13:03:22.000Z",
        claim_status: "planned",
        confidence: "high",
        counterparties: [{ cik: null, name: "Foxconn", resolution: "unresolved" }],
        date_precision: "quarter",
        derived: true,
        effective_date_text: "second half of 2027",
        effective_from: "2027-07-01",
        effective_to: "2027-12-31",
        id: "00000000-0000-4000-8000-0000000000a1",
        item: { attribution: item.attribution, title: item.title, url: item.url },
        item_id: item.id,
        model_processing_allowed: true,
        products: [{ name: "Rubin" }],
        revision: 1,
        summary: "NVIDIA plans to ship Rubin in H2 2027.",
        title: "Rubin availability",
        topic: "availability",
        ...overrides,
    };
}
