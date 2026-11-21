import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
    CompanyFiscalPeriod,
    V2AnnouncementsResponse,
    V2ApiStatus,
    V2AsReportedDetailedResponse,
    V2AsReportedPresentationResponse,
    V2AsReportedResponse,
    V2AudioResponse,
    V2CagrResponse,
    V2CompaniesResponse,
    V2CompaniesSort,
    V2CompanyResponse,
    V2DatasetsResponse,
    V2DateKind,
    V2DividendsResponse,
    V2DividendsSort,
    V2DocumentFigureResponse,
    V2DocumentKindCatalogResponse,
    V2DocumentSectionsResponse,
    V2DocumentVersionResponse,
    V2EventComparisonResponse,
    V2EventResponse,
    V2EventsResponse,
    V2EventsSort,
    V2EventStatsResponse,
    V2EventStatus,
    V2EventType,
    V2EventTypeCatalogResponse,
    V2FactPlacesResponse,
    V2FactPlaceStatus,
    V2FactResponse,
    V2FilerHoldingsResponse,
    V2FilerPhase,
    V2FilerResponse,
    V2FilersResponse,
    V2FilersSort,
    V2FilingDetailResponse,
    V2FilingFactsResponse,
    V2FilingHoldingsResponse,
    V2FilingNotesResponse,
    V2FilingSearchResponse,
    V2FilingsResponse,
    V2FilingsSort,
    V2FormCatalogResponse,
    V2Fund,
    V2FundPositionsResponse,
    V2FundsResponse,
    V2FundsSort,
    V2FundStructure,
    V2FundType,
    V2FundWeightsResponse,
    V2GrowthResponse,
    V2GuidanceBasis,
    V2GuidancePeriodKind,
    V2GuidanceResponse,
    V2HolderChangesResponse,
    V2HolderChangeType,
    V2HoldersInstruments,
    V2HolderSource,
    V2HoldersResponse,
    V2InsiderSide,
    V2InsiderTradesResponse,
    V2Instrument,
    V2InstrumentsResponse,
    V2InstrumentsSort,
    V2InstrumentType,
    V2InvestorDocumentResponse,
    V2InvestorDocumentSearchResponse,
    V2InvestorDocumentsResponse,
    V2InvestorDocumentsSort,
    V2IpoDetail,
    V2IposResponse,
    V2IposSort,
    V2KpisResponse,
    V2Licensing,
    V2LiveAudioResponse,
    V2MappingRulesResponse,
    V2MarketHolidaysResponse,
    V2MarketHolidaysSort,
    V2Me,
    V2MetricCatalogResponse,
    V2NewsItem,
    V2NewsListResponse,
    V2NewsSearchResponse,
    V2NewsText,
    V2OfferingsResponse,
    V2ParticipantsResponse,
    V2PeopleResponse,
    V2PeopleSort,
    V2Person,
    V2PersonRole,
    V2PressReleaseResponse,
    V2PriceAttributionResponse,
    V2ProsodyResponse,
    V2ProsodySection,
    V2QaResponse,
    V2RatiosResponse,
    V2ReviewChainResponse,
    V2ReviewDirection,
    V2SectionCatalogResponse,
    V2SectionOutline,
    V2SegmentsDetailedResponse,
    V2SegmentsResponse,
    V2SlidesResponse,
    V2SplitsResponse,
    V2SplitsSort,
    V2StandardizedDetailedResponse,
    V2StandardizedPresentationResponse,
    V2StandardizedResponse,
    V2TranscriptDiffResponse,
    V2TranscriptLayer,
    V2TranscriptResponse,
    V2TranscriptSearchResponse,
    V2TranscriptSearchType,
    V2TranscriptSplit,
    V2TranscriptTextResponse,
    V2TranscriptVersionsResponse,
    V2Usage,
} from "./types";

import { ASSET_GROUP_CATEGORIES } from "../earnings/documents";
import { SEARCH_MODES } from "../earnings/labels";
import { env } from "../env";
import { createApiClient } from "./client.server";
import { throwApiError } from "./errors";
import {
    V2_COMPANY_EXPANDS,
    V2_EVENT_EXPANDS,
    V2_FILER_EXPANDS,
    V2_FILING_EXPANDS,
    V2_IPO_STAGES,
    V2_RATIO_CATEGORIES,
    V2_SLIDES_INCLUDES,
    V2_STATEMENTS,
    v2Expand,
    v2Query,
} from "./v2";

const apiKeySchema = z
    .string()
    .transform(val => val.trim())
    .pipe(z.string().min(1))
    .optional();

const instrumentTypeSchema = z.enum(["stock", "etf", "closed_end_fund", "etn"] as const satisfies ReadonlyArray<V2InstrumentType>);

const fundTypeSchema = z.enum(["etf", "closed_end_fund"] as const satisfies ReadonlyArray<V2FundType>);

const fundStructureSchema = z.enum(["registered_fund", "exchange_traded_trust"] as const satisfies ReadonlyArray<V2FundStructure>);

/** A bare US ticker (`BRK.B`, `BF-B`); `TICKER.<MIC>` is refused by the API. */
const symbolSchema = z.string().trim().min(1).max(15);

/** A fund's ticker or fund key (`S000024908`, `cik:884394`). */
const fundSchema = z.string().trim().min(1).max(20);

