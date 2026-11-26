import type { V2GuidanceItem, V2KpiCatalogEntry, V2KpiSeriesPoint, V2NonGaapMetric } from "@/lib/api/types";

// Tests only: rows of the Data API 12.1 earnings extraction in the contract's shapes (spec of invinite-data-api 20e6487).

const COMPANY = { cik: "0000320193", ticker: "AAPL" };

const EVENT_ID = "9655a5db-8968-40be-8c79-7cd1a8aed8e9";

const RELEASE_URL = "https://www.sec.gov/Archives/edgar/data/320193/000032019326000070/a8-kex991.htm";

export const NON_GAAP_RECONCILED: V2NonGaapMetric = {
    adjustments: [
        { amount: 0.12, label: "Share-based compensation" },
        { amount: -0.03, label: "Income tax effects" },
    ],
    company: COMPANY,
    conference_date: "2026-10-30T21:00:00Z",
    confidence: 0.94,
    currency: "USD",
    event_id: EVENT_ID,
    gaap: { metric: "Diluted EPS", value: 1.55 },
    id: "0f8e2a52-46a8-4f8a-9d55-1d1d4c0f1a01",
    metric: "Adjusted diluted EPS",
    metric_key: "eps_adjusted_diluted",
    period_end: "2026-09-27",
    period_kind: "quarter",
    prior_year_value: 1.46,
    reconciled: true,
    reconciliation_gap: 0,
    source: { accession: "0000320193-26-000070", col: 1, row: 6, table: 2, url: RELEASE_URL },
    unit: "per_share",
    value: 1.64,
};

export const NON_GAAP_GAP: V2NonGaapMetric = {
    ...NON_GAAP_RECONCILED,
    adjustments: [{ amount: 1_200_000_000, label: "Restructuring charges" }],
    gaap: { metric: "Operating income", value: 30_000_000_000 },
    id: "0f8e2a52-46a8-4f8a-9d55-1d1d4c0f1a02",
    metric: "Adjusted operating income",
    metric_key: "operating_income_adjusted",
    prior_year_value: null,
    reconciled: false,
    reconciliation_gap: 100_000_000,
    unit: "USD",
    value: 31_300_000_000,
};

export const NON_GAAP_UNCHECKED: V2NonGaapMetric = {
    ...NON_GAAP_RECONCILED,
    adjustments: [],
    gaap: null,
    id: "0f8e2a52-46a8-4f8a-9d55-1d1d4c0f1a03",
    metric: "Free cash flow",
    metric_key: "free_cash_flow",
    reconciled: null,
    reconciliation_gap: null,
    source: { accession: null, col: 2, row: 0, table: 5, url: "https://investor.example.com/q4-release" },
    unit: "USD",
    value: 26_500_000_000,
};

function point(overrides: Partial<V2KpiSeriesPoint> & Pick<V2KpiSeriesPoint, "id" | "period_end" | "value">): V2KpiSeriesPoint {
    return {
        company: COMPANY,
        confidence: 0.9,
        event_id: EVENT_ID,
        kpi_key: "load_factor",
        label: "Load factor",
        origin: "release_table",
        period_kind: "quarter",
        prior_year_value: null,
        sector: "airlines",
        segment: null,
        source: { accession: "0000320193-26-000070", sentence: null, url: RELEASE_URL },
        unit: "pct",
        xbrl_check: "none",
        yoy_change: null,
        ...overrides,
    };
}

/** Load factor: two quarters + a year (table only) + a segment point; ASMs from the call (no URL, a sentence). */
export const KPI_SERIES_POINTS: Array<V2KpiSeriesPoint> = [
    point({ id: "k1", period_end: "2026-06-30", value: 86.1, xbrl_check: "matched", yoy_change: 0.8 }),
    point({ id: "k2", period_end: "2026-03-31", value: 81.4 }),
    point({ id: "k3", period_end: "2025-12-31", period_kind: "year", value: 83.9 }),
    point({ id: "k4", period_end: "2026-06-30", segment: "Domestic", value: 88.0 }),
    point({
        id: "k5",
        kpi_key: "available_seat_miles",
        label: "Available seat miles",
        origin: "transcript",
        period_end: "2026-06-30",
        source: { accession: null, sentence: "Capacity was 74.2 billion available seat miles in the quarter.", url: null },
        unit: "count",
        value: 74_200_000_000,
        xbrl_check: "differs",
        yoy_change: 4.1,
    }),
];

export const QUALITATIVE_GUIDANCE: V2GuidanceItem = {
    basis: "unknown",
    change_vs_prior: null,
    company: COMPANY,
    conference_date: "2026-10-30T21:00:00Z",
    confidence: 0.81,
    cross_validated: false,
    currency: null,
    direction: "maintained",
    event_id: EVENT_ID,
    fiscal_quarter: 1,
    fiscal_year: 2027,
    high: null,
    id: "5d1b0b8e-8f2a-4a51-9e0c-4f3c2d1e0a11",
    low: null,
    metric: "Revenue growth",
    metric_normalized: "revenue",
    midpoint: null,
    period_kind: "quarter",
    period_label: "Q1 FY2027",
    prior_item_id: null,
    qualifier: "directional",
    review_status: "auto",
    source_accession: "0000320193-26-000070",
    source_url: RELEASE_URL,
    sources: [],
    statement_text: "We expect revenue to grow year over year in the December quarter.",
    unit: null,
};

export const KPI_CATALOG_ROWS: Array<V2KpiCatalogEntry> = [
    { kpi_key: "load_factor", label: "Load factor", period_kinds: ["quarter", "year"], sector: "airlines", unit: "pct" },
    { kpi_key: "net_interest_margin", label: "Net interest margin", period_kinds: ["quarter"], sector: "banks", unit: "pct" },
];
