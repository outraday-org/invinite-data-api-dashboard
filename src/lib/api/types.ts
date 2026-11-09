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
export type InsiderTradesResponse = ApiResponse<"/v1/insider-trades", "get">;
export type IposResponse = ApiResponse<"/v1/ipos", "get">;
export type CompanyFiscalPeriodsResponse = ApiResponse<"/v1/company/fiscal-periods", "get">;
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
export type InsiderTrade = InsiderTradesResponse["transactions"][number];
export type Ipo = IposResponse["ipos"][number];
export type CompanyFiscalPeriod = CompanyFiscalPeriodsResponse["companies"][number]["periods"][number];
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

// A JSON value. The spec types free-form fields (`InvestorDocument.pages[]`, SEC nested objects) as `unknown`, which a
// server function's return type rejects (TanStack Start only accepts provably serialisable values); the API answers
// JSON, so those fields are narrowed to `JsonValue`.
export type JsonValue = Array<JsonValue> | boolean | null | number | string | { [key: string]: JsonValue };

// News (IDA /v1/news*)
export type NewsListResponse = ApiResponse<"/v1/news", "get">;
export type NewsItemResponse = ApiResponse<"/v1/news/{id}", "get">;
/** A `GET /v1/news` row; also the `item` of a `news.live` `news_item` frame. */
export type NewsItemPublic = NewsListResponse["items"][number];
export type NewsAttribution = NewsItemPublic["attribution"];
export type NewsPublication = NewsItemPublic["publications"][number];
export type NewsKind = NewsItemPublic["kind"];
export type NewsDevelopment = NewsItemResponse["developments"][number];
export type NewsSighting = NewsItemResponse["sightings"][number];
export type NewsQuery = ApiQuery<"/v1/news">;

// SEC document store (IDA `/v1/sec/*`, backend delivery-integration task 2). Most nested objects are typed
// `{ [key: string]: unknown }` by the spec (`additionalProperties`); `SecJson` narrows every `unknown` to `JsonValue`
// so a server function may return them. The panel reads them through the guards of `src/lib/sec/source.ts`.
type SecJson<T> = unknown extends T
    ? JsonValue
    : T extends ReadonlyArray<infer TItem>
        ? Array<SecJson<TItem>>
        : T extends object
            ? { [TKey in keyof T]: SecJson<T[TKey]> }
            : T;

export type SecFilersResponse = SecJson<ApiResponse<"/v1/sec/filers", "get">>;
export type SecFilingsResponse = SecJson<ApiResponse<"/v1/sec/filings", "get">>;
export type SecFilingManifestResponse = SecJson<ApiResponse<"/v1/sec/filings/{accession}", "get">>;
/** `/v1/sec/documents/{accession}/{filename}` and `/v1/sec/versions/{version_id}` answer the same body. */
export type SecDocumentResponse = SecJson<ApiResponse<"/v1/sec/versions/{version_id}", "get">>;
export type SecFigureResponse = SecJson<ApiResponse<"/v1/sec/versions/{version_id}/figures/{block_id}", "get">>;
export type SecSectionsResponse = SecJson<ApiResponse<"/v1/sec/versions/{version_id}/sections", "get">>;
export type SecSearchResponse = SecJson<ApiResponse<"/v1/sec/search", "get">>;
export type SecExportResponse = SecJson<ApiResponse<"/v1/sec/exports/{export_id}", "get">>;
export type SecManagerPortfolioResponse = SecJson<ApiResponse<"/v1/sec/holdings/managers/{cik}/portfolio", "get">>;

export type SecReadiness = SecFilingsResponse["readiness"];
export type SecReadinessStatus = SecReadiness["status"];
export type SecFilerMatch = NonNullable<SecFilersResponse["matches"]>[number];
export type SecFilingRow = NonNullable<SecFilingsResponse["filings"]>[number];
export type SecFormFacet = NonNullable<SecFilingsResponse["form_facet"]>[number];
export type SecSearchHit = NonNullable<SecSearchResponse["hits"]>[number];
export type SecSearchCoverage = NonNullable<SecSearchResponse["coverage"]>;
export type SecSearchMode = NonNullable<ApiQuery<"/v1/sec/search">["mode"]>;
export type SecFilingsOrder = NonNullable<ApiQuery<"/v1/sec/filings">["order"]>;
/** The API's `case_sensitive` string enum (`mode=literal` only). */
export type SecSearchCaseSensitive = NonNullable<ApiQuery<"/v1/sec/search">["case_sensitive"]>;

