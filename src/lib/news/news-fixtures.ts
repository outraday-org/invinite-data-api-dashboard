import type { NewsItemPublic, NewsItemResponse } from "@/lib/api/types";

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
            statement: "Reproduced verbatim from the publisher; © the publisher. Source and date above.",
        },
        ciks: [NVIDIA_CIK],
        description: "NVIDIA today announced Rubin.",
        earnings: null,
        first_seen_at: "2026-10-29T13:03:40.000Z",
        id: "4c1d9e62-3b7a-4f2e-8d1c-9e0a7b6c5d4f",
        is_earnings_news: false,
        kind: "other",
        model_processing_allowed: true,
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
        source: { host: "nvidianews.nvidia.com", id: "ir:nvidianews.nvidia.com", name: "NVIDIA Newsroom" },
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
            statement: "Reproduced verbatim from the publisher; © the publisher. Source and date above.",
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

/** `GET /v1/news/{id}` of `item` (text available unless overridden). */
export function newsDetail(item: NewsItemPublic, overrides: Partial<NewsItemResponse> = {}): NewsItemResponse {
    return {
        ...item,
        assets: [],
        body_text: "SANTA CLARA, Calif., Oct. 29, 2026 -- NVIDIA today announced …",
        companies: [{ cik: NVIDIA_CIK, confidence: 1, match_kind: "issuer", symbol: "NVDA" }],
        content_status: "available",
        developments: [],
        sightings: [{ published_at_claimed: null, seen_at: "2026-10-29T13:03:40.000Z", source_id: item.source.id, url: item.url }],
        superseded_by: null,
        text_url: `/v1/news/${item.id}/text`,
        ...overrides,
    };
}
