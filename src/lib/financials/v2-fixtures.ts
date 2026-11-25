/**
 * Trimmed v2 Financials + Metrics answers (tests only), in the shapes of the frozen contract
 * (`invinite-data-api` spec/openapi.v2.json, backend tasks/data-api-v2 task 5).
 */
import type {
    V2AsReportedDetailedResponse,
    V2AsReportedPresentationResponse,
    V2AsReportedResponse,
    V2CagrResponse,
    V2FactPlacesResponse,
    V2FactResponse,
    V2FinancialVintagesResponse,
    V2GrowthResponse,
    V2RatiosResponse,
    V2SegmentsDetailedResponse,
    V2SegmentsResponse,
    V2StandardizedDetailedResponse,
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

const source = (accession: string, restated = false, isPreliminary = false) => ({ accession, filed_at: "2026-08-01T20:30:00Z", form: "10-Q", is_preliminary: isPreliminary, restated });

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

const REVENUE = "RevenueFromContractWithCustomerExcludingAssessedTax";

const rawId = (start: string, end: string) => `320193|${REVENUE}|${start}T00:00:00|${end}T00:00:00|-|-`;

const reportedFact = (value: number, accession: null | string, htmlTagId: null | string, derived = false) => ({
    accession,
    company_label: "Total net sales",
    decimals: -6,
    derived,
    formula: null,
    html_tag_id: htmlTagId,
    label: "Revenue",
    original_accession: null,
    original_filing_date: null,
    original_label: null,
    original_value: null,
    split_factor: null,
    value,
    value_as_reported: null,
});

const member = (start: string, end: string, value: number) => ({ concept: REVENUE, end_date: end, start_date: start, type: "reported" as const, value });

/**
 * As-reported detailed, quarterly (live shape of AAPL 2026-11-24): Q4 FY2026 computed as FY − Q1 − Q2 − Q3 over raw
 * fact ids, and the filed Q3 the table has loaded (its filing and element), so the Q3 member resolves without a request.
 */
export const V2_AS_REPORTED_Q4: V2AsReportedDetailedResponse = {
    data: [
        {
            ...coordinates(2026, 4, "2026-09-26"),
            currency: "USD",
            period_start: "2026-06-28",
            source: { ...source("0000320193-26-000026"), form: "10-K" },
            statements: {
                income_statement: {
                    facts: {
                        [`us-gaap:${REVENUE}`]: {
                            ...reportedFact(114_477_000_000, "0000320193-26-000026", null, true),
                            formula: {
                                formula_str: [
                                    rawId("2025-09-28", "2026-09-26"),
                                    rawId("2025-09-28", "2025-12-27"),
                                    rawId("2025-12-28", "2026-03-28"),
                                    rawId("2026-03-29", "2026-06-27"),
                                ].join(" - "),
                                members: [
                                    member("2025-09-28", "2026-09-26", 478_834_000_000),
                                    member("2025-09-28", "2025-12-27", 143_756_000_000),
                                    member("2025-12-28", "2026-03-28", 111_184_000_000),
                                    member("2026-03-29", "2026-06-27", 109_417_000_000),
                                ],
                            },
                        },
                    },
                },
            },
        },
        {
            ...coordinates(2026, 3, "2026-06-27"),
            currency: "USD",
            period_start: "2026-03-29",
            source: source("0000320193-26-000020"),
            statements: { income_statement: { facts: { [`us-gaap:${REVENUE}`]: reportedFact(109_417_000_000, "0000320193-26-000020", "f-56") } } },
        },
    ],
    has_more: true,
    meta: { basis: "as_reported", currency: "USD", point_in_time: null },
    next_cursor: "eyJ2IjozfQ",
};

/** The annual as-reported detailed rows a member lookup asks (FY2026 filed in the 10-K at its element). */
export const V2_AS_REPORTED_ANNUAL_LOOKUP: V2AsReportedDetailedResponse = {
    data: [
        {
            ...coordinates(2026, 4, "2026-09-26"),
            currency: "USD",
            period: "annual",
            period_start: "2025-09-28",
            source: { ...source("0000320193-26-000026"), form: "10-K" },
            statements: { income_statement: { facts: { [`us-gaap:${REVENUE}`]: reportedFact(478_834_000_000, "0000320193-26-000026", "f-210") } } },
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

/** A point-in-time answer (`as_of=2026-05-01`): `meta.point_in_time` names the selector. */
export const V2_STANDARDIZED_AS_OF: V2StandardizedResponse = {
    ...V2_STANDARDIZED,
    has_more: false,
    meta: { ...V2_STANDARDIZED.meta, point_in_time: { as_of: "2026-05-01", filing: null } },
    next_cursor: null,
};

const FACT_ID = "320193|is_total_revenue|quarterly|2026|3";

/** The standardized detailed view: each value carries its fact id (live AAPL shape, 2026-11-21). */
export const V2_STANDARDIZED_DETAILED: V2StandardizedDetailedResponse = {
    data: [
        {
            ...coordinates(2026, 3, "2026-06-27"),
            currency: "USD",
            source: source("0000320193-26-000073"),
            statements: {
                income_statement: {
                    facts: {
                        is_total_revenue: {
                            accession: "0000320193-26-000073",
                            fact_id: FACT_ID,
                            formula: null,
                            html_tag_id: "f-76",
                            parent_id: null,
                            split_factor: null,
                            unit: "usd",
                            value: 94_036_000_000,
                            value_as_reported: null,
                        },
                    },
                },
            },
        },
    ],
    has_more: false,
    meta: { basis: "standardized", coverage: { state: "complete", through: "2026-06-27" }, currency: "USD", point_in_time: null },
    next_cursor: null,
};

/** `GET /v1/facts/{fact_id}` (live AAPL shape, trimmed). */
export const V2_FACT: V2FactResponse = {
    company,
    fact_id: FACT_ID,
    metric_id: "is_total_revenue",
    operands: [],
    rule: {
        alias_role: "alternate",
        declared_alias: "RevenueFromContractWithCustomerExcludingAssessedTax",
        declared_taxonomy: "us_gaap",
        formula_definition: null,
        kind: "alias",
        metric_id: "is_total_revenue",
        metric_name: "Total Revenue",
        notes: "ASC 606 filers tag RevenueFromContractWithCustomerExcludingAssessedTax as the top line.",
        rule_id: "r_8b92b021e8bd4f2207e85b87",
        statement: "income_statement",
    },
    source_facts: [
        {
            accession: "0000320193-26-000073",
            annotated_anchor: "f-76",
            basis: "receipt",
            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
            raw: { end_date: "2026-06-27T00:00:00", instant_date: null, start_date: "2026-03-29T00:00:00", value: "94036000000" },
            segment: null,
        },
    ],
    unit: "usd",
    value: 94_036_000_000,
};

const place = (blockId: string, row: number, status: "derived" | "placed" = "placed") => ({
    block_id: blockId,
    concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
    document_version: "8be0b759-1a9d-5f89-8308-bd86185f5e1f",
    fact_id: FACT_ID,
    html_tag_id: "f-76",
    legacy_id: null,
    page: null,
    pdf_box: null,
    rendition_url: null,
    source_sha256: null,
    status,
    table_col: 3,
    table_row: row,
    xbrl_ordinal: 7,
    xpath: null,
});

/** `GET /v1/fact-places?fact=` (PRO): two placed spots (one repeated) and a derived one. */
export const V2_FACT_PLACES: V2FactPlacesResponse = {
    data: [place("b00407", 6), place("b00407", 6), place("b00475", 7), place("b00500", 1, "derived")],
    has_more: false,
    meta: { coverage: { state: "complete" } },
    next_cursor: null,
};

/** `GET /v1/segments/detailed` (PRO): segment facts with concept, caption and filing. */
export const V2_SEGMENTS_DETAILED: V2SegmentsDetailedResponse = {
    data: [
        {
            ...coordinates(2026, 3, "2026-06-27"),
            accession: "0000320193-26-000073",
            dimensions: [{ axis: "srt:ProductOrServiceAxis", member: "aapl:IPhoneMember" }],
            html_label: "iPhone",
            html_tag_id: "f-301",
            metric: "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
            metric_id: "is_total_revenue",
            segment_id: "seg_revenue_product",
            unit: "usd",
            value: 44_582_000_000,
        },
        {
            ...coordinates(2026, 3, "2026-06-27"),
            accession: null,
            dimensions: [{ axis: "us-gaap:StatementBusinessSegmentsAxis", member: "aapl:AmericasSegmentMember" }],
            html_label: null,
            html_tag_id: null,
            metric: null,
            metric_id: "is_total_revenue",
            segment_id: "seg_revenue_business_segment",
            unit: null,
            value: 41_198_000_000,
        },
    ],
    has_more: true,
    meta: { coverage: { state: "complete" } },
    next_cursor: "eyJ2Ijo0fQ",
};

/**
 * As-reported summary, quarterly (Data API 11.2 shape): the newest quarter preliminary (the earnings release before the
 * 10-Q), the older one from its 10-Q; each period with its start, for the "Filed values" request.
 */
export const V2_AS_REPORTED_SUMMARY: V2AsReportedResponse = {
    data: [
        {
            ...coordinates(2026, 4, "2026-09-26"),
            currency: "USD",
            period_start: "2026-06-28",
            source: { ...source("0000320193-26-000090", false, true), form: "8-K" },
            statements: { income_statement: { facts: { "us-gaap:Revenues": { derived: false, value: 102_466_000_000 } } } },
        },
        {
            ...coordinates(2026, 3, "2026-06-27"),
            currency: "USD",
            period_start: "2026-03-29",
            source: source("0000320193-26-000073"),
            statements: { income_statement: { facts: { "us-gaap:NetIncomeLoss": { derived: true, value: 23_434_000_000 }, "us-gaap:Revenues": { derived: false, value: 94_036_000_000 } } } },
        },
    ],
    has_more: false,
    meta: { basis: "as_reported", currency: "USD", point_in_time: null },
    next_cursor: null,
};

/** `GET /v1/financials/vintages` (Data API 11.2 shape): the 10-Q's value, repeated by the 10-K, restated by a later 10-Q. */
export const V2_FINANCIAL_VINTAGES: V2FinancialVintagesResponse = {
    data: [
        { accession: "0000320193-26-000073", filing_date: "2026-08-01", form: "10-Q", is_current: false, period_end: "2026-06-27", period_start: "2026-03-29", unit: "USD", value: 94_036_000_000 },
        { accession: "0000320193-26-000100", filing_date: "2026-10-31", form: "10-K", is_current: false, period_end: "2026-06-27", period_start: "2026-03-29", unit: "USD", value: 94_036_000_000 },
        { accession: "0000320193-27-000010", filing_date: "2027-05-01", form: "10-Q", is_current: true, period_end: "2026-06-27", period_start: "2026-03-29", unit: "USD", value: 94_100_000_000 },
    ],
    has_more: false,
    meta: {},
    next_cursor: null,
};

/** As-reported summary, balance sheet (instants): the period row still names its quarter's start. */
export const V2_AS_REPORTED_BALANCE_SHEET: V2AsReportedResponse = {
    data: [
        {
            ...coordinates(2026, 3, "2026-06-27"),
            currency: "USD",
            period_start: "2026-03-29",
            source: source("0000320193-26-000073"),
            statements: { balance_sheet: { facts: { "us-gaap:Assets": { derived: false, value: 331_495_000_000 } } } },
        },
    ],
    has_more: false,
    meta: { basis: "as_reported", currency: "USD", point_in_time: null },
    next_cursor: null,
};
