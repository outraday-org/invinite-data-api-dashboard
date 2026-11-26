import type { paths } from "./schema";

// Helper type to extract successful JSON response from a path
type ApiResponse<TPath extends keyof paths, TPathValue extends keyof paths[TPath]>
    = paths[TPath][TPathValue] extends { responses: { 200: { content: { "application/json": infer R } } } }
        ? R
        : never;

// Helper type to extract the query parameters of a path's GET operation
type ApiQuery<TPath extends keyof paths>
    = paths[TPath] extends { get: { parameters: { query?: infer Q } } } ? NonNullable<Q> : never;

// Fiscal periods (`GET /v1/fiscal-periods`): the list envelope `{ data, has_more, next_cursor, meta }`. One company's
// details are `V2CompanyResponse` (`GET /v1/companies/{company}`).
export type CompanyFiscalPeriodsResponse = ApiResponse<"/v1/fiscal-periods", "get">;
export type CompanyFiscalPeriod = CompanyFiscalPeriodsResponse["data"][number];

// Instruments and funds (Data API 7.0, backend tasks/instruments-and-funds-api tasks 3–4). An instrument is one
// exchange-traded US symbol with ONE `type` (`stock | etf | closed_end_fund | etn`); a fund carries `structure`
// (`registered_fund` | `exchange_traded_trust`, owner decision 11). `datasets` = the data families that exist for it:
// the only source of the dashboard's navigation.
export type V2InstrumentsResponse = ApiResponse<"/v1/instruments", "get">;
export type V2Instrument = ApiResponse<"/v1/instruments/{symbol}", "get">;
export type V2InstrumentType = V2Instrument["type"];
export type V2FundStructure = NonNullable<V2Instrument["structure"]>;
export type V2Dataset = V2Instrument["datasets"][number];
export type V2FundsResponse = ApiResponse<"/v1/funds", "get">;
export type V2FundListItem = V2FundsResponse["data"][number];
export type V2FundType = V2FundListItem["type"];
export type V2Fund = ApiResponse<"/v1/funds/{fund}", "get">;
/** A fund's composition: the issuer's own daily / monthly file, else its latest N-PORT report (`source` + `as_of`). */
export type V2FundPositionsResponse = ApiResponse<"/v1/funds/{fund}/holdings", "get">;
export type V2FundPosition = V2FundPositionsResponse["data"][number];
/** `issuer_daily` / `issuer_monthly` = the issuer's own holdings file, `nport` = the fund's latest public N-PORT report. */
export type V2FundSource = V2FundPosition["source"];
export type V2FundStoredDate = NonNullable<NonNullable<V2FundPositionsResponse["meta"]["composition"]>["stored_dates"]>[number];
/** The sector / country / asset-class buckets of the same composition. */
export type V2FundWeightsResponse = ApiResponse<"/v1/funds/{fund}/weights", "get">;
export type V2FundWeight = V2FundWeightsResponse["data"][number];
export type V2FundWeightDimension = V2FundWeight["dimension"];
/** `meta.reason` of the composition and the weights (one vocabulary; the weights add `weights_unavailable`). */
export type V2FundCompositionReason = NonNullable<V2FundWeightsResponse["meta"]["reason"]>;
/** Who holds a security: one row schema for 13F managers, N-PORT funds and ETF issuer files. */
export type V2HoldersResponse = ApiResponse<"/v1/holders", "get">;
export type V2Holder = V2HoldersResponse["data"][number];
export type V2HolderSource = V2Holder["source"];
/** One source of the overview (no `source=`, owner decision 12). */
export type V2HolderSection = NonNullable<V2HoldersResponse["meta"]["sections"]>[number];
export type V2HolderSectionState = V2HolderSection["state"];
export type V2HoldersInstruments = NonNullable<ApiQuery<"/v1/holders">["instruments"]>;
export type V2HolderChangesResponse = ApiResponse<"/v1/holder-changes", "get">;
export type V2HolderChange = V2HolderChangesResponse["data"][number];
export type V2HolderChangeType = V2HolderChange["type"];
/** A 13F manager's portfolio (the same `Holder` row). */
export type V2FilerHoldingsResponse = ApiResponse<"/v1/filers/{cik}/holdings", "get">;

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
/** `expand=fund` (Data API release 5.7): a fund registrant's series (N-CEN census, prospectus fees / returns, N-PORT net assets). */
export type V2FilerFund = NonNullable<V2FilerResponse["fund"]>;
export type V2FilerFundSeries = V2FilerFund["series"][number];
/** `expand=private_offerings` (Data API release 5.7): summary of the filer's Form D private offerings. */
export type V2FilerPrivateOfferings = NonNullable<V2FilerResponse["private_offerings"]>;
export type V2DividendsSort = NonNullable<ApiQuery<"/v1/dividends">["sort"]>;
export type V2SplitsSort = NonNullable<ApiQuery<"/v1/splits">["sort"]>;
export type V2MarketHolidaysSort = NonNullable<ApiQuery<"/v1/market-holidays">["sort"]>;
/** `GET /v1/companies/{company}?expand=` values the dashboard asks for. */
export type V2CompanyExpand = "coverage" | "former_tickers";
/** `GET /v1/funds/{fund}?expand=` values. */
export type V2FundExpand = "coverage";
/** `GET /v1/filers/{cik}?expand=` values. */
export type V2FilerExpand = "former_names" | "former_tickers" | "fund" | "lifecycle" | "private_offerings" | "proposed_symbols" | "successors";
/** A ticker the registrant used before (`expand=former_tickers` of a company or filer; Data API 11.2). */
export type V2FormerTicker = NonNullable<V2CompanyResponse["former_tickers"]>[number];

