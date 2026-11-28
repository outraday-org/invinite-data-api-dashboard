/**
 * O7 group 5 fixtures (tests only), shaped on live answers of 2026-11-21 (api.data.invinite.com): NVDA's `revenue`
 * KPI history (`/v1/kpis?company=NVDA&metric=revenue`), AAPL's Q4 FY2026 call with its results filing and 10-K, and
 * cross-company transcript search hits (`/v1/search/transcripts` without company).
 */
import type { V2Event, V2KpiMention, V2TranscriptSearchHit, V2TranscriptSearchResponse } from "@/lib/api/types";

import { CALENDAR_EVENT } from "./calendar-fixtures";

const kpi = (patch: Partial<V2KpiMention> & Pick<V2KpiMention, "conference_date" | "event_id" | "seq" | "value" | "value_text">): V2KpiMention => ({
    company: { cik: "0001045810", ticker: "NVDA" },
    filing_link: null,
    metric: "revenue",
    metric_normalized: "revenue",
    origin: "transcript",
    period_label: null,
    source_sentence: "Revenue was a record.",
    speaker: { label: "B", name: "Colette Kress", title: "Executive Vice President and Chief Financial Officer" },
    start_ms: 120_000,
    unit: "usd",
    ...patch,
});

/** Newest call first (the API's default `-conference_date`); the 2025-11-19 call states the metric three times. */
export const NVDA_REVENUE_HISTORY: Array<V2KpiMention> = [
    kpi({ conference_date: "2026-08-26", event_id: "b1dfd0fb-63d6-4d68-8d64-020588d4bbc0", period_label: "Q2 FY2028", seq: 4, value: 96_000_000_000, value_text: "$96 billion" }),
    kpi({ conference_date: "2026-05-20", event_id: "474fd5cd-64b9-4f54-b0a9-d39f3c031648", period_label: "Q1 FY2027", seq: 2, value: 82_000_000_000, value_text: "$82 billion" }),
    kpi({
        conference_date: "2026-02-25",
        event_id: "cce56779-a8d5-43d5-9287-39d79b1e3d42",
        filing_link: {
            accession_number: "0001045810-26-000020",
            candidate_count: 1,
            concept: "us-gaap:Revenues",
            document_url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000020/q4fy26pr.htm",
            edgar_index_url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000020/",
            fact_period: null,
            figure_kind: "money",
            form: "8-K",
            match_kind: "rounded",
            matched_by: "figures",
            matched_value: 68_127_000_000,
            snippet: "Revenue of $68.1 billion",
            target: "press_release",
        },
        origin: "press_release",
        period_label: "Q4 FY2026",
        seq: 1,
        value: 68_000_000_000,
        value_text: "$68 billion",
    }),
    kpi({ conference_date: "2025-11-19", event_id: "bea3e7fd-0000-4000-8000-000000000001", period_label: "Q3 FY2026", seq: 9, value: 57_000_000_000, value_text: "57 billion" }),
    kpi({ conference_date: "2025-11-19", event_id: "bea3e7fd-0000-4000-8000-000000000001", period_label: "Q3 FY2026", seq: 10, unit: "pct", value: 62, value_text: "62%" }),
    kpi({ conference_date: "2025-11-19", event_id: "bea3e7fd-0000-4000-8000-000000000001", period_label: null, seq: 11, value: null, value_text: "a record" }),
];

/** AAPL's Q4 FY2026 call (published): the results 8-K and the 10-K, a high-confidence EDGAR start time. */
export const AAPL_Q4_EVENT: V2Event = {
    ...CALENDAR_EVENT,
    call_time_confidence: "high",
    call_time_source: "edgar",
    cik: "0000320193",
    company_name: "Apple Inc.",
    event_id: "2463cda2-9968-411d-886c-e638d71f34b3",
    fiscal_quarter: 4,
    fiscal_year: 2026,
    periodic_report: {
        accepted_at: "2026-11-03T13:05:15.000Z",
        accession: "0000320193-26-000026",
        edgar_index_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/0000320193-26-000026-index.htm",
        filing_date: "2026-11-03",
        form: "10-K",
        period_end: "2026-09-26",
    },
    results_filing: {
        accepted_at: "2026-11-02T21:30:23.000Z",
        accession: "0000320193-26-000024",
        edgar_index_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000024/0000320193-26-000024-index.htm",
        form: "8-K",
    },
    scheduled_at: "2026-11-02T22:00:00.000Z",
    symbol: "AAPL",
    tz: "America/New_York",
};

/** An estimate that never became a call: low confidence, expired with its reason, no filings yet. */
export const EXPIRED_ESTIMATE_EVENT: V2Event = {
    ...AAPL_Q4_EVENT,
    call_time_confidence: "low",
    call_time_source: "estimate",
    event_id: "9d047f98-db37-433b-862f-bf02269b62d3",
    periodic_report: null,
    results_filing: null,
};

const hit = (patch: Partial<V2TranscriptSearchHit> & Pick<V2TranscriptSearchHit, "event_id" | "symbol">): V2TranscriptSearchHit => ({
    audio_url: null,
    chunk_index: 3,
    cik: "0000000001",
    conference_date: "2026-11-05T15:00:00.000Z",
    end_ms: null,
    fiscal_quarter: 3,
    fiscal_year: 2026,
    match: { lexical_rank: 1, spans: [{ end: 12, start: 0 }], type: "lexical" },
    score: 0.4996,
    slide: { image_url: null, page: 7 },
    speaker: { label: null, name: null, title: null },
    start_ms: null,
    text: "Gross margin expanded 120 basis points.",
    text_truncated: false,
    type: "presentation",
    ...patch,
});

/** A full page (8 passages, the operation's cap) of `gross margin` across companies, newest window default. */
export const MARKET_SEARCH_ANSWER: V2TranscriptSearchResponse = {
    data: ["WES", "APPN", "PG", "STEM", "BLND", "AROC", "APPN", "WDFC"].map((symbol, index) => hit({
        event_id: `00000000-0000-4000-8000-00000000000${index}`,
        score: 0.5 - index / 100,
        symbol,
    })),
    has_more: false,
    meta: { index: { completeness: "complete", lexical: { failed: 0, indexed: 3068, pending: 0, state: "ready" }, reasons: [] }, query: "gross margin" },
    next_cursor: null,
};
