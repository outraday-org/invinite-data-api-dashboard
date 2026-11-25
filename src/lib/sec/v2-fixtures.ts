/**
 * SEC family answers for tests only (`/v1/filings*`, `/v1/document-versions/*`, `/v1/filers`, `/v1/search/filings`,
 * holdings, insider trades, IPOs): the filings rows, the 10-K manifest and the document version are the API mappers'
 * output over their recorded door fixtures of 2026-11-09 (`invinite-data-api/src/lib/v1/sec/fixtures/`, trimmed); the
 * filer page and the search page are the pinned spec's captured examples (`openapi.json`, 2026-11-11; the listed
 * filer added); holders, changes, fund compositions, insider trades and IPOs are written in the contract's shape (Data API
 * 7.0 for the holder and fund rows).
 */
import type {
    V2BeneficialOwnershipResponse,
    V2DocumentVersionResponse,
    V2FilerHoldingChangesResponse,
    V2FilerHoldingsResponse,
    V2FilersResponse,
    V2FilingDetailResponse,
    V2FilingSearchResponse,
    V2FilingsResponse,
    V2FundPositionsResponse,
    V2FundWeightsResponse,
    V2Holder,
    V2HolderChangesResponse,
    V2HoldersResponse,
    V2InsiderHoldingsResponse,
    V2InsiderSaleNoticesResponse,
    V2InsiderTradeDetail,
    V2InsiderTradesResponse,
    V2IposResponse,
    V2OfferingDetail,
    V2OfferingsResponse,
} from "@/lib/api/types";

const AAPL = { cik: "0000320193", ticker: "AAPL" };

export const V2_FILINGS: V2FilingsResponse = {
    data: [
        {
            accession: "0001140361-26-042505",
            company: AAPL,
            edgar_index_url: "https://www.sec.gov/Archives/edgar/data/320193/000114036126042505/0001140361-26-042505-index.htm",
            filed_at: "2026-11-06T21:30:47Z",
            filing_date: "2026-11-06",
            form: "424B2",
            fund: null,
            items: [],
            primary_document: "ny20084621x2_424b2.htm",
            report_date: null,
            roles: ["filer", "listed"],
            symbol: "AAPL",
        },
        {
            accession: "0000320193-26-000026",
            company: AAPL,
            edgar_index_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/0000320193-26-000026-index.htm",
            filed_at: "2026-11-03T13:05:15Z",
            filing_date: "2026-11-03",
            form: "10-K",
            fund: null,
            items: [],
            primary_document: "aapl-20260926.htm",
            report_date: "2026-09-26",
            roles: ["filer", "listed"],
            symbol: "AAPL",
        },
    ],
    has_more: true,
    meta: {
        coverage: { state: "complete" },
        form_facet: [
            { count: 31, form: "10-K", newest_filing_date: "2026-11-03" },
            { count: 2, form: "10-K/A", newest_filing_date: "2010-01-25" },
            { count: 98, form: "10-Q", newest_filing_date: "2026-07-31" },
            { count: 412, form: "424B2", newest_filing_date: "2026-11-06" },
        ],
    },
    next_cursor: "eyJ2IjoyfQ",
};

export const V2_FILING_10K: V2FilingDetailResponse = {
    accession: "0000320193-26-000026",
    company: AAPL,
    documents: [
        {
            current_version_id: "8be0b759-1a9d-5f89-8308-bd86185f5e1f",
            description: "10-K",
            filename: "aapl-20260926.htm",
            source_url: "https://storage.invinite.com/sec/4765d5384d6b2195ff48ff775f9244f9/aapl-20260926.htm",
            type: "10-K",
        },
        {
            current_version_id: "5306c415-7af9-5e5b-a83a-857f27126d6e",
            description: "EX-4.1",
            filename: "a10-kexhibit4109262026.htm",
            source_url: null,
            type: "EX-4.1",
        },
        {
            current_version_id: null,
            description: "XBRL TAXONOMY EXTENSION SCHEMA DOCUMENT",
            filename: "aapl-20260926.xsd",
            source_url: "https://storage.invinite.com/sec/4765d5384d6b2195ff48ff775f9244f9/aapl-20260926.xsd",
            type: "EX-101.SCH",
        },
    ],
    edgar_index_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/0000320193-26-000026-index.htm",
    filed_at: "2026-11-03T13:05:15Z",
    filing_date: "2026-11-03",
    form: "10-K",
    items: [],
    report_date: "2026-09-26",
};

const block = (id: string, text: string, prev: null | string, next: null | string) => ({
    citation: { block_id: id, page: 1, page_end: null, printed: null, printed_end: null, version_id: "8be0b759-1a9d-5f89-8308-bd86185f5e1f" },
    footnote_refs: [],
    heading_level: 5,
    id,
    kind: "heading",
    neighbors: { next, prev },
    page: { ordinal: 1, printed: null },
    text,
});

