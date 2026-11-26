/**
 * Instrument and fund answers for tests only (Data API 7.0, `GET /v1/instruments*`, `GET /v1/funds*`), written in the
 * contract's shape. `datasets` follows the API's table (`invinite-data-api/src/lib/v2/instrumentDatasets.ts`):
 * the dashboard never derives it.
 */
import type { V2Fund, V2FundsResponse, V2Instrument, V2InstrumentsResponse } from "@/lib/api/types";

const STOCK_DATASETS: V2Instrument["datasets"] = [
    "profile",
    "filings",
    "dividends",
    "splits",
    "holders",
    "financials",
    "metrics",
    "segments",
    "fiscal_periods",
    "events",
    "transcripts",
    "guidance",
    "insider_trades",
    "people",
    "investor_documents",
    "news",
    "ipos",
    "offerings",
    "alerts",
];

const FUND_DATASETS: V2Instrument["datasets"] = ["profile", "filings", "dividends", "splits", "holders", "fund_holdings", "fund_weights", "alerts"];

const listing = { country_code: "US", currency: "USD", is_active: true, logo_url: null };

export const AAPL_INSTRUMENT: V2Instrument = {
    ...listing,
    company: { cik: "0000320193" },
    datasets: STOCK_DATASETS,
    exchange: "XNAS",
    fund: null,
    list_date: "1980-12-12",
    name: "Apple Inc.",
    structure: null,
    symbol: "AAPL",
    type: "stock",
};

export const SPY_INSTRUMENT: V2Instrument = {
    ...listing,
    company: null,
    datasets: FUND_DATASETS,
    exchange: "ARCX",
    fund: { fund_key: "cik:884394", registrant_cik: "0000884394", series_id: null },
    list_date: "1993-01-29",
    name: "SPDR S&P 500 ETF Trust",
    structure: "registered_fund",
    symbol: "SPY",
    type: "etf",
};

export const TQQQ_INSTRUMENT: V2Instrument = {
    ...listing,
    company: null,
    datasets: FUND_DATASETS,
    exchange: "XNAS",
    fund: { fund_key: "S000024908", registrant_cik: "0001174610", series_id: "S000024908" },
    list_date: "2010-02-09",
    name: "ProShares UltraPro QQQ",
    structure: "registered_fund",
    symbol: "TQQQ",
    type: "etf",
};

export const PDI_INSTRUMENT: V2Instrument = {
    ...listing,
    company: null,
    datasets: [...FUND_DATASETS, "events", "ipos", "offerings"],
    exchange: "XNYS",
    fund: { fund_key: "cik:1510599", registrant_cik: "0001510599", series_id: null },
    list_date: "2012-05-31",
    name: "PIMCO Dynamic Income Fund",
    structure: "registered_fund",
    symbol: "PDI",
    type: "closed_end_fund",
};

/** An exchange-traded trust (owner decision 11): files 10-K, no N-PORT, so no `fund_holdings` / `fund_weights`. */
export const GLD_INSTRUMENT: V2Instrument = {
    ...listing,
    company: null,
    datasets: ["profile", "filings", "dividends", "splits", "holders", "alerts"],
    exchange: "ARCX",
    fund: { fund_key: "cik:1222333", registrant_cik: "0001222333", series_id: null },
    list_date: "2004-11-18",
    name: "SPDR Gold Shares",
    structure: "exchange_traded_trust",
    symbol: "GLD",
    type: "etf",
};

export const VXX_INSTRUMENT: V2Instrument = {
    ...listing,
    company: null,
    datasets: ["profile", "dividends", "splits", "holders", "alerts"],
    exchange: "BATS",
    fund: null,
    list_date: "2018-01-19",
    name: "iPath Series B S&P 500 VIX Short-Term Futures ETN",
    structure: null,
    symbol: "VXX",
    type: "etn",
};

export const INSTRUMENT_SEARCH: V2InstrumentsResponse = {
    data: [TQQQ_INSTRUMENT, GLD_INSTRUMENT, PDI_INSTRUMENT, VXX_INSTRUMENT, AAPL_INSTRUMENT],
    has_more: false,
    meta: { coverage: { state: "complete" } },
    next_cursor: null,
};

/** VOO: a class of a multi-class series — net assets are the series' (`series`), no market cap of its own. */
export const VOO_FUND: V2Fund = {
    advisers: [{ crd: null, is_affiliated: true, lei: null, name: "The Vanguard Group, Inc.", role: "Advisor" }],
    brand_colors: null,
    class_id: "C000092055",
    country_code: "US",
    currency: "USD",
    exchange: "ARCX",
    expense_ratio_as_of: "2026-04-29",
    expense_ratio_class_id: "C000092055",
    expense_ratio_gross: 0.0003,
    expense_ratio_net: 0.0003,
    fund_key: "S000002277",
    homepage_url: null,
    investment_company_type: "N-1A",
    is_active: true,
    is_index: true,
    list_date: "2010-09-09",
    logo_url: null,
    market_cap: null,
    name: "Vanguard S&P 500 ETF",
    net_assets_as_of: "2026-06-30",
    net_assets_scope: "series",
    net_assets_usd: 1_700_000_000_000,
    registrant_cik: "0000036405",
    registrant_name: "Vanguard Index Funds",
    series_id: "S000002277",
    share_classes: [
        { class_id: "C000007773", class_name: "Admiral Shares", is_listed: false, ticker: "VFIAX" },
        { class_id: "C000092055", class_name: "ETF Shares", is_listed: true, ticker: "VOO" },
    ],
    shares_outstanding: 1_400_000_000,
    short_float_pct: null,
    structure: "registered_fund",
    symbol: "VOO",
    symbols: ["VOO"],
    type: "etf",
};

export const FUNDS_PAGE: V2FundsResponse = {
    data: [
        { exchange: "ARCX", fund_key: "cik:1222333", is_active: true, logo_url: null, name: "SPDR Gold Shares", net_assets_usd: null, structure: "exchange_traded_trust", symbol: "GLD", type: "etf" },
        { exchange: "XNYS", fund_key: "cik:1510599", is_active: true, logo_url: null, name: "PIMCO Dynamic Income Fund", net_assets_usd: 5_200_000_000, structure: "registered_fund", symbol: "PDI", type: "closed_end_fund" },
        { exchange: "ARCX", fund_key: "cik:884394", is_active: true, logo_url: null, name: "SPDR S&P 500 ETF Trust", net_assets_usd: 640_000_000_000, structure: "registered_fund", symbol: "SPY", type: "etf" },
    ],
    has_more: true,
    meta: { coverage: { state: "complete" } },
    next_cursor: "c2",
};
