import type { paths } from "./schema";

// Helper type to extract successful JSON response from a path
type ApiResponse<TPath extends keyof paths, TPathValue extends keyof paths[TPath]>
    = paths[TPath][TPathValue] extends { responses: { 200: { content: { "application/json": infer R } } } }
        ? R
        : never;

// Helper type to extract the query parameters of a path's GET operation
type ApiQuery<TPath extends keyof paths>
    = paths[TPath] extends { get: { parameters: { query?: infer Q } } } ? NonNullable<Q> : never;

// Companies (`GET /v1/companies`, `/v1/fiscal-periods`): the redesigned list envelope `{ data, has_more, next_cursor,
// meta }`. One company's details are `V2CompanyResponse` (`GET /v1/companies/{company}`).
export type CompanySearchResponse = ApiResponse<"/v1/companies", "get">;
export type CompanyFiscalPeriodsResponse = ApiResponse<"/v1/fiscal-periods", "get">;

// Derived entity types
export type Company = CompanySearchResponse["data"][number];
export type CompanyFiscalPeriod = CompanyFiscalPeriodsResponse["data"][number];

// A JSON value. The spec types free-form fields (`InvestorDocument.pages[]`, SEC nested objects) as `unknown`, which a
// server function's return type rejects (TanStack Start only accepts provably serialisable values); the API answers
// JSON, so those fields are narrowed to `JsonValue`.
export type JsonValue = Array<JsonValue> | boolean | null | number | string | { [key: string]: JsonValue };

// News (IDA /v1/news*, backend tasks/data-api-v2 task 8)
export type V2NewsListResponse = ApiResponse<"/v1/news", "get">;
export type V2NewsItem = ApiResponse<"/v1/news/{id}", "get">;
export type V2NewsText = ApiResponse<"/v1/news/{id}/text", "get">;
export type V2NewsBlock = V2NewsText["blocks"][number];
export type V2AnnouncementsResponse = ApiResponse<"/v1/announcements", "get">;
/** The list row = the item member = the stream's `news` frame's `item` (one projection, IDA `toNewsItemPublic`). */
export type NewsItemPublic = V2NewsItem;
export type NewsAttribution = NewsItemPublic["attribution"];
export type NewsPublication = NewsItemPublic["publications"][number];
export type NewsKind = NewsItemPublic["kind"];
/** An announcement (v1 "development") of a news item. */
export type NewsDevelopment = V2AnnouncementsResponse["data"][number];

// SEC document store (the SEC family: filers, filings, document versions, filing search). Most nested objects are
// typed `{ [key: string]: unknown }` by the spec (`additionalProperties`); `SecJson` narrows every `unknown` to
// `JsonValue` so a server function may return them. The panel reads them through the guards of `src/lib/sec/source.ts`.
type SecJson<T> = unknown extends T
    ? JsonValue
    : T extends ReadonlyArray<infer TItem>
        ? Array<SecJson<TItem>>
        : T extends object
            ? { [TKey in keyof T]: SecJson<T[TKey]> }
            : T;

/** The readiness states of the SEC views (`src/lib/sec/readiness.ts`): a v1 problem code or a `meta.coverage` state. */
export type SecReadinessStatus = "excluded" | "failed" | "not_ready" | "partial" | "pending" | "ready" | "unknown";
export type V2FilersResponse = ApiResponse<"/v1/filers", "get">;
export type V2FilerMatch = V2FilersResponse["data"][number];
export type V2FilingSearchResponse = SecJson<ApiResponse<"/v1/search/filings", "get">>;
export type V2FilingSearchHit = V2FilingSearchResponse["data"][number];
/** `meta.index` of `GET /v1/search/filings`. */
export type SecSearchCoverage = NonNullable<V2FilingSearchResponse["meta"]["index"]>;
export type SecSearchMode = NonNullable<ApiQuery<"/v1/search/filings">["mode"]>;

