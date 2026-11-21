import type {
    V2DatasetsResponse,
    V2DocumentSectionsResponse,
    V2FactPlacesResponse,
    V2FilingDetailResponse,
    V2FilingFactsResponse,
    V2FilingHoldingsResponse,
    V2FilingNotesResponse,
    V2ReviewChainResponse,
} from "@/lib/api/types";
import type { LiveFiling } from "@/lib/live/ws-frames";

/**
 * Fixtures of the filing page and the live filings (tests only; backend tasks/data-api-dashboard O7 group 3), in the
 * contract's shape, recorded from the live API on 2026-11-21 (AAPL 10-Q `0000320193-26-000020`, Berkshire's 13F-HR
 * `0001193125-26-352200`), trimmed.
 */

export const FILING_FACTS: V2FilingFactsResponse = {
    data: [
        { decimals: -6, dimensions: [], instant: "2026-06-30", period_end: null, period_start: null, tag: "AccountsPayableCurrent", unit: "USD", value: 64525000000 },
        {
            decimals: -6,
            dimensions: [{ axis: "srt:ProductOrServiceAxis", member: "us-gaap:ProductMember" }],
            instant: null,
            period_end: "2026-06-27",
            period_start: "2026-03-29",
            tag: "RevenueFromContractWithCustomerExcludingAssessedTax",
            unit: "USD",
            value: 66613000000,
        },
        { decimals: null, dimensions: [], instant: "2026-06-27", period_end: null, period_start: null, tag: "CommitmentsAndContingencies", unit: "USD", value: null },
    ],
    has_more: true,
    meta: { coverage: { state: "complete" }, source: { accession: "0000320193-26-000020", dataset_release: "2026_07" } },
    next_cursor: "eyJ2IjoyfQ",
};

/** A filing whose data set release is not out yet (filed after the newest `fsn` release). */
export const FILING_FACTS_PENDING: V2FilingFactsResponse = {
    data: [],
    has_more: false,
    meta: { coverage: { state: "pending", through: "2026-10-31" }, source: { accession: "0000320193-26-000026" } },
    next_cursor: null,
};

const LONG_NOTE = `Condensed Consolidated Financial Statement Details The following tables show the Company's condensed consolidated financial statement details as of June 27, 2026 and September 27, 2025 (in millions). ${"Inventories Components Finished goods Total inventories. ".repeat(12)}`;

export const FILING_NOTES: V2FilingNotesResponse = {
    data: [{ dimensions: [], period_end: "2026-06-27", tag: "AdditionalFinancialInformationDisclosureTextBlock", text: LONG_NOTE }],
    has_more: false,
    meta: { coverage: { state: "complete" }, source: { accession: "0000320193-26-000020", dataset_release: "2026_07" } },
    next_cursor: null,
};

export const FILING_HOLDINGS_13F: V2FilingHoldingsResponse = {
    data: [{
        accession_number: "0001193125-26-352200",
        as_of: "2026-06-30",
        asset_cat: null,
        filing_date: "2026-08-14",
        filing_url: "https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm",
        holder: { cik: "0001067983", class_tickers: [], fund_key: null, issuer_file_as_of: null, name: null, registrant_name: null, series_id: null, symbols: [], type: "institution" },
        investment_discretion: "DFND",
        put_call: null,
        security: { cik: null, cusip: "615369105", fund_key: null, isin: null, name: "MOODYS CORP", resolution: null, symbol: null },
        shares: 11973928,
        shares_type: "SH",
        source: "13f",
        value_usd: 5423231470,
        voting_authority: { none: 0, shared: 0, sole: 11973928 },
        weight_pct: null,
    }],
    has_more: true,
    meta: { coverage: { state: "complete" }, family: "13f", source: { accession: "0001193125-26-352200" } },
    next_cursor: "eyJ2IjoyfQ",
};

export const DOCUMENT_SECTIONS: V2DocumentSectionsResponse = {
    data: [
        { block_spans: [{ from: "b00012", to: "b00040" }], blocks: ["b00012-b00040"], item_id: "1", legacy_section_key: null, ordinal: 1, outline: "generic", part: "Part I", title: "Financial Statements" },
        { block_spans: [{ from: "b00107", to: "b00244" }], blocks: ["b00107-b00244"], item_id: "1A", legacy_section_key: null, ordinal: 2, outline: "generic", part: "Part II", title: "Risk Factors" },
    ],
    has_more: false,
    meta: { coverage: { state: "complete" }, source: { accession: "0000320193-26-000020", version_id: "f735ba2e-582b-5682-a5c7-746c8cef1457" } },
    next_cursor: null,
};