// Data API v2 (`/v2/*`, backend tasks/data-api-v2 task 4). Lists answer `{ data, has_more, next_cursor, meta }` and
// page by `cursor` (the same filters, no offset); errors are RFC 9457 problems (`ApiRequestError.requestId`).
export type V2CompanyResponse = ApiResponse<"/v2/companies/{company}", "get">;
export type V2DividendsResponse = ApiResponse<"/v2/dividends", "get">;
export type V2SplitsResponse = ApiResponse<"/v2/splits", "get">;
export type V2MarketHolidaysResponse = ApiResponse<"/v2/market-holidays", "get">;
/** `lifecycle` is free JSON in the spec (snake_case: phase, kind, first_public_seen_at, registration_tracks, …). */
export type V2FilerResponse = SecJson<ApiResponse<"/v2/filers/{cik}", "get">>;

export type V2Dividend = V2DividendsResponse["data"][number];
export type V2Split = V2SplitsResponse["data"][number];
export type V2MarketHoliday = V2MarketHolidaysResponse["data"][number];
export type V2CompanyCoverage = NonNullable<V2CompanyResponse["coverage"]>;
export type V2ProposedSymbol = NonNullable<V2FilerResponse["proposed_symbols"]>[number];
export type V2FormerName = NonNullable<V2FilerResponse["former_names"]>[number];
export type V2Successor = NonNullable<V2FilerResponse["successors"]>[number];
export type V2DividendsSort = NonNullable<ApiQuery<"/v2/dividends">["sort"]>;
export type V2SplitsSort = NonNullable<ApiQuery<"/v2/splits">["sort"]>;
export type V2MarketHolidaysSort = NonNullable<ApiQuery<"/v2/market-holidays">["sort"]>;
/** `GET /v2/companies/{company}?expand=` values the dashboard asks for. */
export type V2CompanyExpand = "coverage";
/** `GET /v2/filers/{cik}?expand=` values. */
export type V2FilerExpand = "former_names" | "lifecycle" | "proposed_symbols" | "successors";

// Data API v2 events family (`/v2/events*`, `/v2/guidance`, `/v2/kpis`, `/v2/investor-documents*`, `/v2/search/*`,
// backend tasks/data-api-v2 task 7). Every per-event read names the event by id (no selector, no offset).
export type V2EventsResponse = ApiResponse<"/v2/events", "get">;
export type V2EventResponse = ApiResponse<"/v2/events/{event_id}", "get">;
export type V2PressReleaseResponse = ApiResponse<"/v2/events/{event_id}/press-release", "get">;
export type V2QaResponse = ApiResponse<"/v2/events/{event_id}/qa", "get">;
export type V2SlidesResponse = ApiResponse<"/v2/events/{event_id}/slides", "get">;
/** `url` is the recording's permanent public URL (one forensic watermark per call); it does not expire. */
export type V2AudioResponse = ApiResponse<"/v2/events/{event_id}/audio", "get">;
export type V2LiveAudioResponse = ApiResponse<"/v2/events/{event_id}/live-audio", "get">;
export type V2EventStatsResponse = ApiResponse<"/v2/events/{event_id}/stats", "get">;
export type V2EventComparisonResponse = ApiResponse<"/v2/events/{event_id}/comparison", "get">;
export type V2ProsodyResponse = ApiResponse<"/v2/events/{event_id}/prosody", "get">;
/** Derived returns only (basis points): the response carries no price or volume. */
export type V2PriceAttributionResponse = ApiResponse<"/v2/events/{event_id}/price-attribution", "get">;
export type V2TranscriptResponse = ApiResponse<"/v2/events/{event_id}/transcript", "get">;
export type V2TranscriptTextResponse = ApiResponse<"/v2/events/{event_id}/transcript-text", "get">;
export type V2TranscriptVersionsResponse = ApiResponse<"/v2/events/{event_id}/transcript-versions", "get">;
export type V2TranscriptDiffResponse = ApiResponse<"/v2/events/{event_id}/transcript-diff", "get">;
export type V2TranscriptSearchResponse = ApiResponse<"/v2/search/transcripts", "get">;
export type V2GuidanceResponse = ApiResponse<"/v2/guidance", "get">;
export type V2KpisResponse = ApiResponse<"/v2/kpis", "get">;
export type V2ParticipantsResponse = ApiResponse<"/v2/participants", "get">;
/** `pages[]` (member route, `expand=pages`) is free JSON per page in the spec: narrowed to `JsonValue`. */
export type V2InvestorDocumentsResponse = SecJson<ApiResponse<"/v2/investor-documents", "get">>;
export type V2InvestorDocumentResponse = SecJson<ApiResponse<"/v2/investor-documents/{document_id}", "get">>;
export type V2InvestorDocumentSearchResponse = ApiResponse<"/v2/search/investor-documents", "get">;