export const V2_DOCUMENT_VERSION: V2DocumentVersionResponse = {
    blocks: [
        block("b00001", "UNITED STATES", null, "b00002"),
        block("b00002", "SECURITIES AND EXCHANGE COMMISSION", "b00001", "b00003"),
    ],
    footnotes: [],
    pages: [],
    quality: { pages: 65, printed_labels_trusted: true },
    selection: { blocks: null, first_ordinal: 1, footnotes: true, last_ordinal: 2, next_block: "b00003", status: "ok", truncated: true },
    source: {
        content_type: "html",
        filed_at: "2026-11-03T13:05:15Z",
        form: "10-K",
        role: "primary",
        url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
    },
    toc: [],
    version: {
        accession: "0000320193-26-000026",
        block_count: 730,
        created_at: "2026-11-03T17:44:33.530Z",
        filename: "aapl-20260926.htm",
        id: "8be0b759-1a9d-5f89-8308-bd86185f5e1f",
        page_count: 65,
    },
};

const AAPL_SECURITY = { cik: "0000320193", cusip: "037833100", fund_key: null, isin: null, name: "Apple Inc.", resolution: "cusip", symbol: "AAPL" };

const VANGUARD = {
    cik: "0000102909",
    class_tickers: [],
    fund_key: null,
    issuer_file_as_of: null,
    name: "VANGUARD GROUP INC",
    registrant_name: null,
    series_id: null,
    symbols: [],
    type: "institution" as const,
};

const THIRTEEN_F_ROW: V2Holder = {
    accession_number: "0000102909-26-000123",
    as_of: "2026-09-30",
    asset_cat: null,
    filing_date: "2026-11-13",
    filing_url: "https://www.sec.gov/Archives/edgar/data/102909/000010290926000123/0000102909-26-000123-index.htm",
    holder: VANGUARD,
    investment_discretion: "SOLE",
    put_call: null,
    security: AAPL_SECURITY,
    shares: 1_390_000_000,
    shares_type: "SH",
    source: "13f",
    value_usd: 412_000_000_000,
    voting_authority: { none: 0, shared: 0, sole: 1_390_000_000 },
    weight_pct: null,
};

/** An N-PORT row of a listed fund that also has an issuer file (`issuer_file_as_of`, owner decision 12). */
const NPORT_VOO_ROW: V2Holder = {
    accession_number: "0001752724-26-123456",
    as_of: "2026-06-30",
    asset_cat: "EC",
    filing_date: "2026-08-28",
    filing_url: null,
    holder: {
        cik: "0000036405",
        class_tickers: ["VFIAX", "VOO"],
        fund_key: "S000002277",
        issuer_file_as_of: "2026-10-31",
        name: "Vanguard 500 Index Fund",
        registrant_name: "Vanguard Index Funds",
        series_id: "S000002277",
        symbols: ["VOO"],
        type: "fund",
    },
    investment_discretion: null,
    put_call: null,
    security: AAPL_SECURITY,
    shares: 550_000_000,
    shares_type: "NS",
    source: "nport",
    value_usd: 98_765_432_100,
    voting_authority: null,
    weight_pct: 7.12,
};

/** An unlisted fund is a holder row only (decision 13): `symbols: []`, no link. */
const NPORT_UNLISTED_ROW: V2Holder = {
    ...NPORT_VOO_ROW,
    accession_number: "0000035315-26-000777",
    holder: {
        cik: "0000035315",
        class_tickers: ["FCNTX"],
        fund_key: "S000006037",
        issuer_file_as_of: null,
        name: "Fidelity Contrafund",
        registrant_name: "Fidelity Contrafund",
        series_id: "S000006037",
        symbols: [],
        type: "fund",
    },
    shares: 120_000_000,
    value_usd: 21_000_000_000,
    weight_pct: 9.4,
};

const ISSUER_FILE_SPY_ROW: V2Holder = {
    accession_number: null,
    as_of: "2026-11-13",
    asset_cat: null,
    filing_date: null,
    filing_url: null,
    holder: {
        cik: "0000884394",
        class_tickers: ["SPY"],
        fund_key: "cik:884394",
        issuer_file_as_of: null,
        name: "SPDR S&P 500 ETF Trust",
        registrant_name: "SPDR S&P 500 ETF Trust",
        series_id: null,
        symbols: ["SPY"],
        type: "fund",
    },
    investment_discretion: null,
    put_call: null,
    security: AAPL_SECURITY,
    shares: 170_000_000,
    shares_type: "SH",
    source: "issuer_file",
    value_usd: 46_100_000_000,
    voting_authority: null,
    weight_pct: 6.52,
};

/** `GET /v1/holders?symbol=AAPL&source=13f`. */
export const V2_HOLDERS_13F: V2HoldersResponse = {
    data: [THIRTEEN_F_ROW],
    has_more: false,
    meta: {
        counting: "One row per manager and security; options and principal amounts excluded unless instruments=all",
        coverage: { state: "complete", through: "2026-09-30" },
        pinned_at: "2026-11-09T06:00:00Z",
        sections: null,
        source: "13f",
    },
    next_cursor: null,
};

/** `GET /v1/holders?symbol=AAPL&source=nport`: a listed fund (link) and an unlisted one (text). */
export const V2_HOLDERS_NPORT: V2HoldersResponse = {
    data: [NPORT_VOO_ROW, NPORT_UNLISTED_ROW],
    has_more: false,
    meta: {
        counting: "One row per fund from its latest public N-PORT report on or before period_end",
        coverage: { state: "complete" },
        pinned_at: "2026-11-14T12:00:00Z",
        sections: null,
        source: "nport",
    },
    next_cursor: null,
};