export const FACT_PLACES: V2FactPlacesResponse = {
    data: [{
        block_id: "b00085",
        concept: "MarketableSecuritiesNoncurrent",
        document_version: "f735ba2e-582b-5682-a5c7-746c8cef1457",
        fact_id: null,
        html_tag_id: "f-492",
        legacy_id: "f-492",
        page: null,
        pdf_box: [],
        rendition_url: "https://storage.invinite.com/filing_htmls/08ebddf35a565e5be3f0c5dd5da7a47c/320193_0000320193-26-000020_10-Q_2026-07-31.html",
        source_sha256: "4ad5bea67cedfa7542d623900355cc8d143ef95c1acc135a597f2eedabdb9177",
        status: "placed",
        table_col: 39,
        table_row: 14,
        xbrl_ordinal: 66,
        xpath: "/html/body/ix:continuation[3]/ix:nonnumeric/div[2]/table/tr[15]/td[20]/span/ix:nonfraction",
    }],
    has_more: false,
    meta: { coverage: { state: "complete" }, source: { version_id: "f735ba2e-582b-5682-a5c7-746c8cef1457" } },
    next_cursor: null,
};

/** A filing whose letters are not resolved / that has none: its own node only. */
export const REVIEW_CHAIN_ALONE: V2ReviewChainResponse = {
    accession: "0000320193-26-000026",
    completeness: { max_depth: 1, max_nodes: 100, not_held_nodes: [], truncated: false, unresolved_edges: 0, unresolved_review_nodes: [] },
    edges: [],
    nodes: [{ accession: "0000320193-26-000026", depth: 0, file_number: null, filing_date: null, form: null, holding: null, report_date: null }],
    twins: [],
};

/** A comment letter and the response pointing at it (shape per the spec's free JSON; illustrative values). */
export const REVIEW_CHAIN_LETTERS: V2ReviewChainResponse = {
    accession: "0000320193-25-000079",
    completeness: { max_depth: 1, max_nodes: 100, not_held_nodes: ["0000000000-26-000001"], truncated: true, unresolved_edges: 2, unresolved_review_nodes: [] },
    edges: [{ direction: "up", from: "0000000000-26-000002", kind: "reviews", to: "0000320193-25-000079" }],
    nodes: [
        { accession: "0000320193-25-000079", depth: 0, file_number: "001-36743", filing_date: "2025-10-31", form: "10-K", holding: null, report_date: "2025-09-27" },
        { accession: "0000000000-26-000002", depth: 1, file_number: "001-36743", filing_date: "2026-02-10", form: "UPLOAD", holding: null, report_date: null },
    ],
    twins: [],
};

export const FILING_PARTIES: V2FilingDetailResponse = {
    accession: "0000320193-26-000026",
    company: { cik: "0000320193", ticker: "AAPL" },
    edgar_index_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/0000320193-26-000026-index.htm",
    filed_at: "2026-11-03T13:05:15Z",
    filing_date: "2026-11-03",
    form: "10-K",
    items: [],
    parties: [{ cik: "0000320193", name: "Apple Inc.", role: "filer" }, { cik: "0000320193", name: null, role: "listed" }],
    relations: [{ from: "a10-kexhibit21109262026.htm", relation: "exhibit_of", to: "aapl-20260926.htm" }],
    report_date: "2026-09-26",
};

export const DATASETS: V2DatasetsResponse = {
    data: [
        { dataset: "f13", forms: ["13F-HR", "13F-HR/A", "13F-NT", "13F-NT/A"], release: "01jun2026-31aug2026", released_at: "2026-09-14" },
        { dataset: "fsn", forms: ["10-K", "10-Q", "8-K"], release: "2026_10", released_at: "2026-11-04" },
        { dataset: "zzz", forms: [], release: "2026", released_at: null },
    ],
    has_more: false,
    meta: { coverage: { state: "complete" } },
    next_cursor: null,
};

/** A `new_filing` frame's filing (the spec's `WebSocketFiling`). */
export const LIVE_FILING: LiveFiling = {
    accession_number: "0000320193-26-000030",
    calendar_quarter: 4,
    calendar_year: 2026,
    cik: "0000320193",
    filing_date: "2026-11-20",
    fiscal_quarter: 1,
    fiscal_year: 2027,
    form_type: "8-K",
    html_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000030/aapl-20261120.htm",
    period_end: "2026-11-20",
    proposed_symbols: null,
    ticker: "AAPL",
};

/** A pre-IPO registration (no ticker yet, proposed symbols). */
export const LIVE_FILING_S1: LiveFiling = {
    accession_number: "0001999999-26-000001",
    calendar_quarter: 4,
    calendar_year: 2026,
    cik: "0001999999",
    filing_date: "2026-11-20",
    fiscal_quarter: null,
    fiscal_year: null,
    form_type: "S-1",
    html_url: null,
    period_end: null,
    proposed_symbols: [{ exchange: "NASDAQ", ipo_calendar_match: false, security_class: "common", source: "regex", symbol: "NEWC" }],
    ticker: null,
};
