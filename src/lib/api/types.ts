import type { paths } from "./schema";

// Helper type to extract successful JSON response from a path
type ApiResponse<TPath extends keyof paths, TPathValue extends keyof paths[TPath]>
    = paths[TPath][TPathValue] extends { responses: { 200: { content: { "application/json": infer R } } } }
        ? R
        : never;

// Helper type to extract the query parameters of a path's GET operation
type ApiQuery<TPath extends keyof paths>
    = paths[TPath] extends { get: { parameters: { query?: infer Q } } } ? NonNullable<Q> : never;

// Response types derived from schema
export type CompanySearchResponse = ApiResponse<"/v1/company/search", "get">;
export type CompanyDetailsResponse = ApiResponse<"/v1/company/details", "get">;
export type DividendsResponse = ApiResponse<"/v1/company/dividends", "get">;
export type SplitsResponse = ApiResponse<"/v1/company/splits", "get">;
export type InsiderTradesResponse = ApiResponse<"/v1/insider-trades", "get">;
export type IposResponse = ApiResponse<"/v1/ipos", "get">;
export type MarketHolidaysResponse = ApiResponse<"/v1/market/market-holidays", "get">;
export type FilingsResponse = ApiResponse<"/v1/sec-filings/filings", "get">;
export type AvailableFormTypesResponse = ApiResponse<"/v1/sec-filings/available-form-types", "get">;
export type FinancialRatiosResponse = ApiResponse<"/v1/financial-metrics/ratios", "get">;
export type FinancialGrowthResponse = ApiResponse<"/v1/financial-metrics/growth", "get">;
export type FinancialCagrResponse = ApiResponse<"/v1/financial-metrics/cagr", "get">;
export type InstitutionalTransactionsResponse = ApiResponse<
    "/v1/institutional-ownership/transactions",
    "get"
>;
export type InstitutionalHoldingsResponse = ApiResponse<
    "/v1/institutional-ownership/holdings-by-company",
    "get"
>;
export type InstitutionsResponse = ApiResponse<
    "/v1/institutional-ownership/institutions",
    "get"
>;

// All 3 statement endpoints have the same response structure
export type StandardizedFinancialsResponse = ApiResponse<"/v1/standardized/income-statement", "get">;
export type StandardizedFinancialsPresentationResponse = ApiResponse<
    "/v1/standardized/income-statement/presentation",
    "get"
>;
export type AsReportedFinancialsPresentationResponse = ApiResponse<
    "/v1/as-reported/income-statement/presentation",
    "get"
>;
export type SegmentedFinancialsResponse = ApiResponse<"/v1/segmented-financials", "get">;

// Derived entity types
export type Company = CompanySearchResponse["companies"][number];
export type CompanyDetails = CompanyDetailsResponse["companies"][number];
export type Dividend = DividendsResponse["companies"][number]["dividends"][number];
export type Split = SplitsResponse["companies"][number]["splits"][number];
export type InsiderTrade = InsiderTradesResponse["transactions"][number];
export type Ipo = IposResponse["ipos"][number];
export type MarketHoliday = MarketHolidaysResponse["holidays"][number];
export type Filing = FilingsResponse["companies"][number]["filings"][number];
export type InstitutionalTransaction = InstitutionalTransactionsResponse["transactions"][number];
export type InstitutionalHolding = InstitutionalHoldingsResponse["holdings"][number];
export type Institution = InstitutionsResponse["institutions"][number];
export type FinancialPeriod
    = StandardizedFinancialsPresentationResponse["companies"][number]["periods"][number];
export type PresentationFinancialPeriod
    = | AsReportedFinancialsPresentationResponse["companies"][number]["periods"][number]
        | StandardizedFinancialsPresentationResponse["companies"][number]["periods"][number];
export type SegmentedFinancialPeriod
    = SegmentedFinancialsResponse["companies"][number]["periods"][number];
export type FinancialCagrPeriod
    = FinancialCagrResponse["companies"][number]["periods"][number];
export type FinancialGrowthPeriod
    = FinancialGrowthResponse["companies"][number]["periods"][number];
export type FinancialRatiosPeriod
    = FinancialRatiosResponse["companies"][number]["periods"][number];