// Data API (the redesigned contract, served under `/v1` since backend tasks/data-api-v2 task 12; the `V2` names are
// kept from when it was served as `/v2`). Lists answer `{ data, has_more, next_cursor, meta }` and
// page by `cursor` (the same filters, no offset); errors are RFC 9457 problems (`ApiRequestError.requestId`).
export type V2CompanyResponse = ApiResponse<"/v1/companies/{company}", "get">;
export type V2DividendsResponse = ApiResponse<"/v1/dividends", "get">;
export type V2SplitsResponse = ApiResponse<"/v1/splits", "get">;
export type V2MarketHolidaysResponse = ApiResponse<"/v1/market-holidays", "get">;
/** `lifecycle` is free JSON in the spec (snake_case: phase, kind, first_public_seen_at, registration_tracks, …). */
export type V2FilerResponse = SecJson<ApiResponse<"/v1/filers/{cik}", "get">>;

export type V2Dividend = V2DividendsResponse["data"][number];
export type V2Split = V2SplitsResponse["data"][number];
export type V2MarketHoliday = V2MarketHolidaysResponse["data"][number];
export type V2CompanyCoverage = NonNullable<V2CompanyResponse["coverage"]>;
export type V2ProposedSymbol = NonNullable<V2FilerResponse["proposed_symbols"]>[number];
export type V2FormerName = NonNullable<V2FilerResponse["former_names"]>[number];
export type V2Successor = NonNullable<V2FilerResponse["successors"]>[number];
export type V2DividendsSort = NonNullable<ApiQuery<"/v1/dividends">["sort"]>;
export type V2SplitsSort = NonNullable<ApiQuery<"/v1/splits">["sort"]>;
export type V2MarketHolidaysSort = NonNullable<ApiQuery<"/v1/market-holidays">["sort"]>;
/** `GET /v1/companies/{company}?expand=` values the dashboard asks for. */
export type V2CompanyExpand = "coverage";
/** `GET /v1/filers/{cik}?expand=` values. */
export type V2FilerExpand = "former_names" | "lifecycle" | "proposed_symbols" | "successors";

// Data API v2 SEC family (`/v1/filings*`, `/v1/document-versions/*`, `/v1/holdings`, `/v1/holding-changes`,
// `/v1/insider-trades*`, `/v1/ipos*`, backend tasks/data-api-v2 task 6). Readiness is `meta.coverage.state` on a 200
// (`data: []` while pending); 403 `excluded` / 404 `not_covered` / 503 `unavailable` are problems.
export type V2FilingsResponse = ApiResponse<"/v1/filings", "get">;
/** `parties` / `relations` are free JSON in the spec: narrowed to `JsonValue`. */
export type V2FilingDetailResponse = SecJson<ApiResponse<"/v1/filings/{accession}", "get">>;
/** The canonical document content (blocks / pages / footnotes / toc / quality) is free JSON: narrowed to `JsonValue`. */
export type V2DocumentVersionResponse = SecJson<ApiResponse<"/v1/document-versions/{version_id}", "get">>;
export type V2DocumentFigureResponse = SecJson<ApiResponse<"/v1/document-versions/{version_id}/figures/{block_id}", "get">>;
export type V2HoldingsResponse = ApiResponse<"/v1/holdings", "get">;
export type V2HoldingChangesResponse = ApiResponse<"/v1/holding-changes", "get">;
export type V2InsiderTradesResponse = ApiResponse<"/v1/insider-trades", "get">;
export type V2IposResponse = ApiResponse<"/v1/ipos", "get">;

