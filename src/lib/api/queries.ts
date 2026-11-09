import type { InfiniteData, UseQueryOptions } from "@tanstack/react-query";

import { queryOptions, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { AssetGroupCategory } from "@/lib/earnings/documents";

import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type {
    CagrPeriodYears,
    CompanyFiscalPeriod,
    FiscalPeriodType,
    GrowthType,
    RatioCategory,
    SearchMode,
    SecDocumentResponse,
    SecExportResponse,
    SecFigureResponse,
    SecFilersResponse,
    SecFilingManifestResponse,
    SecFilingsOrder,
    SecFilingsResponse,
    SecManagerPortfolioResponse,
    SecSearchCaseSensitive,
    SecSearchMode,
    SecSearchResponse,
    SecSectionsResponse,
    SegmentedFinancialsSegmentId,
    StatementType,
    V2AnnouncementsResponse,
    V2AudioResponse,
    V2CompanyExpand,
    V2CompanyResponse,
    V2DateKind,
    V2DividendsResponse,
    V2DividendsSort,
    V2DocumentFigureResponse,
    V2DocumentVersionResponse,
    V2Event,
    V2EventComparisonResponse,
    V2EventsResponse,
    V2EventsSort,
    V2EventStatsResponse,
    V2EventStatus,
    V2EventType,
    V2FilerExpand,
    V2FilerResponse,
    V2FilingDetailResponse,
    V2FilingExpand,
    V2FilingsResponse,
    V2FilingsSort,
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
    V2IpoStage,
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
    V2SlidesInclude,
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

import { ApiRequestError, errorDescription, rethrowApiError, retryUnlessApiError } from "./errors";
import {
    getApiBaseUrl,
    getAsReportedFinancialsPresentation,
    getCompanyDetails,
    getCompanyFiscalPeriods,
    getFinancialCagr,
    getFinancialGrowth,
    getFinancialRatios,
    getSecDocument,
    getSecExport,
    getSecExportFile,
    getSecFigure,
    getSecFilers,
    getSecFilingManifest,
    getSecFilings,
    getSecManagerPortfolio,
    getSecSearch,
    getSecSections,
    getSecVersion,
    getSegmentedFinancials,
    getStandardizedFinancials,
    getV2Announcements,
    getV2Audio,
    getV2Company,
    getV2Dividends,
    getV2DocumentFigure,
    getV2DocumentVersion,
    getV2Event,
    getV2EventComparison,
    getV2Events,
    getV2EventStats,
    getV2Filer,
    getV2Filing,
    getV2Filings,
    getV2Guidance,
    getV2HoldingChanges,
    getV2Holdings,
    getV2InsiderTrades,
    getV2InvestorDocument,
    getV2InvestorDocuments,
    getV2InvestorDocumentSearch,
    getV2Ipos,
    getV2Kpis,
    getV2LiveAudio,
    getV2MarketHolidays,
    getV2News,
    getV2NewsItem,
    getV2NewsText,
    getV2Participants,
    getV2PressRelease,
    getV2PriceAttribution,
    getV2Prosody,
    getV2Qa,
    getV2Slides,
    getV2Splits,
    getV2Transcript,
    getV2TranscriptDiff,
    getV2TranscriptSearch,
    getV2TranscriptText,
    getV2TranscriptVersions,
    searchCompanies,
} from "./server-functions";

function useApiKey() {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    return {
        apiKey,
        apiKeyUpdatedAt,
        hasHydrated,
    };
}

// Query options
export const companySearchOptions = (query: string) =>
    queryOptions({
        enabled: query.trim().length > 0,
        queryFn: () => searchCompanies({ data: { query } }),
        queryKey: ["company", "search", query],
        staleTime: 5 * 60 * 1000,
    });

export const companyDetailsOptions = (identifier: string) =>
    queryOptions({
        enabled: identifier.trim().length > 0,
        queryFn: () => getCompanyDetails({ data: { identifier } }),
        queryKey: ["company", "details", identifier],
        staleTime: 5 * 60 * 1000,
    });

type StandardizedFinancialsInput = {
    fiscalPeriodType: FiscalPeriodType;
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
    statement: StatementType;
};

export const standardizedFinancialsOptions = (input: StandardizedFinancialsInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getStandardizedFinancials({ data: input }),
        queryKey: [
            "standardized",
            input.statement,
            input.identifier,
            input.fiscalPeriodType,
            input.sort ?? "desc",
            input.limit ?? 8,
            input.offset ?? 0,
        ],
        staleTime: 5 * 60 * 1000,
    });

type AsReportedFinancialsPresentationInput = StandardizedFinancialsInput;

export const asReportedFinancialsPresentationOptions = (
    input: AsReportedFinancialsPresentationInput,
) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getAsReportedFinancialsPresentation({ data: input }),
        queryKey: [
            "as-reported",
            "presentation",
            input.statement,
            input.identifier,
            input.fiscalPeriodType,
            input.sort ?? "desc",
            input.limit ?? 8,
            input.offset ?? 0,
        ],
        staleTime: 5 * 60 * 1000,
    });

type SegmentedFinancialsInput = {
    fiscalPeriodType: FiscalPeriodType;
    identifier: string;
    limit?: number;
    offset?: number;
    segmentId?: SegmentedFinancialsSegmentId;
    sort?: "asc" | "desc";
};

type FinancialRatiosInput = {
    category?: RatioCategory;
    fiscalPeriodType: FiscalPeriodType;
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
};

type FinancialGrowthInput = {
    fiscalPeriodType: FiscalPeriodType;
    growthType?: GrowthType;
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
};

type FinancialCagrInput = {
    identifier: string;
    limit?: number;
    offset?: number;
    periodYears?: CagrPeriodYears;
    sort?: "asc" | "desc";
};

export const segmentedFinancialsOptions = (input: SegmentedFinancialsInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getSegmentedFinancials({ data: input }),
        queryKey: [
            "segmented-financials",
            input.identifier,
            input.fiscalPeriodType,
            input.segmentId ?? "all",
            input.sort ?? "desc",
            input.limit ?? 8,
            input.offset ?? 0,
        ],
        staleTime: 5 * 60 * 1000,
    });

