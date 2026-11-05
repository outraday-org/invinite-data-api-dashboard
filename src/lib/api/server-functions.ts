import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
    AsReportedFinancialsPresentationResponse,
    AvailableFormTypesResponse,
    CompanyDetailsResponse,
    CompanySearchResponse,
    DividendsResponse,
    EarningsAudioResponse,
    EarningsCalendarResponse,
    EarningsCompanyDocumentResponse,
    EarningsCompanyDocumentsResponse,
    EarningsDiffResponse,
    EarningsDocumentSearchResponse,
    EarningsDocumentsResponse,
    EarningsEventResponse,
    EarningsEventsResponse,
    EarningsExtractionsResponse,
    EarningsGuidanceHistoryResponse,
    EarningsLiveResponse,
    EarningsLiveStreamResponse,
    EarningsMetricsResponse,
    EarningsParticipantsResponse,
    EarningsPressReleaseResponse,
    EarningsPriceAttributionResponse,
    EarningsProsodyResponse,
    EarningsQaResponse,
    EarningsSearchResponse,
    EarningsSlidesResponse,
    EarningsTranscriptDiffResponse,
    EarningsTranscriptResponse,
    EarningsTranscriptVersionsResponse,
    FilingsResponse,
    FinancialCagrResponse,
    FinancialGrowthResponse,
    FinancialRatiosResponse,
    InsiderTradesResponse,
    InstitutionalHoldingsResponse,
    InstitutionalTransactionsResponse,
    InstitutionsResponse,
    IposResponse,
    MarketHolidaysResponse,
    NewsAssetDownloadResponse,
    NewsItemResponse,
    NewsListResponse,
    SecDocumentResponse,
    SecExportResponse,
    SecFigureResponse,
    SecFilerResponse,
    SecFilersResponse,
    SecFilingManifestResponse,
    SecFilingsResponse,
    SecLifecycleResponse,
    SecManagerPortfolioResponse,
    SecSearchResponse,
    SecSectionsResponse,
    SegmentedFinancialsResponse,
    SplitsResponse,
    StandardizedFinancialsPresentationResponse,
} from "./types";

import { ASSET_GROUP_CATEGORIES } from "../earnings/documents";
import { SEARCH_CASE_SENSITIVE_VALUES, SEARCH_MODES } from "../earnings/labels";
import { env } from "../env";
import { createApiClient } from "./client.server";
import { throwApiError } from "./errors";

const apiKeySchema = z
    .string()
    .transform(val => val.trim())
    .pipe(z.string().min(1))
    .optional();

const searchSchema = z.object({
    apiKey: apiKeySchema,
    limit: z.number().optional(),
    offset: z.number().optional(),
    query: z.string(),
});

export const searchCompanies = createServerFn({ method: "GET" })
    .inputValidator(searchSchema)
    .handler(async ({ data }): Promise<CompanySearchResponse> => {
        const { apiKey, limit = 10, offset = 0, query } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/company/search", {
            params: { query: { limit, offset, query } },
        });

        if (error) throw error;

        return res;
    });

const detailsSchema = z.object({
    apiKey: apiKeySchema,
    identifier: z.string(),
});

export const getCompanyDetails = createServerFn({ method: "GET" })
    .inputValidator(detailsSchema)
    .handler(async ({ data }): Promise<CompanyDetailsResponse> => {
        const { apiKey, identifier } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/company/details", {
            params: { query: { identifier } },
        });

        if (error) throw error;

        return res;
    });

const dividendsSchema = z.object({
    apiKey: apiKeySchema,
    endDate: z.string().optional(),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    startDate: z.string().optional(),
});