export type V2Filing = V2FilingsResponse["data"][number];
export type V2FilingDetail = V2FilingDetailResponse;
export type V2FilingDocument = NonNullable<V2FilingDetail["documents"]>[number];
export type V2FormFacet = NonNullable<V2FilingsResponse["meta"]["form_facet"]>[number];
/** `report_date` is in the contract but a 400 until the door sorts by it: only `filed_at` is sent. */
export type V2FilingsSort = Extract<NonNullable<ApiQuery<"/v1/filings">["sort"]>, "-filed_at" | "filed_at">;
/** `GET /v1/filings/{accession}?expand=` values. */
export type V2FilingExpand = "documents" | "parties" | "relations";
export type V2Holding = V2HoldingsResponse["data"][number];
export type V2HoldingChange = V2HoldingChangesResponse["data"][number];
export type V2HoldingChangeType = V2HoldingChange["type"];
export type V2HoldingsInstruments = NonNullable<ApiQuery<"/v1/holdings">["instruments"]>;
export type V2InsiderTrade = V2InsiderTradesResponse["data"][number];
export type V2InsiderSide = V2InsiderTrade["side"];
export type V2Ipo = V2IposResponse["data"][number];
export type V2IpoStage = V2Ipo["stage"];
export type V2IposSort = NonNullable<ApiQuery<"/v1/ipos">["sort"]>;
/** `meta.coverage` of a v2 list: `pending` (data empty, still filling) / `partial` / `complete`. */
export type V2MetaCoverage = NonNullable<V2HoldingsResponse["meta"]["coverage"]>;
/** `meta.source`: the documented provenance (dataset release, document version, accession, fetch time). */
export type V2MetaSource = NonNullable<V2HoldingsResponse["meta"]["source"]>;

// Data API v2 events family (`/v1/events*`, `/v1/guidance`, `/v1/kpis`, `/v1/investor-documents*`, `/v1/search/*`,
// backend tasks/data-api-v2 task 7). Every per-event read names the event by id (no selector, no offset).
export type V2EventsResponse = ApiResponse<"/v1/events", "get">;
export type V2EventResponse = ApiResponse<"/v1/events/{event_id}", "get">;
export type V2PressReleaseResponse = ApiResponse<"/v1/events/{event_id}/press-release", "get">;
export type V2QaResponse = ApiResponse<"/v1/events/{event_id}/qa", "get">;
export type V2SlidesResponse = ApiResponse<"/v1/events/{event_id}/slides", "get">;
/** `url` is the recording's permanent public URL (one forensic watermark per call); it does not expire. */
export type V2AudioResponse = ApiResponse<"/v1/events/{event_id}/audio", "get">;
export type V2LiveAudioResponse = ApiResponse<"/v1/events/{event_id}/live-audio", "get">;
export type V2EventStatsResponse = ApiResponse<"/v1/events/{event_id}/stats", "get">;
export type V2EventComparisonResponse = ApiResponse<"/v1/events/{event_id}/comparison", "get">;
export type V2ProsodyResponse = ApiResponse<"/v1/events/{event_id}/prosody", "get">;
/** Derived returns only (basis points): the response carries no price or volume. */
export type V2PriceAttributionResponse = ApiResponse<"/v1/events/{event_id}/price-attribution", "get">;
export type V2TranscriptResponse = ApiResponse<"/v1/events/{event_id}/transcript", "get">;
export type V2TranscriptTextResponse = ApiResponse<"/v1/events/{event_id}/transcript-text", "get">;
export type V2TranscriptVersionsResponse = ApiResponse<"/v1/events/{event_id}/transcript-versions", "get">;
export type V2TranscriptDiffResponse = ApiResponse<"/v1/events/{event_id}/transcript-diff", "get">;
export type V2TranscriptSearchResponse = ApiResponse<"/v1/search/transcripts", "get">;
export type V2GuidanceResponse = ApiResponse<"/v1/guidance", "get">;
export type V2KpisResponse = ApiResponse<"/v1/kpis", "get">;
export type V2ParticipantsResponse = ApiResponse<"/v1/participants", "get">;
/** `pages[]` (member route, `expand=pages`) is free JSON per page in the spec: narrowed to `JsonValue`. */
export type V2InvestorDocumentsResponse = SecJson<ApiResponse<"/v1/investor-documents", "get">>;
export type V2InvestorDocumentResponse = SecJson<ApiResponse<"/v1/investor-documents/{document_id}", "get">>;
export type V2InvestorDocumentSearchResponse = ApiResponse<"/v1/search/investor-documents", "get">;

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
/** `status=` of `GET /v1/events` (derived: upcoming / live / ended). */
export type V2EventStatus = "ended" | "live" | "upcoming";
/** `date_kind=` of `GET /v1/events`: date certainty (`estimated` = estimated or unconfirmed). */
export type V2DateKind = NonNullable<ApiQuery<"/v1/events">["date_kind"]>;
export type V2EventsSort = NonNullable<ApiQuery<"/v1/events">["sort"]>;
/** `GET /v1/events/{event_id}?expand=` values. */
export type V2EventExpand = "calendar" | "observations";
export type V2QaPair = V2QaResponse["data"][number];
export type V2Participation = V2ParticipantsResponse["data"][number];
export type V2TranscriptTurn = V2TranscriptResponse["turns"][number];
export type V2TranscriptLayer = V2TranscriptResponse["layer"];
export type V2TranscriptVersion = V2TranscriptVersionsResponse["data"][number];
export type V2TranscriptSplit = NonNullable<ApiQuery<"/v1/events/{event_id}/transcript-text">["split"]>;
export type V2GuidanceItem = V2GuidanceResponse["data"][number];
export type V2GuidanceBasis = V2GuidanceItem["basis"];
export type V2GuidancePeriodKind = V2GuidanceItem["period_kind"];
export type V2KpiMention = V2KpisResponse["data"][number];
export type V2Slide = V2SlidesResponse["slides"][number];
/** A player slide on the audio's clock (`at_ms` from the start of the recording `/audio` serves). */
export type V2SlideTimelineEntry = NonNullable<V2SlidesResponse["timeline"]>[number];
/** `GET /v1/events/{event_id}/slides?include=` values (`timeline` is opt-in in v2). */
export type V2SlidesInclude = "markdown" | "timeline";
export type V2ProsodySection = V2ProsodyResponse["section"];
export type V2ProsodySpeaker = V2ProsodyResponse["speakers"][number];
export type V2PriceBucket = V2PriceAttributionResponse["buckets"][number];
export type V2PriceUtteranceRef = V2PriceBucket["utterance_refs"][number];
export type V2LiveAudioStatus = V2LiveAudioResponse["status"];
export type V2InvestorDocument = V2InvestorDocumentsResponse["data"][number];
export type V2InvestorDocumentsSort = NonNullable<ApiQuery<"/v1/investor-documents">["sort"]>;
export type V2TranscriptSearchHit = V2TranscriptSearchResponse["data"][number];
export type V2TranscriptSearchType = V2TranscriptSearchHit["type"];
export type V2InvestorDocumentSearchHit = V2InvestorDocumentSearchResponse["data"][number];
/** `lexical` (the API default) · `literal`; both search operations take the same modes. */
export type SearchMode = NonNullable<ApiQuery<"/v1/search/transcripts">["mode"]>;
/** The search index state of an answer (`meta.index`; v1's `coverage`). */
export type SearchCoverage = NonNullable<V2TranscriptSearchResponse["meta"]["index"]>;
export type HitMatch = V2TranscriptSearchHit["match"];
/** Zero-based, end-exclusive Unicode code-point offsets into the hit's `text`. */
export type MatchSpan = HitMatch["spans"][number];