/** `GET /v1/holders?symbol=AAPL&source=issuer_file`: only the ETFs with an issuer file. */
export const V2_HOLDERS_ISSUER_FILE: V2HoldersResponse = {
    data: [ISSUER_FILE_SPY_ROW],
    has_more: false,
    meta: { coverage: { state: "complete" }, funds_with_issuer_file: 7, reason: null, sections: null, snapshot_changed: false, source: "issuer_file" },
    next_cursor: null,
};

/** `GET /v1/holders?symbol=AAPL` (no `source`): the overview, one section per source, rows one after another. */
export const V2_HOLDERS_OVERVIEW: V2HoldersResponse = {
    data: [THIRTEEN_F_ROW, NPORT_VOO_ROW, ISSUER_FILE_SPY_ROW],
    has_more: false,
    meta: {
        coverage: { state: "complete" },
        pinned_at: "2026-11-14T12:00:00Z",
        sections: [
            { as_of: "2026-09-30", has_more: true, reason: null, rows: 1, source: "13f", state: "complete", total: null },
            { as_of: "2026-06-30", has_more: true, reason: null, rows: 1, source: "nport", state: "complete", total: 774 },
            { as_of: "2026-11-13", has_more: false, reason: null, rows: 1, source: "issuer_file", state: "complete", total: 1 },
        ],
        source: null,
    },
    next_cursor: null,
};

/** SQQQ-type overview: a source that cannot tell the fund apart from its trust is a section state, not a failure. */
export const V2_HOLDERS_OVERVIEW_NOT_COVERED: V2HoldersResponse = {
    data: [],
    has_more: false,
    meta: {
        sections: [
            { as_of: null, has_more: false, reason: "fund_cusip_unknown", rows: 0, source: "13f", state: "not_covered", total: null },
            { as_of: null, has_more: false, reason: null, rows: 0, source: "nport", state: "unavailable", total: null },
            { as_of: null, has_more: false, reason: "no_etf_holders", rows: 0, source: "issuer_file", state: "not_covered", total: 0 },
        ],
        source: null,
    },
    next_cursor: null,
};

export const V2_HOLDERS_PENDING: V2HoldersResponse = {
    data: [],
    has_more: false,
    meta: { coverage: { retry_after_s: 60, state: "pending" }, source: "13f" },
    next_cursor: null,
};

/** `GET /v1/filers/102909/holdings`: a manager's portfolio, the same `Holder` row. */
export const V2_FILER_HOLDINGS: V2FilerHoldingsResponse = {
    data: [THIRTEEN_F_ROW],
    has_more: false,
    meta: {
        counting: "One row per manager and security; options and principal amounts excluded unless instruments=all",
        coverage: { state: "complete", through: "2026-09-30" },
        pinned_at: "2026-11-09T06:00:00Z",
    },
    next_cursor: null,
};

export const V2_HOLDER_CHANGES: V2HolderChangesResponse = {
    data: [{
        accession_number: "0000102909-26-000123",
        as_of: "2026-09-30",
        filing_date: null,
        holder: VANGUARD,
        prior_as_of: "2026-06-30",
        put_call: null,
        security: AAPL_SECURITY,
        shares: 1_390_000_000,
        shares_change: 5_000_000,
        shares_change_pct: 0.0036,
        shares_prior: 1_385_000_000,
        shares_type: "SH",
        type: "added",
        value_change_usd: 1_500_000_000,
        value_usd: 412_000_000_000,
    }],
    has_more: false,
    meta: { coverage: { state: "partial" } },
    next_cursor: null,
};

export const V2_INSIDER_TRADES: V2InsiderTradesResponse = {
    data: [{
        accession_number: "0000320193-26-000031",
        acquired_disposed: "D",
        cik: "0000320193",
        coding_code: "S",
        // A realtime sec-api row: the Form 3/4/5 dataset fields (release 5.7) are null.
        conversion_exercise_price: null,
        deemed_execution_date: null,
        direct_indirect: null,
        exercise_date: null,
        expiration_date: null,
        filed_at: "2026-10-03T22:01:05Z",
        footnotes: null,
        id: "9f6f0c3e-1b5a-4d0e-9a51-3f0b1d7c2a11",
        is_10b5_1: null,
        is_derivative: false,
        nature_of_ownership: null,
        owner_cik: null,
        period_of_report: "2026-10-01",
        reporting_person_is_director: false,
        reporting_person_is_officer: true,
        reporting_person_is_other: false,
        reporting_person_is_ten_percent_owner: false,
        reporting_person_name: "Cook Timothy D",
        reporting_person_officer_title: "Chief Executive Officer",
        security_title: "Common Stock",
        share_price: 254.12,
        shares: 129_963,
        shares_owned_following_transaction: 3_280_180,
        side: "sell",
        source: "sec_api",
        total: 33_026_197.56,
        transaction_date: null,
        underlying_security_title: null,
        underlying_shares: null,
    }, {
        accession_number: "0000320193-26-000035",
        acquired_disposed: "A",
        cik: "0000320193",
        coding_code: "M",
        conversion_exercise_price: null,
        deemed_execution_date: null,
        direct_indirect: "D",
        exercise_date: null,
        expiration_date: null,
        filed_at: "2026-10-16T21:30:00Z",
        footnotes: [{ id: "F1", text: "Each restricted stock unit represents a right to one share of common stock." }],
        id: "f345:0000320193-26-000035:DERIV_TRANS:1:1631982",
        is_10b5_1: false,
        is_derivative: true,
        nature_of_ownership: null,
        owner_cik: "0001631982",
        period_of_report: "2026-10-15",
        reporting_person_is_director: false,
        reporting_person_is_officer: true,
        reporting_person_is_other: false,
        reporting_person_is_ten_percent_owner: false,
        reporting_person_name: "Adams Katherine L",
        reporting_person_officer_title: "SVP, General Counsel",
        security_title: "Restricted Stock Unit",
        share_price: null,
        shares: 40_000,
        shares_owned_following_transaction: 120_000,
        side: "buy",
        source: "f345",
        total: null,
        transaction_date: "2026-10-15",
        underlying_security_title: "Common Stock",
        underlying_shares: 40_000,
    }],
    has_more: false,
    meta: {},
    next_cursor: null,
};

