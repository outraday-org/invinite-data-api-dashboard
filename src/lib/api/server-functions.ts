import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
    AsReportedFinancialsPresentationResponse,
    CompanyDetailsResponse,
    CompanyFiscalPeriod,
    CompanySearchResponse,
    FinancialCagrResponse,
    FinancialGrowthResponse,
    FinancialRatiosResponse,
    InsiderTradesResponse,
    InstitutionalHoldingsResponse,
    InstitutionalTransactionsResponse,
    InstitutionsResponse,
    IposResponse,
    SecDocumentResponse,
    SecExportResponse,
    SecFigureResponse,
    SecFilersResponse,
    SecFilingManifestResponse,
    SecFilingsResponse,
    SecManagerPortfolioResponse,
    SecSearchResponse,
    SecSectionsResponse,
    SegmentedFinancialsResponse,
    StandardizedFinancialsPresentationResponse,
    V2AnnouncementsResponse,
    V2AudioResponse,
    V2CompanyResponse,
    V2DateKind,
    V2DividendsResponse,
    V2DividendsSort,
    V2EventComparisonResponse,
    V2EventResponse,
    V2EventsResponse,
    V2EventsSort,
    V2EventStatsResponse,
    V2EventStatus,
    V2EventType,
    V2FilerResponse,
    V2GuidanceBasis,
    V2GuidancePeriodKind,
    V2GuidanceResponse,
    V2InvestorDocumentResponse,
    V2InvestorDocumentSearchResponse,
    V2InvestorDocumentsResponse,
    V2InvestorDocumentsSort,
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
    V2SlidesResponse,
    V2SplitsResponse,
    V2SplitsSort,
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
import { SEARCH_CASE_SENSITIVE_VALUES, SEARCH_MODES } from "../earnings/labels";
import { env } from "../env";
import { createApiClient } from "./client.server";
import { throwApiError } from "./errors";
import { V2_COMPANY_EXPANDS, V2_EVENT_EXPANDS, V2_FILER_EXPANDS, V2_SLIDES_INCLUDES, v2Expand, v2Query } from "./v2";

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

const fiscalPeriodsSchema = z.object({
    apiKey: apiKeySchema,
    identifier: z.string().trim().min(1),
});

/** Pages `/v1/company/fiscal-periods` stops after this many pages (100 periods each: 25 years of quarters ×4). */
const FISCAL_PERIOD_MAX_PAGES = 10;

/**
 * Every fiscal period of a company (`/v1/company/fiscal-periods`, all pages): the filings list labels a row's
 * `report_date` with its fiscal / calendar quarter by `period_end`. A company the financial data does not cover (a
 * pre-IPO CIK, 404) has none → [].
 */