// Data API v2 Financials + Metrics groups (`/v1/financials/*`, `/v1/metrics/*`, `/v1/segments*`, `/v1/facts/*`,
// backend tasks/data-api-v2 task 5). One row per fiscal period; `statements.<statement>.facts` takes the operation's
// shape (summary / detailed / presentation). A first page may be `meta.coverage.state: pending` (the backing table
// is filled after a release).
export type V2StandardizedResponse = ApiResponse<"/v1/financials/standardized", "get">;
/** A formula member's `segment` is free JSON in the spec: narrowed to `JsonValue` (both detailed views). */
export type V2StandardizedDetailedResponse = SecJson<ApiResponse<"/v1/financials/standardized/detailed", "get">>;
export type V2StandardizedPresentationResponse = ApiResponse<"/v1/financials/standardized/presentation", "get">;
export type V2AsReportedResponse = ApiResponse<"/v1/financials/as-reported", "get">;
export type V2AsReportedDetailedResponse = SecJson<ApiResponse<"/v1/financials/as-reported/detailed", "get">>;
export type V2AsReportedPresentationResponse = ApiResponse<"/v1/financials/as-reported/presentation", "get">;
export type V2RatiosResponse = ApiResponse<"/v1/metrics/ratios", "get">;
export type V2GrowthResponse = ApiResponse<"/v1/metrics/growth", "get">;
export type V2CagrResponse = ApiResponse<"/v1/metrics/cagr", "get">;
export type V2SegmentsResponse = ApiResponse<"/v1/segments", "get">;
export type V2SegmentsDetailedResponse = ApiResponse<"/v1/segments/detailed", "get">;
/** The mapping rule, operands and source facts are free JSON in the spec: narrowed to `JsonValue`. */
export type V2FactResponse = SecJson<ApiResponse<"/v1/facts/{fact_id}", "get">>;