export const getCompanyDividends = createServerFn({ method: "GET" })
    .inputValidator(dividendsSchema)
    .handler(async ({ data }): Promise<DividendsResponse> => {
        const {
            apiKey,
            endDate,
            identifier,
            limit = 40,
            offset = 0,
            sort = "desc",
            startDate,
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/company/dividends", {
            params: {
                query: {
                    end_date: endDate,
                    identifier,
                    limit,
                    offset,
                    sort,
                    start_date: startDate,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const splitsSchema = z.object({
    apiKey: apiKeySchema,
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

export const getCompanySplits = createServerFn({ method: "GET" })
    .inputValidator(splitsSchema)
    .handler(async ({ data }): Promise<SplitsResponse> => {
        const {
            apiKey,
            identifier,
            limit = 40,
            offset = 0,
            sort = "desc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/company/splits", {
            params: {
                query: {
                    identifier,
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const insiderTradesSchema = z.object({
    acquiredDisposed: z.enum(["A", "D"]).optional(),
    apiKey: apiKeySchema,
    endDate: z.string().optional(),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    startDate: z.string().optional(),
});

export const getInsiderTrades = createServerFn({ method: "GET" })
    .inputValidator(insiderTradesSchema)
    .handler(async ({ data }): Promise<InsiderTradesResponse> => {
        const {
            acquiredDisposed,
            apiKey,
            endDate,
            identifier,
            limit = 40,
            offset = 0,
            sort = "desc",
            startDate,
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/insider-trades", {
            params: {
                query: {
                    acquired_disposed: acquiredDisposed,
                    end_date: endDate,
                    identifier,
                    limit,
                    offset,
                    sort,
                    start_date: startDate,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const institutionalTransactionsSchema = z.object({
    apiKey: apiKeySchema,
    calendarQuarter: z.number().optional(),
    calendarYear: z.number().optional(),
    endDate: z.string().optional(),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    startDate: z.string().optional(),
    type: z.enum(["new_buy", "added", "reduced", "sold_out"]).optional(),
});

export const getInstitutionalTransactions = createServerFn({ method: "GET" })
    .inputValidator(institutionalTransactionsSchema)
    .handler(async ({ data }): Promise<InstitutionalTransactionsResponse> => {
        const {
            apiKey,
            calendarQuarter,
            calendarYear,
            endDate,
            identifier,
            limit = 40,
            offset = 0,
            sort = "desc",
            startDate,
            type,
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/institutional-ownership/transactions", {
            params: {
                query: {
                    calendar_quarter: calendarQuarter,
                    calendar_year: calendarYear,
                    end_date: endDate,
                    identifier,
                    limit,
                    offset,
                    sort,
                    start_date: startDate,
                    type,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const institutionalHoldingsSchema = z.object({
    apiKey: apiKeySchema,
    identifier: z.string(),
    limit: z.number().optional(),
    minValue: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

export const getInstitutionalHoldingsByCompany = createServerFn({ method: "GET" })
    .inputValidator(institutionalHoldingsSchema)
    .handler(async ({ data }): Promise<InstitutionalHoldingsResponse> => {
        const {
            apiKey,
            identifier,
            limit = 40,
            minValue,
            offset = 0,
            sort = "desc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/institutional-ownership/holdings-by-company", {
            params: {
                query: {
                    identifier,
                    limit,
                    min_value: minValue,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const institutionsSchema = z.object({
    apiKey: apiKeySchema,
    ciks: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

export const getInstitutions = createServerFn({ method: "GET" })
    .inputValidator(institutionsSchema)
    .handler(async ({ data }): Promise<InstitutionsResponse> => {
        const {
            apiKey,
            ciks,
            limit = 100,
            offset = 0,
            sort = "asc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/institutional-ownership/institutions", {
            params: {
                query: {
                    ciks,
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const iposSchema = z.object({
    apiKey: apiKeySchema,
    endDate: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    startDate: z.string().optional(),
});

export const getIpos = createServerFn({ method: "GET" })
    .inputValidator(iposSchema)
    .handler(async ({ data }): Promise<IposResponse> => {
        const {
            apiKey,
            endDate,
            limit = 40,
            offset = 0,
            sort = "desc",
            startDate,
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/ipos", {
            params: {
                query: {
                    end_date: endDate,
                    limit,
                    offset,
                    sort,
                    start_date: startDate,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const marketHolidaysSchema = z.object({
    apiKey: apiKeySchema,
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

export const getMarketHolidays = createServerFn({ method: "GET" })
    .inputValidator(marketHolidaysSchema)
    .handler(async ({ data }): Promise<MarketHolidaysResponse> => {
        const { apiKey, limit = 40, offset = 0, sort = "desc" } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/market/market-holidays", {
            params: {
                query: {
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const filingsSchema = z.object({
    apiKey: apiKeySchema,
    formType: z.string().optional(),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

export const getFilings = createServerFn({ method: "GET" })
    .inputValidator(filingsSchema)
    .handler(async ({ data }): Promise<FilingsResponse> => {
        const {
            apiKey,
            formType,
            identifier,
            limit = 40,
            offset = 0,
            sort = "desc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/sec-filings/filings", {
            params: {
                query: {
                    form_type: formType,
                    identifier,
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

const availableFormTypesSchema = z.object({
    apiKey: apiKeySchema,
    identifier: z.string().optional(),
});

export const getAvailableFormTypes = createServerFn({ method: "GET" })
    .inputValidator(availableFormTypesSchema)
    .handler(async ({ data }): Promise<AvailableFormTypesResponse> => {
        const { apiKey, identifier } = data;

        const api = createApiClient(apiKey);

        const { data: res } = await api.GET("/v1/sec-filings/available-form-types", {
            params: { query: { identifier } },
        });

        if (!res) {
            throw new Error("Failed to load available form types");
        }

        return res;
    });

const financialsSchema = z.object({
    apiKey: apiKeySchema,
    fiscalPeriodType: z.enum(["annual", "quarterly", "ttm", "ytd"]),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    statement: z.enum(["balance-sheet", "cash-flow-statement", "income-statement"]),
});

const segmentedFinancialsSchema = z.object({
    apiKey: apiKeySchema,
    fiscalPeriodType: z.enum(["annual", "quarterly", "ttm", "ytd"]),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    segmentId: z.enum([
        "seg_revenue_product",
        "seg_revenue_geographic",
        "seg_revenue_business_segment",
        "seg_cost_of_revenue_business_segment",
        "seg_research_and_development_expenses_business_segment",
        "seg_selling_and_marketing_expenses_business_segment",
        "seg_general_and_administrative_expenses_business_segment",
    ]).optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

const ratiosSchema = z.object({
    apiKey: apiKeySchema,
    category: z.enum(["valuation", "profitability", "liquidity", "solvency"]).optional(),
    fiscalPeriodType: z.enum(["annual", "quarterly", "ttm", "ytd"]),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

const growthSchema = z.object({
    apiKey: apiKeySchema,
    fiscalPeriodType: z.enum(["annual", "quarterly", "ttm", "ytd"]),
    growthType: z.enum(["year_over_year", "quarter_over_quarter"]).optional(),
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

const cagrSchema = z.object({
    apiKey: apiKeySchema,
    identifier: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    periodYears: z.union([z.literal(3), z.literal(5), z.literal(10)]).optional(),
    sort: z.enum(["asc", "desc"]).optional(),
});

export const getStandardizedFinancials = createServerFn({ method: "GET" })
    .inputValidator(financialsSchema)
    .handler(async ({ data }): Promise<StandardizedFinancialsPresentationResponse> => {
        const {
            apiKey,
            fiscalPeriodType,
            identifier,
            limit = 8,
            offset = 0,
            sort = "desc",
            statement,
        } = data;

        const api = createApiClient(apiKey);

        const path = `/v1/standardized/${statement}/presentation` as const;

        const { data: res, error } = await api.GET(path, {
            params: {
                query: {
                    fiscal_period_type: fiscalPeriodType,
                    identifier,
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

export const getAsReportedFinancialsPresentation = createServerFn({ method: "GET" })
    .inputValidator(financialsSchema)
    .handler(async ({ data }): Promise<AsReportedFinancialsPresentationResponse> => {
        const {
            apiKey,
            fiscalPeriodType,
            identifier,
            limit = 8,
            offset = 0,
            sort = "desc",
            statement,
        } = data;

        const api = createApiClient(apiKey);

        const path = `/v1/as-reported/${statement}/presentation` as const;

        const { data: res, error } = await api.GET(path, {
            params: {
                query: {
                    fiscal_period_type: fiscalPeriodType,
                    identifier,
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

export const getSegmentedFinancials = createServerFn({ method: "GET" })
    .inputValidator(segmentedFinancialsSchema)
    .handler(async ({ data }): Promise<SegmentedFinancialsResponse> => {
        const {
            apiKey,
            fiscalPeriodType,
            identifier,
            limit = 8,
            offset = 0,
            segmentId,
            sort = "desc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/segmented-financials", {
            params: {
                query: {
                    fiscal_period_type: fiscalPeriodType,
                    identifier,
                    limit,
                    offset,
                    segment_id: segmentId,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

export const getFinancialRatios = createServerFn({ method: "GET" })
    .inputValidator(ratiosSchema)
    .handler(async ({ data }): Promise<FinancialRatiosResponse> => {
        const {
            apiKey,
            category,
            fiscalPeriodType,
            identifier,
            limit = 8,
            offset = 0,
            sort = "desc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/financial-metrics/ratios", {
            params: {
                query: {
                    category,
                    fiscal_period_type: fiscalPeriodType,
                    identifier,
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

export const getFinancialGrowth = createServerFn({ method: "GET" })
    .inputValidator(growthSchema)
    .handler(async ({ data }): Promise<FinancialGrowthResponse> => {
        const {
            apiKey,
            fiscalPeriodType,
            growthType,
            identifier,
            limit = 8,
            offset = 0,
            sort = "desc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/financial-metrics/growth", {
            params: {
                query: {
                    fiscal_period_type: fiscalPeriodType,
                    growth_type: growthType,
                    identifier,
                    limit,
                    offset,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

export const getFinancialCagr = createServerFn({ method: "GET" })
    .inputValidator(cagrSchema)
    .handler(async ({ data }): Promise<FinancialCagrResponse> => {
        const {
            apiKey,
            identifier,
            limit = 8,
            offset = 0,
            periodYears,
            sort = "desc",
        } = data;

        const api = createApiClient(apiKey);

        const { data: res, error } = await api.GET("/v1/financial-metrics/cagr", {
            params: {
                query: {
                    identifier,
                    limit,
                    offset,
                    period_years: periodYears ? (String(periodYears) as "3" | "5" | "10") : undefined,
                    sort,
                },
            },
        });

        if (error) throw error;

        return res;
    });

// Earnings calls (IDA `/v1/earnings-calls/*`). The event selector picks one call: `eventId`,
// or `identifier` + `date` (New York day YYYY-MM-DD) / `year` + `quarter`.
const eventSelectorSchema = z.object({
    date: z.string().optional(),
    eventId: z.string().uuid().optional(),
    identifier: z.string().optional(),
    quarter: z.number().int().min(1).max(4).optional(),
    year: z.number().int().optional(),
});

type EventSelector = z.infer<typeof eventSelectorSchema>;

const toSelectorQuery = (s: EventSelector) => ({
    date: s.date,
    event_id: s.eventId,
    identifier: s.identifier,
    quarter: s.quarter,
    year: s.year,
});

const selectorInputSchema = eventSelectorSchema.extend({ apiKey: apiKeySchema });

const earningsCalendarSchema = z.object({
    apiKey: apiKeySchema,
    // `calendar` filters (2026-11): which day `from` / `to` select, and `calendar.status`. Omitted = the API defaults.
    calendarStatus: z.array(z.enum(["cancelled", "postponed", "reported", "confirmed", "announced", "estimated"])).optional(),
    dateKind: z.enum(["call", "report"]).optional(),
    eventType: z.enum(["earnings_call", "investor_day", "conference", "agm", "other", "all"]).optional(),
    exchange: z.string().optional(),
    from: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    session: z.enum(["bmo", "amc", "intraday"]).optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    status: z.array(z.enum(["estimated", "unconfirmed", "confirmed", "postponed", "cancelled"])).optional(),
    to: z.string().optional(),
});

export const getEarningsCalendar = createServerFn({ method: "GET" })
    .inputValidator(earningsCalendarSchema)
    .handler(async ({ data }): Promise<EarningsCalendarResponse> => {
        const { apiKey, calendarStatus, dateKind, eventType, exchange, from, limit, offset, session, sort, status, to } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/calendar", {
            params: {
                query: {
                    calendar_status: calendarStatus?.length ? calendarStatus : undefined,
                    date_kind: dateKind,
                    event_type: eventType,
                    exchange,
                    from,
                    limit,
                    offset,
                    session,
                    sort,
                    status,
                    to,
                },
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsEventsSchema = z.object({
    apiKey: apiKeySchema,
    eventType: z.enum(["earnings_call", "investor_day", "conference", "agm", "other", "all"]).optional(),
    from: z.string().optional(),
    identifier: z.string(),
    include: z.literal("observations").optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    to: z.string().optional(),
});

export const getEarningsEvents = createServerFn({ method: "GET" })
    .inputValidator(earningsEventsSchema)
    .handler(async ({ data }): Promise<EarningsEventsResponse> => {
        const { apiKey, eventType, from, identifier, include, limit, offset, sort, to } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/events", {
            params: {
                query: {
                    event_type: eventType,
                    from,
                    identifier,
                    include: include ? [include] : undefined,
                    limit,
                    offset,
                    sort,
                    to,
                },
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getEarningsLive = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema }))
    .handler(async ({ data }): Promise<EarningsLiveResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/live");

        if (error) throwApiError(error, response);

        return res;
    });

export const getEarningsEvent = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, eventId: z.string().uuid() }))
    .handler(async ({ data }): Promise<EarningsEventResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/event/{event_id}", {
            // The call header shows the call-time provenance (example app); the API omits it by default.
            params: { path: { event_id: data.eventId }, query: { include: ["observations"] } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsTranscriptSchema = selectorInputSchema.extend({
    asOf: z.string().optional(),
    format: z.enum(["text", "speakers", "words", "sections", "cleaned"]).optional(),
    version: z.number().int().optional(),
});

export const getEarningsTranscript = createServerFn({ method: "GET" })
    .inputValidator(earningsTranscriptSchema)
    .handler(async ({ data }): Promise<EarningsTranscriptResponse> => {
        const { apiKey, asOf, format, version } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/transcript", {
            params: { query: { ...toSelectorQuery(data), as_of: asOf, format, version } },
        });

        if (error) throwApiError(error, response);

        // `data` is JSON typed as `unknown` by the spec (see `JsonValue` in types.ts).
        return res as EarningsTranscriptResponse;
    });

export const getEarningsTranscriptVersions = createServerFn({ method: "GET" })
    .inputValidator(selectorInputSchema)
    .handler(async ({ data }): Promise<EarningsTranscriptVersionsResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/transcript/versions", {
            params: { query: toSelectorQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsTranscriptDiffSchema = selectorInputSchema.extend({
    from: z.number().int(),
    to: z.number().int().optional(),
});

export const getEarningsTranscriptDiff = createServerFn({ method: "GET" })
    .inputValidator(earningsTranscriptDiffSchema)
    .handler(async ({ data }): Promise<EarningsTranscriptDiffResponse> => {
        const { apiKey, from, to } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/transcript/diff", {
            params: { query: { ...toSelectorQuery(data), from, to } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsQaSchema = selectorInputSchema.extend({
    limit: z.number().optional(),
    offset: z.number().optional(),
});

export const getEarningsQa = createServerFn({ method: "GET" })
    .inputValidator(earningsQaSchema)
    .handler(async ({ data }): Promise<EarningsQaResponse> => {
        const { apiKey, limit, offset } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/qa", {
            params: { query: { ...toSelectorQuery(data), limit, offset } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsParticipantsSchema = selectorInputSchema.extend({
    include: z.literal("evidence").optional(),
});

export const getEarningsParticipants = createServerFn({ method: "GET" })
    .inputValidator(earningsParticipantsSchema)
    .handler(async ({ data }): Promise<EarningsParticipantsResponse> => {
        const { apiKey, include } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/participants", {
            params: { query: { ...toSelectorQuery(data), include: include ? [include] : undefined } },
        });

        if (error) throwApiError(error, response);

        // `detail` is JSON typed as `unknown` by the spec (see `JsonValue` in types.ts).
        return res as EarningsParticipantsResponse;
    });

const earningsPressReleaseSchema = selectorInputSchema.extend({
    include: z.literal("body").optional(),
});

export const getEarningsPressRelease = createServerFn({ method: "GET" })
    .inputValidator(earningsPressReleaseSchema)
    .handler(async ({ data }): Promise<EarningsPressReleaseResponse> => {
        const { apiKey, include } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/press-release", {
            params: { query: { ...toSelectorQuery(data), include: include ? [include] : undefined } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsExtractionsSchema = selectorInputSchema.extend({
    kind: z.enum(["guidance", "kpi"]).optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    review: z.enum(["approved", "auto", "all"]).optional(),
});

export const getEarningsExtractions = createServerFn({ method: "GET" })
    .inputValidator(earningsExtractionsSchema)
    .handler(async ({ data }): Promise<EarningsExtractionsResponse> => {
        const { apiKey, kind, limit, offset, review } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/extractions", {
            params: { query: { ...toSelectorQuery(data), kind, limit, offset, review } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsGuidanceHistorySchema = z.object({
    apiKey: apiKeySchema,
    basis: z.enum(["gaap", "non_gaap", "unknown"]).optional(),
    identifier: z.string(),
    limit: z.number().optional(),
    metric: z.string(),
    periodKind: z.enum(["quarter", "fiscal_year", "half", "other"]).optional(),
});

export const getEarningsGuidanceHistory = createServerFn({ method: "GET" })
    .inputValidator(earningsGuidanceHistorySchema)
    .handler(async ({ data }): Promise<EarningsGuidanceHistoryResponse> => {
        const { apiKey, basis, identifier, limit, metric, periodKind } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/guidance/history", {
            params: { query: { basis, identifier, limit, metric, period_kind: periodKind } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsDiffSchema = selectorInputSchema.extend({
    vs: z.literal("prior").optional(),
});

export const getEarningsDiff = createServerFn({ method: "GET" })
    .inputValidator(earningsDiffSchema)
    .handler(async ({ data }): Promise<EarningsDiffResponse> => {
        const { apiKey, vs } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/diff", {
            params: { query: { ...toSelectorQuery(data), vs } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getEarningsMetrics = createServerFn({ method: "GET" })
    .inputValidator(selectorInputSchema)
    .handler(async ({ data }): Promise<EarningsMetricsResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/metrics", {
            params: { query: toSelectorQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsProsodySchema = selectorInputSchema.extend({
    section: z.enum(["prepared", "qa", "all"]).optional(),
});

export const getEarningsProsody = createServerFn({ method: "GET" })
    .inputValidator(earningsProsodySchema)
    .handler(async ({ data }): Promise<EarningsProsodyResponse> => {
        const { apiKey, section } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/prosody", {
            params: { query: { ...toSelectorQuery(data), section } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getEarningsPriceAttribution = createServerFn({ method: "GET" })
    .inputValidator(selectorInputSchema)
    .handler(async ({ data }): Promise<EarningsPriceAttributionResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/price-attribution", {
            params: { query: toSelectorQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// Status-aware routes (audio, slides, documents, search, live stream): their pages render a
// state per status / code (`audio_unavailable`, `media_unavailable`, …), so they throw an
// ApiRequestError instead of the bare error body.
export const getEarningsAudio = createServerFn({ method: "GET" })
    .inputValidator(selectorInputSchema)
    .handler(async ({ data }): Promise<EarningsAudioResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/audio", {
            params: { query: toSelectorQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsSlidesSchema = selectorInputSchema.extend({
    include: z.literal("markdown").optional(),
    pages: z.string().optional(),
});

export const getEarningsSlides = createServerFn({ method: "GET" })
    .inputValidator(earningsSlidesSchema)
    .handler(async ({ data }): Promise<EarningsSlidesResponse> => {
        const { apiKey, include, pages } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/slides", {
            params: { query: { ...toSelectorQuery(data), include: include ? [include] : undefined, pages } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

const earningsDocumentsSchema = selectorInputSchema.extend({
    include: z.literal("body").optional(),
    kind: z.array(z.string()).optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
});

export const getEarningsDocuments = createServerFn({ method: "GET" })
    .inputValidator(earningsDocumentsSchema)
    .handler(async ({ data }): Promise<EarningsDocumentsResponse> => {
        const { apiKey, include, kind, limit, offset } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/documents", {
            params: {
                query: {
                    ...toSelectorQuery(data),
                    include: include ? [include] : undefined,
                    kind: kind?.length ? kind : undefined,
                    limit,
                    offset,
                },
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// Both search routes: `mode` = the exhaustive `SEARCH_MODES`; `case_sensitive` is the API's string enum (`mode=literal`
// only — the API answers 400 otherwise).
const searchModeSchema = z.enum(SEARCH_MODES);

const caseSensitiveSchema = z.enum(SEARCH_CASE_SENSITIVE_VALUES);

const earningsSearchSchema = z.object({
    apiKey: apiKeySchema,
    caseSensitive: caseSensitiveSchema.optional(),
    eventId: z.string().uuid().optional(),
    from: z.string().optional(),
    identifier: z.string().optional(),
    limit: z.number().optional(),
    mode: searchModeSchema.optional(),
    q: z.string().min(1),
    to: z.string().optional(),
    type: z.enum(["transcript", "qa", "preparedRemarks", "presentation"]).optional(),
});

export const getEarningsSearch = createServerFn({ method: "GET" })
    .inputValidator(earningsSearchSchema)
    .handler(async ({ data }): Promise<EarningsSearchResponse> => {
        const { apiKey, caseSensitive, eventId, from, identifier, limit, mode, q, to, type } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/search", {
            params: { query: { case_sensitive: caseSensitive, event_id: eventId, from, identifier, limit, mode, q, to, type } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// A company's IR documents outside its calls' folders (offset paging like the per-call documents).
const earningsCompanyDocumentsSchema = z.object({
    apiKey: apiKeySchema,
    category: z.array(z.enum(ASSET_GROUP_CATEGORIES)).optional(),
    eventId: z.string().uuid().optional(),
    identifier: z.string().min(1),
    include: z.array(z.enum(["calls"])).optional(),
    kind: z.array(z.string()).optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    section: z.array(z.string()).optional(),
    year: z.number().int().optional(),
});

export const getEarningsCompanyDocuments = createServerFn({ method: "GET" })
    .inputValidator(earningsCompanyDocumentsSchema)
    .handler(async ({ data }): Promise<EarningsCompanyDocumentsResponse> => {
        const { apiKey, category, eventId, identifier, include, kind, limit, offset, section, year } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/company-documents", {
            params: {
                query: {
                    category: category?.length ? category : undefined,
                    event_id: eventId,
                    identifier,
                    include: include?.length ? include : undefined,
                    kind: kind?.length ? kind : undefined,
                    limit,
                    offset,
                    section: section?.length ? section : undefined,
                    year,
                },
            },
        });

        if (error) throwApiError(error, response);

        return res as EarningsCompanyDocumentsResponse;
    });

export const getEarningsCompanyDocument = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, documentId: z.string().uuid(), pages: z.boolean().optional() }))
    .handler(async ({ data }): Promise<EarningsCompanyDocumentResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/company-documents/{document_id}", {
            params: { path: { document_id: data.documentId }, query: { include: data.pages ? ["pages"] : undefined } },
        });

        if (error) throwApiError(error, response);

        return res as EarningsCompanyDocumentResponse;
    });

const earningsDocumentSearchSchema = z.object({
    apiKey: apiKeySchema,
    caseSensitive: caseSensitiveSchema.optional(),
    identifier: z.string().optional(),
    kind: z.array(z.string()).optional(),
    limit: z.number().optional(),
    mode: searchModeSchema.optional(),
    q: z.string().min(1),
    section: z.array(z.string()).optional(),
    table: z.enum(["event_documents", "company_documents"]).optional(),
    year: z.number().int().optional(),
});

export const getEarningsDocumentSearch = createServerFn({ method: "GET" })
    .inputValidator(earningsDocumentSearchSchema)
    .handler(async ({ data }): Promise<EarningsDocumentSearchResponse> => {
        const { apiKey, caseSensitive, identifier, kind, limit, mode, q, section, table, year } = data;

        const api = createApiClient(apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/documents/search", {
            params: {
                query: {
                    case_sensitive: caseSensitive,
                    identifier,
                    kind: kind?.length ? kind : undefined,
                    limit,
                    mode,
                    q,
                    section: section?.length ? section : undefined,
                    table,
                    year,
                },
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getEarningsLiveStream = createServerFn({ method: "GET" })
    .inputValidator(selectorInputSchema)
    .handler(async ({ data }): Promise<EarningsLiveStreamResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/earnings-calls/live/stream", {
            params: { query: toSelectorQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// News (IDA /v1/news*, backend earnings tasks/inhouse-news-pipeline task 17)

const newsListSchema = z.object({
    apiKey: apiKeySchema,
    cursor: z.string().optional(),
    earnings: z.enum(["true", "false"]).optional(),
    from: z.string().optional(),
    /** Only items with media the API serves now (`media_count` > 0). */
    hasMedia: z.boolean().optional(),
    issuerCategory: z.array(z.string()).optional(),
    issuerTag: z.array(z.string()).optional(),
    kind: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    publicationType: z.array(z.string()).optional(),
    /** Publisher CIKs: items the company published itself (a verified issuer publication), not mentions. */
    publisher: z.array(z.string()).optional(),
    /** `market` = every company: `ticker` is not sent. */
    scope: z.enum(["company", "market"]),
    source: z.array(z.string()).optional(),
    ticker: z.string().optional(),
    to: z.string().optional(),
    topic: z.array(z.string()).optional(),
});

const listOrUndefined = (values: Array<string> | undefined) => (values?.length ? values : undefined);

export const getNewsList = createServerFn({ method: "GET" })
    .inputValidator(newsListSchema)
    .handler(async ({ data }): Promise<NewsListResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/news", {
            params: {
                query: {
                    cursor: data.cursor,
                    earnings: data.earnings,
                    from: data.from,
                    has_media: data.hasMedia ? "true" : undefined,
                    issuer_category: listOrUndefined(data.issuerCategory),
                    issuer_tag: listOrUndefined(data.issuerTag),
                    kind: listOrUndefined(data.kind),
                    limit: data.limit,
                    publication_type: listOrUndefined(data.publicationType),
                    publisher: listOrUndefined(data.publisher),
                    source: listOrUndefined(data.source),
                    ticker: data.scope === "company" && data.ticker ? [data.ticker] : undefined,
                    to: data.to,
                    topic: listOrUndefined(data.topic),
                },
            },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getNewsItem = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: z.string().uuid() }))
    .handler(async ({ data }): Promise<NewsItemResponse> => {
        const api = createApiClient(data.apiKey);

        // Both text forms: body_html renders the article, body_text is the fallback.
        const { data: res, error, response } = await api.GET("/v1/news/{id}", {
            params: { path: { id: data.id }, query: { body: "both" } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** A short-lived (≤ 60 s) URL of one news image / file: asked only on an explicit click, never cached. */
export const getNewsAssetDownload = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        assetId: z.string().uuid(),
        id: z.string().uuid(),
        /** `display` = an inline URL (an image, or a PDF viewed in the browser); `download` = an attachment. */
        purpose: z.enum(["display", "download"]),
    }))
    .handler(async ({ data }): Promise<NewsAssetDownloadResponse> => {
        const api = createApiClient(data.apiKey);

        const { data: res, error, response } = await api.GET("/v1/news/{id}/assets/{asset_id}/download", {
            params: { path: { asset_id: data.assetId, id: data.id }, query: { purpose: data.purpose } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

// The API base URL (not a secret) for the browser's own WebSocket to `/v1/ws` (task 8).
export const getApiBaseUrl = createServerFn({ method: "GET" })
    .handler((): { url: string } => ({ url: env.INVINITE_DATA_API_URL }));

// SEC document store (`/v1/sec/*`, STANDARD; 1 credit, search 100). 200 = ready / partial, 202 = pending (the same
// body, `readiness.status: "pending"`, not billed), 403 excluded / 404 unknown / 424 failed / 503 not_ready / 400 /
// 409 restart_required = `ApiRequestError` (`code` = the state, `reason` = the store's reason). Every nested object
// is JSON typed `unknown` by the spec (see `SecJson` in types.ts). The `/sec/v1/...` routes inside the answers
// (`documents_route`, `canonical.route`) are the store's own paths: never followed, the public calls are built here.

const cikSchema = z.string().trim().regex(/^\d{1,10}$/);

const cursorSchema = z.string().min(1).optional();

const secFilersSchema = z.object({
    apiKey: apiKeySchema,
    limit: z.number().int().min(1).max(100).optional(),
    name: z.string().trim().min(1).optional(),
    ticker: z.string().trim().min(1).optional(),
});

export const getSecFilers = createServerFn({ method: "GET" })
    .inputValidator(secFilersSchema)
    .handler(async ({ data }): Promise<SecFilersResponse> => {
        const { apiKey, limit, name, ticker } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/sec/filers", {
            params: { query: { limit, name, ticker } },
        });

        if (error) throwApiError(error, response);

        return res as SecFilersResponse;
    });

const secCikSchema = z.object({ apiKey: apiKeySchema, cik: cikSchema });

export const getSecFiler = createServerFn({ method: "GET" })
    .inputValidator(secCikSchema)
    .handler(async ({ data }): Promise<SecFilerResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/filers/{cik}", {
            params: { path: { cik: data.cik } },
        });

        if (error) throwApiError(error, response);

        return res as SecFilerResponse;
    });

export const getSecFilerLifecycle = createServerFn({ method: "GET" })
    .inputValidator(secCikSchema)
    .handler(async ({ data }): Promise<SecLifecycleResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/filers/{cik}/lifecycle", {
            params: { path: { cik: data.cik } },
        });

        if (error) throwApiError(error, response);

        return res as SecLifecycleResponse;
    });

const secFilingsSchema = z.object({
    apiKey: apiKeySchema,
    cursor: cursorSchema,
    form: z.string().trim().min(1).optional(),
    identifier: z.string().trim().min(1),
    limit: z.number().int().min(1).max(100).optional(),
    order: z.enum(["desc", "asc"]).optional(),
});

export const getSecFilings = createServerFn({ method: "GET" })
    .inputValidator(secFilingsSchema)
    .handler(async ({ data }): Promise<SecFilingsResponse> => {
        const { apiKey, cursor, form, identifier, limit, order } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/sec/filings", {
            params: { query: { cursor, form, identifier, limit, order } },
        });

        if (error) throwApiError(error, response);

        return res as SecFilingsResponse;
    });

const accessionSchema = z.string().trim().regex(/^(\d{10}-\d{2}-\d{6}|\d{18})$/);

export const getSecFilingManifest = createServerFn({ method: "GET" })
    .inputValidator(z.object({ accession: accessionSchema, apiKey: apiKeySchema }))
    .handler(async ({ data }): Promise<SecFilingManifestResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/filings/{accession}", {
            params: { path: { accession: data.accession } },
        });

        if (error) throwApiError(error, response);

        return res as SecFilingManifestResponse;
    });

// A block selection of one pinned version (`blocks` = `b00107` or `b00107-b00244`; `limit` ≤ 1000).
const blockSelectionSchema = z.object({
    blocks: z.string().regex(/^b\d+(-b\d+)?$/).optional(),
    footnotes: z.boolean().optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    neighbors: z.number().int().min(0).max(50).optional(),
});

type BlockSelection = z.infer<typeof blockSelectionSchema>;

const toBlockQuery = (selection: BlockSelection) => ({
    blocks: selection.blocks,
    footnotes: selection.footnotes === undefined ? undefined : selection.footnotes ? "true" as const : "false" as const,
    limit: selection.limit,
    neighbors: selection.neighbors,
});

/** A document of a filing by accession + filename: the store pins its head version (`version.version_id`). */
export const getSecDocument = createServerFn({ method: "GET" })
    .inputValidator(blockSelectionSchema.extend({
        accession: accessionSchema,
        apiKey: apiKeySchema,
        filename: z.string().trim().min(1).max(255),
    }))
    .handler(async ({ data }): Promise<SecDocumentResponse> => {
        const { accession, apiKey, filename } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/sec/documents/{accession}/{filename}", {
            params: { path: { accession, filename }, query: toBlockQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res as SecDocumentResponse;
    });

const versionIdSchema = z.uuid();

/** One immutable version (a citation's `version_id`): every block / neighbour / footnote stays in that version. */
export const getSecVersion = createServerFn({ method: "GET" })
    .inputValidator(blockSelectionSchema.extend({ apiKey: apiKeySchema, versionId: versionIdSchema }))
    .handler(async ({ data }): Promise<SecDocumentResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/versions/{version_id}", {
            params: { path: { version_id: data.versionId }, query: toBlockQuery(data) },
        });

        if (error) throwApiError(error, response);

        return res as SecDocumentResponse;
    });

export const getSecFigure = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, blockId: z.string().regex(/^b\d+$/), versionId: versionIdSchema }))
    .handler(async ({ data }): Promise<SecFigureResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/versions/{version_id}/figures/{block_id}", {
            params: { path: { block_id: data.blockId, version_id: data.versionId } },
        });

        if (error) throwApiError(error, response);

        return res as SecFigureResponse;
    });

export const getSecSections = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, outline: z.enum(["legacy", "generic"]).optional(), versionId: versionIdSchema }))
    .handler(async ({ data }): Promise<SecSectionsResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/versions/{version_id}/sections", {
            params: { path: { version_id: data.versionId }, query: { outline: data.outline } },
        });

        if (error) throwApiError(error, response);

        return res as SecSectionsResponse;
    });

const secSearchSchema = z.object({
    apiKey: apiKeySchema,
    caseSensitive: caseSensitiveSchema.optional(),
    cik: z.string().trim().regex(/^\d{1,10}(,\d{1,10})*$/).optional(),
    cursor: cursorSchema,
    form: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    mode: searchModeSchema.optional(),
    q: z.string().trim().min(1).max(500),
});

/** Ranked, cited passages (100 credits). `case_sensitive` is sent with `mode=literal` only (else the API answers 400). */
export const getSecSearch = createServerFn({ method: "GET" })
    .inputValidator(secSearchSchema)
    .handler(async ({ data }): Promise<SecSearchResponse> => {
        const { apiKey, caseSensitive, cik, cursor, form, limit, mode, q } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v1/sec/search", {
            params: {
                query: {
                    case_sensitive: mode === "literal" ? caseSensitive : undefined,
                    cik,
                    cursor,
                    form,
                    limit,
                    mode,
                    q,
                },
            },
        });

        if (error) throwApiError(error, response);

        return res as SecSearchResponse;
    });

const exportIdSchema = z.string().trim().regex(/^[\w.:-]{1,200}$/);

export const getSecExport = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, exportId: exportIdSchema }))
    .handler(async ({ data }): Promise<SecExportResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/exports/{export_id}", {
            params: { path: { export_id: data.exportId } },
        });

        if (error) throwApiError(error, response);

        return res as SecExportResponse;
    });

/** The largest export file the dashboard hands to the browser (base64 over the server-function boundary). */
export const SEC_EXPORT_FILE_MAX_BYTES = 25 * 1024 * 1024;

export type SecExportFile = { base64: string; contentType: string; filename: string; sha256: null | string; sizeBytes: number };

/**
 * A key-authorized export file: fetched here with the key, handed to the browser as bytes (never a URL carrying the
 * key). Over `SEC_EXPORT_FILE_MAX_BYTES` → `413 too_large` (the CLI's `sec export-file` streams any size).
 */
export const getSecExportFile = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, exportId: exportIdSchema }))
    .handler(async ({ data }): Promise<SecExportFile> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/exports/{export_id}/file", {
            params: { path: { export_id: data.exportId } },
            parseAs: "arrayBuffer",
        });

        if (error) throwApiError(error, response);

        if (res.byteLength > SEC_EXPORT_FILE_MAX_BYTES) {
            throwApiError({ error: "too_large", message: "This export is too large for the dashboard; download it with the CLI (sec export-file)." }, new Response(null, { status: 413 }));
        }

        return {
            base64: Buffer.from(res).toString("base64"),
            contentType: response.headers.get("content-type") ?? "application/gzip",
            filename: `${data.exportId}.csv.gz`,
            sha256: response.headers.get("x-content-sha256"),
            sizeBytes: res.byteLength,
        };
    });

/** A 13F manager's portfolio page (research holdings): provenance = `pinned_at`, `coverage`, `page_status`. */
export const getSecManagerPortfolio = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cik: cikSchema,
        limit: z.number().int().min(1).max(200).optional(),
        periodEnd: z.iso.date(),
    }))
    .handler(async ({ data }): Promise<SecManagerPortfolioResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v1/sec/holdings/managers/{cik}/portfolio", {
            params: { path: { cik: data.cik }, query: { limit: data.limit, period_end: data.periodEnd } },
        });

        if (error) throwApiError(error, response);

        return res as SecManagerPortfolioResponse;
    });
