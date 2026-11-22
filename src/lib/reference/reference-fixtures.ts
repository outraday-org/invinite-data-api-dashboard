import type {
    CompanyFiscalPeriod,
    V2ApiStatus,
    V2CompaniesResponse,
    V2DividendsResponse,
    V2Licensing,
    V2MappingRulesResponse,
    V2MetricCatalogResponse,
    V2SectionCatalogResponse,
} from "@/lib/api/types";

// Fixtures of O7 group 7 (tests only), trimmed from the live answers of 2026-11-21.

export const V2_METRIC_CATALOG: V2MetricCatalogResponse = {
    data: [
        { description: null, metric_id: "is_total_revenue", name: "Total Revenue", statement: "income-statement", unit: "usd" },
        { description: null, metric_id: "is_total_revenue_growth_drivers", name: "Revenue Growth Drivers", statement: "income-statement", unit: "usd" },
        { description: null, metric_id: "bs_accounts_and_financing_receivable_current", name: "Accounts and Financing Receivable, Current", statement: "balance-sheet", unit: "usd" },
        { description: "Gross profit as a share of revenue", metric_id: "ratio_gross_margin_pct", name: "Gross Margin", statement: null, unit: "percent" },
    ],
    has_more: false,
    meta: {},
    next_cursor: null,
};

export const V2_SECTION_CATALOG: V2SectionCatalogResponse = {
    data: [
        { form: "10-K", section_id: "part_i-item_1", title: "Business" },
        { form: "10-K", section_id: "part_i-item_1a", title: "Risk Factors" },
    ],
    has_more: false,
    meta: {},
    next_cursor: null,
};

export const V2_MAPPING_RULES: V2MappingRulesResponse = {
    data: [
        {
            label: "Accounts and Financing Receivable, Current",
            metric_id: "bs_accounts_and_financing_receivable_current",
            rule: {
                alias_role: "primary",
                declared_alias: "AccountsNotesAndLoansReceivableNetCurrent",
                declared_taxonomy: "us_gaap",
                formula_definition: null,
                hierarchy: { depth: 4, global_order: 15, parent: "bs_total_receivables_current", sibling_order: 1 },
                kind: "alias",
                required_operands: [],
                rule_id: "r_6415758cf9f508d3a5c68fff",
                sign_policy: "as_reported",
            },
            statement: "balance-sheet",
        },
        {
            label: "Common Shareholders Equity Including Additional Paid in Capital",
            metric_id: "bs_common_shareholders_equity_including_additional_paid_in_capital",
            rule: {
                alias_role: null,
                declared_alias: null,
                declared_taxonomy: null,
                formula_definition: "bs_common_shareholders_equity + bs_additional_paid_in_capital",
                hierarchy: { depth: 3, global_order: 88, parent: "bs_shareholders_equity_attributable_to_parent", sibling_order: 1 },
                kind: "formula",
                required_operands: [],
                rule_id: "r_1224b8520ae2df6f4fb1a1fe",
                sign_policy: "as_reported",
            },
            statement: "balance-sheet",
        },
    ],
    has_more: true,
    meta: {},
    next_cursor: "cursor-2",
};

export const V2_COMPANIES: V2CompaniesResponse = {
    data: [
        { cik: "0000320193", exchange: "XNAS", fiscal_year_end: null, logo_url: "https://storage.invinite.com/company_logos/AAPL.png", name: "Apple Inc.", sector: "Technology", ticker: "AAPL" },
        { cik: "0001652044", exchange: "XNAS", fiscal_year_end: "12-31", logo_url: null, name: "Alphabet Inc.", sector: "Technology", ticker: "GOOGL" },
    ],
    has_more: true,
    meta: {},
    next_cursor: "cursor-2",
};

export const V2_API_STATUS: V2ApiStatus = {
    generated_at: "2026-11-21T16:16:40.387Z",
    groups: [
        { group: "instruments", name: "Instruments", p50_ms_7d: 25, p95_ms_7d: 800, status: "operational", uptime_7d: 1, uptime_30d: 1, uptime_90d: 1 },
        { group: "companies", name: "Companies", p50_ms_7d: 25, p95_ms_7d: null, status: "degraded", uptime_7d: 0.995, uptime_30d: 0.997, uptime_90d: 0.997 },
    ],
    services: [
        { family: "company", status: "operational", uptime_7d: 1, uptime_30d: 1, uptime_90d: 1 },
        { family: "sec_filings", status: "degraded", uptime_7d: 0.989, uptime_30d: 0.995, uptime_90d: 0.995 },
        { family: "institutional_ownership", status: "degraded", uptime_7d: 0.993, uptime_30d: 0.991, uptime_90d: 0.991 },
        { family: "news", status: "outage", uptime_7d: 0.983, uptime_30d: 0.983, uptime_90d: null },
    ],
    universe: { companies: 6023, earnings_calls: { companies: 5541, scope: "all" } },
};