// Data API v2 SEC family (`/v1/filings*`, `/v1/document-versions/*`, `/v1/holders`, `/v1/holder-changes`,
// `/v1/insider-trades*`, `/v1/ipos*`, backend tasks/data-api-v2 task 6). Readiness is `meta.coverage.state` on a 200
// (`data: []` while pending); 403 `excluded` / 404 `not_covered` / 503 `unavailable` are problems.
export type V2FilingsResponse = ApiResponse<"/v1/filings", "get">;
/** `parties` / `relations` are free JSON in the spec: narrowed to `JsonValue`. */
export type V2FilingDetailResponse = SecJson<ApiResponse<"/v1/filings/{accession}", "get">>;
/** The canonical document content (blocks / pages / footnotes / toc / quality) is free JSON: narrowed to `JsonValue`. */
export type V2DocumentVersionResponse = SecJson<ApiResponse<"/v1/document-versions/{version_id}", "get">>;
export type V2DocumentFigureResponse = SecJson<ApiResponse<"/v1/document-versions/{version_id}/figures/{block_id}", "get">>;
export type V2InsiderTradesResponse = ApiResponse<"/v1/insider-trades", "get">;
/** Holding lines of Forms 3 / 4 / 5 (a security held without a transaction; Data API 11.2). */
export type V2InsiderHoldingsResponse = ApiResponse<"/v1/insider-holdings", "get">;
export type V2IposResponse = ApiResponse<"/v1/ipos", "get">;
/** Form D private offerings (Data API release 5.7, tag IPOs). */
export type V2OfferingsResponse = ApiResponse<"/v1/offerings", "get">;

export type V2Filing = V2FilingsResponse["data"][number];
export type V2FilingDetail = V2FilingDetailResponse;
export type V2FilingDocument = NonNullable<V2FilingDetail["documents"]>[number];
export type V2FormFacet = NonNullable<V2FilingsResponse["meta"]["form_facet"]>[number];
/** `report_date` is in the contract but a 400 until the door sorts by it: only `filed_at` is sent. */
export type V2FilingsSort = Extract<NonNullable<ApiQuery<"/v1/filings">["sort"]>, "-filed_at" | "filed_at">;
/** `GET /v1/filings/{accession}?expand=` values. */
export type V2FilingExpand = "documents" | "parties" | "relations";
export type V2InsiderTrade = V2InsiderTradesResponse["data"][number];
export type V2InsiderSide = V2InsiderTrade["side"];
export type V2InsiderHolding = V2InsiderHoldingsResponse["data"][number];
export type V2InsiderHoldingsSort = NonNullable<ApiQuery<"/v1/insider-holdings">["sort"]>;
export type V2Ipo = V2IposResponse["data"][number];
export type V2IpoStage = V2Ipo["stage"];
export type V2IposSort = NonNullable<ApiQuery<"/v1/ipos">["sort"]>;
export type V2Offering = V2OfferingsResponse["data"][number];
/** `meta.coverage` of a v2 list: `pending` (data empty, still filling) / `partial` / `complete`. */
export type V2MetaCoverage = NonNullable<V2FilingsResponse["meta"]["coverage"]>;
/** `meta.source`: the documented provenance (dataset release, document version, accession, fetch time). */
export type V2MetaSource = NonNullable<V2FilingsResponse["meta"]["source"]>;

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
/** Data API 12.1: the adjusted figures of the results releases with their reconciliation (`GET /v1/non-gaap`, PRO). */
export type V2NonGaapResponse = ApiResponse<"/v1/non-gaap", "get">;
/** Data API 12.1: a company's catalog KPIs as comparable series (`GET /v1/kpi-series`, PRO). */
export type V2KpiSeriesResponse = ApiResponse<"/v1/kpi-series", "get">;
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
export type V2NonGaapMetric = V2NonGaapResponse["data"][number];
export type V2KpiSeriesPoint = V2KpiSeriesResponse["data"][number];
/** Why a guidance item has no number (Data API 12.1; null on a numeric item). */
export type V2GuidanceQualifier = NonNullable<V2GuidanceItem["qualifier"]>;
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
/** Every filing that stated a value for one as-reported concept and period, oldest first (Data API 11.2). */
export type V2FinancialVintagesResponse = ApiResponse<"/v1/financials/vintages", "get">;
export type V2FinancialVintage = V2FinancialVintagesResponse["data"][number];
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