/** The contract's Event (`exchange` a MIC such as XNAS; `video` without a provider). */
export type V2Event = V2EventResponse;
/** The company's public broadcast on a video platform (`video` of every event; null = none known). */
export type V2EventVideo = NonNullable<V2Event["video"]>;
/** `expand=calendar`: the call / report semantics of the calendar. */
export type V2EventCalendar = NonNullable<V2Event["calendar"]>;
export type V2CalendarStatus = NonNullable<V2EventCalendar["status"]>;
export type V2DateStatus = V2Event["date_status"];
export type V2Session = NonNullable<V2Event["session"]>;
/** `type=` is a comma list in the spec; one stored type or `all` is what the dashboard sends. */
export type V2EventType = "all" | V2Event["event_type"];
/** `status=` of `GET /v2/events` (derived: upcoming / live / ended). */
export type V2EventStatus = "ended" | "live" | "upcoming";
/** `date_kind=` of `GET /v2/events`: date certainty (`estimated` = estimated or unconfirmed). */
export type V2DateKind = NonNullable<ApiQuery<"/v2/events">["date_kind"]>;
export type V2EventsSort = NonNullable<ApiQuery<"/v2/events">["sort"]>;
/** `GET /v2/events/{event_id}?expand=` values. */
export type V2EventExpand = "calendar" | "observations";
export type V2QaPair = V2QaResponse["data"][number];
export type V2Participation = V2ParticipantsResponse["data"][number];
export type V2TranscriptTurn = V2TranscriptResponse["turns"][number];
export type V2TranscriptLayer = V2TranscriptResponse["layer"];
export type V2TranscriptVersion = V2TranscriptVersionsResponse["data"][number];
export type V2TranscriptSplit = NonNullable<ApiQuery<"/v2/events/{event_id}/transcript-text">["split"]>;
export type V2GuidanceItem = V2GuidanceResponse["data"][number];
export type V2GuidanceBasis = V2GuidanceItem["basis"];
export type V2GuidancePeriodKind = V2GuidanceItem["period_kind"];
export type V2KpiMention = V2KpisResponse["data"][number];
export type V2Slide = V2SlidesResponse["slides"][number];
/** A player slide on the audio's clock (`at_ms` from the start of the recording `/audio` serves). */
export type V2SlideTimelineEntry = NonNullable<V2SlidesResponse["timeline"]>[number];
/** `GET /v2/events/{event_id}/slides?include=` values (`timeline` is opt-in in v2). */
export type V2SlidesInclude = "markdown" | "timeline";
export type V2ProsodySection = V2ProsodyResponse["section"];
export type V2ProsodySpeaker = V2ProsodyResponse["speakers"][number];
export type V2PriceBucket = V2PriceAttributionResponse["buckets"][number];
export type V2PriceUtteranceRef = V2PriceBucket["utterance_refs"][number];
export type V2LiveAudioStatus = V2LiveAudioResponse["status"];
export type V2InvestorDocument = V2InvestorDocumentsResponse["data"][number];
export type V2InvestorDocumentsSort = NonNullable<ApiQuery<"/v2/investor-documents">["sort"]>;
export type V2TranscriptSearchHit = V2TranscriptSearchResponse["data"][number];
export type V2TranscriptSearchType = V2TranscriptSearchHit["type"];
export type V2InvestorDocumentSearchHit = V2InvestorDocumentSearchResponse["data"][number];
/** `lexical` (the API default) · `literal`; both search operations take the same modes. */
export type SearchMode = NonNullable<ApiQuery<"/v2/search/transcripts">["mode"]>;
/** The search index state of an answer (`meta.index`; v1's `coverage`). */
export type SearchCoverage = NonNullable<V2TranscriptSearchResponse["meta"]["index"]>;
export type HitMatch = V2TranscriptSearchHit["match"];
/** Zero-based, end-exclusive Unicode code-point offsets into the hit's `text`. */
export type MatchSpan = HitMatch["spans"][number];

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