/** Search everything exchange-traded by ticker prefix or name (`GET /v1/instruments?q=`, one page). */
export const getInstruments = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: z.string().min(1).optional(),
        exchange: z.string().trim().min(1).max(10).optional(),
        isActive: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        query: z.string().optional(),
        sort: z.enum(["symbol", "-symbol", "name", "-name"] as const satisfies ReadonlyArray<V2InstrumentsSort>).optional(),
        structure: z.array(fundStructureSchema).optional(),
        type: z.array(instrumentTypeSchema).optional(),
    }))
    .handler(async ({ data }): Promise<V2InstrumentsResponse> => {
        const { apiKey, cursor, exchange, isActive, limit = 10, query, sort, structure, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/instruments", {
            params: {
                query: v2Query({
                    cursor,
                    exchange,
                    is_active: isActive,
                    limit,
                    q: query?.trim() || undefined,
                    sort,
                    structure: v2Expand(structure),
                    type: v2Expand(type),
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** One instrument: its type, structure, company or fund link and `datasets` (404 `not_covered` = not known). */
export const getInstrument = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, symbol: symbolSchema }))
    .handler(async ({ data }): Promise<V2Instrument> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/instruments/{symbol}", {
            params: { path: { symbol: data.symbol } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The listed funds (ETFs and closed-end funds; an ETN is no fund) by cursor. */
export const getFunds = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: z.string().min(1).optional(),
        exchange: z.string().trim().min(1).max(10).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        q: z.string().trim().min(1).optional(),
        sort: z.enum(["symbol", "-symbol", "name", "-name"] as const satisfies ReadonlyArray<V2FundsSort>).optional(),
        structure: z.array(fundStructureSchema).optional(),
        type: z.array(fundTypeSchema).optional(),
    }))
    .handler(async ({ data }): Promise<V2FundsResponse> => {
        const { apiKey, cursor, exchange, limit, q, sort, structure, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/funds", {
            params: { query: v2Query({ cursor, exchange, limit, q, sort, structure: v2Expand(structure), type: v2Expand(type) }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** One fund's profile (ticker or fund key): net assets with date and scope, expense ratio, registrant, classes. */
export const getFund = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, fund: fundSchema }))
    .handler(async ({ data }): Promise<V2Fund> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/funds/{fund}", {
            params: { path: { fund: data.fund } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const fiscalPeriodsSchema = z.object({
    apiKey: apiKeySchema,
    identifier: z.string().trim().min(1),
});

/** Pages `/v1/fiscal-periods` stops after this many pages (200 periods each: 50 years of quarters ×10). */
const FISCAL_PERIOD_MAX_PAGES = 10;

/**
 * Every fiscal period of a company (`GET /v1/fiscal-periods?company=`, every cursor page): the filings list labels a
 * row's `report_date` with its fiscal / calendar quarter by `period_end`. A company the financial data does not cover
 * (a pre-IPO CIK, 404 `not_covered`) has none → [].
 */
export const getCompanyFiscalPeriods = createServerFn({ method: "GET" })
    .inputValidator(fiscalPeriodsSchema)
    .handler(async ({ data }): Promise<Array<CompanyFiscalPeriod>> => {
        const api = createApiClient(data.apiKey);

        const periods: Array<CompanyFiscalPeriod> = [];

        let cursor: string | undefined;

        for (let page = 0; page < FISCAL_PERIOD_MAX_PAGES; page++) {
            const { data: res, error, response } = await api.GET("/v1/fiscal-periods", {
                params: { query: v2Query({ company: data.identifier, cursor, limit: 200, sort: "-period_end" as const }) },
            });

            if (response.status === 404) return periods;

            if (error) throwApiError(error, response);

            periods.push(...res.data);

            cursor = res.next_cursor ?? undefined;

            if (!res.has_more || !cursor) break;
        }

        return periods;
    });

// News (IDA /v1/news*, backend tasks/data-api-v2 task 8; the page since backend earnings inhouse-news-pipeline task 17)

const newsListSchema = z.object({
    apiKey: apiKeySchema,
    /** Ticker or CIK: v2 lists a company's news only (no market-wide feed, decision 15). */
    company: z.string().trim().min(1),
    cursor: z.string().optional(),
    /** An event id: the news linked to that call (O7 group 2). */
    event: z.string().trim().min(1).max(100).optional(),
    kind: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    /** ISO instants: `published_at.gte` / `published_at.lt`. */
    publishedAtGte: z.string().optional(),
    publishedAtLt: z.string().optional(),
    /** Omitted = the API's `-published_at` (newest first). */
    sort: z.enum(["published_at", "-published_at"]).optional(),
    topic: z.array(z.string()).optional(),
});

export const getV2News = createServerFn({ method: "GET" })
    .inputValidator(newsListSchema)
    .handler(async ({ data }): Promise<V2NewsListResponse> => {
        const { apiKey, company, cursor, event, kind, limit, publishedAtGte, publishedAtLt, sort, topic } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/news", {
            params: {
                query: v2Query({
                    company,
                    cursor,
                    event,
                    "kind": v2Expand(kind),
                    limit,
                    "published_at.gte": publishedAtGte,
                    "published_at.lt": publishedAtLt,
                    sort,
                    "topic": v2Expand(topic),
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const newsItemInputSchema = z.object({ apiKey: apiKeySchema, id: z.string().uuid() });

export const getV2NewsItem = createServerFn({ method: "GET" })
    .inputValidator(newsItemInputSchema)
    .handler(async ({ data }): Promise<V2NewsItem> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/news/{id}", {
            params: { path: { id: data.id } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Pages of a summary read at most (each up to 20,000 characters; a summary is far shorter). */
const NEWS_TEXT_MAX_PAGES = 10;

/**
 * `GET /v1/news/{id}/text`, every page (`next_cursor`; lead decision G2). The blocks of all pages are joined into one
 * answer.
 */
export const getV2NewsText = createServerFn({ method: "GET" })
    .inputValidator(newsItemInputSchema)
    .handler(async ({ data }): Promise<V2NewsText> => {
        const api = createApiClient(data.apiKey);

        let cursor: string | undefined;

        let joined: undefined | V2NewsText;

        for (let page = 0; page < NEWS_TEXT_MAX_PAGES; page += 1) {
            const { data: res, error, response } = await api.GET("/v1/news/{id}/text", {
                params: { path: { id: data.id }, query: v2Query({ cursor }) },
            });

            if (error) throwApiError(error, response);

            joined = joined ? { ...res, blocks: [...joined.blocks, ...res.blocks] } : res;

            cursor = res.next_cursor ?? undefined;

            if (!cursor) break;
        }

        if (!joined) throw new Error("No news text page was read");

        return joined;
    });

export const getV2Announcements = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, item: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }))
    .handler(async ({ data }): Promise<V2AnnouncementsResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/announcements", {
            params: { query: v2Query({ item: data.item, limit: data.limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// The API base URL (not a secret) for the browser's own WebSocket to `/v1/stream`.
export const getApiBaseUrl = createServerFn({ method: "GET" })
    .handler((): { url: string } => ({ url: env.INVINITE_DATA_API_URL }));

// SEC family helpers (filers, filings, document versions, holdings, filing search). The refusals are problems:
// 403 `excluded`, 404 `not_covered`, 503 `unavailable` (`ApiRequestError`, classified by `src/lib/sec/readiness.ts`).

const cikSchema = z.string().trim().regex(/^\d{1,10}$/);

const cursorSchema = z.string().min(1).optional();

// Every search route: `mode` = the exhaustive `SEARCH_MODES`.
const searchModeSchema = z.enum(SEARCH_MODES);

const accessionSchema = z.string().trim().regex(/^(\d{10}-\d{2}-\d{6}|\d{18})$/);

const versionIdSchema = z.uuid();

/**
 * The filer registry (`GET /v1/filers`, 1 credit a page): by name or ticker (`q`), by `phase` (`manager` = the 13F
 * institutions), sorted, by cursor.
 */
export const getV2Filers = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        phase: z.enum(["pre_ipo", "public", "former", "manager", "other"] as const satisfies ReadonlyArray<V2FilerPhase>).optional(),
        q: z.string().trim().min(1).max(200).optional(),
        sort: z.enum(["name", "-name", "cik", "-cik"] as const satisfies ReadonlyArray<V2FilersSort>).optional(),
    }))
    .handler(async ({ data }): Promise<V2FilersResponse> => {
        const { apiKey, cursor, limit, phase, q, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filers", {
            params: { query: v2Query({ cursor, limit, phase, q, sort }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const filingSearchSchema = z.object({
    apiKey: apiKeySchema,
    caseSensitive: z.boolean().optional(),
    cursor: cursorSchema,
    /** Days (`YYYY-MM-DD`), inclusive: `filed_at.gte` / `filed_at.lte` (the spec's `format: date`). */
    filedFrom: z.iso.date().optional(),
    filedTo: z.iso.date().optional(),
    form: z.string().trim().min(1).optional(),
    /** Section ids, comma list. */
    item: z.string().trim().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    mode: searchModeSchema.optional(),
    q: z.string().trim().min(1).max(500),
    /** Ticker, fund key or company CIK; none = every filer (`meta.index.matches` caps the read). */
    symbol: z.string().trim().min(1).optional(),
});

/**
 * Ranked, cited passages from SEC documents (`GET /v1/search/filings`, one index page per request).
 * `case_sensitive` is sent with `mode=literal` only.
 */
export const getV2FilingSearch = createServerFn({ method: "GET" })
    .inputValidator(filingSearchSchema)
    .handler(async ({ data }): Promise<V2FilingSearchResponse> => {
        const { apiKey, caseSensitive, cursor, filedFrom, filedTo, form, item, limit, mode, q, symbol } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/search/filings", {
            params: {
                query: v2Query({
                    "case_sensitive": mode === "literal" ? caseSensitive : undefined,
                    cursor,
                    "filed_at.gte": filedFrom,
                    "filed_at.lte": filedTo,
                    form,
                    item,
                    limit,
                    mode,
                    q,
                    symbol,
                }),
            },
        });

        if (error) throwApiError(error, response);

        // `document_spans` / `citation` are free JSON in the spec (see `SecJson` in types.ts).
        return res as V2FilingSearchResponse;
    });

// Data API (`/v1/*`, the redesigned contract of backend tasks/data-api-v2, served under `/v1` since task 12). An unknown query parameter is a 400 `unknown_parameter`,
// so each function sends only the operation's declared parameters and drops the unset ones (`v2Query`). Lists page by
// `cursor` (= the previous page's `next_cursor`, with the SAME filters; changed filters + an old cursor = 400
// `cursor_mismatch`). Errors are RFC 9457 problems, thrown as `ApiRequestError` (`code`, `requestId`).

const v2LimitSchema = z.number().int().min(1).max(200).optional();

const v2CompanySchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1),
    expand: z.array(z.enum(V2_COMPANY_EXPANDS)).optional(),
});

export const getV2Company = createServerFn({ method: "GET" })
    .inputValidator(v2CompanySchema)
    .handler(async ({ data }): Promise<V2CompanyResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/companies/{company}", {
            params: { path: { company: data.company }, query: v2Query({ expand: v2Expand(data.expand) }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2DividendsSchema = z.object({
    apiKey: apiKeySchema,
    cursor: cursorSchema,
    exDateGte: z.string().trim().min(1).optional(),
    exDateLte: z.string().trim().min(1).optional(),
    limit: v2LimitSchema,
    sort: z.enum(["ex_date", "-ex_date", "pay_date", "-pay_date"] as const satisfies ReadonlyArray<V2DividendsSort>).optional(),
    symbol: symbolSchema,
});

export const getV2Dividends = createServerFn({ method: "GET" })
    .inputValidator(v2DividendsSchema)
    .handler(async ({ data }): Promise<V2DividendsResponse> => {
        const { apiKey, cursor, exDateGte, exDateLte, limit, sort, symbol } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/dividends", {
            params: { query: v2Query({ cursor, "ex_date.gte": exDateGte, "ex_date.lte": exDateLte, limit, sort, symbol }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2SplitsSchema = z.object({
    apiKey: apiKeySchema,
    cursor: cursorSchema,
    limit: v2LimitSchema,
    sort: z.enum(["execution_date", "-execution_date"] as const satisfies ReadonlyArray<V2SplitsSort>).optional(),
    symbol: symbolSchema,
});

export const getV2Splits = createServerFn({ method: "GET" })
    .inputValidator(v2SplitsSchema)
    .handler(async ({ data }): Promise<V2SplitsResponse> => {
        const { apiKey, cursor, limit, sort, symbol } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/splits", {
            params: { query: v2Query({ cursor, limit, sort, symbol }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2MarketHolidaysSchema = z.object({
    apiKey: apiKeySchema,
    cursor: cursorSchema,
    dateGte: z.string().trim().min(1).optional(),
    dateLte: z.string().trim().min(1).optional(),
    limit: v2LimitSchema,
    sort: z.enum(["date", "-date"] as const satisfies ReadonlyArray<V2MarketHolidaysSort>).optional(),
});

export const getV2MarketHolidays = createServerFn({ method: "GET" })
    .inputValidator(v2MarketHolidaysSchema)
    .handler(async ({ data }): Promise<V2MarketHolidaysResponse> => {
        const { apiKey, cursor, dateGte, dateLte, limit, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/market-holidays", {
            params: { query: v2Query({ cursor, "date.gte": dateGte, "date.lte": dateLte, limit, sort }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2FilerSchema = z.object({
    apiKey: apiKeySchema,
    cik: cikSchema,
    expand: z.array(z.enum(V2_FILER_EXPANDS)).optional(),
});

export const getV2Filer = createServerFn({ method: "GET" })
    .inputValidator(v2FilerSchema)
    .handler(async ({ data }): Promise<V2FilerResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/filers/{cik}", {
            params: { path: { cik: data.cik }, query: v2Query({ expand: v2Expand(data.expand) }) },
        });

        if (error) throwApiError(error, response);

        return res as V2FilerResponse;
    });

// Events family (`/v1/events*`, `/v1/guidance`, `/v1/kpis`, `/v1/investor-documents*`, `/v1/search/*`, backend
// tasks/data-api-v2 task 7). Every per-event read names the event by id; "not derived yet" is a 404 `not_found` with
// the reason in `detail`, audio refused = 403 `forbidden`, a media outage = 503 `unavailable` (page states).

const eventIdSchema = z.uuid();

const eventInputSchema = z.object({ apiKey: apiKeySchema, eventId: eventIdSchema });

const v2EventTypeSchema = z.enum(["earnings_call", "investor_day", "conference", "agm", "other", "all"] as const satisfies ReadonlyArray<V2EventType>);

const v2EventsSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1).optional(),
    cursor: cursorSchema,
    dateKind: z.enum(["confirmed", "estimated", "any"] as const satisfies ReadonlyArray<V2DateKind>).optional(),
    expand: z.array(z.literal("calendar")).optional(),
    fiscalQuarter: z.number().int().min(1).max(4).optional(),
    fiscalYear: z.number().int().min(1900).max(2200).optional(),
    limit: v2LimitSchema,
    scheduledAtGte: z.string().trim().min(1).optional(),
    scheduledAtLte: z.string().trim().min(1).optional(),
    sort: z.enum(["scheduled_at", "-scheduled_at"] as const satisfies ReadonlyArray<V2EventsSort>).optional(),
    status: z.array(z.enum(["upcoming", "live", "ended"] as const satisfies ReadonlyArray<V2EventStatus>)).optional(),
    type: v2EventTypeSchema.optional(),
});

/** `GET /v1/events`: without `company` a calendar window (≤ 92 days; `status=live` alone needs none). */
export const getV2Events = createServerFn({ method: "GET" })
    .inputValidator(v2EventsSchema)
    .handler(async ({ data }): Promise<V2EventsResponse> => {
        const { apiKey, company, cursor, dateKind, expand, fiscalQuarter, fiscalYear, limit, scheduledAtGte, scheduledAtLte, sort, status, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events", {
            params: {
                query: v2Query({
                    company,
                    cursor,
                    "date_kind": dateKind,
                    "expand": v2Expand(expand),
                    "fiscal_quarter": fiscalQuarter,
                    "fiscal_year": fiscalYear,
                    limit,
                    "scheduled_at.gte": scheduledAtGte,
                    "scheduled_at.lte": scheduledAtLte,
                    sort,
                    "status": v2Expand(status),
                    type,
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Event = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ expand: z.array(z.enum(V2_EVENT_EXPANDS)).optional() }))
    .handler(async ({ data }): Promise<V2EventResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}", {
            params: { path: { event_id: data.eventId }, query: v2Query({ expand: v2Expand(data.expand) }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2PressRelease = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2PressReleaseResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/press-release", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Qa = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ cursor: cursorSchema, include: z.literal("scores").optional(), limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2QaResponse> => {
        const { apiKey, cursor, eventId, include, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events/{event_id}/qa", {
            params: { path: { event_id: eventId }, query: v2Query({ cursor, include, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Slides = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ include: z.array(z.enum(V2_SLIDES_INCLUDES)).optional(), pages: z.string().trim().min(1).optional() }))
    .handler(async ({ data }): Promise<V2SlidesResponse> => {
        const { apiKey, eventId, include, pages } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events/{event_id}/slides", {
            params: { path: { event_id: eventId }, query: v2Query({ include: v2Expand(include), pages }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Audio = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2AudioResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/audio", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2LiveAudio = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2LiveAudioResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/live-audio", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2EventStats = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2EventStatsResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/stats", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/**
 * The comparison with the previous call (the one the pipeline derives). `prior` may name that call; any other event id
 * answers 404 `not_found` whose `detail` names the derived prior (O7 group 5's picker shows it).
 */
export const getV2EventComparison = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ prior: eventIdSchema.optional() }))
    .handler(async ({ data }): Promise<V2EventComparisonResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/comparison", {
            params: { path: { event_id: data.eventId }, query: v2Query({ prior: data.prior }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Prosody = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ section: z.enum(["prepared", "qa", "all"] as const satisfies ReadonlyArray<V2ProsodySection>).optional() }))
    .handler(async ({ data }): Promise<V2ProsodyResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/prosody", {
            params: { path: { event_id: data.eventId }, query: v2Query({ section: data.section }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2PriceAttribution = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2PriceAttributionResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/price-attribution", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const transcriptVersionSchema = z.number().int().min(1).optional();

/** The turns of one version (`layer` raw | cleaned; `words` adds each turn's timed words). */
export const getV2Transcript = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({
        layer: z.enum(["raw", "cleaned"] as const satisfies ReadonlyArray<V2TranscriptLayer>).optional(),
        version: transcriptVersionSchema,
        words: z.boolean().optional(),
    }))
    .handler(async ({ data }): Promise<V2TranscriptResponse> => {
        const { apiKey, eventId, layer, version, words } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events/{event_id}/transcript", {
            params: { path: { event_id: eventId }, query: v2Query({ include: words ? "words" as const : undefined, layer, version }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The transcript as text blocks (`split=sections`: prepared remarks + Q&A). */
export const getV2TranscriptText = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({
        split: z.enum(["none", "sections"] as const satisfies ReadonlyArray<V2TranscriptSplit>).optional(),
        version: transcriptVersionSchema,
    }))
    .handler(async ({ data }): Promise<V2TranscriptTextResponse> => {
        const { apiKey, eventId, split, version } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events/{event_id}/transcript-text", {
            params: { path: { event_id: eventId }, query: v2Query({ split, version }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2TranscriptVersions = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ cursor: cursorSchema, limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2TranscriptVersionsResponse> => {
        const { apiKey, cursor, eventId, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events/{event_id}/transcript-versions", {
            params: { path: { event_id: eventId }, query: v2Query({ cursor, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2TranscriptDiff = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ from: z.number().int().min(1), to: z.number().int().min(1) }))
    .handler(async ({ data }): Promise<V2TranscriptDiffResponse> => {
        const { apiKey, eventId, from, to } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events/{event_id}/transcript-diff", {
            params: { path: { event_id: eventId }, query: { from, to } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/**
 * One page of ranked passages (the API answers ≤ 8 hits, `has_more: false`); `meta.index` = the index coverage. `type`
 * is a hit's type (one spelling since lead decision 11: `prepared`).
 */
export const getV2TranscriptSearch = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        company: z.string().trim().min(1).optional(),
        // The call-date window (`conference_date.gte` / `.lte`, days); none without a company = the API's last 365 days.
        conferenceDateGte: z.iso.date().optional(),
        conferenceDateLte: z.iso.date().optional(),
        event: eventIdSchema.optional(),
        limit: v2LimitSchema,
        mode: searchModeSchema.optional(),
        q: z.string().trim().min(1),
        type: z.enum(["transcript", "qa", "prepared", "presentation"] as const satisfies ReadonlyArray<V2TranscriptSearchType>).optional(),
    }))
    .handler(async ({ data }): Promise<V2TranscriptSearchResponse> => {
        const { apiKey, company, conferenceDateGte, conferenceDateLte, event, limit, mode, q, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/search/transcripts", {
            params: {
                query: v2Query({
                    company,
                    "conference_date.gte": conferenceDateGte,
                    "conference_date.lte": conferenceDateLte,
                    event,
                    limit,
                    mode,
                    q,
                    type,
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2GuidanceSchema = z.object({
    apiKey: apiKeySchema,
    basis: z.enum(["gaap", "non_gaap", "unknown"] as const satisfies ReadonlyArray<V2GuidanceBasis>).optional(),
    company: z.string().trim().min(1).optional(),
    cursor: cursorSchema,
    event: eventIdSchema.optional(),
    limit: v2LimitSchema,
    metric: z.string().trim().min(1).optional(),
    periodKind: z.enum(["quarter", "fiscal_year", "half", "other"] as const satisfies ReadonlyArray<V2GuidancePeriodKind>).optional(),
    sort: z.enum(["conference_date", "-conference_date"]).optional(),
});

/**
 * `GET /v1/guidance` (`company` or `event`). Always `review=any`: the contract default `approved` matches no row
 * today (every item is `auto` or `needs_review`).
 */
export const getV2Guidance = createServerFn({ method: "GET" })
    .inputValidator(v2GuidanceSchema)
    .handler(async ({ data }): Promise<V2GuidanceResponse> => {
        const { apiKey, basis, company, cursor, event, limit, metric, periodKind, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/guidance", {
            params: { query: v2Query({ basis, company, cursor, event, limit, metric, period_kind: periodKind, review: "any" as const, sort }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** `GET /v1/kpis`: one call's KPIs (`event`) or a company's history of one metric (`company` + `metric`, O7 group 5). */
export const getV2Kpis = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        company: z.string().trim().min(1).optional(),
        cursor: cursorSchema,
        event: eventIdSchema.optional(),
        limit: v2LimitSchema,
        metric: z.string().trim().min(1).optional(),
        sort: z.enum(["conference_date", "-conference_date"]).optional(),
    }))
    .handler(async ({ data }): Promise<V2KpisResponse> => {
        const { apiKey, company, cursor, event, limit, metric, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/kpis", {
            params: { query: v2Query({ company, cursor, event, limit, metric, sort }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The speakers of one event (`/v1/participants?event=`), with the quotes each name was resolved from. */
export const getV2Participants = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, event: eventIdSchema, limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2ParticipantsResponse> => {
        const { apiKey, cursor, event, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/participants", {
            params: { query: v2Query({ cursor, event, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2InvestorDocumentsSchema = z.object({
    apiKey: apiKeySchema,
    category: z.enum(ASSET_GROUP_CATEGORIES).optional(),
    company: z.string().trim().min(1).optional(),
    cursor: cursorSchema,
    event: eventIdSchema.optional(),
    fiscalYear: z.number().int().optional(),
    kind: z.array(z.string().trim().min(1)).optional(),
    limit: v2LimitSchema,
    sort: z.enum(["filing_date", "-filing_date", "event_date", "-event_date"] as const satisfies ReadonlyArray<V2InvestorDocumentsSort>).optional(),
});

/** The IR library and every call's documents in one list (`source: company | call`); `pages` is null in lists. */
export const getV2InvestorDocuments = createServerFn({ method: "GET" })
    .inputValidator(v2InvestorDocumentsSchema)
    .handler(async ({ data }): Promise<V2InvestorDocumentsResponse> => {
        const { apiKey, category, company, cursor, event, fiscalYear, kind, limit, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/investor-documents", {
            params: {
                query: v2Query({ category, company, cursor, event, fiscal_year: fiscalYear, kind: v2Expand(kind), limit, sort }),
            },
        });

        if (error) throwApiError(error, response);

        // `pages[]` is free JSON in the spec (see `SecJson` in types.ts).
        return res as V2InvestorDocumentsResponse;
    });

/** One document of either source; `pages` inlines the per-page text (`expand=pages`, ≤ 2 MB) and `body_text`. */
export const getV2InvestorDocument = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, documentId: z.uuid(), pages: z.boolean().optional() }))
    .handler(async ({ data }): Promise<V2InvestorDocumentResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/investor-documents/{document_id}", {
            params: { path: { document_id: data.documentId }, query: v2Query({ expand: data.pages ? "pages" : undefined }) },
        });

        if (error) throwApiError(error, response);

        return res as V2InvestorDocumentResponse;
    });

/** One page of passages (≤ 20, `has_more: false`); no source filter and no case switch in v2. */
export const getV2InvestorDocumentSearch = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        company: z.string().trim().min(1).optional(),
        kind: z.array(z.string().trim().min(1)).optional(),
        limit: v2LimitSchema,
        mode: searchModeSchema.optional(),
        q: z.string().trim().min(1),
    }))
    .handler(async ({ data }): Promise<V2InvestorDocumentSearchResponse> => {
        const { apiKey, company, kind, limit, mode, q } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/search/investor-documents", {
            params: { query: v2Query({ company, kind: v2Expand(kind), limit, mode, q }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// SEC family (`/v1/filings*`, `/v1/document-versions/*`, `/v1/holders`, `/v1/holder-changes`, `/v1/insider-trades`,
// `/v1/ipos`, backend tasks/data-api-v2 task 6). Readiness is `meta.coverage.state` on a 200 (`data: []` while
// pending); 403 `excluded`, 404 `not_covered` and 503 `unavailable` are problems (page states, `secErrorState`).

const v2FilingsSchema = z.object({
    apiKey: apiKeySchema,
    cursor: cursorSchema,
    /** Days (`YYYY-MM-DD`), inclusive: `filed_at.gte` / `filed_at.lte` (the spec's `format: date`; an instant is a 400). */
    filedFrom: z.iso.date().optional(),
    filedTo: z.iso.date().optional(),
    form: z.array(z.string().trim().min(1)).optional(),
    /** 8-K items (any of). */
    items: z.array(z.string().trim().min(1).max(10)).optional(),
    limit: v2LimitSchema,
    sort: z.enum(["filed_at", "-filed_at"] as const satisfies ReadonlyArray<V2FilingsSort>).optional(),
    /** Ticker of any instrument, a fund key or a company CIK (its primary listing). */
    symbol: symbolSchema,
});

/** An instrument's filings by cursor (`meta.form_facet` = its forms with counts) (`sort`: `filed_at` only). */
export const getV2Filings = createServerFn({ method: "GET" })
    .inputValidator(v2FilingsSchema)
    .handler(async ({ data }): Promise<V2FilingsResponse> => {
        const { apiKey, cursor, filedFrom, filedTo, form, items, limit, sort, symbol } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filings", {
            params: {
                query: v2Query({
                    cursor,
                    "filed_at.gte": filedFrom,
                    "filed_at.lte": filedTo,
                    "form": v2Expand(form),
                    "items": v2Expand(items),
                    limit,
                    sort,
                    symbol,
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** One filing's manifest; `expand: ["documents"]` lists its documents (`current_version_id`, public `source_url`). */
export const getV2Filing = createServerFn({ method: "GET" })
    .inputValidator(z.object({ accession: accessionSchema, apiKey: apiKeySchema, expand: z.array(z.enum(V2_FILING_EXPANDS)).optional() }))
    .handler(async ({ data }): Promise<V2FilingDetailResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/filings/{accession}", {
            params: { path: { accession: data.accession }, query: v2Query({ expand: v2Expand(data.expand) }) },
        });

        if (error) throwApiError(error, response);

        // `parties` / `relations` are free JSON in the spec (see `SecJson` in types.ts).
        return res as V2FilingDetailResponse;
    });

/** One immutable document version: a block range (`b00107-b00244`), with its footnotes / neighbours. */
export const getV2DocumentVersion = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        blocks: z.string().regex(/^b\d+(-b\d+)?$/).optional(),
        footnotes: z.boolean().optional(),
        neighbors: z.number().int().min(0).max(20).optional(),
        versionId: versionIdSchema,
    }))
    .handler(async ({ data }): Promise<V2DocumentVersionResponse> => {
        const { apiKey, blocks, footnotes, neighbors, versionId } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/document-versions/{version_id}", {
            params: { path: { version_id: versionId }, query: v2Query({ blocks, footnotes, neighbors }) },
        });

        if (error) throwApiError(error, response);

        return res as V2DocumentVersionResponse;
    });

/** A figure of a document version (`image.url` = its permanent public image, or `image: null`). */
export const getV2DocumentFigure = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, blockId: z.string().regex(/^b\d+$/), versionId: versionIdSchema }))
    .handler(async ({ data }): Promise<V2DocumentFigureResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/document-versions/{version_id}/figures/{block_id}", {
            params: { path: { block_id: data.blockId, version_id: data.versionId } },
        });

        if (error) throwApiError(error, response);

        return res as V2DocumentFigureResponse;
    });

// Holder rows (13F, N-PORT, issuer files): up to 1 000 per page.
const holdersLimitSchema = z.number().int().min(1).max(1000).optional();

const holderSourceSchema = z.enum(["13f", "nport", "issuer_file"] as const satisfies ReadonlyArray<V2HolderSource>);

const holdersInstrumentsSchema = z.enum(["shares", "all"] as const satisfies ReadonlyArray<V2HoldersInstruments>);

const holderChangeTypeSchema = z.enum(["new", "added", "reduced", "sold_out", "unchanged"] as const satisfies ReadonlyArray<V2HolderChangeType>);

/**
 * Who holds ONE instrument (`GET /v1/holders?symbol=`): with `source` the full list of that source by cursor; without it
 * the overview (owner decision 12): one door page per source in `data`, one after another, `meta.sections[]` naming
 * each one's state, as-of, total and `has_more` (no cursor). `periodEnd` is never sent with `source=issuer_file` (400).
 */
export const getHolders = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: cursorSchema,
        instruments: holdersInstrumentsSchema.optional(),
        limit: holdersLimitSchema,
        periodEnd: z.iso.date().optional(),
        source: holderSourceSchema.optional(),
        symbol: symbolSchema,
    }))
    .handler(async ({ data }): Promise<V2HoldersResponse> => {
        const { apiKey, cursor, instruments, limit, periodEnd, source, symbol } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/holders", {
            params: {
                query: v2Query({
                    cursor,
                    instruments,
                    limit,
                    period_end: source === "issuer_file" ? undefined : periodEnd,
                    source,
                    symbol,
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The proven 13F position changes of one security's holders vs the prior quarter (`unchanged` only when `type` asks). */
export const getHolderChanges = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: cursorSchema,
        limit: holdersLimitSchema,
        periodEnd: z.iso.date().optional(),
        symbol: symbolSchema,
        type: z.array(holderChangeTypeSchema).optional(),
    }))
    .handler(async ({ data }): Promise<V2HolderChangesResponse> => {
        const { apiKey, cursor, limit, periodEnd, symbol, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/holder-changes", {
            params: { query: v2Query({ cursor, limit, period_end: periodEnd, symbol, type: v2Expand(type) }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** A 13F manager's portfolio for one quarter (`period_end` omitted = the newest quarter whose 13F deadline passed). */
export const getFilerHoldings = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cik: cikSchema,
        cursor: cursorSchema,
        instruments: holdersInstrumentsSchema.optional(),
        limit: holdersLimitSchema,
        periodEnd: z.iso.date().optional(),
    }))
    .handler(async ({ data }): Promise<V2FilerHoldingsResponse> => {
        const { apiKey, cik, cursor, instruments, limit, periodEnd } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filers/{cik}/holdings", {
            params: { path: { cik }, query: v2Query({ cursor, instruments, limit, period_end: periodEnd }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/**
 * A listed fund's composition from the freshest source (the issuer's daily / monthly file, else its latest N-PORT
 * report; `meta.source` / `meta.as_of` name it), largest weight first; `asOf` = the composition stored on or before it.
 */
export const getFundPositions = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        asOf: z.iso.date().optional(),
        cursor: cursorSchema,
        fund: fundSchema,
        limit: v2LimitSchema,
    }))
    .handler(async ({ data }): Promise<V2FundPositionsResponse> => {
        const { apiKey, asOf, cursor, fund, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/funds/{fund}/holdings", {
            params: { path: { fund }, query: v2Query({ as_of: asOf, cursor, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** A fund's sector / country / asset-class weights of the composition `getFundPositions` serves (`basis` per bucket). */
export const getFundWeights = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        asOf: z.iso.date().optional(),
        cursor: cursorSchema,
        dimension: z.string().trim().regex(/^(sector|country|asset_class)(,(sector|country|asset_class))*$/).optional(),
        fund: fundSchema,
        limit: v2LimitSchema,
    }))
    .handler(async ({ data }): Promise<V2FundWeightsResponse> => {
        const { apiKey, asOf, cursor, dimension, fund, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/funds/{fund}/weights", {
            params: { path: { fund }, query: v2Query({ as_of: asOf, cursor, dimension, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2InsiderTradesSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1),
    cursor: cursorSchema,
    filedAtGte: z.string().trim().min(1).optional(),
    filedAtLt: z.string().trim().min(1).optional(),
    limit: v2LimitSchema,
    side: z.enum(["buy", "sell"] as const satisfies ReadonlyArray<V2InsiderSide>).optional(),
});

/** A company's insider trades, newest filed first (`side` buy = acquired, sell = disposed). */
export const getV2InsiderTrades = createServerFn({ method: "GET" })
    .inputValidator(v2InsiderTradesSchema)
    .handler(async ({ data }): Promise<V2InsiderTradesResponse> => {
        const { apiKey, company, cursor, filedAtGte, filedAtLt, limit, side } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/insider-trades", {
            params: { query: v2Query({ company, cursor, "filed_at.gte": filedAtGte, "filed_at.lt": filedAtLt, limit, side }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2IposSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1).optional(),
    cursor: cursorSchema,
    isSpac: z.boolean().optional(),
    limit: v2LimitSchema,
    listingDateGte: z.iso.date().optional(),
    listingDateLte: z.iso.date().optional(),
    sort: z.enum(["listing_date", "-listing_date", "first_public_at", "-first_public_at"] as const satisfies ReadonlyArray<V2IposSort>).optional(),
    stage: z.array(z.enum(V2_IPO_STAGES)).optional(),
});

/** Offerings, one row each (registration track + listing-calendar row); `company` optional (pre-listing offerings have none). */
export const getV2Ipos = createServerFn({ method: "GET" })
    .inputValidator(v2IposSchema)
    .handler(async ({ data }): Promise<V2IposResponse> => {
        const { apiKey, company, cursor, isSpac, limit, listingDateGte, listingDateLte, sort, stage } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/ipos", {
            params: {
                query: v2Query({
                    company,
                    cursor,
                    "is_spac": isSpac,
                    limit,
                    "listing_date.gte": listingDateGte,
                    "listing_date.lte": listingDateLte,
                    sort,
                    "stage": v2Expand(stage),
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2OfferingsSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1).optional(),
    cursor: cursorSchema,
    limit: v2LimitSchema,
});

/** Form D private offerings, newest latest filing first; `company` = ONE issuer CIK (any Form D issuer) or a listed ticker. */
export const getV2Offerings = createServerFn({ method: "GET" })
    .inputValidator(v2OfferingsSchema)
    .handler(async ({ data }): Promise<V2OfferingsResponse> => {
        const { apiKey, company, cursor, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/offerings", {
            params: { query: v2Query({ company, cursor, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// Financials + Metrics groups (`/v1/financials/*`, `/v1/metrics/*`, `/v1/segments*`, `/v1/facts/*`, backend
// tasks/data-api-v2 task 5). One row per fiscal period (segments: per segment fact), newest `period_end` first, by
// cursor. A first page whose `meta.coverage.state` is `pending` (`data: []`) = the statements are being prepared.

const periodTypeSchema = z.enum(["annual", "quarterly", "ytd", "ttm"]);

const fiscalYearSchema = z.number().int().min(1900).max(2200).optional();

const v2PeriodListSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1),
    cursor: cursorSchema,
    fiscalYearGt: fiscalYearSchema,
    fiscalYearGte: fiscalYearSchema,
    fiscalYearLt: fiscalYearSchema,
    fiscalYearLte: fiscalYearSchema,
    limit: v2LimitSchema,
    period: periodTypeSchema,
    sort: z.enum(["period_end", "-period_end"]).optional(),
});

type V2PeriodListInput = z.infer<typeof v2PeriodListSchema>;

/** The shared query of every period list: company, period type, the fiscal-year window, sort, limit, cursor. */
const periodListQuery = (data: V2PeriodListInput) => ({
    "company": data.company,
    "cursor": data.cursor,
    "fiscal_year.gt": data.fiscalYearGt,
    "fiscal_year.gte": data.fiscalYearGte,
    "fiscal_year.lt": data.fiscalYearLt,
    "fiscal_year.lte": data.fiscalYearLte,
    "limit": data.limit,
    "period": data.period,
    "sort": data.sort,
});

const v2StandardizedSchema = v2PeriodListSchema.extend({
    /** Point in time: the newest rendering of each period filed on or before this day (`YYYY-MM-DD`). */
    asOf: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** Pin the rendering of one filing. */
    filing: accessionSchema.optional(),
    fiscalQuarter: z.number().int().min(1).max(4).optional(),
    fiscalYear: fiscalYearSchema,
    /** Any of; omitted = all three. */
    statement: z.array(z.enum(V2_STATEMENTS)).optional(),
});

type V2StandardizedInput = z.infer<typeof v2StandardizedSchema>;

const v2AsReportedSchema = v2StandardizedSchema.extend({
    displaySign: z.enum(["as_filed", "cash_flow_direction"]).optional(),
    reportedOnly: z.boolean().optional(),
});

type V2AsReportedInput = z.infer<typeof v2AsReportedSchema>;

const standardizedQuery = (data: V2StandardizedInput) => v2Query({
    ...periodListQuery(data),
    as_of: data.asOf,
    filing: data.filing,
    fiscal_quarter: data.fiscalQuarter,
    fiscal_year: data.fiscalYear,
    statement: v2Expand(data.statement),
});

const asReportedQuery = (data: V2AsReportedInput) => v2Query({
    ...standardizedQuery(data),
    display_sign: data.displaySign,
    reported_only: data.reportedOnly,
});

/** Standardized statements, summary: `facts` = `{metric_id: value}`. */
export const getV2Standardized = createServerFn({ method: "GET" })
    .inputValidator(v2StandardizedSchema)
    .handler(async ({ data }): Promise<V2StandardizedResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/financials/standardized", {
            params: { query: standardizedQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Standardized statements with lineage (PRO): `facts` = `{metric_id: {value, unit, fact_id, formula, …}}`. */
export const getV2StandardizedDetailed = createServerFn({ method: "GET" })
    .inputValidator(v2StandardizedSchema)
    .handler(async ({ data }): Promise<V2StandardizedDetailedResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/financials/standardized/detailed", {
            params: { query: standardizedQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res as V2StandardizedDetailedResponse;
    });

/** Standardized statements as a presentation tree (PRO): `facts` = `[{metric_id, value, children?}]`. */
export const getV2StandardizedPresentation = createServerFn({ method: "GET" })
    .inputValidator(v2StandardizedSchema)
    .handler(async ({ data }): Promise<V2StandardizedPresentationResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/financials/standardized/presentation", {
            params: { query: standardizedQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** As-reported statements, summary: `facts` = `{concept: {value, derived}}`. */
export const getV2AsReported = createServerFn({ method: "GET" })
    .inputValidator(v2AsReportedSchema)
    .handler(async ({ data }): Promise<V2AsReportedResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/financials/as-reported", {
            params: { query: asReportedQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** As-reported statements with labels and lineage (PRO). */
export const getV2AsReportedDetailed = createServerFn({ method: "GET" })
    .inputValidator(v2AsReportedSchema)
    .handler(async ({ data }): Promise<V2AsReportedDetailedResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/financials/as-reported/detailed", {
            params: { query: asReportedQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res as V2AsReportedDetailedResponse;
    });

/** As-reported statements as the filer's presentation tree (PRO): `[{concept, label, value?, depth, is_total?, children?}]`. */
export const getV2AsReportedPresentation = createServerFn({ method: "GET" })
    .inputValidator(v2AsReportedSchema)
    .handler(async ({ data }): Promise<V2AsReportedPresentationResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/financials/as-reported/presentation", {
            params: { query: asReportedQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Ratios per period, `{category: {metric_id: value}}` (`category` any of; v1's `solvency` = `leverage`). */
export const getV2Ratios = createServerFn({ method: "GET" })
    .inputValidator(v2PeriodListSchema.extend({ category: z.array(z.enum(V2_RATIO_CATEGORIES)).optional() }))
    .handler(async ({ data }): Promise<V2RatiosResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/metrics/ratios", {
            params: { query: v2Query({ ...periodListQuery(data), category: v2Expand(data.category) }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Growth per period and basis (`basis` yoy | qoq, v1 `growth_type`; omitted = both, one row each). */
export const getV2Growth = createServerFn({ method: "GET" })
    .inputValidator(v2PeriodListSchema.extend({ basis: z.enum(["yoy", "qoq"]).optional() }))
    .handler(async ({ data }): Promise<V2GrowthResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/metrics/growth", {
            params: { query: v2Query({ ...periodListQuery(data), basis: data.basis }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** CAGR per period and horizon (`horizon` 3 | 5 | 10 years, v1 `period_years`; omitted = every horizon). */
export const getV2Cagr = createServerFn({ method: "GET" })
    .inputValidator(v2PeriodListSchema.extend({ horizon: z.union([z.literal(3), z.literal(5), z.literal(10)]).optional() }))
    .handler(async ({ data }): Promise<V2CagrResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/metrics/cagr", {
            params: { query: v2Query({ ...periodListQuery(data), horizon: data.horizon }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2SegmentsSchema = v2PeriodListSchema.extend({
    /** XBRL axes (any of). */
    axis: z.array(z.string().trim().min(1)).optional(),
    /** Metric ids (any of). */
    metric: z.array(z.string().trim().min(1)).optional(),
});

type V2SegmentsInput = z.infer<typeof v2SegmentsSchema>;

const segmentsQuery = (data: V2SegmentsInput) => v2Query({ ...periodListQuery(data), axis: v2Expand(data.axis), metric: v2Expand(data.metric) });

/** Segment facts, one row each (`metric_id`, `segment_id`, `value`, `dimensions[]`). */
export const getV2Segments = createServerFn({ method: "GET" })
    .inputValidator(v2SegmentsSchema)
    .handler(async ({ data }): Promise<V2SegmentsResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/segments", {
            params: { query: segmentsQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Segment facts with lineage (PRO): adds `metric` (the XBRL concept), `accession`, `html_tag_id`, `html_label`, `unit`. */
export const getV2SegmentsDetailed = createServerFn({ method: "GET" })
    .inputValidator(v2SegmentsSchema)
    .handler(async ({ data }): Promise<V2SegmentsDetailedResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/segments/detailed", {
            params: { query: segmentsQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Why a standardized fact has its value (`fact_id` of a detailed standardized fact). */
export const getV2Fact = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, factId: z.string().trim().min(1).max(200) }))
    .handler(async ({ data }): Promise<V2FactResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/facts/{fact_id}", {
            params: { path: { fact_id: data.factId } },
        });

        if (error) throwApiError(error, response);

        return res as V2FactResponse;
    });

// Account and IPO detail (backend tasks/data-api-dashboard O5). `/v1/me` (0 credits) is the key validator.

/** Who the caller is: plan, rate limits, credits, allowed families (0 credits; 401 = no or an invalid key). */
export const getMe = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema }))
    .handler(async ({ data }): Promise<V2Me> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/me");

        if (error) throwApiError(error, response);

        return res;
    });

/** The caller's usage over the last `days` UTC days (1–90; the API answers a 7 / 30 / 90 window; 0 credits). */
export const getMyUsage = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, days: z.number().int().min(1).max(90).optional() }))
    .handler(async ({ data }): Promise<V2Usage> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/me/usage", {
            params: { query: v2Query({ days: data.days }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** One offering by its id (the IPO calendar's row detail). */
export const getIpo = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, ipoId: z.string().trim().min(1).max(200) }))
    .handler(async ({ data }): Promise<V2IpoDetail> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/ipos/{ipo_id}", {
            params: { path: { ipo_id: data.ipoId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// People (backend tasks/data-api-dashboard O7 group 1): `/v1/people` (search), `/v1/people/{person_id}`, and the calls
// of one person (`/v1/participants?person=`). 1 credit a request each.

const personIdSchema = z.uuid();

/** People who appear on calls (`GET /v1/people`): by name (`q`), company, event, role; sorted; by cursor. */
export const getV2People = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        company: z.string().trim().min(1).max(200).optional(),
        cursor: cursorSchema,
        event: eventIdSchema.optional(),
        limit: v2LimitSchema,
        q: z.string().trim().min(1).max(200).optional(),
        role: z.enum(["executive", "analyst", "operator", "other"] as const satisfies ReadonlyArray<V2PersonRole>).optional(),
        sort: z.enum(["name", "-name", "last_seen", "-last_seen"] as const satisfies ReadonlyArray<V2PeopleSort>).optional(),
    }))
    .handler(async ({ data }): Promise<V2PeopleResponse> => {
        const { apiKey, company, cursor, event, limit, q, role, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/people", {
            params: { query: v2Query({ company, cursor, event, limit, q, role, sort }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** One person (`GET /v1/people/{person_id}`). */
export const getV2Person = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, personId: personIdSchema }))
    .handler(async ({ data }): Promise<V2Person> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/people/{person_id}", {
            params: { path: { person_id: data.personId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Every call one person spoke on (`GET /v1/participants?person=`), one participation per call, by cursor. */
export const getV2PersonParticipations = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, limit: v2LimitSchema, person: personIdSchema }))
    .handler(async ({ data }): Promise<V2ParticipantsResponse> => {
        const { apiKey, cursor, limit, person } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/participants", {
            params: { query: v2Query({ cursor, limit, person }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// Fact places (backend tasks/data-api-dashboard O7 group 4, "Explain this number").

const FACT_PLACE_STATUSES = ["placed", "hidden", "not_in_document", "derived", "unmatched"] as const satisfies ReadonlyArray<V2FactPlaceStatus>;

/** Where facts sit in a document version (PRO): by `fact` (a standardized fact's source facts) or `documentVersion`. */
export const getV2FactPlaces = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: cursorSchema,
        documentVersion: z.string().trim().min(1).max(200).optional(),
        fact: z.string().trim().min(1).max(200).optional(),
        limit: v2LimitSchema,
        status: z.array(z.enum(FACT_PLACE_STATUSES)).optional(),
    }).refine(data => Boolean(data.fact) !== Boolean(data.documentVersion), "Exactly one of fact / documentVersion"))
    .handler(async ({ data }): Promise<V2FactPlacesResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/fact-places", {
            params: {
                query: v2Query({
                    cursor: data.cursor,
                    document_version: data.documentVersion,
                    fact: data.fact,
                    limit: data.limit,
                    status: v2Expand(data.status),
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });
// News search and announcements by company (backend tasks/data-api-dashboard O7 group 2).

/**
 * `GET /v1/search/news` (STANDARD, 10 credits a page): headlines, ledes and summary passages; `company` (a ticker or a
 * comma list) is optional — without it the whole market is searched. The window = `published_at.gte` / `.lt`.
 */
export const getV2NewsSearch = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        company: z.string().trim().min(1).optional(),
        cursor: z.string().optional(),
        field: z.enum(["title", "lede", "summary", "any"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        mode: z.enum(["lexical", "literal"]).optional(),
        publishedAtGte: z.string().optional(),
        publishedAtLt: z.string().optional(),
        q: z.string().trim().min(1).max(500),
    }))
    .handler(async ({ data }): Promise<V2NewsSearchResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/search/news", {
            params: {
                query: v2Query({
                    "company": data.company,
                    "cursor": data.cursor,
                    "field": data.field,
                    "limit": data.limit,
                    "mode": data.mode,
                    "published_at.gte": data.publishedAtGte,
                    "published_at.lt": data.publishedAtLt,
                    "q": data.q,
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/**
 * `GET /v1/announcements?company=` (STANDARD, 2 credits a page): a company's announcements with the topic, the
 * announced window (`announced_at.gte` / `.lt`) and the effective range (`effective_from.gte`, `effective_to.lte`).
 */
export const getV2AnnouncementsList = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        announcedAtGte: z.string().optional(),
        announcedAtLt: z.string().optional(),
        apiKey: apiKeySchema,
        company: z.string().trim().min(1),
        cursor: z.string().optional(),
        effectiveFromGte: z.iso.date().optional(),
        effectiveToLte: z.iso.date().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        sort: z.enum(["announced_at", "-announced_at"]).optional(),
        topic: z.array(z.string()).optional(),
    }))
    .handler(async ({ data }): Promise<V2AnnouncementsResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/announcements", {
            params: {
                query: v2Query({
                    "announced_at.gte": data.announcedAtGte,
                    "announced_at.lt": data.announcedAtLt,
                    "company": data.company,
                    "cursor": data.cursor,
                    "effective_from.gte": data.effectiveFromGte,
                    "effective_to.lte": data.effectiveToLte,
                    "limit": data.limit,
                    "sort": data.sort,
                    "topic": v2Expand(data.topic),
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// Filings depth (backend tasks/data-api-dashboard O7 group 3): the filing detail page's tabs, a document version's
// sections and fact places, the SEC data sets. Each list pages by `cursor` with the same filters.

/** A filing's numeric XBRL facts (SEC financial statement data sets), `tag` = concepts (comma list). */
export const getV2FilingFacts = createServerFn({ method: "GET" })
    .inputValidator(z.object({ accession: accessionSchema, apiKey: apiKeySchema, cursor: cursorSchema, limit: v2LimitSchema, tag: z.string().trim().min(1).max(500).optional() }))
    .handler(async ({ data }): Promise<V2FilingFactsResponse> => {
        const { accession, apiKey, cursor, limit, tag } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filings/{accession}/facts", {
            params: { path: { accession }, query: v2Query({ cursor, limit, tag }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** A filing's text facts (XBRL text blocks), `tag` = concepts (comma list). */
export const getV2FilingNotes = createServerFn({ method: "GET" })
    .inputValidator(z.object({ accession: accessionSchema, apiKey: apiKeySchema, cursor: cursorSchema, limit: v2LimitSchema, tag: z.string().trim().min(1).max(500).optional() }))
    .handler(async ({ data }): Promise<V2FilingNotesResponse> => {
        const { accession, apiKey, cursor, limit, tag } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filings/{accession}/notes", {
            params: { path: { accession }, query: v2Query({ cursor, limit, tag }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The comment-letter graph around a filing (`max_depth` hops, `direction`); one answer, no cursor. */
export const getV2ReviewChain = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        accession: accessionSchema,
        apiKey: apiKeySchema,
        direction: z.enum(["both", "up", "down"] as const satisfies ReadonlyArray<V2ReviewDirection>).optional(),
        maxDepth: z.number().int().min(1).max(6).optional(),
    }))
    .handler(async ({ data }): Promise<V2ReviewChainResponse> => {
        const { accession, apiKey, direction, maxDepth } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filings/{accession}/review-chain", {
            params: { path: { accession }, query: v2Query({ direction, max_depth: maxDepth }) },
        });

        if (error) throwApiError(error, response);

        // `nodes` / `edges` / `twins` / `completeness` are free JSON in the spec (see `SecJson` in types.ts).
        return res as V2ReviewChainResponse;
    });

/** The reported lines of one 13F-HR or NPORT-P filing as filed (`meta.family`), in the filing's line order. */
export const getV2FilingHoldings = createServerFn({ method: "GET" })
    .inputValidator(z.object({ accession: accessionSchema, apiKey: apiKeySchema, cursor: cursorSchema, limit: z.number().int().min(1).max(1000).optional() }))
    .handler(async ({ data }): Promise<V2FilingHoldingsResponse> => {
        const { accession, apiKey, cursor, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filings/{accession}/holdings", {
            params: { path: { accession }, query: v2Query({ cursor, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The section outline of a document version (`generic` headings by default, `legacy` = the old section ids). */
export const getV2DocumentSections = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: cursorSchema,
        limit: v2LimitSchema,
        outline: z.enum(["legacy", "generic"] as const satisfies ReadonlyArray<V2SectionOutline>).optional(),
        versionId: versionIdSchema,
    }))
    .handler(async ({ data }): Promise<V2DocumentSectionsResponse> => {
        const { apiKey, cursor, limit, outline, versionId } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/document-versions/{version_id}/sections", {
            params: { path: { version_id: versionId }, query: v2Query({ cursor, limit, outline }) },
        });

        if (error) throwApiError(error, response);

        // `block_spans` is free JSON in the spec (see `SecJson` in types.ts).
        return res as V2DocumentSectionsResponse;
    });

/** The SEC data set releases the filings routes serve (newest release per data set). */
export const getV2Datasets = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2DatasetsResponse> => {
        const { apiKey, cursor, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/datasets", {
            params: { query: v2Query({ cursor, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// Reference (backend tasks/data-api-dashboard O7 group 7): the six catalogs (`/v1/catalog/*`, FREE, one credit a page,
// by cursor), the companies list (`/v1/companies`) and the API's status (`/status`, `/status/licensing`: no key needed,
// 0 credits; the key is sent like on every call).

const catalogPageSchema = z.object({ apiKey: apiKeySchema, cursor: cursorSchema, limit: v2LimitSchema });

const catalogStatementSchema = z.array(z.enum(V2_STATEMENTS)).optional();

/** The standardized metrics (`GET /v1/catalog/metrics`, `statement` comma list). */
export const getMetricCatalog = createServerFn({ method: "GET" })
    .inputValidator(catalogPageSchema.extend({ statement: catalogStatementSchema }))
    .handler(async ({ data }): Promise<V2MetricCatalogResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/catalog/metrics", {
            params: { query: v2Query({ cursor: data.cursor, limit: data.limit, statement: v2Expand(data.statement) }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The sections of each form (`GET /v1/catalog/sections`, `form` comma list). */
export const getSectionCatalog = createServerFn({ method: "GET" })
    .inputValidator(catalogPageSchema.extend({ form: z.array(z.string().trim().min(1).max(20)).optional() }))
    .handler(async ({ data }): Promise<V2SectionCatalogResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/catalog/sections", {
            params: { query: v2Query({ cursor: data.cursor, form: v2Expand(data.form), limit: data.limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The SEC forms the API serves (`GET /v1/catalog/forms`). */
export const getFormCatalog = createServerFn({ method: "GET" })
    .inputValidator(catalogPageSchema)
    .handler(async ({ data }): Promise<V2FormCatalogResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/catalog/forms", {
            params: { query: v2Query({ cursor: data.cursor, limit: data.limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The event types (`GET /v1/catalog/event-types`). */
export const getEventTypeCatalog = createServerFn({ method: "GET" })
    .inputValidator(catalogPageSchema)
    .handler(async ({ data }): Promise<V2EventTypeCatalogResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/catalog/event-types", {
            params: { query: v2Query({ cursor: data.cursor, limit: data.limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The investor-document kinds (`GET /v1/catalog/document-kinds`). */
export const getDocumentKindCatalog = createServerFn({ method: "GET" })
    .inputValidator(catalogPageSchema)
    .handler(async ({ data }): Promise<V2DocumentKindCatalogResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/catalog/document-kinds", {
            params: { query: v2Query({ cursor: data.cursor, limit: data.limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The standardized metrics' mapping rules (`GET /v1/catalog/mapping-rules`, `statement` / `metric_id` comma lists). */
export const getMappingRules = createServerFn({ method: "GET" })
    .inputValidator(catalogPageSchema.extend({
        metricId: z.array(z.string().trim().regex(/^[a-z0-9_]{1,120}$/)).optional(),
        statement: catalogStatementSchema,
    }))
    .handler(async ({ data }): Promise<V2MappingRulesResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/catalog/mapping-rules", {
            params: {
                query: v2Query({
                    cursor: data.cursor,
                    limit: data.limit,
                    metric_id: v2Expand(data.metricId),
                    statement: v2Expand(data.statement),
                }),
            },
        });

        if (error) throwApiError(error, response);

        // `rule` is free JSON in the spec (see `SecJson` in types.ts).
        return res as V2MappingRulesResponse;
    });

/** Operating companies with a US listing (`GET /v1/companies`: `q` name / ticker prefix, `exchange` / `sector` lists). */
export const getCompanies = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: cursorSchema,
        exchange: z.array(z.string().trim().regex(/^[A-Z]{4}$/)).optional(),
        limit: v2LimitSchema,
        q: z.string().trim().min(1).max(100).optional(),
        sector: z.array(z.string().trim().min(1).max(60)).optional(),
        sort: z.enum(["ticker", "-ticker", "name", "-name"] as const satisfies ReadonlyArray<V2CompaniesSort>).optional(),
    }))
    .handler(async ({ data }): Promise<V2CompaniesResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/companies", {
            params: {
                query: v2Query({
                    cursor: data.cursor,
                    exchange: v2Expand(data.exchange),
                    limit: data.limit,
                    q: data.q,
                    sector: v2Expand(data.sector),
                    sort: data.sort,
                }),
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Whether each product works (`GET /status`): status and uptime per family and per docs group, the universe. */
export const getApiStatus = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema }))
    .handler(async ({ data }): Promise<V2ApiStatus> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/status");

        if (error) throwApiError(error, response);

        return res;
    });

/** The licensing policy (`GET /status/licensing`): rights per tier and the right and tier of every route. */
export const getApiLicensing = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema }))
    .handler(async ({ data }): Promise<V2Licensing> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/status/licensing");

        if (error) throwApiError(error, response);

        return res;
    });