// Account (`/v1/me`, `/v1/me/usage`, 0 credits; backend tasks/data-api-dashboard O5): the caller's plan, rate limits,
// credits and the docs groups the plan may call; usage per UTC day, per endpoint family and per caller.
export type V2Me = ApiResponse<"/v1/me", "get">;
export type V2Plan = V2Me["plan"];
export type V2Usage = ApiResponse<"/v1/me/usage", "get">;
/** One offering (`GET /v1/ipos/{ipo_id}`): the list's row, asked again for the detail dialog. */
export type V2IpoDetail = ApiResponse<"/v1/ipos/{ipo_id}", "get">;
export type V2InstrumentsSort = NonNullable<ApiQuery<"/v1/instruments">["sort"]>;
/** `is_active` of `/v1/instruments` and `/v1/funds` (Data API 12.0): `true` (the API default) = listed today, `false` = delisted, `all` = both. */
export type V2ActiveFilter = NonNullable<ApiQuery<"/v1/instruments">["is_active"]>;
export type V2FundsSort = NonNullable<ApiQuery<"/v1/funds">["sort"]>;
export type V2FilerPhase = NonNullable<ApiQuery<"/v1/filers">["phase"]>;
export type V2FilersSort = NonNullable<ApiQuery<"/v1/filers">["sort"]>;

// People (backend tasks/data-api-dashboard O7 group 1): who speaks on calls, across calls.
export type V2PeopleResponse = ApiResponse<"/v1/people", "get">;
/** A person who appears on calls (`GET /v1/people/{person_id}`, the rows of `GET /v1/people`). */
export type V2Person = ApiResponse<"/v1/people/{person_id}", "get">;
export type V2PersonRole = NonNullable<ApiQuery<"/v1/people">["role"]>;
export type V2PeopleSort = NonNullable<ApiQuery<"/v1/people">["sort"]>;

// News search and announcements (backend tasks/data-api-dashboard O7 group 2).
/** `GET /v1/search/news`: one page of hits (headline, lede or a summary passage), `meta.index` = the coverage. */
export type V2NewsSearchResponse = ApiResponse<"/v1/search/news", "get">;
export type V2NewsSearchHit = V2NewsSearchResponse["data"][number];
export type V2NewsSearchField = NonNullable<ApiQuery<"/v1/search/news">["field"]>;
/** An announcement's topic (the row itself is `NewsDevelopment`). */
export type V2AnnouncementTopic = NewsDevelopment["topic"];
export type V2AnnouncementsSort = NonNullable<ApiQuery<"/v1/announcements">["sort"]>;
export type V2NewsSort = NonNullable<ApiQuery<"/v1/news">["sort"]>;

// Fact places (`GET /v1/fact-places`, PRO; backend tasks/data-api-dashboard O7): where a standardized fact's source
// facts sit in a document version (block, table cell, inline-XBRL id), with a typed `status`.
export type V2FactPlacesResponse = ApiResponse<"/v1/fact-places", "get">;
export type V2FactPlace = V2FactPlacesResponse["data"][number];
export type V2FactPlaceStatus = V2FactPlace["status"];

