import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
    CompanyFiscalPeriod,
    CompanySearchResponse,
    V2AnnouncementsResponse,
    V2AsReportedDetailedResponse,
    V2AsReportedPresentationResponse,
    V2AsReportedResponse,
    V2AudioResponse,
    V2CagrResponse,
    V2CompanyResponse,
    V2DateKind,
    V2DividendsResponse,
    V2DividendsSort,
    V2DocumentFigureResponse,
    V2DocumentVersionResponse,
    V2EventComparisonResponse,
    V2EventResponse,
    V2EventsResponse,
    V2EventsSort,
    V2EventStatsResponse,
    V2EventStatus,
    V2EventType,
    V2FactResponse,
    V2FilerResponse,
    V2FilersResponse,
    V2FilingDetailResponse,
    V2FilingSearchResponse,
    V2FilingsResponse,
    V2FilingsSort,
    V2GrowthResponse,
    V2GuidanceBasis,
    V2GuidancePeriodKind,
    V2GuidanceResponse,
    V2HoldingChangesResponse,
    V2HoldingsInstruments,
    V2HoldingsResponse,
    V2InsiderSide,
    V2InsiderTradesResponse,
    V2InvestorDocumentResponse,
    V2InvestorDocumentSearchResponse,
    V2InvestorDocumentsResponse,
    V2InvestorDocumentsSort,
    V2IposResponse,
    V2IposSort,
    V2KpisResponse,
    V2LiveAudioResponse,
    V2MarketHolidaysResponse,
    V2MarketHolidaysSort,
    V2NewsItem,
    V2NewsListResponse,
    V2NewsText,
    V2ParticipantsResponse,
    V2PressReleaseResponse,
    V2PriceAttributionResponse,
    V2ProsodyResponse,
    V2ProsodySection,
    V2QaResponse,
    V2RatiosResponse,
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

const searchSchema = z.object({
    apiKey: apiKeySchema,
    limit: z.number().int().min(1).max(200).optional(),
    query: z.string(),
});

/** Company search by name or ticker prefix (`GET /v1/companies?q=`, one page). */
export const searchCompanies = createServerFn({ method: "GET" })
    .inputValidator(searchSchema)
    .handler(async ({ data }): Promise<CompanySearchResponse> => {
        const { apiKey, limit = 10, query } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/companies", {
            params: { query: v2Query({ limit, q: query }) },
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
    kind: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    /** ISO instants: `published_at.gte` / `published_at.lt`. */
    publishedAtGte: z.string().optional(),
    publishedAtLt: z.string().optional(),
    topic: z.array(z.string()).optional(),
});