export type FinancialMetricPeriod
    = FinancialCagrPeriod | FinancialGrowthPeriod | FinancialRatiosPeriod;
export type SegmentedFinancialFact
    = SegmentedFinancialPeriod["facts"][string][number];

// Earnings calls (IDA `/v1/earnings-calls/*`)

// A JSON value. The spec types free-form fields (`transcript.data`, `participation_events[].detail`)
// as `unknown`, which a server function's return type rejects (TanStack Start only accepts provably
// serialisable values); the API answers JSON, so those fields are narrowed to `JsonValue`.
export type JsonValue = Array<JsonValue> | boolean | null | number | string | { [key: string]: JsonValue };

type WithJson<TObject, TKey extends keyof TObject> = Omit<TObject, TKey> & { [TProp in TKey]: JsonValue };

export type EarningsCalendarResponse = ApiResponse<"/v1/earnings-calls/calendar", "get">;
export type EarningsEventsResponse = ApiResponse<"/v1/earnings-calls/events", "get">;
export type EarningsLiveResponse = ApiResponse<"/v1/earnings-calls/live", "get">;
export type EarningsLiveStreamResponse = ApiResponse<"/v1/earnings-calls/live/stream", "get">;
export type EarningsEventResponse = ApiResponse<"/v1/earnings-calls/event/{event_id}", "get">;
export type EarningsTranscriptResponse = WithJson<ApiResponse<"/v1/earnings-calls/transcript", "get">, "data">;
export type EarningsTranscriptVersionsResponse = ApiResponse<"/v1/earnings-calls/transcript/versions", "get">;
export type EarningsTranscriptDiffResponse = ApiResponse<"/v1/earnings-calls/transcript/diff", "get">;
export type EarningsQaResponse = ApiResponse<"/v1/earnings-calls/qa", "get">;
type EarningsParticipantsRaw = ApiResponse<"/v1/earnings-calls/participants", "get">;

export type EarningsParticipationEvent
    = Omit<EarningsParticipantsRaw["participation_events"][number], "detail"> & { detail: null | Record<string, JsonValue> };
export type EarningsParticipantsResponse
    = Omit<EarningsParticipantsRaw, "participation_events"> & { participation_events: Array<EarningsParticipationEvent> };
export type EarningsPressReleaseResponse = ApiResponse<"/v1/earnings-calls/press-release", "get">;
export type EarningsExtractionsResponse = ApiResponse<"/v1/earnings-calls/extractions", "get">;
export type EarningsGuidanceHistoryResponse = ApiResponse<"/v1/earnings-calls/guidance/history", "get">;
export type EarningsDiffResponse = ApiResponse<"/v1/earnings-calls/diff", "get">;
export type EarningsMetricsResponse = ApiResponse<"/v1/earnings-calls/metrics", "get">;
export type EarningsProsodyResponse = ApiResponse<"/v1/earnings-calls/prosody", "get">;
/** Derived returns only (basis points): the response carries no price or volume. */
export type EarningsPriceAttributionResponse = ApiResponse<"/v1/earnings-calls/price-attribution", "get">;
export type EarningsAudioResponse = ApiResponse<"/v1/earnings-calls/audio", "get">;
export type EarningsSlidesResponse = ApiResponse<"/v1/earnings-calls/slides", "get">;
export type EarningsDocumentsResponse = ApiResponse<"/v1/earnings-calls/documents", "get">;
export type EarningsSearchResponse = ApiResponse<"/v1/earnings-calls/search", "get">;