export const V2_IPOS: V2IposResponse = {
    data: [
        {
            company: { cik: "0002156369", ticker: null },
            currency: "USD",
            exchange: "XNAS",
            final_price: null,
            ipo_id: "r-0002156369-333-290001",
            is_spac: false,
            issuer_name: "Rezera Inc",
            listing_date: null,
            price_range_high: 18,
            price_range_low: 16,
            proposed_symbols: ["RZRA"],
            shares_offered: 10_000_000,
            sources: {
                listing: null,
                registration: {
                    cik: "0002156369",
                    company_name: "Rezera Inc",
                    effective_at: null,
                    exchange: "XNAS",
                    exchange_approved_at: null,
                    filings: [],
                    final_offer_price: null,
                    final_shares_offered: null,
                    first_public_at: "2026-10-20T20:15:00Z",
                    first_trade_date: null,
                    form_family: "S-1",
                    is_spac: false,
                    price_range_at: "2026-11-02T12:00:00Z",
                    price_range_high: "18.00",
                    price_range_low: "16.00",
                    priced_at: null,
                    proposed_symbols: [],
                    shares_offered: 10_000_000,
                    stage: "price_range",
                    track_key: "333-290001",
                    withdrawn_at: null,
                },
            },
            stage: "price_range",
            total_offer_size: null,
        },
        {
            company: { cik: "0001234567", ticker: "NEWCO" },
            currency: "USD",
            exchange: "XNYS",
            final_price: 21,
            ipo_id: "l-NEWCO",
            is_spac: false,
            issuer_name: "NewCo Holdings",
            listing_date: "2026-11-05",
            price_range_high: 20,
            price_range_low: 18,
            proposed_symbols: [],
            shares_offered: 25_000_000,
            sources: {
                listing: {
                    announced_date: "2026-10-28",
                    currency_code: "USD",
                    final_issue_price: 21,
                    highest_offer_price: 20,
                    ipo_status: "history",
                    isin: null,
                    issue_end_date: null,
                    issue_start_date: null,
                    issuer_name: "NewCo Holdings",
                    last_updated: "2026-11-06T00:00:00Z",
                    listing_date: "2026-11-05",
                    lot_size: null,
                    lowest_offer_price: 18,
                    max_shares_offered: 25_000_000,
                    min_shares_offered: null,
                    primary_exchange: "XNYS",
                    security_description: null,
                    security_type: "CS",
                    shares_outstanding: null,
                    ticker: "NEWCO",
                    total_offer_size: 525_000_000,
                    us_code: null,
                },
                registration: null,
            },
            stage: "trading",
            total_offer_size: 525_000_000,
        },
    ],
    has_more: false,
    meta: {},
    next_cursor: null,
};

/** `GET /v1/filers?q=` (the spec example + a listed filer): one page, no cursor. */
export const V2_FILERS: V2FilersResponse = {
    data: [
        {
            cik: "0001453746",
            entity_type: "other",
            forms: [],
            listing: null,
            name: "ADAMS STREET TRUEST - BERKSHIRE FUND V LP Zinc Series",
            phase: null,
            sic: null,
            stated_tickers: [],
        },
        {
            cik: "0001067983",
            entity_type: "operating",
            forms: ["10-K", "13F-HR"],
            listing: { exchange: "XNYS", ticker: "BRK-B" },
            name: "BERKSHIRE HATHAWAY INC",
            phase: "public",
            sic: "6331",
            stated_tickers: ["BRK-A", "BRK-B"],
        },
    ],
    has_more: false,
    meta: { coverage: { state: "complete" } },
    next_cursor: null,
};