export const financialRatiosOptions = (input: FinancialRatiosInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getFinancialRatios({ data: input }),
        queryKey: [
            "financial-metrics",
            "ratios",
            input.identifier,
            input.fiscalPeriodType,
            input.category ?? "all",
            input.sort ?? "desc",
            input.limit ?? 8,
            input.offset ?? 0,
        ],
        staleTime: 5 * 60 * 1000,
    });

export const financialGrowthOptions = (input: FinancialGrowthInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getFinancialGrowth({ data: input }),
        queryKey: [
            "financial-metrics",
            "growth",
            input.identifier,
            input.fiscalPeriodType,
            input.growthType ?? "all",
            input.sort ?? "desc",
            input.limit ?? 8,
            input.offset ?? 0,
        ],
        staleTime: 5 * 60 * 1000,
    });

export const financialCagrOptions = (input: FinancialCagrInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getFinancialCagr({ data: input }),
        queryKey: [
            "financial-metrics",
            "cagr",
            input.identifier,
            input.periodYears ?? "all",
            input.sort ?? "desc",
            input.limit ?? 8,
            input.offset ?? 0,
        ],
        staleTime: 5 * 60 * 1000,
    });

// Helper to show error toast (a v2 problem's request id appended: `errorDescription`)
function useErrorToast(error: Error | null, message: string) {
    React.useEffect(() => {
        if (error) {
            toast.error(message, {
                description: errorDescription(error),
            });
        }
    }, [error, message]);
}

/** The toast's error: none when the hook keeps quiet (`errorMessage: null`) or the API's status is a page state. */
function toastableError(error: Error | null, errorMessage: null | string, quietStatuses: ReadonlyArray<number> = []) {
    if (errorMessage === null) return null;

    return error instanceof ApiRequestError && quietStatuses.includes(error.status) ? null : error;
}