export type EarningsEvent = EarningsCalendarResponse["events"][number];
export type EarningsEventWithObservations = EarningsEventsResponse["events"][number];
export type EarningsLiveEvent = EarningsLiveResponse["events"][number];
export type EarningsEventBrief = EarningsAudioResponse["event"];
export type EarningsTranscriptVersion = EarningsTranscriptVersionsResponse["versions"][number];
export type EarningsQaPair = EarningsQaResponse["pairs"][number];
export type EarningsParticipant = EarningsParticipantsResponse["participants"][number];
export type EarningsGuidanceItem = NonNullable<EarningsExtractionsResponse["guidance"]>[number];
export type EarningsKpi = NonNullable<EarningsExtractionsResponse["kpis"]>[number];
export type EarningsDocument = EarningsDocumentsResponse["documents"][number];
export type EarningsSlide = EarningsSlidesResponse["slides"][number];
export type EarningsSlideDeck = NonNullable<EarningsSlidesResponse["deck"]>;
export type EarningsSearchHit = EarningsSearchResponse["hits"][number];
export type EarningsProsodySpeaker = EarningsProsodyResponse["speakers"][number];
export type EarningsPriceBucket = EarningsPriceAttributionResponse["buckets"][number];
export type EarningsPriceTopMinute = EarningsPriceAttributionResponse["top_minutes"][number];
export type EarningsPriceUtteranceRef = EarningsPriceBucket["utterance_refs"][number];

export type EarningsDateStatus = EarningsEvent["date_status"];
export type EarningsSession = NonNullable<ApiQuery<"/v1/earnings-calls/calendar">["session"]>;
export type EarningsEventType = NonNullable<ApiQuery<"/v1/earnings-calls/calendar">["event_type"]>;
export type EarningsTranscriptFormat = NonNullable<ApiQuery<"/v1/earnings-calls/transcript">["format"]>;
export type EarningsExtractionKind = NonNullable<ApiQuery<"/v1/earnings-calls/extractions">["kind"]>;
export type EarningsExtractionReview = NonNullable<ApiQuery<"/v1/earnings-calls/extractions">["review"]>;
export type EarningsGuidancePeriodKind = NonNullable<ApiQuery<"/v1/earnings-calls/guidance/history">["period_kind"]>;
export type EarningsGuidanceBasis = NonNullable<ApiQuery<"/v1/earnings-calls/guidance/history">["basis"]>;
export type EarningsProsodySection = NonNullable<ApiQuery<"/v1/earnings-calls/prosody">["section"]>;
export type EarningsSearchType = NonNullable<ApiQuery<"/v1/earnings-calls/search">["type"]>;

export type EarningsLiveStreamStatus = EarningsLiveStreamResponse["status"];

// Query parameter types
export type FiscalPeriodType = "annual" | "quarterly" | "ttm" | "ytd";

// Only the 3 statement types that share the same response structure
export type StatementType = "balance-sheet" | "cash-flow-statement" | "income-statement";

export type RatioCategory = "liquidity" | "profitability" | "solvency" | "valuation";
export type GrowthType = "quarter_over_quarter" | "year_over_year";
export type CagrPeriodYears = 3 | 5 | 10;

export type SegmentedFinancialsSegmentId
    = | "seg_cost_of_revenue_business_segment"
        | "seg_general_and_administrative_expenses_business_segment"
        | "seg_research_and_development_expenses_business_segment"
        | "seg_revenue_business_segment"
        | "seg_revenue_geographic"
        | "seg_revenue_product"
        | "seg_selling_and_marketing_expenses_business_segment";

// Public status + licensing (IDA `/status*`, task 21; no API key)
export type ApiStatusResponse = ApiResponse<"/status", "get">;
export type EarningsCallsStatusResponse = ApiResponse<"/status/earnings-calls", "get">;
export type LicensingResponse = ApiResponse<"/status/licensing", "get">;

export type StatusFamily = NonNullable<ApiStatusResponse["api"]>["families"][number];
export type ProductFamily = StatusFamily["family"];
export type StatusFamilyDay = StatusFamily["days"][number];
export type FreshnessRow = NonNullable<ApiStatusResponse["freshness"]>[number];
export type FreshnessReason = NonNullable<FreshnessRow["reason"]>;
export type StatusUniverse = ApiStatusResponse["universe"];
export type EarningsCallsStatusDay = EarningsCallsStatusResponse["days"][number];
export type EarningsCallsCoverageDay = EarningsCallsStatusResponse["coverageDays"][number];
export type EarningsCallsKeywordHitDay = EarningsCallsStatusResponse["keywordHitDays"][number];
export type LicenseRight = LicensingResponse["rights"][number];
export type LicenseTier = keyof LicensingResponse["tiers"];
export type LicensingFamily = LicensingResponse["families"][number];
export type LicensingRoute = LicensingFamily["routes"][number];