/** `GET /v1/search/filings?q=supply%20chain%20risk&symbol=AAPL` (the spec example of 6.4): a partial index. */
export const V2_FILING_SEARCH: V2FilingSearchResponse = {
    data: [{
        accession: "0000320193-25-000079",
        citation: {
            accession: "0000320193-25-000079",
            filename: "aapl-20250927.htm",
            source: { url: "https://storage.invinite.com/sec/18cf21cf542b9c42832192ccfdaef882/aapl-20250927.htm" },
            version_id: "d7bbe5c0-8708-521f-a720-15ef6d1bd1fa",
        },
        document_spans: [{ blocks: [{ block_id: "b00136", end: 351, start: 345 }], document_end: 41836, document_start: 41830, end: 734, start: 728 }],
        filename: "aapl-20250927.htm",
        filing_date: "2025-10-31",
        form: "10-K",
        match: { lexical_rank: 1, spans: [{ end: 13, start: 7 }], type: "lexical" },
        score: 0.01276426,
        text: "Global supply chain disruptions can materially adversely affect the Company’s business.",
        version_id: "d7bbe5c0-8708-521f-a720-15ef6d1bd1fa",
    }],
    has_more: false,
    meta: {
        coverage: { state: "partial" },
        index: {
            completeness: "partial",
            forms_indexed: ["10-K*"],
            hint: null,
            lexical: { failed: 0, indexed: 31, not_indexed_by_policy: 6, pending: 0, state: "ready" },
            matches: null,
            reasons: ["held_gap"],
        },
        mode: "lexical",
        query: "supply chain risk",
    },
    next_cursor: null,
};

/** Form D private offerings (`/v1/offerings`, Data API release 5.7), in the contract's shape. */
export const V2_OFFERINGS: V2OfferingsResponse = {
    data: [
        {
            accessions: ["0001991882-25-000004", "0001991882-26-000009"],
            amendment_count: 1,
            co_issuer_ciks: [],
            entity_type: "Limited Partnership",
            exemptions: ["06c", "3C.7"],
            file_number: "021-528681",
            filed_first: "2025-03-14",
            filed_latest: "2026-03-12",
            finders_fee: 0,
            first_accession: "0001991882-25-000004",
            first_sale_yet_to_occur: false,
            has_non_accredited: false,
            indefinite_amount: false,
            industry_group: "Pooled Investment Fund",
            investment_fund_type: "Private Equity Fund",
            investor_count: 42,
            is_40_act: false,
            is_amendment: true,
            is_business_combination: false,
            issuer_name: "Example Growth Fund II, L.P.",
            jurisdiction: "DELAWARE",
            latest_accession: "0001991882-26-000009",
            min_investment: 250_000,
            more_than_one_year: true,
            net_asset_value_range: "Decline to Disclose",
            non_accredited_count: 0,
            offering_id: "021-528681",
            original_held: true,
            primary_issuer_cik: "0001991882",
            related_persons: [{ clarification: null, name: "Jane Q. Example", relationships: ["Executive Officer"] }],
            revenue_range: null,
            sale_date: "2025-02-28",
            sales_commission: 0,
            security_types: ["pooled_investment_fund"],
            sic_code: null,
            total_offering_amount: 150_000_000,
            total_remaining: 62_500_000,
            total_sold: 87_500_000,
            year_of_inc: "2024",
        },
        {
            accessions: ["0001991882-24-000002"],
            amendment_count: 0,
            co_issuer_ciks: [],
            entity_type: "Limited Partnership",
            exemptions: ["06b"],
            file_number: null,
            filed_first: "2024-06-03",
            filed_latest: "2024-06-03",
            finders_fee: null,
            first_accession: "0001991882-24-000002",
            first_sale_yet_to_occur: true,
            has_non_accredited: null,
            indefinite_amount: true,
            industry_group: "Pooled Investment Fund",
            investment_fund_type: "Hedge Fund",
            investor_count: null,
            is_40_act: null,
            is_amendment: false,
            is_business_combination: false,
            issuer_name: "Example Growth Fund II, L.P.",
            jurisdiction: "DELAWARE",
            latest_accession: "0001991882-24-000002",
            min_investment: null,
            more_than_one_year: false,
            net_asset_value_range: null,
            non_accredited_count: null,
            offering_id: "0001991882-24-000002",
            original_held: true,
            primary_issuer_cik: "0001991882",
            related_persons: [],
            revenue_range: null,
            sale_date: null,
            sales_commission: null,
            security_types: ["pooled_investment_fund"],
            sic_code: null,
            total_offering_amount: null,
            total_remaining: null,
            total_sold: 0,
            year_of_inc: "Within Last Five Years",
        },
    ],
    has_more: true,
    meta: { coverage: { state: "complete" }, pinned_at: "2026-11-14T12:00:00Z" },
    next_cursor: "eyJ2IjoyfQ",
};

const SPY_FUND = { fund_key: "cik:884394", name: "SPDR S&P 500 ETF Trust", symbol: "SPY" };

const SPY_DAY = { as_of: "2026-11-13", fund: SPY_FUND, source: "issuer_daily" as const };

const security = (name: string, symbol: null | string) => ({ cik: null, cusip: null, isin: null, name, resolution: null, sedol: null, symbol });