export const getV2News = createServerFn({ method: "GET" })
    .inputValidator(newsListSchema)
    .handler(async ({ data }): Promise<V2NewsListResponse> => {
        const { apiKey, company, cursor, kind, limit, publishedAtGte, publishedAtLt, topic } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/news", {
            params: {
                query: v2Query({
                    company,
                    cursor,
                    "kind": v2Expand(kind),
                    limit,
                    "published_at.gte": publishedAtGte,
                    "published_at.lt": publishedAtLt,
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
 * The filer registry by name or ticker (`GET /v1/filers?q=`): without `phase` ONE page of at most 50 filers
 * (`has_more` false) — narrow `q` to find more.
 */
export const getV2Filers = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        limit: z.number().int().min(1).max(50).optional(),
        q: z.string().trim().min(1).max(200),
    }))
    .handler(async ({ data }): Promise<V2FilersResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/filers", {
            params: { query: v2Query({ limit: data.limit, q: data.q }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const filingSearchSchema = z.object({
    apiKey: apiKeySchema,
    caseSensitive: z.boolean().optional(),
    /** Ticker or CIK: the search stays scoped to one company. */
    company: z.string().trim().min(1),
    cursor: cursorSchema,
    form: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    mode: searchModeSchema.optional(),
    q: z.string().trim().min(1).max(500),
});

/**
 * Ranked, cited passages from SEC documents (`GET /v1/search/filings`, one index page per request).
 * `case_sensitive` is sent with `mode=literal` only.
 */
export const getV2FilingSearch = createServerFn({ method: "GET" })
    .inputValidator(filingSearchSchema)
    .handler(async ({ data }): Promise<V2FilingSearchResponse> => {
        const { apiKey, caseSensitive, company, cursor, form, limit, mode, q } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/search/filings", {
            params: {
                query: v2Query({
                    case_sensitive: mode === "literal" ? caseSensitive : undefined,
                    company,
                    cursor,
                    form,
                    limit,
                    mode,
                    q,
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
    company: z.string().trim().min(1),
    cursor: cursorSchema,
    exDateGte: z.string().trim().min(1).optional(),
    exDateLte: z.string().trim().min(1).optional(),
    limit: v2LimitSchema,
    sort: z.enum(["ex_date", "-ex_date", "pay_date", "-pay_date"] as const satisfies ReadonlyArray<V2DividendsSort>).optional(),
});

export const getV2Dividends = createServerFn({ method: "GET" })
    .inputValidator(v2DividendsSchema)
    .handler(async ({ data }): Promise<V2DividendsResponse> => {
        const { apiKey, company, cursor, exDateGte, exDateLte, limit, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/dividends", {
            params: { query: v2Query({ company, cursor, "ex_date.gte": exDateGte, "ex_date.lte": exDateLte, limit, sort }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2SplitsSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1),
    cursor: cursorSchema,
    limit: v2LimitSchema,
    sort: z.enum(["execution_date", "-execution_date"] as const satisfies ReadonlyArray<V2SplitsSort>).optional(),
});

export const getV2Splits = createServerFn({ method: "GET" })
    .inputValidator(v2SplitsSchema)
    .handler(async ({ data }): Promise<V2SplitsResponse> => {
        const { apiKey, company, cursor, limit, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/splits", {
            params: { query: v2Query({ company, cursor, limit, sort }) },
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
        const { apiKey, company, cursor, dateKind, expand, limit, scheduledAtGte, scheduledAtLte, sort, status, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/events", {
            params: {
                query: v2Query({
                    company,
                    cursor,
                    "date_kind": dateKind,
                    "expand": v2Expand(expand),
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

/** The comparison with the previous call (the one the pipeline derives; `prior` is not sent). */
export const getV2EventComparison = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2EventComparisonResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/events/{event_id}/comparison", {
            params: { path: { event_id: data.eventId } },
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
        event: eventIdSchema.optional(),
        limit: v2LimitSchema,
        mode: searchModeSchema.optional(),
        q: z.string().trim().min(1),
        type: z.enum(["transcript", "qa", "prepared", "presentation"] as const satisfies ReadonlyArray<V2TranscriptSearchType>).optional(),
    }))
    .handler(async ({ data }): Promise<V2TranscriptSearchResponse> => {
        const { apiKey, company, event, limit, mode, q, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/search/transcripts", {
            params: { query: v2Query({ company, event, limit, mode, q, type }) },
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

export const getV2Kpis = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, event: eventIdSchema, limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2KpisResponse> => {
        const { apiKey, cursor, event, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/kpis", {
            params: { query: v2Query({ cursor, event, limit }) },
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

// SEC family (`/v1/filings*`, `/v1/document-versions/*`, `/v1/holdings`, `/v1/holding-changes`, `/v1/insider-trades`,
// `/v1/ipos`, backend tasks/data-api-v2 task 6). Readiness is `meta.coverage.state` on a 200 (`data: []` while
// pending); 403 `excluded`, 404 `not_covered` and 503 `unavailable` are problems (page states, `secErrorState`).

const v2FilingsSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1),
    cursor: cursorSchema,
    filedAtGte: z.string().trim().min(1).optional(),
    filedAtLt: z.string().trim().min(1).optional(),
    form: z.array(z.string().trim().min(1)).optional(),
    limit: v2LimitSchema,
    sort: z.enum(["filed_at", "-filed_at"] as const satisfies ReadonlyArray<V2FilingsSort>).optional(),
});

/** A company's filings by cursor (`meta.form_facet` = its forms with counts) (`sort`: `filed_at` only). */
export const getV2Filings = createServerFn({ method: "GET" })
    .inputValidator(v2FilingsSchema)
    .handler(async ({ data }): Promise<V2FilingsResponse> => {
        const { apiKey, company, cursor, filedAtGte, filedAtLt, form, limit, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/filings", {
            params: {
                query: v2Query({
                    company,
                    cursor,
                    "filed_at.gte": filedAtGte,
                    "filed_at.lt": filedAtLt,
                    "form": v2Expand(form),
                    limit,
                    sort,
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

// 13F rows: up to 1 000 per page.
const v2ThirteenFLimitSchema = z.number().int().min(1).max(1000).optional();

const v2HoldingsSchema = z.object({
    accession: accessionSchema.optional(),
    apiKey: apiKeySchema,
    company: z.string().trim().min(1).optional(),
    cursor: cursorSchema,
    filer: z.string().trim().regex(/^\d{1,10}(,\d{1,10})*$/).optional(),
    instruments: z.enum(["shares", "all"] as const satisfies ReadonlyArray<V2HoldingsInstruments>).optional(),
    limit: v2ThirteenFLimitSchema,
    periodEnd: z.iso.date().optional(),
});

/** 13F positions of exactly one scope (`company` | `filer` | `accession`); `period_end` omitted = the server's newest due quarter. */
export const getV2Holdings = createServerFn({ method: "GET" })
    .inputValidator(v2HoldingsSchema)
    .handler(async ({ data }): Promise<V2HoldingsResponse> => {
        const { accession, apiKey, company, cursor, filer, instruments, limit, periodEnd } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/holdings", {
            params: { query: v2Query({ accession, company, cursor, filer, instruments, limit, period_end: periodEnd }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const v2HoldingChangesSchema = z.object({
    apiKey: apiKeySchema,
    company: z.string().trim().min(1),
    cursor: cursorSchema,
    limit: v2ThirteenFLimitSchema,
    periodEnd: z.iso.date().optional(),
});

/** A company's proven 13F position changes vs the prior quarter (`unchanged` rows only when `type` asks; not sent here). */
export const getV2HoldingChanges = createServerFn({ method: "GET" })
    .inputValidator(v2HoldingChangesSchema)
    .handler(async ({ data }): Promise<V2HoldingChangesResponse> => {
        const { apiKey, company, cursor, limit, periodEnd } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/holding-changes", {
            params: { query: v2Query({ company, cursor, limit, period_end: periodEnd }) },
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
    limit: v2LimitSchema,
    sort: z.enum(["listing_date", "-listing_date", "first_public_at", "-first_public_at"] as const satisfies ReadonlyArray<V2IposSort>).optional(),
    stage: z.array(z.enum(V2_IPO_STAGES)).optional(),
});

/** Offerings, one row each (registration track + listing-calendar row); `company` optional (pre-listing offerings have none). */
export const getV2Ipos = createServerFn({ method: "GET" })
    .inputValidator(v2IposSchema)
    .handler(async ({ data }): Promise<V2IposResponse> => {
        const { apiKey, company, cursor, limit, sort, stage } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/ipos", {
            params: { query: v2Query({ company, cursor, limit, sort, stage: v2Expand(stage) }) },
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