export const getCompanyFiscalPeriods = createServerFn({ method: "GET" })
    .inputValidator(fiscalPeriodsSchema)
    .handler(async ({ data }): Promise<Array<CompanyFiscalPeriod>> => {
        const api = createApiClient(data.apiKey);

        const periods: Array<CompanyFiscalPeriod> = [];

        for (let page = 0; page < FISCAL_PERIOD_MAX_PAGES; page++) {
            const { data: res, error, response } = await api.GET("/v1/company/fiscal-periods", {
                params: { query: { identifier: data.identifier, limit: 100, offset: page * 100, sort: "desc" } },
            });

            if (response.status === 404) return periods;

            if (error) throwApiError(error, response);

            const company = res.companies.at(0);

            if (!company) break;

            periods.push(...company.periods);

            if (!company.next_url) break;
        }

        return periods;
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

// News (IDA /v2/news*, backend tasks/data-api-v2 task 8; the page since backend earnings inhouse-news-pipeline task 17)

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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/news", {
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
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/news/{id}", {
            params: { path: { id: data.id } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** Pages of a summary read at most (each up to 20,000 characters; a summary is far shorter). */
const NEWS_TEXT_MAX_PAGES = 10;

/**
 * `GET /v2/news/{id}/text`, every page (`next_cursor`; lead decision G2). The blocks of all pages are joined into one
 * answer.
 */
export const getV2NewsText = createServerFn({ method: "GET" })
    .inputValidator(newsItemInputSchema)
    .handler(async ({ data }): Promise<V2NewsText> => {
        const api = createApiClient(data.apiKey);

        let cursor: string | undefined;

        let joined: undefined | V2NewsText;

        for (let page = 0; page < NEWS_TEXT_MAX_PAGES; page += 1) {
            const { data: res, error, response } = await api.GET("/v2/news/{id}/text", {
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
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/announcements", {
            params: { query: v2Query({ item: data.item, limit: data.limit }) },
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

// Every search route: `mode` = the exhaustive `SEARCH_MODES`; `case_sensitive` (SEC search) is the API's string enum
// (`mode=literal` only — the API answers 400 otherwise).
const searchModeSchema = z.enum(SEARCH_MODES);

const caseSensitiveSchema = z.enum(SEARCH_CASE_SENSITIVE_VALUES);

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

// Data API v2 (`/v2/*`, backend tasks/data-api-v2 task 4). An unknown query parameter is a 400 `unknown_parameter`,
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
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/companies/{company}", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/dividends", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/splits", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/market-holidays", {
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
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/filers/{cik}", {
            params: { path: { cik: data.cik }, query: v2Query({ expand: v2Expand(data.expand) }) },
        });

        if (error) throwApiError(error, response);

        return res as V2FilerResponse;
    });

// Events family (`/v2/events*`, `/v2/guidance`, `/v2/kpis`, `/v2/investor-documents*`, `/v2/search/*`, backend
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

/** `GET /v2/events`: without `company` a calendar window (≤ 92 days; `status=live` alone needs none). */
export const getV2Events = createServerFn({ method: "GET" })
    .inputValidator(v2EventsSchema)
    .handler(async ({ data }): Promise<V2EventsResponse> => {
        const { apiKey, company, cursor, dateKind, expand, limit, scheduledAtGte, scheduledAtLte, sort, status, type } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/events", {
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
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}", {
            params: { path: { event_id: data.eventId }, query: v2Query({ expand: v2Expand(data.expand) }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2PressRelease = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2PressReleaseResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}/press-release", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Qa = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ cursor: cursorSchema, include: z.literal("scores").optional(), limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2QaResponse> => {
        const { apiKey, cursor, eventId, include, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/events/{event_id}/qa", {
            params: { path: { event_id: eventId }, query: v2Query({ cursor, include, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Slides = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ include: z.array(z.enum(V2_SLIDES_INCLUDES)).optional(), pages: z.string().trim().min(1).optional() }))
    .handler(async ({ data }): Promise<V2SlidesResponse> => {
        const { apiKey, eventId, include, pages } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/events/{event_id}/slides", {
            params: { path: { event_id: eventId }, query: v2Query({ include: v2Expand(include), pages }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Audio = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2AudioResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}/audio", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2LiveAudio = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2LiveAudioResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}/live-audio", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2EventStats = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2EventStatsResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}/stats", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The comparison with the previous call (the one the pipeline derives; `prior` is not sent). */
export const getV2EventComparison = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2EventComparisonResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}/comparison", {
            params: { path: { event_id: data.eventId } },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Prosody = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ section: z.enum(["prepared", "qa", "all"] as const satisfies ReadonlyArray<V2ProsodySection>).optional() }))
    .handler(async ({ data }): Promise<V2ProsodyResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}/prosody", {
            params: { path: { event_id: data.eventId }, query: v2Query({ section: data.section }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2PriceAttribution = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema)
    .handler(async ({ data }): Promise<V2PriceAttributionResponse> => {
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/events/{event_id}/price-attribution", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/events/{event_id}/transcript", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/events/{event_id}/transcript-text", {
            params: { path: { event_id: eventId }, query: v2Query({ split, version }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2TranscriptVersions = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ cursor: cursorSchema, limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2TranscriptVersionsResponse> => {
        const { apiKey, cursor, eventId, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/events/{event_id}/transcript-versions", {
            params: { path: { event_id: eventId }, query: v2Query({ cursor, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2TranscriptDiff = createServerFn({ method: "GET" })
    .inputValidator(eventInputSchema.extend({ from: z.number().int().min(1), to: z.number().int().min(1) }))
    .handler(async ({ data }): Promise<V2TranscriptDiffResponse> => {
        const { apiKey, eventId, from, to } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/events/{event_id}/transcript-diff", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/search/transcripts", {
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
 * `GET /v2/guidance` (`company` or `event`). Always `review=any`: the contract default `approved` matches no row
 * today (every item is `auto` or `needs_review`).
 */
export const getV2Guidance = createServerFn({ method: "GET" })
    .inputValidator(v2GuidanceSchema)
    .handler(async ({ data }): Promise<V2GuidanceResponse> => {
        const { apiKey, basis, company, cursor, event, limit, metric, periodKind, sort } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/guidance", {
            params: { query: v2Query({ basis, company, cursor, event, limit, metric, period_kind: periodKind, review: "any" as const, sort }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

export const getV2Kpis = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, event: eventIdSchema, limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2KpisResponse> => {
        const { apiKey, cursor, event, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/kpis", {
            params: { query: v2Query({ cursor, event, limit }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });

/** The speakers of one event (`/v2/participants?event=`), with the quotes each name was resolved from. */
export const getV2Participants = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, event: eventIdSchema, limit: v2LimitSchema }))
    .handler(async ({ data }): Promise<V2ParticipantsResponse> => {
        const { apiKey, cursor, event, limit } = data;

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/participants", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/investor-documents", {
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
        const { data: res, error, response } = await createApiClient(data.apiKey).GET("/v2/investor-documents/{document_id}", {
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

        const { data: res, error, response } = await createApiClient(apiKey).GET("/v2/search/investor-documents", {
            params: { query: v2Query({ company, kind: v2Expand(kind), limit, mode, q }) },
        });

        if (error) throwApiError(error, response);

        return res;
    });