/** `GET /v1/funds/SPY/holdings` (Data API 7.0, written in the contract's shape): the issuer's daily file. */
export const V2_FUND_POSITIONS: V2FundPositionsResponse = {
    data: [
        { ...SPY_DAY, asset_class: "equity", market_value_usd: 52_400_000_000, security: security("NVIDIA CORP", "NVDA"), shares: 290_000_000, weight_pct: 7.41 },
        { ...SPY_DAY, asset_class: "equity", market_value_usd: 46_100_000_000, security: security("APPLE INC", "AAPL"), shares: 170_000_000, weight_pct: 6.52 },
    ],
    has_more: true,
    meta: {
        as_of: "2026-11-13",
        composition: {
            newest_issuer_as_of: "2026-11-13",
            nport_report_date: "2026-09-30",
            stored_dates: [
                { as_of: "2026-11-13", positions_count: 503, source: "issuer_daily", status: "ready" },
                { as_of: "2026-11-12", positions_count: 503, source: "issuer_daily", status: "quarantined" },
                { as_of: "2026-11-11", positions_count: 503, source: "issuer_daily", status: "ready" },
                { as_of: "2026-09-30", positions_count: 504, source: "nport", status: null },
            ],
            stored_from: "2026-10-15",
            stored_to: "2026-11-13",
        },
        coverage: { state: "complete" },
        reason: null,
        source: "issuer_daily",
    },
    next_cursor: "c2",
};

/** TQQQ: swap and futures lines carry a notional exposure, no weight. */
export const V2_FUND_POSITIONS_LEVERAGED: V2FundPositionsResponse = {
    data: [
        {
            as_of: "2026-11-13",
            asset_class: "derivative",
            fund: { fund_key: "S000024908", name: "ProShares UltraPro QQQ", symbol: "TQQQ" },
            market_value_usd: 1_200_000,
            notional_value_usd: 9_800_000_000,
            security: security("NASDAQ 100 INDEX SWAP", null),
            source: "issuer_daily",
            weight_pct: null,
        },
    ],
    has_more: false,
    meta: { as_of: "2026-11-13", coverage: { state: "complete" }, reason: null, source: "issuer_daily" },
    next_cursor: null,
};

/** A fund the store still treats as a single-asset trust (drift; an exchange-traded trust never asks): no rows by design. */
export const V2_FUND_POSITIONS_SINGLE_ASSET: V2FundPositionsResponse = {
    data: [],
    has_more: false,
    meta: { as_of: "2026-11-13", coverage: { state: "complete" }, reason: "single_asset_trust", source: "issuer_daily" },
    next_cursor: null,
};

/** `GET /v1/funds/SPY/weights`: sector (issuer-stated), country (mixed basis), an Unclassified bucket. */
export const V2_FUND_WEIGHTS: V2FundWeightsResponse = {
    data: [
        { ...SPY_DAY, basis: "issuer_stated", bucket: "Information Technology", dimension: "sector", positions: 68, weight_pct: 31.2 },
        { ...SPY_DAY, basis: "issuer_stated", bucket: "Financials", dimension: "sector", positions: 72, weight_pct: 13.1 },
        { ...SPY_DAY, basis: "mixed", bucket: "US", dimension: "country", positions: 500, weight_pct: 99.1 },
        { ...SPY_DAY, basis: "none", bucket: "Unclassified", dimension: "country", positions: 3, weight_pct: 0.9 },
    ],
    has_more: false,
    meta: { coverage: { state: "complete" } },
    next_cursor: null,
};

// Ownership and offerings (backend tasks/data-api-dashboard O7 group 6).

/** `GET /v1/insider-trades/{id}`: a Form 3/4/5 dataset line — an option exercise under a 10b5-1 plan, held indirectly. */
export const V2_INSIDER_TRADE_DETAIL: V2InsiderTradeDetail = {
    ...V2_INSIDER_TRADES.data[1],
    coding_code: "M",
    conversion_exercise_price: 112.5,
    direct_indirect: "I",
    exercise_date: "2024-03-01",
    expiration_date: "2031-03-01",
    footnotes: [{ id: "F1", text: "Exercised under a Rule 10b5-1 trading plan adopted on May 2, 2026." }],
    is_10b5_1: true,
    nature_of_ownership: "By Trust",
    security_title: "Employee Stock Option (right to buy)",
    shares_owned_before_transaction: 80_000,
};

/** `GET /v1/filers/102909/holding-changes`: one manager's positions vs the prior quarter (a new one, a sold-out one). */
export const V2_FILER_HOLDING_CHANGES: V2FilerHoldingChangesResponse = {
    data: [
        { ...V2_HOLDER_CHANGES.data[0], filing_date: "2026-11-13" },
        {
            ...V2_HOLDER_CHANGES.data[0],
            filing_date: "2026-11-13",
            security: { cik: "0001045810", cusip: "67066G104", fund_key: null, isin: null, name: "NVIDIA CORP", resolution: null, symbol: "NVDA" },
            shares: 0,
            shares_change: -2_000_000,
            shares_change_pct: -1,
            shares_prior: 2_000_000,
            type: "sold_out",
            value_change_usd: -350_000_000,
            value_usd: 0,
        },
    ],
    has_more: true,
    meta: { coverage: { state: "complete", through: "2026-09-30" } },
    next_cursor: "c2",
};

/** `GET /v1/offerings/021-528681`: the list's first row with a co-issuer and two related persons. */
export const V2_OFFERING_DETAIL: V2OfferingDetail = {
    ...V2_OFFERINGS.data[0],
    co_issuer_ciks: ["0001991883"],
    related_persons: [
        { clarification: null, name: "Jane Q. Example", relationships: ["Executive Officer"] },
        { clarification: "Managing member of the general partner", name: "Example GP LLC", relationships: ["Promoter"] },
    ],
    sales_commission: 1_250_000,
};

