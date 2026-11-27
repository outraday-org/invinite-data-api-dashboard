import type { V2AsReportedDetailedResponse, V2AsReportedPresentationResponse, V2AsReportedResponse } from "@/lib/api/types";

/** Candidate renderer (aapl-2026-q3), real Q3 filing values and native IDs. */
export const AAPL_MEMBER_PRESENTATION: V2AsReportedPresentationResponse = {
    data: [
        {
            calendar_quarter: 2,
            calendar_year: 2026,
            company: {
                cik: "0000320193",
                ticker: "AAPL",
            },
            currency: "USD",
            fiscal_quarter: 3,
            fiscal_year: 2026,
            period: "quarterly",
            period_end: "2026-06-27",
            period_start: "2026-03-29",
            source: {
                accession: "0000320193-26-000020",
                filed_at: "2026-07-30T20:30:27Z",
                form: "10-Q",
                is_preliminary: false,
                restated: false,
            },
            statements: {
                income_statement: {
                    facts: [
                        {
                            children: [
                                {
                                    accession: "0000320193-26-000020",
                                    company_label: "Products",
                                    concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                                    depth: 1,
                                    derived: false,
                                    dimensions: [
                                        {
                                            axis: "srt:ProductOrServiceAxis",
                                            member: "us-gaap:ProductMember",
                                        },
                                    ],
                                    html_tag_id: "f-48",
                                    key: "RevenueFromContractWithCustomerExcludingAssessedTax|srt:ProductOrServiceAxis=us-gaap:ProductMember",
                                    label: "Net sales",
                                    value: 78678000000,
                                },
                                {
                                    accession: "0000320193-26-000020",
                                    company_label: "Services",
                                    concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                                    depth: 1,
                                    derived: false,
                                    dimensions: [
                                        {
                                            axis: "srt:ProductOrServiceAxis",
                                            member: "us-gaap:ServiceMember",
                                        },
                                    ],
                                    html_tag_id: "f-52",
                                    key: "RevenueFromContractWithCustomerExcludingAssessedTax|srt:ProductOrServiceAxis=us-gaap:ServiceMember",
                                    label: "Net sales",
                                    value: 30739000000,
                                },
                                {
                                    accession: "0000320193-26-000020",
                                    company_label: "Total net sales",
                                    concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                                    depth: 2,
                                    derived: false,
                                    html_tag_id: "f-56",
                                    is_total: true,
                                    key: "RevenueFromContractWithCustomerExcludingAssessedTax",
                                    label: "Net sales",
                                    value: 109417000000,
                                },
                            ],
                            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                            depth: 0,
                            key: "RevenueFromContractWithCustomerExcludingAssessedTax#group",
                            label: "Net sales",
                        },
                        {
                            children: [
                                {
                                    accession: "0000320193-26-000020",
                                    company_label: "Products",
                                    concept: "CostOfGoodsAndServicesSold",
                                    depth: 1,
                                    derived: false,
                                    dimensions: [
                                        {
                                            axis: "srt:ProductOrServiceAxis",
                                            member: "us-gaap:ProductMember",
                                        },
                                    ],
                                    html_tag_id: "f-60",
                                    key: "CostOfGoodsAndServicesSold|srt:ProductOrServiceAxis=us-gaap:ProductMember",
                                    label: "Cost of sales",
                                    value: 47153000000,
                                },
                                {
                                    accession: "0000320193-26-000020",
                                    company_label: "Services",
                                    concept: "CostOfGoodsAndServicesSold",
                                    depth: 1,
                                    derived: false,
                                    dimensions: [
                                        {
                                            axis: "srt:ProductOrServiceAxis",
                                            member: "us-gaap:ServiceMember",
                                        },
                                    ],
                                    html_tag_id: "f-64",
                                    key: "CostOfGoodsAndServicesSold|srt:ProductOrServiceAxis=us-gaap:ServiceMember",
                                    label: "Cost of sales",
                                    value: 7494000000,
                                },
                                {
                                    accession: "0000320193-26-000020",
                                    company_label: "Total cost of sales",
                                    concept: "CostOfGoodsAndServicesSold",
                                    depth: 2,
                                    derived: false,
                                    html_tag_id: "f-68",
                                    is_total: true,
                                    key: "CostOfGoodsAndServicesSold",
                                    label: "Cost of sales",
                                    value: 54647000000,
                                },
                            ],
                            concept: "CostOfGoodsAndServicesSold",
                            depth: 0,
                            key: "CostOfGoodsAndServicesSold#group",
                            label: "Cost of sales",
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: {
        basis: "as_reported",
        currency: "USD",
        point_in_time: null,
    },
    next_cursor: null,
};

/** Candidate renderer (aapl-2026-q3), real Q3 filing values and native IDs. */
export const AAPL_MEMBER_SUMMARY: V2AsReportedResponse = {
    data: [
        {
            calendar_quarter: 2,
            calendar_year: 2026,
            company: {
                cik: "0000320193",
                ticker: "AAPL",
            },
            currency: "USD",
            fiscal_quarter: 3,
            fiscal_year: 2026,
            period: "quarterly",
            period_end: "2026-06-27",
            period_start: "2026-03-29",
            source: {
                accession: "0000320193-26-000020",
                filed_at: "2026-07-30T20:30:27Z",
                form: "10-Q",
                is_preliminary: false,
                restated: false,
            },
            statements: {
                income_statement: {
                    facts: {
                        CostOfGoodsAndServicesSold: {
                            derived: false,
                            value: 54647000000,
                        },
                        RevenueFromContractWithCustomerExcludingAssessedTax: {
                            derived: false,
                            value: 109417000000,
                        },
                    },
                    member_facts: [
                        {
                            company_label: "Products",
                            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ProductMember",
                                },
                            ],
                            key: "RevenueFromContractWithCustomerExcludingAssessedTax|srt:ProductOrServiceAxis=us-gaap:ProductMember",
                            label: "Net sales",
                            value: 78678000000,
                        },
                        {
                            company_label: "Services",
                            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ServiceMember",
                                },
                            ],
                            key: "RevenueFromContractWithCustomerExcludingAssessedTax|srt:ProductOrServiceAxis=us-gaap:ServiceMember",
                            label: "Net sales",
                            value: 30739000000,
                        },
                        {
                            company_label: "Products",
                            concept: "CostOfGoodsAndServicesSold",
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ProductMember",
                                },
                            ],
                            key: "CostOfGoodsAndServicesSold|srt:ProductOrServiceAxis=us-gaap:ProductMember",
                            label: "Cost of sales",
                            value: 47153000000,
                        },
                        {
                            company_label: "Services",
                            concept: "CostOfGoodsAndServicesSold",
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ServiceMember",
                                },
                            ],
                            key: "CostOfGoodsAndServicesSold|srt:ProductOrServiceAxis=us-gaap:ServiceMember",
                            label: "Cost of sales",
                            value: 7494000000,
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: {
        basis: "as_reported",
        currency: "USD",
        point_in_time: null,
    },
    next_cursor: null,
};

/** Candidate renderer (aapl-2026-q3), real Q3 filing values and native IDs. */
export const AAPL_MEMBER_DETAILED: V2AsReportedDetailedResponse = {
    data: [
        {
            calendar_quarter: 2,
            calendar_year: 2026,
            company: {
                cik: "0000320193",
                ticker: "AAPL",
            },
            currency: "USD",
            fiscal_quarter: 3,
            fiscal_year: 2026,
            period: "quarterly",
            period_end: "2026-06-27",
            period_start: "2026-03-29",
            source: {
                accession: "0000320193-26-000020",
                filed_at: "2026-07-30T20:30:27Z",
                form: "10-Q",
                is_preliminary: false,
                restated: false,
            },
            statements: {
                income_statement: {
                    facts: {
                        CostOfGoodsAndServicesSold: {
                            accession: "0000320193-26-000020",
                            company_label: "Total cost of sales",
                            decimals: -6,
                            derived: false,
                            formula: null,
                            html_tag_id: "f-68",
                            label: "Cost of sales",
                            original_accession: null,
                            original_filing_date: null,
                            original_label: null,
                            original_value: null,
                            split_factor: null,
                            value: 54647000000,
                            value_as_reported: null,
                        },
                        RevenueFromContractWithCustomerExcludingAssessedTax: {
                            accession: "0000320193-26-000020",
                            company_label: "Total net sales",
                            decimals: -6,
                            derived: false,
                            formula: null,
                            html_tag_id: "f-56",
                            label: "Net sales",
                            original_accession: null,
                            original_filing_date: null,
                            original_label: null,
                            original_value: null,
                            split_factor: null,
                            value: 109417000000,
                            value_as_reported: null,
                        },
                    },
                    member_facts: [
                        {
                            accession: "0000320193-26-000020",
                            company_label: "Products",
                            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                            decimals: -6,
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ProductMember",
                                },
                            ],
                            formula: null,
                            html_tag_id: "f-48",
                            key: "RevenueFromContractWithCustomerExcludingAssessedTax|srt:ProductOrServiceAxis=us-gaap:ProductMember",
                            label: "Net sales",
                            value: 78678000000,
                        },
                        {
                            accession: "0000320193-26-000020",
                            company_label: "Services",
                            concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
                            decimals: -6,
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ServiceMember",
                                },
                            ],
                            formula: null,
                            html_tag_id: "f-52",
                            key: "RevenueFromContractWithCustomerExcludingAssessedTax|srt:ProductOrServiceAxis=us-gaap:ServiceMember",
                            label: "Net sales",
                            value: 30739000000,
                        },
                        {
                            accession: "0000320193-26-000020",
                            company_label: "Products",
                            concept: "CostOfGoodsAndServicesSold",
                            decimals: -6,
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ProductMember",
                                },
                            ],
                            formula: null,
                            html_tag_id: "f-60",
                            key: "CostOfGoodsAndServicesSold|srt:ProductOrServiceAxis=us-gaap:ProductMember",
                            label: "Cost of sales",
                            value: 47153000000,
                        },
                        {
                            accession: "0000320193-26-000020",
                            company_label: "Services",
                            concept: "CostOfGoodsAndServicesSold",
                            decimals: -6,
                            derived: false,
                            dimensions: [
                                {
                                    axis: "srt:ProductOrServiceAxis",
                                    member: "us-gaap:ServiceMember",
                                },
                            ],
                            formula: null,
                            html_tag_id: "f-64",
                            key: "CostOfGoodsAndServicesSold|srt:ProductOrServiceAxis=us-gaap:ServiceMember",
                            label: "Cost of sales",
                            value: 7494000000,
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: {
        basis: "as_reported",
        currency: "USD",
        point_in_time: null,
    },
    next_cursor: null,
};

/** Candidate renderer (synthetic-derived-q4), synthetic values and filings. */
export const SYNTHETIC_Q4_MEMBER_PRESENTATION: V2AsReportedPresentationResponse = {
    data: [
        {
            calendar_quarter: 3,
            calendar_year: 2026,
            company: {
                cik: "0000000001",
                ticker: "SYN",
            },
            currency: "USD",
            fiscal_quarter: 4,
            fiscal_year: 2026,
            period: "quarterly",
            period_end: "2026-09-30",
            period_start: "2026-07-01",
            source: {
                accession: "0000000001-26-000002",
                filed_at: "2026-11-01T00:00:00Z",
                form: "10-K",
                is_preliminary: false,
                restated: false,
            },
            statements: {
                income_statement: {
                    facts: [
                        {
                            accession: "0000000001-26-000002",
                            children: [
                                {
                                    accession: "0000000001-26-000002",
                                    company_label: "Products",
                                    concept: "Revenue",
                                    depth: 1,
                                    derived: true,
                                    dimensions: [
                                        {
                                            axis: "ext:Axis",
                                            member: "ext:Products",
                                        },
                                    ],
                                    html_tag_id: null,
                                    key: "Revenue|ext:Axis=ext:Products",
                                    label: "Revenue",
                                    value: 70,
                                },
                            ],
                            company_label: "Total revenue",
                            concept: "Revenue",
                            depth: 0,
                            derived: false,
                            html_tag_id: "total",
                            key: "Revenue",
                            label: "Revenue",
                            value: 100,
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: {
        basis: "as_reported",
        currency: "USD",
        point_in_time: null,
    },
    next_cursor: null,
};

/** Candidate renderer (synthetic-derived-q4), synthetic values and filings. */
export const SYNTHETIC_Q4_MEMBER_DETAILED: V2AsReportedDetailedResponse = {
    data: [
        {
            calendar_quarter: 3,
            calendar_year: 2026,
            company: {
                cik: "0000000001",
                ticker: "SYN",
            },
            currency: "USD",
            fiscal_quarter: 4,
            fiscal_year: 2026,
            period: "quarterly",
            period_end: "2026-09-30",
            period_start: "2026-07-01",
            source: {
                accession: "0000000001-26-000002",
                filed_at: "2026-11-01T00:00:00Z",
                form: "10-K",
                is_preliminary: false,
                restated: false,
            },
            statements: {
                income_statement: {
                    facts: {
                        Revenue: {
                            accession: "0000000001-26-000002",
                            company_label: "Total revenue",
                            decimals: -6,
                            derived: false,
                            formula: null,
                            html_tag_id: "total",
                            label: "Revenue",
                            original_accession: null,
                            original_filing_date: null,
                            original_label: null,
                            original_value: null,
                            split_factor: null,
                            value: 100,
                            value_as_reported: null,
                        },
                    },
                    member_facts: [
                        {
                            accession: "0000000001-26-000002",
                            company_label: "Products",
                            concept: "Revenue",
                            decimals: -6,
                            derived: true,
                            dimensions: [
                                {
                                    axis: "ext:Axis",
                                    member: "ext:Products",
                                },
                            ],
                            formula: {
                                formula_str: "1|Revenue|2025-10-01|2026-09-30|-|[{\"dimension\":\"ext:Axis\",\"value\":\"ext:Products\"}]|annual - 1|Revenue|2025-10-01|2025-12-31|-|[{\"dimension\":\"alias:ConsolidationItemsAxis\",\"value\":\"alias:OperatingSegmentsMember\"},{\"dimension\":\"alias:Axis\",\"value\":\"alias:Products\"}]|quarterly - 1|Revenue|2025-10-01|2026-03-31|-|[{\"dimension\":\"alias:ConsolidationItemsAxis\",\"value\":\"alias:OperatingSegmentsMember\"},{\"dimension\":\"alias:Axis\",\"value\":\"alias:Products\"}]|quarterly",
                                members: [
                                    {
                                        accession: "0000000001-26-000002",
                                        concept: "Revenue",
                                        end_date: "2026-09-30",
                                        fact_id: "1|Revenue|2025-10-01|2026-09-30|-|[{\"dimension\":\"ext:Axis\",\"value\":\"ext:Products\"}]|annual",
                                        fiscal_period_type: "annual",
                                        html_tag_id: null,
                                        instant_date: null,
                                        segment: [
                                            {
                                                dimension: "ext:Axis",
                                                value: "ext:Products",
                                            },
                                        ],
                                        start_date: "2025-10-01",
                                        type: "reported",
                                        value: 100,
                                    },
                                    {
                                        accession: "0000000001-26-000001",
                                        concept: "Revenue",
                                        end_date: "2025-12-31",
                                        fact_id: "1|Revenue|2025-10-01|2025-12-31|-|[{\"dimension\":\"alias:ConsolidationItemsAxis\",\"value\":\"alias:OperatingSegmentsMember\"},{\"dimension\":\"alias:Axis\",\"value\":\"alias:Products\"}]|quarterly",
                                        fiscal_period_type: "quarterly",
                                        html_tag_id: "quarter-cell",
                                        instant_date: null,
                                        segment: [
                                            {
                                                dimension: "alias:ConsolidationItemsAxis",
                                                value: "alias:OperatingSegmentsMember",
                                            },
                                            {
                                                dimension: "alias:Axis",
                                                value: "alias:Products",
                                            },
                                        ],
                                        start_date: "2025-10-01",
                                        type: "reported",
                                        value: 20,
                                    },
                                    {
                                        concept: "Revenue",
                                        end_date: "2026-03-31",
                                        fiscal_period_type: "quarterly",
                                        instant_date: null,
                                        segment: [
                                            {
                                                dimension: "alias:ConsolidationItemsAxis",
                                                value: "alias:OperatingSegmentsMember",
                                            },
                                            {
                                                dimension: "alias:Axis",
                                                value: "alias:Products",
                                            },
                                        ],
                                        start_date: "2025-10-01",
                                        type: "reported",
                                        value: 10,
                                    },
                                ],
                            },
                            html_tag_id: null,
                            key: "Revenue|ext:Axis=ext:Products",
                            label: "Revenue",
                            value: 70,
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: {
        basis: "as_reported",
        currency: "USD",
        point_in_time: null,
    },
    next_cursor: null,
};

/** Candidate renderer (synthetic-two-axis), synthetic values and filings. */
export const SYNTHETIC_TWO_AXIS_MEMBER_DETAILED: V2AsReportedDetailedResponse = {
    data: [
        {
            calendar_quarter: 2,
            calendar_year: 2026,
            company: {
                cik: "0000000001",
                ticker: "SYN",
            },
            currency: "USD",
            fiscal_quarter: 3,
            fiscal_year: 2026,
            period: "quarterly",
            period_end: "2026-06-30",
            period_start: "2026-07-01",
            source: {
                accession: "synthetic-filing",
                filed_at: "2026-11-01T00:00:00Z",
                form: "10-K",
                is_preliminary: false,
                restated: false,
            },
            statements: {
                income_statement: {
                    facts: {
                        Revenue: {
                            accession: "synthetic-filing",
                            company_label: "Total revenue",
                            decimals: -6,
                            derived: false,
                            formula: null,
                            html_tag_id: "total",
                            label: "Revenue",
                            original_accession: null,
                            original_filing_date: null,
                            original_label: null,
                            original_value: null,
                            split_factor: null,
                            value: 100,
                            value_as_reported: null,
                        },
                    },
                    member_facts: [
                        {
                            accession: "synthetic-filing",
                            company_label: "Products",
                            concept: "Revenue",
                            decimals: -6,
                            derived: false,
                            dimensions: [
                                {
                                    axis: "ext:Axis",
                                    member: "ext:Products",
                                },
                                {
                                    axis: "ext:RegionAxis",
                                    member: "ext:US",
                                },
                            ],
                            formula: null,
                            html_tag_id: "member",
                            key: "Revenue|ext:Axis=ext:Products;ext:RegionAxis=ext:US",
                            label: "Revenue",
                            value: 70,
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: {
        basis: "as_reported",
        currency: "USD",
        point_in_time: null,
    },
    next_cursor: null,
};

/** Candidate renderer (synthetic-balance-sheet), synthetic values and filings. */
export const SYNTHETIC_BALANCE_MEMBER_DETAILED: V2AsReportedDetailedResponse = {
    data: [
        {
            calendar_quarter: 2,
            calendar_year: 2026,
            company: {
                cik: "0000000001",
                ticker: "SYN",
            },
            currency: "USD",
            fiscal_quarter: 3,
            fiscal_year: 2026,
            period: "quarterly",
            period_end: "2026-06-30",
            period_start: "2026-07-01",
            source: {
                accession: "synthetic-filing",
                filed_at: "2026-11-01T00:00:00Z",
                form: "10-K",
                is_preliminary: false,
                restated: false,
            },
            statements: {
                balance_sheet: {
                    facts: {},
                    member_facts: [
                        {
                            accession: "synthetic-filing",
                            company_label: "United States",
                            concept: "Cash",
                            decimals: -6,
                            derived: false,
                            dimensions: [
                                {
                                    axis: "ext:RegionAxis",
                                    member: "ext:US",
                                },
                            ],
                            formula: null,
                            html_tag_id: "member",
                            key: "Cash|ext:RegionAxis=ext:US",
                            label: "Cash",
                            value: 70,
                        },
                    ],
                },
            },
        },
    ],
    has_more: false,
    meta: {
        basis: "as_reported",
        currency: "USD",
        point_in_time: null,
    },
    next_cursor: null,
};
