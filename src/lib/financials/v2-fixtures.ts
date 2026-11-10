/**
 * Trimmed v2 Financials + Metrics answers (tests only), in the shapes of the frozen contract
 * (`invinite-data-api` spec/openapi.v2.json, backend tasks/data-api-v2 task 5).
 */
import type {
    V2AsReportedDetailedResponse,
    V2AsReportedPresentationResponse,
    V2CagrResponse,
    V2GrowthResponse,
    V2RatiosResponse,
    V2SegmentsResponse,
    V2StandardizedResponse,
} from "@/lib/api/types";

const company = { cik: "0000320193", ticker: "AAPL" };

const coordinates = (fiscalYear: number, fiscalQuarter: number, periodEnd: string) => ({
    calendar_quarter: Number(periodEnd.slice(5, 7)) <= 3 ? 1 : Number(periodEnd.slice(5, 7)) <= 6 ? 2 : Number(periodEnd.slice(5, 7)) <= 9 ? 3 : 4,
    calendar_year: Number(periodEnd.slice(0, 4)),
    company,
    fiscal_quarter: fiscalQuarter,
    fiscal_year: fiscalYear,
    period: "quarterly" as const,
    period_end: periodEnd,
    period_start: null,
});

const source = (accession: string, restated = false) => ({ accession, filed_at: "2026-08-01T20:30:00Z", form: "10-Q", restated });

export const V2_STANDARDIZED: V2StandardizedResponse = {
    data: [
        {
            ...coordinates(2026, 3, "2026-06-27"),
            currency: "USD",
            source: source("0000320193-26-000073"),
            statements: { income_statement: { facts: { is_net_income: 23_434_000_000, is_total_revenue: 94_036_000_000 } } },
        },
        {
            ...coordinates(2026, 2, "2026-03-28"),
            currency: "USD",
            source: source("0000320193-26-000052", true),
            statements: { income_statement: { facts: { is_total_revenue: 95_359_000_000 } } },
        },
    ],
    has_more: true,
    meta: { basis: "standardized", coverage: { state: "complete", through: "2026-06-27" }, currency: "USD", point_in_time: null },
    next_cursor: "eyJ2IjoyfQ",
};

export const V2_STANDARDIZED_PENDING: V2StandardizedResponse = {
    data: [],
    has_more: false,
    meta: { basis: "standardized", coverage: { retry_after_s: 60, state: "pending", through: null }, currency: null, point_in_time: null },
    next_cursor: null,
};

export const V2_AS_REPORTED_DETAILED: V2AsReportedDetailedResponse = {
    data: [
        {
            ...coordinates(2026, 3, "2026-06-27"),
            currency: "USD",
            source: source("0000320193-26-000073"),
            statements: {
                income_statement: {
                    facts: {
                        "us-gaap:NetIncomeLoss": {
                            accession: null,
                            company_label: "Net income",
                            decimals: -6,
                            derived: true,
                            formula: { formula_str: "FY - Q1 - Q2 - Q3", members: [] },
                            html_tag_id: null,
                            label: "Net Income (Loss)",
                            original_accession: null,
                            original_filing_date: null,
                            original_label: null,
                            original_value: null,
                            split_factor: null,
                            value: 23_434_000_000,
                            value_as_reported: null,
                        },
                        "us-gaap:Revenues": {
                            accession: "0000320193-26-000073",
                            company_label: null,
                            decimals: -6,
                            derived: false,
                            formula: null,
                            html_tag_id: "f-12",
                            label: "Revenues",
                            original_accession: null,
                            original_filing_date: null,
                            original_label: null,
                            original_value: null,
                            split_factor: null,
                            value: 94_036_000_000,
                            value_as_reported: null,
                        },
                    },
                },
            },
        },
    ],
    has_more: false,
    meta: { basis: "as_reported", currency: "USD", point_in_time: null },
    next_cursor: null,
};

export const V2_AS_REPORTED_PRESENTATION: V2AsReportedPresentationResponse = {
    data: [
        {
            ...coordinates(2026, 3, "2026-06-27"),
            currency: "USD",
            source: source("0000320193-26-000073"),
            statements: {
                income_statement: {
                    facts: [
                        {
                            children: [
                                { concept: "us-gaap:ProductRevenue", depth: 1, label: "Products", value: 66_000_000_000 },
                                { concept: "us-gaap:ServiceRevenue", depth: 1, label: "Services", value: 28_036_000_000 },
                            ],
                            concept: "us-gaap:Revenues",
                            depth: 0,
                            is_total: true,
                            label: "Total net sales",
                            value: 94_036_000_000,
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: { basis: "as_reported", currency: "USD", point_in_time: null },
    next_cursor: null,
};

export const V2_RATIOS: V2RatiosResponse = {
    data: [
        { ...coordinates(2026, 3, "2026-06-27"), ratios: { leverage: { debt_to_equity: 1.87 }, profitability: { gross_margin_pct: 46.9 } } },
        { ...coordinates(2026, 2, "2026-03-28"), ratios: { profitability: { gross_margin_pct: 47.1 } } },
    ],
    has_more: false,
    meta: { coverage: { state: "complete" } },
    next_cursor: null,
};

export const V2_GROWTH: V2GrowthResponse = {
    data: [
        { ...coordinates(2026, 3, "2026-06-27"), basis: "yoy", facts: { is_total_revenue: 0.096 } },
        { ...coordinates(2026, 3, "2026-06-27"), basis: "qoq", facts: { is_total_revenue: -0.014 } },
        { ...coordinates(2026, 2, "2026-03-28"), basis: "yoy", facts: { is_total_revenue: 0.081 } },
    ],
    has_more: true,
    meta: {},
    next_cursor: "eyJ2IjozfQ",
};

export const V2_CAGR: V2CagrResponse = {
    data: [
        { ...coordinates(2025, 4, "2025-09-27"), facts: { is_total_revenue: 0.087 }, horizon: 3, period: "annual" },
        { ...coordinates(2025, 4, "2025-09-27"), facts: { is_total_revenue: 0.112 }, horizon: 10, period: "annual" },
    ],
    has_more: false,
    meta: {},
    next_cursor: null,
};

export const V2_SEGMENTS: V2SegmentsResponse = {
    data: [
        {
            ...coordinates(2026, 3, "2026-06-27"),
            dimensions: [{ axis: "srt:ProductOrServiceAxis", member: "aapl:IPhoneMember" }],
            metric_id: "is_total_revenue",
            segment_id: "seg_revenue_product",
            value: 44_582_000_000,
        },
        {
            ...coordinates(2026, 3, "2026-06-27"),
            dimensions: [{ axis: "us-gaap:StatementBusinessSegmentsAxis", member: "aapl:AmericasSegmentMember" }],
            metric_id: "is_total_revenue",
            segment_id: "seg_revenue_business_segment",
            value: 41_198_000_000,
        },
        {
            ...coordinates(2026, 2, "2026-03-28"),
            dimensions: [{ axis: "srt:ProductOrServiceAxis", member: "aapl:IPhoneMember" }],
            metric_id: "is_total_revenue",
            segment_id: "seg_revenue_product",
            value: 46_841_000_000,
        },
    ],
    has_more: false,
    meta: { coverage: { state: "complete" } },
    next_cursor: null,
};