/** `GET /v1/funds/QQQ/holdings`: N-PORT rows with ISIN, sector and country and their bases. */
export const V2_FUND_POSITIONS_CLASSIFIED: V2FundPositionsResponse = {
    data: [{
        as_of: "2026-09-30",
        asset_class: "equity",
        country: "US",
        country_basis: "nport",
        fund: { fund_key: "S000006218", name: "Invesco QQQ Trust", symbol: "QQQ" },
        market_value_usd: 30_000_000_000,
        sector: "Information Technology",
        sector_basis: "derived_sic",
        security: { ...security("APPLE INC", "AAPL"), cusip: "037833100", isin: "US0378331005" },
        shares: 120_000_000,
        source: "nport",
        weight_pct: 8.9,
    }],
    has_more: false,
    meta: { as_of: "2026-09-30", coverage: { state: "complete" }, reason: null, source: "nport" },
    next_cursor: null,
};

/** TQQQ's weights: the sum far from 100 (swaps at notional). */
export const V2_FUND_WEIGHTS_LEVERAGED: V2FundWeightsResponse = {
    data: [
        { as_of: "2026-11-13", basis: "issuer_stated", bucket: "Derivatives", dimension: "asset_class", fund: { fund_key: "S000024908", name: "ProShares UltraPro QQQ", symbol: "TQQQ" }, positions: 12, source: "issuer_daily", weight_pct: 214.3 },
        { as_of: "2026-11-13", basis: "issuer_stated", bucket: "Equity", dimension: "asset_class", fund: { fund_key: "S000024908", name: "ProShares UltraPro QQQ", symbol: "TQQQ" }, positions: 101, source: "issuer_daily", weight_pct: 85.9 },
    ],
    has_more: false,
    meta: { as_of: "2026-11-13", coverage: { state: "complete" }, source: "issuer_daily", weight_basis: "net_assets", weight_pct_sum: 300.2 },
    next_cursor: null,
};

/** `GET /v1/insider-holdings` (Data API 11.2 shape): a direct share holding and an indirect option holding. */
export const V2_INSIDER_HOLDINGS: V2InsiderHoldingsResponse = {
    data: [{
        accession_number: "0001214156-26-000003",
        as_of: "2026-10-02",
        cik: "0000320193",
        conversion_exercise_price: null,
        direct_indirect: "D",
        exercise_date: null,
        expiration_date: null,
        filed_at: "2026-10-04T20:00:00Z",
        footnotes: null,
        form: "4",
        id: "f345:0001214156-26-000003:NONDERIV_HOLDING:1:1214156",
        is_derivative: false,
        nature_of_ownership: null,
        owner_cik: "0001214156",
        reporting_person_is_director: false,
        reporting_person_is_officer: true,
        reporting_person_is_other: false,
        reporting_person_is_ten_percent_owner: false,
        reporting_person_name: "Cook Timothy D",
        reporting_person_officer_title: "Chief Executive Officer",
        reporting_person_other_text: null,
        security_title: "Common Stock",
        shares_owned: 3_280_180,
        source: "f345",
        underlying_security_title: null,
        underlying_shares: null,
        value_owned: null,
    }, {
        accession_number: "0001631982-26-000010",
        as_of: "2026-09-15",
        cik: "0000320193",
        conversion_exercise_price: 112.5,
        direct_indirect: "I",
        exercise_date: "2024-03-01",
        expiration_date: "2031-03-01",
        filed_at: "2026-09-17T21:00:00Z",
        footnotes: null,
        form: "4",
        id: "f345:0001631982-26-000010:DERIV_HOLDING:1:1631982",
        is_derivative: true,
        nature_of_ownership: "By Trust",
        owner_cik: "0001631982",
        reporting_person_is_director: true,
        reporting_person_is_officer: false,
        reporting_person_is_other: false,
        reporting_person_is_ten_percent_owner: false,
        reporting_person_name: "Levinson Arthur D",
        reporting_person_officer_title: null,
        reporting_person_other_text: null,
        security_title: "Stock Option (Right to Buy)",
        shares_owned: 40_000,
        source: "f345",
        underlying_security_title: "Common Stock",
        underlying_shares: 40_000,
        value_owned: null,
    }],
    has_more: true,
    meta: { coverage: { state: "complete", through: "2026-10-04" } },
    next_cursor: "eyJ2IjoyfQ",
};

/** Schedule 13D / 13G filings (Data API 11.5, the contract's shape): a 13G/A that is the latest of its chain, the 13G it
 * follows (superseded), and a 13D without a structured cover page. */