// Filings depth (backend tasks/data-api-dashboard O7 group 3): a filing's facts, notes, review chain and reported
// holdings, a document version's sections and fact places, the SEC data sets. The review chain's nodes / edges are free
// JSON in the spec: narrowed to `JsonValue` (`SecJson`) and read through guards.
export type V2FilingFactsResponse = ApiResponse<"/v1/filings/{accession}/facts", "get">;
export type V2FilingFact = V2FilingFactsResponse["data"][number];
export type V2FilingNotesResponse = ApiResponse<"/v1/filings/{accession}/notes", "get">;
export type V2FilingNote = V2FilingNotesResponse["data"][number];
export type V2ReviewChainResponse = SecJson<ApiResponse<"/v1/filings/{accession}/review-chain", "get">>;
export type V2ReviewDirection = NonNullable<ApiQuery<"/v1/filings/{accession}/review-chain">["direction"]>;
export type V2FilingHoldingsResponse = ApiResponse<"/v1/filings/{accession}/holdings", "get">;
export type V2FiledHolding = V2FilingHoldingsResponse["data"][number];
/** `block_spans` is free JSON in the spec. */
export type V2DocumentSectionsResponse = SecJson<ApiResponse<"/v1/document-versions/{version_id}/sections", "get">>;
export type V2DocumentSection = V2DocumentSectionsResponse["data"][number];
export type V2SectionOutline = NonNullable<ApiQuery<"/v1/document-versions/{version_id}/sections">["outline"]>;
export type V2DatasetsResponse = ApiResponse<"/v1/datasets", "get">;
export type V2SecDataset = V2DatasetsResponse["data"][number];
/** `meta.index.matches` of a search without a company filter (null when the search names one). */
export type V2FilingSearchMatches = NonNullable<SecSearchCoverage["matches"]>;

// Reference (backend tasks/data-api-dashboard O7 group 7): the catalogs, the companies list and the API's status.
export type V2MetricCatalogResponse = ApiResponse<"/v1/catalog/metrics", "get">;
export type V2MetricCatalogEntry = V2MetricCatalogResponse["data"][number];
export type V2SectionCatalogResponse = ApiResponse<"/v1/catalog/sections", "get">;
export type V2SectionCatalogEntry = V2SectionCatalogResponse["data"][number];
export type V2FormCatalogResponse = ApiResponse<"/v1/catalog/forms", "get">;
export type V2FormCatalogEntry = V2FormCatalogResponse["data"][number];
export type V2EventTypeCatalogResponse = ApiResponse<"/v1/catalog/event-types", "get">;
export type V2EventTypeCatalogEntry = V2EventTypeCatalogResponse["data"][number];
export type V2DocumentKindCatalogResponse = ApiResponse<"/v1/catalog/document-kinds", "get">;
export type V2DocumentKindCatalogEntry = V2DocumentKindCatalogResponse["data"][number];
/** The exchanges of the served instruments with their counts (Data API 11.2). */
export type V2ExchangeCatalogResponse = ApiResponse<"/v1/catalog/exchanges", "get">;
export type V2ExchangeCatalogEntry = V2ExchangeCatalogResponse["data"][number];
/** The sectors of the operating companies with their industries (Data API 11.2): the values `sector=` accepts. */
export type V2SectorCatalogResponse = ApiResponse<"/v1/catalog/sectors", "get">;
export type V2SectorCatalogEntry = V2SectorCatalogResponse["data"][number];
/** Data API 12.1: the KPIs each sector catalog names (the values `kpi=` of `/v1/kpi-series` accepts). */
export type V2KpiCatalogResponse = ApiResponse<"/v1/catalog/kpis", "get">;
export type V2KpiCatalogEntry = V2KpiCatalogResponse["data"][number];
/** A standardized metric's mapping rule; `rule` is free JSON in the spec (read by guards, `src/lib/reference/catalog.ts`). */
export type V2MappingRulesResponse = SecJson<ApiResponse<"/v1/catalog/mapping-rules", "get">>;
export type V2MappingRule = V2MappingRulesResponse["data"][number];
/** `GET /v1/companies`: operating companies with a US listing (stocks only). */
export type V2CompaniesResponse = ApiResponse<"/v1/companies", "get">;
export type V2CompanyListItem = V2CompaniesResponse["data"][number];
export type V2CompaniesSort = NonNullable<ApiQuery<"/v1/companies">["sort"]>;
/** `GET /status` (no key, 0 credits): status and uptime per product family and per docs group, the coverage universe. */
export type V2ApiStatus = ApiResponse<"/status", "get">;
export type V2ServiceStatus = NonNullable<V2ApiStatus["services"]>[number]["status"];
/** `GET /status/licensing` (no key): rights per tier, the right and tier of every route by product family. */
export type V2Licensing = ApiResponse<"/status/licensing", "get">;
export type V2LicensingRight = V2Licensing["rights"][number];