const rights = (display: boolean, redistribute: boolean, rag: boolean, audio: boolean, enterprise = false) => ({
    audio,
    display,
    rag,
    redistribute,
    redistribute_api: enterprise,
    resell: false,
    train: enterprise,
});

export const V2_LICENSING: V2Licensing = {
    by_contract: ["train"],
    counsel_signed_off: false,
    families: [
        {
            family: "company",
            routes: [
                { license: "display", route: "/v1/companies", tier: "free" },
                { license: "redistribute", route: "/v1/dividends", tier: "lite" },
            ],
        },
        {
            family: "financials",
            routes: [
                { license: "redistribute", route: "/v1/financials/as-reported", tier: "standard" },
                { license: "redistribute", route: "/v1/financials/as-reported/detailed", tier: "pro" },
            ],
        },
    ],
    notes: {
        audio: "Audio files carry a forensic watermark that identifies the recording.",
        display: "Show the data to the licensee's own users, with attribution.",
        news: "News text is Invinite's own summary.",
        pdf_documents: "Branded PDFs are permanent URLs.",
        rag: "Use the text as retrieval context in a customer-facing product.",
        redistribute: "Pass the data on inside the licensee's product with attribution.",
        redistribute_api: "Return the data in the licensee's own API responses. Enterprise contract only.",
        sec_data: "Figures and filings originate from SEC EDGAR.",
        train: "Model training is an Enterprise right, granted in the contract.",
    },
    policy_version: "2026-11-draft",
    resale: "Invinite data may never be resold.",
    rights: ["display", "redistribute", "rag", "train", "audio", "redistribute_api", "resell"],
    tiers: {
        enterprise: rights(true, true, true, true, true),
        free: rights(false, false, false, false),
        lite: rights(true, false, false, false),
        pro: rights(true, true, true, true),
        standard: rights(true, false, true, false),
    },
    universe: { companies: 6023, earnings_calls: { companies: 5541, scope: "all" } },
};

const period = (fiscalYear: number, fiscalQuarter: number, calendarYear: number, calendarQuarter: number, periodEnd: string): CompanyFiscalPeriod => ({
    calendar_quarter: calendarQuarter,
    calendar_year: calendarYear,
    company: { cik: "0000320193", ticker: "AAPL" },
    fiscal_quarter: fiscalQuarter,
    fiscal_year: fiscalYear,
    period_end: periodEnd,
});

/** AAPL's fiscal quarters (fiscal year ends late September), oldest first: the card sorts them. */
export const AAPL_FISCAL_PERIODS: Array<CompanyFiscalPeriod> = [
    period(2024, 1, 2023, 4, "2023-12-30"),
    period(2024, 2, 2024, 1, "2024-03-30"),
    period(2024, 3, 2024, 2, "2024-06-29"),
    period(2024, 4, 2024, 3, "2024-09-28"),
    period(2025, 1, 2024, 4, "2024-12-28"),
    period(2025, 2, 2025, 1, "2025-03-29"),
    period(2025, 3, 2025, 2, "2025-06-28"),
    period(2025, 4, 2025, 3, "2025-09-27"),
    period(2026, 1, 2025, 4, "2025-12-27"),
    period(2026, 2, 2026, 1, "2026-03-28"),
];

export const V2_DIVIDENDS: V2DividendsResponse = {
    data: [
        { cash_amount: 0.26, company: { cik: "0000320193", ticker: "AAPL" }, declaration_date: "2026-10-30", dividend_type: "CD", ex_dividend_date: "2026-11-10", frequency: 4, fund: null, pay_date: "2026-11-13", record_date: "2026-11-10", symbol: "AAPL" },
        { cash_amount: 1.5, company: { cik: "0000320193", ticker: "AAPL" }, declaration_date: "2026-01-30", dividend_type: "SC", ex_dividend_date: "2026-02-09", frequency: 0, fund: null, pay_date: "2026-02-12", record_date: "2026-02-10", symbol: "AAPL" },
        { cash_amount: 0.1, company: { cik: "0000320193", ticker: "AAPL" }, declaration_date: "2025-10-30", dividend_type: "XX", ex_dividend_date: "2025-11-10", frequency: 4, fund: null, pay_date: "2025-11-13", record_date: "2025-11-10", symbol: "AAPL" },
    ],
    has_more: false,
    meta: {},
    next_cursor: null,
};