export const V2_BENEFICIAL_OWNERSHIP: V2BeneficialOwnershipResponse = {
    data: [
        {
            accepted_at: "2025-11-12T15:02:11Z",
            accession_number: "0000102909-25-000123",
            amendment_no: 12,
            class_title: "Common Stock",
            company: AAPL,
            company_name: "Apple Inc.",
            cusip: "037833100",
            event_date: "2025-09-30",
            filed_at: "2025-11-12",
            filing_url: "https://www.sec.gov/Archives/edgar/data/320193/000010290925000123/0000102909-25-000123-index.htm",
            form: "SCHEDULE 13G/A",
            holders: [
                {
                    aggregate_amount: 153451954,
                    citizenship: "PA",
                    filer_cik: "0000102909",
                    is_group_member: false,
                    name: "VANGUARD GROUP INC",
                    percent_of_class: 9.92,
                    shared_dispositive_power: 6153521,
                    shared_voting_power: 1520417,
                    sole_dispositive_power: 147298433,
                    sole_voting_power: 0,
                    source_of_funds: null,
                    type_of_person: "IA",
                },
            ],
            is_amendment: true,
            is_current: true,
            parse_state: "parsed",
            purpose: null,
            schedule: "13G",
            source_url: null,
            supersedes_accession: "0000102909-24-000877",
        },
        {
            accepted_at: "2024-11-08T14:00:00Z",
            accession_number: "0000102909-24-000877",
            amendment_no: 11,
            class_title: "Common Stock",
            company: AAPL,
            company_name: "Apple Inc.",
            cusip: "037833100",
            event_date: "2024-09-30",
            filed_at: "2024-11-08",
            filing_url: "https://www.sec.gov/Archives/edgar/data/320193/000010290924000877/0000102909-24-000877-index.htm",
            form: "SCHEDULE 13G/A",
            holders: [
                {
                    aggregate_amount: 150000000,
                    citizenship: "PA",
                    filer_cik: "0000102909",
                    is_group_member: false,
                    name: "VANGUARD GROUP INC",
                    percent_of_class: 9.5,
                    shared_dispositive_power: null,
                    shared_voting_power: null,
                    sole_dispositive_power: null,
                    sole_voting_power: null,
                    source_of_funds: null,
                    type_of_person: "IA",
                },
            ],
            is_amendment: true,
            is_current: false,
            parse_state: "parsed",
            purpose: null,
            schedule: "13G",
            source_url: null,
            supersedes_accession: null,
        },
        {
            accepted_at: null,
            accession_number: "0001193125-25-000001",
            amendment_no: null,
            class_title: null,
            company: { cik: "0001234567", ticker: null },
            company_name: "Example Target Corp",
            cusip: null,
            event_date: null,
            filed_at: "2025-10-01",
            filing_url: "https://www.sec.gov/Archives/edgar/data/1234567/000119312525000001/0001193125-25-000001-index.htm",
            form: "SCHEDULE 13D",
            holders: [],
            is_amendment: false,
            is_current: true,
            parse_state: "no_structured_document",
            purpose: null,
            schedule: "13D",
            source_url: null,
            supersedes_accession: null,
        },
    ],
    has_more: true,
    meta: { coverage: { state: "complete", through: "2025-11-12" }, coverage_start: "2023-04-13", pinned_at: "2025-11-13T00:00:00Z" },
    next_cursor: "c2",
};

/** Form 144 notices (Data API 11.5, the contract's shape): an original replaced by an amendment, and that amendment. */
export const V2_INSIDER_SALE_NOTICES: V2InsiderSaleNoticesResponse = {
    data: [
        {
            accepted_at: "2025-10-03T16:31:08Z",
            accession_number: "0001959173-25-006500",
            acquisitions: [],
            company: AAPL,
            company_name: "Apple Inc.",
            filed_at: "2025-10-03",
            filer: { cik: "0001214156", name: "COOK TIMOTHY D" },
            filing_url: "https://www.sec.gov/Archives/edgar/data/320193/000195917325006500/0001959173-25-006500-index.htm",
            form: "144/A",
            is_amendment: true,
            nothing_sold_past_3_months: false,
            notice_date: "2025-10-03",
            parse_state: "parsed",
            plan_adoption_dates: ["2025-05-15"],
            relationships: ["Officer", "Director"],
            remarks: null,
            replaced_by: null,
            replaces_accession: "0001959173-25-006421",
            sales_past_3_months: [],
            securities: [
                { approximate_sale_date: "2025-10-06", broker: "Morgan Stanley Smith Barney LLC", class_title: "Common", exchange: "NASDAQ", market_value: 25780000, shares_outstanding: 14840390000, shares_to_sell: 100000 },
            ],
            source_url: null,
        },
        {
            accepted_at: "2025-10-02T16:31:08Z",
            accession_number: "0001959173-25-006421",
            acquisitions: [],
            company: AAPL,
            company_name: "Apple Inc.",
            filed_at: "2025-10-02",
            filer: { cik: "0001214156", name: "COOK TIMOTHY D" },
            filing_url: "https://www.sec.gov/Archives/edgar/data/320193/000195917325006421/0001959173-25-006421-index.htm",
            form: "144",
            is_amendment: false,
            nothing_sold_past_3_months: false,
            notice_date: "2025-10-02",
            parse_state: "parsed",
            plan_adoption_dates: [],
            relationships: ["Officer"],
            remarks: null,
            replaced_by: "0001959173-25-006500",
            replaces_accession: null,
            sales_past_3_months: [],
            securities: [
                { approximate_sale_date: "2025-10-06", broker: "Morgan Stanley Smith Barney LLC", class_title: "Common", exchange: "NASDAQ", market_value: 25000000, shares_outstanding: 14840390000, shares_to_sell: 100000 },
            ],
            source_url: null,
        },
    ],
    has_more: false,
    meta: { coverage: { state: "complete", through: "2025-10-03" }, coverage_start: "2023-04-13", pinned_at: "2025-10-04T00:00:00Z" },
    next_cursor: null,
};