// Ownership and offerings (backend tasks/data-api-dashboard O7 group 6): insider trade detail, Form D offerings market
// wide + one offering, a 13F manager's position changes, a fund's advisers.
export type V2InsiderTradesSort = NonNullable<ApiQuery<"/v1/insider-trades">["sort"]>;
/** One insider transaction line (`GET /v1/insider-trades/{id}`): the list row with every field. */
export type V2InsiderTradeDetail = ApiResponse<"/v1/insider-trades/{id}", "get">;
/** One Form D offering (`GET /v1/offerings/{offering_id}`): the list row, asked again for the detail page. */
export type V2OfferingDetail = ApiResponse<"/v1/offerings/{offering_id}", "get">;
/** A 13F manager's position changes vs the prior quarter (the `HolderChange` row). */
export type V2FilerHoldingChangesResponse = ApiResponse<"/v1/filers/{cik}/holding-changes", "get">;
export type V2FundAdviser = V2Fund["advisers"][number];

// Ownership forms (Data API 11.5, tag Ownership): Schedule 13D / 13G filings and Form 144 notices (`/ownership-filings`).
/** A page of Schedule 13D (activist) / 13G (passive) filings (`GET /v1/beneficial-ownership`). */
export type V2BeneficialOwnershipResponse = ApiResponse<"/v1/beneficial-ownership", "get">;
export type V2BeneficialOwnershipFiling = V2BeneficialOwnershipResponse["data"][number];
export type V2BeneficialOwnershipHolder = V2BeneficialOwnershipFiling["holders"][number];
/** `type=activist` (13D) | `passive` (13G). */
export type V2BeneficialOwnershipType = NonNullable<ApiQuery<"/v1/beneficial-ownership">["type"]>;
/** A page of Form 144 notices of a PROPOSED sale (`GET /v1/insider-sale-notices`). */
export type V2InsiderSaleNoticesResponse = ApiResponse<"/v1/insider-sale-notices", "get">;
export type V2InsiderSaleNotice = V2InsiderSaleNoticesResponse["data"][number];

// Alerts (backend tasks/data-api-dashboard 2-alerts task 2; Data API 7.1): the alert rules, their event log and the
// indicator templates. `condition` / `metadata` / an event's `payload` are free JSON in the spec (`additionalProperties`):
// narrowed to `JsonValue` (`SecJson`) so a server function may return them.
type CreateAlertBody = NonNullable<paths["/v1/alerts"]["post"]["requestBody"]>["content"]["application/json"];
type BatchAlertsBody = NonNullable<paths["/v1/alerts:batch"]["post"]["requestBody"]>["content"]["application/json"];

export type AlertsListResponse = SecJson<ApiResponse<"/v1/alerts", "get">>;
export type Alert = AlertsListResponse["data"][number];
export type AlertType = Alert["type"];
export type AlertStatus = Alert["status"];
export type AlertQuotaUsage = NonNullable<AlertsListResponse["meta"]["quota"]>;
export type AlertsListQuery = ApiQuery<"/v1/alerts">;
export type AlertConditionInput = SecJson<CreateAlertBody["condition"]>;
/** A field of `AlertConditionInput` (the union of every type's fields). */
export type AlertConditionField = keyof CreateAlertBody["condition"];
export type AlertTriggerInput = NonNullable<CreateAlertBody["trigger"]>;
export type AlertTriggerField = keyof AlertTriggerInput;
export type AlertActiveWindow = NonNullable<AlertTriggerInput["active_window"]>;
export type CreateAlertRequest = SecJson<CreateAlertBody>;
export type UpdateAlertRequest = SecJson<NonNullable<paths["/v1/alerts/{id}"]["patch"]["requestBody"]>["content"]["application/json"]>;
export type AlertBatchItem = SecJson<BatchAlertsBody["items"][number]>;
export type AlertBatchOp = AlertBatchItem["op"];
export type AlertBatchResponse = SecJson<ApiResponse<"/v1/alerts:batch", "post">>;
export type AlertBatchResult = AlertBatchResponse["results"][number];
export type AlertTestAccepted = paths["/v1/alerts/{id}:test"]["post"]["responses"][202]["content"]["application/json"];
export type AlertEventsResponse = SecJson<ApiResponse<"/v1/alert-events", "get">>;
export type AlertEvent = AlertEventsResponse["data"][number];
export type AlertEventType = AlertEvent["type"];
export type AlertTemplatesResponse = SecJson<ApiResponse<"/v1/alert-templates", "get">>;
export type AlertTemplate = AlertTemplatesResponse["data"][number];
export type AlertTemplateInput = AlertTemplate["inputs"][number];
/** What a write answered with no body (204): an object, so the inspector can file its request under it. */
export type AlertWriteDone = { done: "deleted" | "validated"; id: null | string };