// Hooks with error handling
export function useCompanySearch(query: string) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...companySearchOptions(query),
            enabled: hasHydrated && query.trim().length > 0,
            queryFn: () => searchCompanies({ data: { apiKey: apiKey ?? undefined, query } }),
            queryKey: [...companySearchOptions(query).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to search companies");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useCompanyDetails(identifier: string) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...companyDetailsOptions(identifier),
            enabled: hasHydrated && identifier.trim().length > 0,
            queryFn: () =>
                getCompanyDetails({ data: { apiKey: apiKey ?? undefined, identifier } }),
            queryKey: [...companyDetailsOptions(identifier).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load company details");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useStandardizedFinancials(input: StandardizedFinancialsInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...standardizedFinancialsOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getStandardizedFinancials({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [...standardizedFinancialsOptions(input).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load financials");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useAsReportedFinancialsPresentation(
    input: AsReportedFinancialsPresentationInput,
) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...asReportedFinancialsPresentationOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getAsReportedFinancialsPresentation({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [
                ...asReportedFinancialsPresentationOptions(input).queryKey,
                String(apiKeyUpdatedAt),
            ],
        }),
    );

    useErrorToast(result.error, "Failed to load as-reported financials");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useSegmentedFinancials(input: SegmentedFinancialsInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...segmentedFinancialsOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getSegmentedFinancials({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [...segmentedFinancialsOptions(input).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load segmented financials");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useFinancialRatios(input: FinancialRatiosInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...financialRatiosOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getFinancialRatios({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [...financialRatiosOptions(input).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load financial ratios");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useFinancialGrowth(input: FinancialGrowthInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...financialGrowthOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getFinancialGrowth({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [...financialGrowthOptions(input).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load growth financials");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useFinancialCagr(input: FinancialCagrInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...financialCagrOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getFinancialCagr({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [...financialCagrOptions(input).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load CAGR financials");

    return {
        ...result,
        data: result.data ?? null,
    };
}

// Shared hook shapes (the earnings family began on v1; every status-aware hook uses them)

const EARNINGS_LIST_STALE_MS = 60 * 1000;

const EARNINGS_EVENT_STALE_MS = 10 * 60 * 1000;

type EarningsQueryExtras<T> = Pick<
    UseQueryOptions<T, Error, T, ReadonlyArray<unknown>>,
    "gcTime" | "refetchInterval" | "retry"
>;

/**
 * Shared shape of the earnings hooks. Every earnings server function throws an
 * `ApiRequestError` (`throwApiError`), revived here by `rethrowApiError`, and an API answer is
 * never retried (`retryUnlessApiError`). `errorMessage: null` = status-aware: no toast, the
 * page classifies `error` (`status`, `code`); a string = toast with that title, except for an
 * `ApiRequestError` whose status is in `quietStatuses` (a page state, e.g. 404 "No transcript").
 */
function useEarningsQuery<T>(options: EarningsQueryExtras<T> & {
    enabled: boolean;
    errorMessage: null | string;
    load: (apiKey: string | undefined) => Promise<T>;
    queryKey: ReadonlyArray<unknown>;
    quietStatuses?: ReadonlyArray<number>;
    staleTime: number;
}) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const { enabled, errorMessage, load, queryKey, quietStatuses, ...rest } = options;

    const result = useQuery<T, Error, T, ReadonlyArray<unknown>>({
        ...rest,
        enabled: hasHydrated && enabled,
        queryFn: () => load(apiKey ?? undefined).catch(rethrowApiError),
        queryKey: [...queryKey, String(apiKeyUpdatedAt)],
        retry: rest.retry ?? retryUnlessApiError,
    });

    useErrorToast(toastableError(result.error, errorMessage, quietStatuses), errorMessage ?? "");

    return {
        ...result,
        data: result.data ?? null,
    };
}

/** The next page's cursor of a v2-style list (`next_cursor`); undefined = the last page. */
const nextCursorOf = (lastPage: { next_cursor?: null | string }) => lastPage.next_cursor ?? undefined;

/**
 * The infinite twin of `useEarningsQuery` over a cursor list: the first page asks without a cursor, the next ones with
 * the last page's `next_cursor` (`/v2/news` pages by cursor with a pager instead: `useNewsPage`).
 */
function useEarningsInfinite<TPage extends { next_cursor?: null | string }>(options: {
    enabled: boolean;
    errorMessage: null | string;
    fetchPage: (cursor: null | string, apiKey: string | undefined) => Promise<TPage>;
    queryKey: ReadonlyArray<unknown>;
    quietStatuses?: ReadonlyArray<number>;
    /** Asked again while the loaded pages say so (e.g. `meta.coverage.state` pending: `refetchWhileCoveragePending`). */
    refetchInterval?: (query: { state: { data?: InfiniteData<TPage, null | string> } }) => false | number;
    staleTime: number;
}) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const { enabled, errorMessage, fetchPage, queryKey, quietStatuses, refetchInterval, staleTime } = options;

    const result = useInfiniteQuery<TPage, Error, InfiniteData<TPage, null | string>, ReadonlyArray<unknown>, null | string>({
        enabled: hasHydrated && enabled,
        getNextPageParam: nextCursorOf,
        initialPageParam: null,
        queryFn: ({ pageParam }) => fetchPage(pageParam, apiKey ?? undefined).catch(rethrowApiError),
        queryKey: [...queryKey, String(apiKeyUpdatedAt)],
        refetchInterval,
        retry: retryUnlessApiError,
        staleTime,
    });

    useErrorToast(toastableError(result.error, errorMessage, quietStatuses), errorMessage ?? "");

    return {
        ...result,
        data: result.data ?? null,
    };
}

// Pipeline capture states of a call that is (about to be) live or just ended without a transcript.
const LIVE_CAPTURE_STATUSES = new Set(["armed", "captured", "capturing"]);

/** Whether a call may be live (or just ended) and not published yet: the call page then polls it. */
export function isEarningsEventLiveish(event: Pick<V2Event, "capture_status" | "has_transcript">) {
    return !event.has_transcript && LIVE_CAPTURE_STATUSES.has(event.capture_status);
}

// News (IDA `/v2/news*`, backend tasks/data-api-v2 task 8; the page since backend earnings inhouse-news-pipeline task 17)

export type NewsListInput = {
    /** The company (ticker): v2 lists a company's news only. */
    company: string;
    /** Day (`YYYY-MM-DD`, UTC): `published_at.gte` its midnight. */
    from?: string;
    kind?: Array<string>;
    limit: number;
    /** Day (`YYYY-MM-DD`, UTC), inclusive: `published_at.lt` the next midnight. */
    to?: string;
    topic?: Array<string>;
};

/** A UTC day's first instant; `next` = the following day's (an inclusive `to` day as an exclusive bound). */
export function dayStartInstant(day: string, next = false): string {
    const start = new Date(`${day}T00:00:00.000Z`);

    if (next) start.setUTCDate(start.getUTCDate() + 1);

    return start.toISOString();
}

/**
 * One page of a company's news, newest first, at the API's keyset cursor (`null` = the first page; the page's
 * `next_cursor` is the next one, an item published meanwhile never shifts a page). Without `from` / `to` the API pages
 * back through the company's whole history. Status-aware: the News page renders the plan / error state. A visited page
 * stays cached, so the pager's Previous does not refetch.
 */
export function useNewsPage(input: NewsListInput & { cursor: null | string }) {
    return useEarningsQuery<V2NewsListResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        load: apiKey =>
            getV2News({
                data: {
                    apiKey,
                    company: input.company,
                    cursor: input.cursor ?? undefined,
                    kind: input.kind,
                    limit: input.limit,
                    publishedAtGte: input.from ? dayStartInstant(input.from) : undefined,
                    publishedAtLt: input.to ? dayStartInstant(input.to, true) : undefined,
                    topic: input.topic,
                },
            }),
        queryKey: [
            "news",
            "v2",
            "list",
            input.company,
            input.from ?? "",
            input.to ?? "",
            input.kind?.join(",") ?? "",
            input.topic?.join(",") ?? "",
            input.limit,
            input.cursor ?? "",
        ],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

/** One news item, the list row (STANDARD); a null id keeps it idle. Status-aware: 404 / plan are panel states. */
export function useNewsItem(id: null | string) {
    return useEarningsQuery<V2NewsItem>({
        enabled: Boolean(id),
        errorMessage: null,
        load: apiKey => getV2NewsItem({ data: { apiKey, id: id ?? "" } }),
        queryKey: ["news", "v2", "item", id ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Invinite's summary of an item in blocks, every page joined (STANDARD); a null id keeps it idle. */
export function useNewsText(id: null | string) {
    return useEarningsQuery<V2NewsText>({
        enabled: Boolean(id),
        errorMessage: null,
        load: apiKey => getV2NewsText({ data: { apiKey, id: id ?? "" } }),
        queryKey: ["news", "v2", "text", id ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** The announcements (v1 "developments") read from one item (STANDARD); a null id keeps it idle. */
export function useNewsAnnouncements(id: null | string) {
    return useEarningsQuery<V2AnnouncementsResponse>({
        enabled: Boolean(id),
        errorMessage: null,
        load: apiKey => getV2Announcements({ data: { apiKey, item: id ?? "", limit: 50 } }),
        queryKey: ["news", "v2", "announcements", id ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** The API base URL (not a secret) for the browser's own live-transcript WebSocket; asked once. */
export function useApiBaseUrl() {
    const result = useQuery({
        gcTime: Number.POSITIVE_INFINITY,
        queryFn: () => getApiBaseUrl(),
        queryKey: ["api-base-url"],
        staleTime: Number.POSITIVE_INFINITY,
    });

    return result.data?.url ?? null;
}

// SEC document store (`/v1/sec/*`). Every hook is status-aware (`errorMessage: null`, no toast): the readiness
// states are page states (`SecReadinessNotice`), never an empty result. A `202 pending` answer is asked again every
// 30 s (not billed) until the store has it.

const SEC_STALE_MS = 10 * 60 * 1000;

const SEC_PENDING_REFETCH_MS = 30 * 1000;

const refetchWhilePending = (query: { state: { data?: { readiness: { status: string } } } }) =>
    query.state.data?.readiness.status === "pending" ? SEC_PENDING_REFETCH_MS : false;

/** CIK / name lookup (`/v1/sec/filers`): idle until `name` (≥ 2 characters) or `ticker` is set. */
export function useSecFilers(input: { limit?: number; name?: string; ticker?: string }) {
    const name = input.name?.trim() ?? "";

    const ticker = input.ticker?.trim() ?? "";

    return useEarningsQuery<SecFilersResponse>({
        enabled: name.length >= 2 || ticker.length > 0,
        errorMessage: null,
        load: apiKey => getSecFilers({ data: { apiKey, limit: input.limit, name: name || undefined, ticker: ticker || undefined } }),
        queryKey: ["sec", "filers", name, ticker, input.limit ?? ""],
        refetchInterval: refetchWhilePending,
        staleTime: SEC_STALE_MS,
    });
}

/** One filer's filings (ticker or CIK), newest first by default, one page per `next_cursor`. */
export function useSecFilingsInfinite(input: { form?: string; identifier: string; limit?: number; order?: SecFilingsOrder }) {
    return useEarningsInfinite<SecFilingsResponse>({
        enabled: input.identifier.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getSecFilings({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["sec", "filings", input.identifier, input.form ?? "", input.order ?? "", input.limit ?? ""],
        staleTime: SEC_STALE_MS,
    });
}

/** Every fiscal period of a company, once per identifier: labels `/v1/sec/filings` rows by `report_date`. */
export function useCompanyFiscalPeriods(identifier: string) {
    return useEarningsQuery<Array<CompanyFiscalPeriod>>({
        enabled: identifier.trim().length > 0,
        errorMessage: null,
        load: apiKey => getCompanyFiscalPeriods({ data: { apiKey, identifier } }),
        queryKey: ["company", "fiscal-periods", identifier],
        staleTime: SEC_STALE_MS,
    });
}

/** A filing's document manifest; idle for a null accession (the panel is closed). */
export function useSecFilingManifest(accession: null | string) {
    return useEarningsQuery<SecFilingManifestResponse>({
        enabled: Boolean(accession),
        errorMessage: null,
        load: apiKey => getSecFilingManifest({ data: { accession: accession ?? "", apiKey } }),
        queryKey: ["sec", "filing", accession ?? ""],
        refetchInterval: refetchWhilePending,
        staleTime: SEC_STALE_MS,
    });
}

type SecBlockSelection = { blocks?: string; footnotes?: boolean; limit?: number; neighbors?: number };

/** What the reader shows: a document of a filing (its head version) or one pinned version (a citation). */
export type SecDocumentTarget
    = | { accession: string; filename: string; kind: "document" }
        | { kind: "version"; versionId: string };

const selectionKey = (s: SecBlockSelection) => [s.blocks ?? "", s.footnotes ?? "", s.limit ?? "", s.neighbors ?? ""] as const;

/** The selected blocks of a document / version; idle for a null target. */
export function useSecDocumentBlocks(target: null | SecDocumentTarget, selection: SecBlockSelection) {
    return useEarningsQuery<SecDocumentResponse>({
        enabled: target !== null,
        errorMessage: null,
        load: (apiKey) => {
            if (target?.kind === "version") return getSecVersion({ data: { ...selection, apiKey, versionId: target.versionId } });

            return getSecDocument({ data: { ...selection, accession: target?.accession ?? "", apiKey, filename: target?.filename ?? "" } });
        },
        queryKey: [
            "sec",
            "blocks",
            target?.kind ?? "",
            target?.kind === "version" ? target.versionId : `${target?.accession ?? ""}/${target?.filename ?? ""}`,
            ...selectionKey(selection),
        ],
        refetchInterval: refetchWhilePending,
        staleTime: SEC_STALE_MS,
    });
}

/** A figure of a pinned version (`image.url` = its permanent public image, or null). */
export function useSecFigure(target: null | { blockId: string; versionId: string }) {
    return useEarningsQuery<SecFigureResponse>({
        enabled: target !== null,
        errorMessage: null,
        load: apiKey => getSecFigure({ data: { apiKey, blockId: target?.blockId ?? "", versionId: target?.versionId ?? "" } }),
        queryKey: ["sec", "figure", target?.versionId ?? "", target?.blockId ?? ""],
        refetchInterval: refetchWhilePending,
        staleTime: SEC_STALE_MS,
    });
}

export function useSecSections(versionId: null | string) {
    return useEarningsQuery<SecSectionsResponse>({
        enabled: Boolean(versionId),
        errorMessage: null,
        load: apiKey => getSecSections({ data: { apiKey, versionId: versionId ?? "" } }),
        queryKey: ["sec", "sections", versionId ?? ""],
        refetchInterval: refetchWhilePending,
        staleTime: SEC_STALE_MS,
    });
}

export type SecSearchInput = {
    caseSensitive?: SecSearchCaseSensitive;
    cik?: string;
    form?: string;
    limit?: number;
    mode: SecSearchMode;
    q: string;
};

/** SEC filing search (100 credits a page): runs once `q` is set (on submit); "More results" follows `next_cursor`. */
export function useSecSearchInfinite(input: SecSearchInput) {
    return useEarningsInfinite<SecSearchResponse>({
        enabled: input.q.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getSecSearch({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: [
            "sec",
            "search",
            input.q,
            input.mode,
            input.mode === "literal" ? input.caseSensitive ?? "" : "",
            input.cik ?? "",
            input.form ?? "",
            input.limit ?? "",
        ],
        staleTime: SEC_STALE_MS,
    });
}

export function useSecExport(exportId: null | string) {
    return useEarningsQuery<SecExportResponse>({
        enabled: Boolean(exportId),
        errorMessage: null,
        load: apiKey => getSecExport({ data: { apiKey, exportId: exportId ?? "" } }),
        queryKey: ["sec", "export", exportId ?? ""],
        refetchInterval: refetchWhilePending,
        staleTime: SEC_STALE_MS,
    });
}

/** The export file as bytes from the server function (the key never reaches a URL); a MUTATION, run on a click. */
export function useSecExportFileDownload() {
    const apiKey = useApiKeyStore(s => s.apiKey);

    return useMutation({
        mutationFn: (exportId: string) => getSecExportFile({ data: { apiKey: apiKey ?? undefined, exportId } }).catch(rethrowApiError),
        retry: false,
    });
}

/** A 13F manager's portfolio page for one period end; idle for a null period (the CIK page asks on a click). */
export function useSecManagerPortfolio(cik: string, periodEnd: null | string) {
    return useEarningsQuery<SecManagerPortfolioResponse>({
        enabled: Boolean(periodEnd) && cik.length > 0,
        errorMessage: null,
        load: apiKey => getSecManagerPortfolio({ data: { apiKey, cik, limit: 25, periodEnd: periodEnd ?? "" } }),
        queryKey: ["sec", "portfolio", cik, periodEnd ?? ""],
        refetchInterval: refetchWhilePending,
        staleTime: SEC_STALE_MS,
    });
}

// Data API v2 (`/v2/*`, backend tasks/data-api-v2 task 4). Every hook revives the problem+json error
// (`ApiRequestError` with `code` / `requestId`) and never retries an API answer. The lists page by `next_cursor`
// (`useEarningsInfinite`: the cursor is the page param and never part of the key; the filters are, so a changed
// filter starts over at page 1 and never sends an old cursor = 400 `cursor_mismatch`).

const V2_STALE_MS = 10 * 60 * 1000;

/** One company (ticker or CIK), `expand: ["coverage"]` adds the data families and their `through` day. */
export function useV2Company(company: string, { expand = [] }: { expand?: ReadonlyArray<V2CompanyExpand> } = {}) {
    return useEarningsQuery<V2CompanyResponse>({
        enabled: company.trim().length > 0,
        errorMessage: "Failed to load company details",
        load: apiKey => getV2Company({ data: { apiKey, company, expand: [...expand] } }),
        queryKey: ["v2", "company", company, [...expand].sort().join(",")],
        quietStatuses: [404],
        staleTime: V2_STALE_MS,
    });
}

/** One filer by CIK with its expansions (status-aware: 403 excluded / 404 not_covered / 503 unavailable are states). */
export function useV2Filer(cik: string, expand: ReadonlyArray<V2FilerExpand> = []) {
    return useEarningsQuery<V2FilerResponse>({
        enabled: cik.length > 0,
        errorMessage: null,
        load: apiKey => getV2Filer({ data: { apiKey, cik, expand: [...expand] } }),
        queryKey: ["v2", "filer", cik, [...expand].sort().join(",")],
        staleTime: V2_STALE_MS,
    });
}

type V2DividendsInput = { company: string; exDateGte?: string; exDateLte?: string; limit?: number; sort?: V2DividendsSort };

export function useV2DividendsInfinite(input: V2DividendsInput) {
    return useEarningsInfinite<V2DividendsResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: "Failed to load dividends",
        fetchPage: (cursor, apiKey) => getV2Dividends({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "dividends", input.company, input.exDateGte ?? "", input.exDateLte ?? "", input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

type V2SplitsInput = { company: string; limit?: number; sort?: V2SplitsSort };

export function useV2SplitsInfinite(input: V2SplitsInput) {
    return useEarningsInfinite<V2SplitsResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: "Failed to load stock splits",
        fetchPage: (cursor, apiKey) => getV2Splits({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "splits", input.company, input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

type V2MarketHolidaysInput = { dateGte?: string; dateLte?: string; limit?: number; sort?: V2MarketHolidaysSort };

export function useV2MarketHolidaysInfinite(input: V2MarketHolidaysInput) {
    return useEarningsInfinite<V2MarketHolidaysResponse>({
        enabled: true,
        errorMessage: "Failed to load market holidays",
        fetchPage: (cursor, apiKey) => getV2MarketHolidays({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "market-holidays", input.dateGte ?? "", input.dateLte ?? "", input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

// Events family (`/v2/events*`, `/v2/guidance`, `/v2/kpis`, `/v2/participants`, `/v2/investor-documents*`,
// `/v2/search/*`, backend tasks/data-api-v2 task 7). Every per-event hook takes the event id ("" keeps it idle); a
// status-aware one (`errorMessage: null`) leaves 404 `not_found` ("not derived yet"), 403 `forbidden` (audio) and 503
// `unavailable` (media) to the page (`MediaState`).

const key = (values: ReadonlyArray<string> | undefined) => [...(values ?? [])].sort().join(",");

export type V2EventsInput = {
    company?: string;
    dateKind?: V2DateKind;
    /** `false` keeps the list idle. */
    enabled?: boolean;
    expand?: Array<"calendar">;
    limit: number;
    scheduledAtGte?: string;
    scheduledAtLte?: string;
    sort?: V2EventsSort;
    status?: Array<V2EventStatus>;
    /** Omitted = the API's default `earnings_call`; `all` = every event type. */
    type?: V2EventType;
};

/**
 * `GET /v2/events` by cursor: a company's events (`company`) or the calendar window (no company, ≤ 92 days). A 404
 * `not_covered` (company outside the coverage) is a page state, never a toast.
 */
export function useV2EventsInfinite(input: V2EventsInput) {
    const { enabled = true, ...query } = input;

    return useEarningsInfinite<V2EventsResponse>({
        enabled: enabled && (query.company === undefined || query.company.trim().length > 0),
        errorMessage: "Failed to load events",
        fetchPage: (cursor, apiKey) => getV2Events({ data: { ...query, apiKey, cursor: cursor ?? undefined } }),
        queryKey: [
            "v2",
            "events",
            query.company ?? "",
            query.type ?? "",
            key(query.status),
            query.scheduledAtGte ?? "",
            query.scheduledAtLte ?? "",
            query.dateKind ?? "",
            key(query.expand),
            query.sort ?? "",
            query.limit,
        ],
        quietStatuses: [404],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

/**
 * Events being captured right now (`status=live&type=all`, one page), refetched every 15 s. Status-aware (no toast: a
 * failing refetch would toast every 15 s; the strip shows a note). `enabled: false` keeps it idle.
 */
export function useV2LiveEvents(enabled = true) {
    return useEarningsQuery<V2EventsResponse>({
        enabled,
        errorMessage: null,
        load: apiKey => getV2Events({ data: { apiKey, limit: 200, status: ["live"], type: "all" } }),
        queryKey: ["v2", "events", "live"],
        refetchInterval: 15 * 1000,
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

/**
 * One event with its calendar semantics and call-time observations. Status-aware: the call page renders a 404 as
 * `NotFound`. Refetched every 30 s while the call is live or just ended without a transcript
 * (`isEarningsEventLiveish`), so the live player appears when capture starts and the Transcript tab lights up.
 */
export function useV2Event(eventId: string) {
    return useEarningsQuery<V2Event>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2Event({ data: { apiKey, eventId, expand: ["calendar", "observations"] } }),
        queryKey: ["v2", "event", eventId],
        refetchInterval: query => (query.state.data && isEarningsEventLiveish(query.state.data) ? 30 * 1000 : false),
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type V2TranscriptInput = { eventId: string; layer?: V2TranscriptLayer; version?: number; words?: boolean };

/** The turns of a version. Status-aware: a 404 is a state (no cleaned layer for this version, no transcript yet). */
export function useV2Transcript(input: V2TranscriptInput) {
    return useEarningsQuery<V2TranscriptResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2Transcript({ data: { ...input, apiKey } }),
        queryKey: ["v2", "transcript", input.eventId, input.layer ?? "", input.version ?? "", input.words ?? false],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type V2TranscriptTextInput = { eventId: string; split?: V2TranscriptSplit; version?: number };

/** The transcript as text blocks (`split: "sections"` = prepared remarks + Q&A). Status-aware like the turns. */
export function useV2TranscriptText(input: V2TranscriptTextInput) {
    return useEarningsQuery<V2TranscriptTextResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2TranscriptText({ data: { ...input, apiKey } }),
        queryKey: ["v2", "transcript-text", input.eventId, input.split ?? "", input.version ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Every published version (one page of 200: a call has a handful). */
export function useV2TranscriptVersions(eventId: string) {
    return useEarningsQuery<V2TranscriptVersionsResponse>({
        enabled: eventId.length > 0,
        errorMessage: "Failed to load transcript versions",
        load: apiKey => getV2TranscriptVersions({ data: { apiKey, eventId, limit: 200 } }),
        queryKey: ["v2", "transcript-versions", eventId],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

export function useV2TranscriptDiff(input: { eventId: string; from: number; to: number }) {
    return useEarningsQuery<V2TranscriptDiffResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: "Failed to compare transcript versions",
        load: apiKey => getV2TranscriptDiff({ data: { ...input, apiKey } }),
        queryKey: ["v2", "transcript-diff", input.eventId, input.from, input.to],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

export function useV2QaInfinite(input: { eventId: string; limit: number }) {
    return useEarningsInfinite<V2QaResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: "Failed to load Q&A",
        fetchPage: (cursor, apiKey) => getV2Qa({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "qa", input.eventId, input.limit],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** The speakers of one event (one page of 200), each with the quotes its name was resolved from. */
export function useV2Participants(eventId: string) {
    return useEarningsQuery<V2ParticipantsResponse>({
        enabled: eventId.length > 0,
        errorMessage: "Failed to load participants",
        load: apiKey => getV2Participants({ data: { apiKey, event: eventId, limit: 200 } }),
        queryKey: ["v2", "participants", eventId],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Status-aware: a 404 = no press release stored for this event. The body is always in the answer. */
export function useV2PressRelease(eventId: string) {
    return useEarningsQuery<V2PressReleaseResponse>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2PressRelease({ data: { apiKey, eventId } }),
        queryKey: ["v2", "press-release", eventId],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

export type V2GuidanceInput = {
    basis?: V2GuidanceBasis;
    company?: string;
    /** The event id (one call's guidance). */
    event?: string;
    limit: number;
    metric?: string;
    periodKind?: V2GuidancePeriodKind;
    sort?: "-conference_date" | "conference_date";
};

/** Guidance items of one event or one company (a metric's history); every review state (`review=any`). */
export function useV2GuidanceInfinite(input: V2GuidanceInput) {
    return useEarningsInfinite<V2GuidanceResponse>({
        enabled: Boolean(input.event || input.company?.trim()),
        errorMessage: "Failed to load guidance",
        fetchPage: (cursor, apiKey) => getV2Guidance({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: [
            "v2",
            "guidance",
            input.event ?? "",
            input.company ?? "",
            input.metric ?? "",
            input.periodKind ?? "",
            input.basis ?? "",
            input.sort ?? "",
            input.limit,
        ],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

export function useV2KpisInfinite(input: { eventId: string; limit: number }) {
    return useEarningsInfinite<V2KpisResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: "Failed to load KPIs",
        fetchPage: (cursor, apiKey) =>
            getV2Kpis({ data: { apiKey, cursor: cursor ?? undefined, event: input.eventId, limit: input.limit } }),
        queryKey: ["v2", "kpis", input.eventId, input.limit],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Status-aware: a 404 until the call's metrics are derived. */
export function useV2EventStats(eventId: string) {
    return useEarningsQuery<V2EventStatsResponse>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2EventStats({ data: { apiKey, eventId } }),
        queryKey: ["v2", "stats", eventId],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Status-aware: a 404 = first call on record / the comparison is not derived yet. */
export function useV2EventComparison(eventId: string) {
    return useEarningsQuery<V2EventComparisonResponse>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2EventComparison({ data: { apiKey, eventId } }),
        queryKey: ["v2", "comparison", eventId],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Status-aware: a 404 until the call's prosody is derived. */
export function useV2Prosody(input: { eventId: string; section?: V2ProsodySection }) {
    return useEarningsQuery<V2ProsodyResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2Prosody({ data: { ...input, apiKey } }),
        queryKey: ["v2", "prosody", input.eventId, input.section ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/**
 * Status-aware: a 404 until the first minute row exists. While the call is live (`live: true` — the caller passes
 * `isEarningsEventLiveish`) the minute rows grow once a minute: refetched every 60 s (same query key, so the live
 * player's seed and the Price moves tab share the answer).
 */
export function useV2PriceAttribution(eventId: string, { live = false }: { live?: boolean } = {}) {
    return useEarningsQuery<V2PriceAttributionResponse>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2PriceAttribution({ data: { apiKey, eventId } }),
        queryKey: ["v2", "price-attribution", eventId],
        refetchInterval: live ? 60 * 1000 : false,
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/**
 * The recording at its permanent public URL, in one request (no polling: an event without a servable recording
 * answers `403 forbidden`).
 */
export function useV2Audio(eventId: string) {
    return useEarningsQuery<V2AudioResponse>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2Audio({ data: { apiKey, eventId } }),
        queryKey: ["v2", "audio", eventId],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** The deck and its page images; `include` adds the player-slide `timeline` (opt-in in v2) and page `markdown`. */
export function useV2Slides(input: { eventId: string; include?: Array<V2SlidesInclude>; pages?: string }) {
    return useEarningsQuery<V2SlidesResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2Slides({ data: { ...input, apiKey } }),
        queryKey: ["v2", "slides", input.eventId, key(input.include), input.pages ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/**
 * The live HLS stream URL of an event (the live player). Never cached (`gcTime: 0`), never retried, never polled: ONE
 * call per live event view. The player asks again itself only for a fresh URL — once after a 403 (an expired token) and
 * before the loaded URL expires (it lives 2 h, so only a call longer than that). An empty id keeps it idle.
 */
export function useV2LiveAudio(eventId: string) {
    return useEarningsQuery<V2LiveAudioResponse>({
        enabled: eventId.length > 0,
        errorMessage: null,
        gcTime: 0,
        load: apiKey => getV2LiveAudio({ data: { apiKey, eventId } }),
        queryKey: ["v2", "live-audio", eventId],
        // At most ONE call per live event view (PRO, 5 credits each; lead decision 10, backend tasks/data-api-v2 task
        // 7): no polling while `not_started`, never stale (no refetch on window focus / remount). The only other call
        // is `refreshStream`'s one fresh URL after a 403 (an expired token).
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
    });
}

export type V2InvestorDocumentsInput = {
    category?: AssetGroupCategory;
    company?: string;
    /** The event id (one call's documents). */
    event?: string;
    fiscalYear?: number;
    kind?: Array<string>;
    limit?: number;
    sort?: V2InvestorDocumentsSort;
};

/** The IR library and every call's documents (`source: company | call`); status-aware (the pages render the error). */
export function useV2InvestorDocumentsInfinite(input: V2InvestorDocumentsInput) {
    return useEarningsInfinite<V2InvestorDocumentsResponse>({
        enabled: Boolean(input.event || input.company?.trim()),
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2InvestorDocuments({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: [
            "v2",
            "investor-documents",
            input.company ?? "",
            input.event ?? "",
            input.category ?? "",
            key(input.kind),
            input.fiscalYear ?? "",
            input.sort ?? "",
            input.limit ?? "",
        ],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

/** One document of either source; `pages` inlines the per-page text (≤ 2 MB) and the body. A null id keeps it idle. */
export function useV2InvestorDocument(documentId: null | string, { pages = false }: { pages?: boolean } = {}) {
    return useEarningsQuery<V2InvestorDocumentResponse>({
        enabled: Boolean(documentId),
        errorMessage: null,
        load: apiKey => getV2InvestorDocument({ data: { apiKey, documentId: documentId ?? "", pages } }),
        queryKey: ["v2", "investor-document", documentId ?? "", pages],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

export type V2TranscriptSearchInput = {
    company?: string;
    /** The event id ("Search this call"). */
    event?: string;
    limit?: number;
    mode?: SearchMode;
    q: string;
    type?: V2TranscriptSearchType;
};

/** "Search this call" (`AskThisCall`): runs once `q` is non-empty (set it on submit, not per keystroke). */
export function useV2TranscriptSearch(input: V2TranscriptSearchInput) {
    return useEarningsQuery<V2TranscriptSearchResponse>({
        enabled: input.q.trim().length > 0,
        errorMessage: null,
        load: apiKey => getV2TranscriptSearch({ data: { ...input, apiKey } }),
        queryKey: [
            "v2",
            "search-transcripts",
            input.q,
            input.mode ?? "",
            input.event ?? "",
            input.company ?? "",
            input.type ?? "",
            input.limit ?? "",
        ],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

export type V2InvestorDocumentSearchInput = { company?: string; kind?: Array<string>; limit?: number; mode?: SearchMode; q: string };

/** Document search (passages with page numbers): runs once `q` is non-empty (set it on submit). */
export function useV2InvestorDocumentSearch(input: V2InvestorDocumentSearchInput) {
    return useEarningsQuery<V2InvestorDocumentSearchResponse>({
        enabled: input.q.trim().length > 0,
        errorMessage: null,
        load: apiKey => getV2InvestorDocumentSearch({ data: { ...input, apiKey } }),
        queryKey: [
            "v2",
            "search-investor-documents",
            input.q,
            input.mode ?? "",
            input.company ?? "",
            key(input.kind),
            input.limit ?? "",
        ],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

// SEC family on v2 (`/v2/filings*`, `/v2/document-versions/*`, `/v2/holdings`, `/v2/holding-changes`,
// `/v2/insider-trades`, `/v2/ipos`, backend tasks/data-api-v2 task 6). Every hook is status-aware (`errorMessage:
// null`): 403 `excluded` / 404 `not_covered` / 503 `unavailable` and the plan gate are page states
// (`SecReadinessNotice`, `secErrorState`). A list whose first page says `meta.coverage.state: pending` (`data: []`)
// is asked again every 30 s until the store has it.

/** 30 s while the first loaded page's `meta.coverage.state` is `pending`, else no refetch. */
export function refetchWhileCoveragePending<TPage extends { meta: { coverage?: { state: string } } }>(
    query: { state: { data?: InfiniteData<TPage, null | string> } },
) {
    return query.state.data?.pages.at(0)?.meta.coverage?.state === "pending" ? SEC_PENDING_REFETCH_MS : false;
}

export type V2FilingsInput = {
    company: string;
    /** Forms (any of). */
    form?: Array<string>;
    /** Day (`YYYY-MM-DD`, UTC): `filed_at.gte` its midnight. */
    from?: string;
    limit?: number;
    sort?: V2FilingsSort;
    /** Day (`YYYY-MM-DD`, UTC), inclusive: `filed_at.lt` the next midnight. */
    to?: string;
};

/** A company's filings by cursor; `meta.form_facet` of the first page = the form picker. */
export function useV2FilingsInfinite(input: V2FilingsInput) {
    return useEarningsInfinite<V2FilingsResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Filings({
            data: {
                apiKey,
                company: input.company,
                cursor: cursor ?? undefined,
                filedAtGte: input.from ? dayStartInstant(input.from) : undefined,
                filedAtLt: input.to ? dayStartInstant(input.to, true) : undefined,
                form: input.form,
                limit: input.limit,
                sort: input.sort,
            },
        }),
        queryKey: ["v2", "filings", input.company, key(input.form), input.from ?? "", input.to ?? "", input.sort ?? "", input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** One filing's manifest with its expansions; idle for a null accession (the dialog is closed). */
export function useV2Filing(accession: null | string, expand: ReadonlyArray<V2FilingExpand> = []) {
    return useEarningsQuery<V2FilingDetailResponse>({
        enabled: Boolean(accession),
        errorMessage: null,
        load: apiKey => getV2Filing({ data: { accession: accession ?? "", apiKey, expand: [...expand] } }),
        queryKey: ["v2", "filing", accession ?? "", key(expand)],
        staleTime: SEC_STALE_MS,
    });
}

export type V2BlockSelection = { blocks?: string; footnotes?: boolean; neighbors?: number };

/** The selected blocks of one document version; idle for a null version id. */
export function useV2DocumentVersion(versionId: null | string, selection: V2BlockSelection) {
    return useEarningsQuery<V2DocumentVersionResponse>({
        enabled: Boolean(versionId),
        errorMessage: null,
        load: apiKey => getV2DocumentVersion({ data: { ...selection, apiKey, versionId: versionId ?? "" } }),
        queryKey: ["v2", "document-version", versionId ?? "", selection.blocks ?? "", selection.footnotes ?? "", selection.neighbors ?? ""],
        staleTime: SEC_STALE_MS,
    });
}

/** A figure of a document version (`image.url` = its permanent public image, or null). */
export function useV2DocumentFigure(target: null | { blockId: string; versionId: string }) {
    return useEarningsQuery<V2DocumentFigureResponse>({
        enabled: target !== null,
        errorMessage: null,
        load: apiKey => getV2DocumentFigure({ data: { apiKey, blockId: target?.blockId ?? "", versionId: target?.versionId ?? "" } }),
        queryKey: ["v2", "document-figure", target?.versionId ?? "", target?.blockId ?? ""],
        staleTime: SEC_STALE_MS,
    });
}

export type V2HoldingsInput = {
    accession?: string;
    company?: string;
    /** Manager CIK(s), comma list. */
    filer?: string;
    instruments?: V2HoldingsInstruments;
    limit?: number;
    /** Quarter end (`YYYY-MM-DD`); omitted = the server's newest quarter whose 13F deadline passed. */
    periodEnd?: string;
};

/** 13F positions by cursor; exactly one of `company` / `filer` / `accession` (none or several keeps it idle). */
export function useV2HoldingsInfinite(input: V2HoldingsInput) {
    const scopes = [input.company, input.filer, input.accession].filter(value => value && value.trim().length > 0);

    return useEarningsInfinite<V2HoldingsResponse>({
        enabled: scopes.length === 1,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Holdings({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: [
            "v2",
            "holdings",
            input.company ?? "",
            input.filer ?? "",
            input.accession ?? "",
            input.periodEnd ?? "",
            input.instruments ?? "",
            input.limit ?? "",
        ],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** A company's proven 13F position changes vs the prior quarter, by cursor (`period_end` omitted = the server's default). */
export function useV2HoldingChangesInfinite(input: { company: string; limit?: number; periodEnd?: string }) {
    return useEarningsInfinite<V2HoldingChangesResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2HoldingChanges({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "holding-changes", input.company, input.periodEnd ?? "", input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

export type V2InsiderTradesInput = {
    company: string;
    /** Day (`YYYY-MM-DD`, UTC): `filed_at.gte` its midnight. */
    from?: string;
    limit?: number;
    side?: V2InsiderSide;
    /** Day (`YYYY-MM-DD`, UTC), inclusive: `filed_at.lt` the next midnight. */
    to?: string;
};

/** A company's insider trades, newest filed first, by cursor. A 404 `not_covered` (none ever stored) is a page state. */
export function useV2InsiderTradesInfinite(input: V2InsiderTradesInput) {
    return useEarningsInfinite<V2InsiderTradesResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2InsiderTrades({
            data: {
                apiKey,
                company: input.company,
                cursor: cursor ?? undefined,
                filedAtGte: input.from ? dayStartInstant(input.from) : undefined,
                filedAtLt: input.to ? dayStartInstant(input.to, true) : undefined,
                limit: input.limit,
                side: input.side,
            },
        }),
        queryKey: ["v2", "insider-trades", input.company, input.side ?? "", input.from ?? "", input.to ?? "", input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

export type V2IposInput = { company?: string; limit?: number; sort?: V2IposSort; stage?: Array<V2IpoStage> };

/** Offerings by cursor (one row per offering: registration track + listing-calendar row). */
export function useV2IposInfinite(input: V2IposInput) {
    return useEarningsInfinite<V2IposResponse>({
        enabled: true,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Ipos({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "ipos", input.company ?? "", key(input.stage), input.sort ?? "", input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}