/** `standardized` | `as-reported` (the path segment of the statement operations). */
export type V2FinancialsBasis = "as-reported" | "standardized";
/** `summary` = `{id: value}`, `detailed` = values with lineage (PRO), `presentation` = the tree (PRO). */
export type V2FinancialsView = "detailed" | "presentation" | "summary";
export type V2StatementsResponse
    = | V2AsReportedDetailedResponse
        | V2AsReportedPresentationResponse
        | V2AsReportedResponse
        | V2StandardizedDetailedResponse
        | V2StandardizedPresentationResponse
        | V2StandardizedResponse;
export type V2StatementPeriod = V2StatementsResponse["data"][number];
/** The response key of a statement (`statement=cash-flow` → `cash_flow`). */
export type V2StatementKey = keyof V2StandardizedResponse["data"][number]["statements"];
export type V2FilingSource = V2StandardizedResponse["data"][number]["source"];
export type V2StandardizedDetailedFacts = NonNullable<V2StandardizedDetailedResponse["data"][number]["statements"]["income_statement"]>["facts"];
export type V2StandardizedDetailedFact = V2StandardizedDetailedFacts[string];
export type V2StandardizedPresentationNode = NonNullable<V2StandardizedPresentationResponse["data"][number]["statements"]["income_statement"]>["facts"][number];
export type V2AsReportedFacts = NonNullable<V2AsReportedResponse["data"][number]["statements"]["income_statement"]>["facts"];
export type V2AsReportedDetailedFacts = NonNullable<V2AsReportedDetailedResponse["data"][number]["statements"]["income_statement"]>["facts"];
export type V2AsReportedDetailedFact = V2AsReportedDetailedFacts[string];
export type V2AsReportedPresentationNode = NonNullable<V2AsReportedPresentationResponse["data"][number]["statements"]["income_statement"]>["facts"][number];
export type V2DisplaySign = NonNullable<ApiQuery<"/v1/financials/as-reported">["display_sign"]>;
export type V2RatioPeriod = V2RatiosResponse["data"][number];
/** `category=` (any of); v1's `solvency` is the contract's `leverage`. */
export type V2RatioCategory = "efficiency" | "leverage" | "liquidity" | "profitability" | "valuation";
export type V2GrowthPeriod = V2GrowthResponse["data"][number];
export type V2GrowthBasis = V2GrowthPeriod["basis"];
export type V2CagrPeriod = V2CagrResponse["data"][number];
export type V2CagrHorizon = V2CagrPeriod["horizon"];
export type V2Segment = V2SegmentsResponse["data"][number];

// Query parameter types
export type FiscalPeriodType = "annual" | "quarterly" | "ttm" | "ytd";

/** `statement=` of the v2 statement operations (one statement per page view). */
export type StatementType = "balance-sheet" | "cash-flow" | "income-statement";

/** v1 `segment_id` values; v2 has no `segment_id` filter, so the segments page filters the loaded rows by them. */
export type SegmentedFinancialsSegmentId
    = | "seg_cost_of_revenue_business_segment"
        | "seg_general_and_administrative_expenses_business_segment"
        | "seg_research_and_development_expenses_business_segment"
        | "seg_revenue_business_segment"
        | "seg_revenue_geographic"
        | "seg_revenue_product"
        | "seg_selling_and_marketing_expenses_business_segment";