// Destinations (backend tasks/data-api-dashboard 2-alerts task 3): where alerts are delivered, their delivery log. The
// signing secret is in `DestinationCreated` / `DestinationSecret` only (the write answers); a `Destination` never carries
// it nor a header value (`header_names` only).
type CreateDestinationBody = NonNullable<paths["/v1/destinations"]["post"]["requestBody"]>["content"]["application/json"];

export type DestinationsListResponse = ApiResponse<"/v1/destinations", "get">;
export type Destination = DestinationsListResponse["data"][number];
export type DestinationKind = Destination["kind"];
export type DestinationPreset = Destination["preset"];
export type DestinationStatus = Destination["status"];
export type CreateDestinationRequest = CreateDestinationBody;
export type UpdateDestinationRequest = NonNullable<paths["/v1/destinations/{id}"]["patch"]["requestBody"]>["content"]["application/json"];
export type DestinationCreated = paths["/v1/destinations"]["post"]["responses"][201]["content"]["application/json"];
export type DestinationSecret = ApiResponse<"/v1/destinations/{id}:rotate-secret", "post">;
export type DestinationTestAccepted = paths["/v1/destinations/{id}:test"]["post"]["responses"][202]["content"]["application/json"];
export type DestinationDeliveriesResponse = ApiResponse<"/v1/destinations/{id}/deliveries", "get">;
export type DestinationDelivery = DestinationDeliveriesResponse["data"][number];
export type DestinationDeliveryStatus = DestinationDelivery["status"];

// Alert end users, their defaults, scripts (backend tasks/data-api-dashboard 2-alerts task 4). `metadata` / a script
// version's `manifest` are free JSON in the spec: narrowed to `JsonValue` (`SecJson`).
type UpdateAlertUserBody = NonNullable<paths["/v1/alert-users/{external_user_id}"]["patch"]["requestBody"]>["content"]["application/json"];
type BatchAlertUsersBody = NonNullable<paths["/v1/alert-users:batch"]["post"]["requestBody"]>["content"]["application/json"];

export type AlertUsersListResponse = SecJson<ApiResponse<"/v1/alert-users", "get">>;
export type AlertUser = AlertUsersListResponse["data"][number];
export type AlertUserStatus = AlertUser["status"];
export type AlertUserLimits = AlertUser["limits"];
export type AlertUserLimitField = keyof AlertUserLimits;
export type AlertUserUsage = AlertUser["usage"];
export type AlertUsersListQuery = ApiQuery<"/v1/alert-users">;
export type UpdateAlertUserRequest = SecJson<UpdateAlertUserBody>;
export type AlertUserBatchItem = SecJson<BatchAlertUsersBody["items"][number]>;
export type AlertUserBatchResponse = SecJson<ApiResponse<"/v1/alert-users:batch", "post">>;
export type AlertUserBatchResult = AlertUserBatchResponse["results"][number];
export type AlertUserDeleteResult = ApiResponse<"/v1/alert-users/{external_user_id}", "delete">;
export type AlertUserDefaults = ApiResponse<"/v1/me/alert-user-defaults", "get">;
export type UpdateAlertUserDefaultsRequest = NonNullable<paths["/v1/me/alert-user-defaults"]["patch"]["requestBody"]>["content"]["application/json"];
export type ScriptsListResponse = SecJson<ApiResponse<"/v1/scripts", "get">>;
export type Script = ScriptsListResponse["data"][number];
export type ScriptVersionsResponse = SecJson<ApiResponse<"/v1/scripts/{id}/versions", "get">>;
export type ScriptVersion = ScriptVersionsResponse["data"][number];
export type ScriptDiagnostic = ScriptVersion["diagnostics"][number];
export type CreateScriptRequest = NonNullable<paths["/v1/scripts"]["post"]["requestBody"]>["content"]["application/json"];
