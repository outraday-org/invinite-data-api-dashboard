import type { InfiniteData, UseQueryOptions } from "@tanstack/react-query";

import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { AssetGroupCategory } from "@/lib/earnings/documents";

import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type {
    CompanyFiscalPeriod,
    FiscalPeriodType,
    SearchMode,
    SecSearchMode,
    StatementType,
    V2AnnouncementsResponse,
    V2AnnouncementsSort,
    V2ApiStatus,
    V2AudioResponse,
    V2CagrHorizon,
    V2CagrResponse,
    V2CompaniesResponse,
    V2CompaniesSort,
    V2CompanyExpand,
    V2CompanyResponse,
    V2DatasetsResponse,
    V2DateKind,
    V2DisplaySign,
    V2DividendsResponse,
    V2DividendsSort,
    V2DocumentFigureResponse,
    V2DocumentKindCatalogResponse,
    V2DocumentSectionsResponse,
    V2DocumentVersionResponse,
    V2Event,
    V2EventComparisonResponse,
    V2EventsResponse,
    V2EventsSort,
    V2EventStatsResponse,
    V2EventStatus,
    V2EventType,
    V2EventTypeCatalogResponse,
    V2FactPlacesResponse,
    V2FactPlaceStatus,
    V2FactResponse,
    V2FilerExpand,
    V2FilerHoldingChangesResponse,
    V2FilerHoldingsResponse,
    V2FilerPhase,
    V2FilerResponse,
    V2FilersResponse,
    V2FilersSort,
    V2FilingDetailResponse,
    V2FilingExpand,
    V2FilingFactsResponse,
    V2FilingHoldingsResponse,
    V2FilingNotesResponse,
    V2FilingSearchResponse,
    V2FilingsResponse,
    V2FilingsSort,
    V2FinancialsBasis,
    V2FinancialsView,
    V2FormCatalogResponse,
    V2Fund,
    V2FundPositionsResponse,
    V2FundsResponse,
    V2FundsSort,
    V2FundStructure,
    V2FundType,
    V2FundWeightsResponse,
    V2GrowthBasis,
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
    V2InsiderTradeDetail,
    V2InsiderTradesResponse,
    V2InsiderTradesSort,
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
    V2IpoStage,
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
    V2NewsSearchField,
    V2NewsSearchResponse,
    V2NewsSort,
    V2NewsText,
    V2OfferingDetail,
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
    V2RatioCategory,
    V2RatiosResponse,
    V2ReviewChainResponse,
    V2ReviewDirection,
    V2SectionCatalogResponse,
    V2SectionOutline,
    V2SegmentsDetailedResponse,
    V2SegmentsResponse,
    V2SlidesInclude,
    V2SlidesResponse,
    V2SplitsResponse,
    V2SplitsSort,
    V2StatementsResponse,
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

import { ApiRequestError, errorDescription, isUnauthorized, rethrowApiError, retryUnlessApiError } from "./errors";
import {
    getApiBaseUrl,
    getApiLicensing,
    getApiStatus,
    getCompanies,
    getCompanyFiscalPeriods,
    getDocumentKindCatalog,
    getEventTypeCatalog,
    getFilerHoldingChanges,
    getFilerHoldings,
    getFormCatalog,
    getFund,
    getFundPositions,
    getFunds,
    getFundWeights,
    getHolderChanges,
    getHolders,
    getInsiderTrade,
    getInstrument,
    getInstruments,
    getIpo,
    getMappingRules,
    getMe,
    getMetricCatalog,
    getMyUsage,
    getOffering,
    getSectionCatalog,
    getV2Announcements,
    getV2AnnouncementsList,
    getV2AsReported,
    getV2AsReportedDetailed,
    getV2AsReportedPresentation,
    getV2Audio,
    getV2Cagr,
    getV2Company,
    getV2Datasets,
    getV2Dividends,
    getV2DocumentFigure,
    getV2DocumentSections,
    getV2DocumentVersion,
    getV2Event,
    getV2EventComparison,
    getV2Events,
    getV2EventStats,
    getV2Fact,
    getV2FactPlaces,
    getV2Filer,
    getV2Filers,
    getV2Filing,
    getV2FilingFacts,
    getV2FilingHoldings,
    getV2FilingNotes,
    getV2Filings,
    getV2FilingSearch,
    getV2Growth,
    getV2Guidance,
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
    getV2NewsSearch,
    getV2NewsText,
    getV2Offerings,
    getV2Participants,
    getV2People,
    getV2Person,
    getV2PersonParticipations,
    getV2PressRelease,
    getV2PriceAttribution,
    getV2Prosody,
    getV2Qa,
    getV2Ratios,
    getV2ReviewChain,
    getV2Segments,
    getV2SegmentsDetailed,
    getV2Slides,
    getV2Splits,
    getV2Standardized,
    getV2StandardizedDetailed,
    getV2StandardizedPresentation,
    getV2Transcript,
    getV2TranscriptDiff,
    getV2TranscriptSearch,
    getV2TranscriptText,
    getV2TranscriptVersions,
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

// Shared hook shapes (the earnings family began on v1; every status-aware hook uses them)

const EARNINGS_LIST_STALE_MS = 60 * 1000;

const EARNINGS_EVENT_STALE_MS = 10 * 60 * 1000;

type EarningsQueryExtras<T> = Pick<
    UseQueryOptions<T, Error, T, ReadonlyArray<unknown>>,
    "gcTime" | "placeholderData" | "refetchInterval" | "retry"
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
 * the last page's `next_cursor` (`/v1/news` pages by cursor with a pager instead: `useNewsPage`).
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

// News (IDA `/v1/news*`, backend tasks/data-api-v2 task 8; the page since backend earnings inhouse-news-pipeline task 17)

export type NewsListInput = {
    /** The company (ticker): v2 lists a company's news only. */
    company: string;
    /** An event id: the news linked to that call. */
    event?: string;
    /** Day (`YYYY-MM-DD`, UTC): `published_at.gte` its midnight. */
    from?: string;
    kind?: Array<string>;
    limit: number;
    /** Omitted = newest first. */
    sort?: V2NewsSort;
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
                    event: input.event,
                    kind: input.kind,
                    limit: input.limit,
                    publishedAtGte: input.from ? dayStartInstant(input.from) : undefined,
                    publishedAtLt: input.to ? dayStartInstant(input.to, true) : undefined,
                    sort: input.sort,
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
            input.event ?? "",
            input.sort ?? "",
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

// SEC family (filers, filing search; the filings / documents / holdings hooks are further down). Every hook is
// status-aware (`errorMessage: null`, no toast): 403 `excluded` / 404 `not_covered` / 503 `unavailable` are page
// states (`SecReadinessNotice`), never an empty result.

const SEC_STALE_MS = 10 * 60 * 1000;

const SEC_PENDING_REFETCH_MS = 30 * 1000;

/** The filer registry by name (`GET /v1/filers?q=`, one page of ≤ 50): idle until `q` has ≥ 2 characters. */
export function useV2Filers(input: { limit?: number; minLength?: number; phase?: V2FilerPhase; q: string }) {
    const q = input.q.trim();

    return useEarningsQuery<V2FilersResponse>({
        enabled: q.length >= (input.minLength ?? 2),
        errorMessage: null,
        load: apiKey => getV2Filers({ data: { apiKey, limit: input.limit, phase: input.phase, q } }),
        placeholderData: keepPreviousData,
        queryKey: ["v2", "filers", q, input.limit ?? "", input.phase ?? ""],
        staleTime: SEC_STALE_MS,
    });
}

/** Every fiscal period of a company, once per identifier: labels `/v1/filings` rows by `report_date`. */
export function useCompanyFiscalPeriods(identifier: string) {
    return useEarningsQuery<Array<CompanyFiscalPeriod>>({
        enabled: identifier.trim().length > 0,
        errorMessage: null,
        load: apiKey => getCompanyFiscalPeriods({ data: { apiKey, identifier } }),
        queryKey: ["company", "fiscal-periods", identifier],
        staleTime: SEC_STALE_MS,
    });
}

export type SecSearchInput = {
    /** `mode=literal` only. */
    caseSensitive?: boolean;
    form?: string;
    /** Day (`YYYY-MM-DD`), inclusive: `filed_at.gte`. */
    from?: string;
    /** Section ids, comma list. */
    item?: string;
    limit?: number;
    /** true = search every filer when `symbol` is empty (`meta.index.matches` caps the read); else no symbol = no request. */
    marketWide?: boolean;
    mode: SecSearchMode;
    q: string;
    /** Ticker, fund key or CIK; empty = no request unless `marketWide` (a company's search stays scoped to it). */
    symbol: string;
    /** Day (`YYYY-MM-DD`), inclusive: `filed_at.lte`. */
    to?: string;
};

/** SEC filing search (`GET /v1/search/filings`): runs once `q` and `symbol` (or `marketWide`) are set (on submit); "More results" follows `next_cursor`. */
export function useV2FilingSearchInfinite(input: SecSearchInput) {
    const symbol = input.symbol.trim();

    return useEarningsInfinite<V2FilingSearchResponse>({
        enabled: input.q.trim().length > 0 && (symbol.length > 0 || input.marketWide === true),
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2FilingSearch({
            data: {
                apiKey,
                caseSensitive: input.caseSensitive,
                cursor: cursor ?? undefined,
                filedFrom: input.from,
                filedTo: input.to,
                form: input.form,
                item: input.item,
                limit: input.limit,
                mode: input.mode,
                q: input.q,
                symbol: symbol || undefined,
            },
        }),
        queryKey: [
            "v2",
            "search-filings",
            input.q,
            input.mode,
            input.mode === "literal" ? String(input.caseSensitive ?? "") : "",
            input.symbol,
            input.form ?? "",
            input.limit ?? "",
            input.item ?? "",
            input.from ?? "",
            input.to ?? "",
        ],
        staleTime: SEC_STALE_MS,
    });
}

// Data API (`/v1/*`, the redesigned contract of backend tasks/data-api-v2, served under `/v1` since task 12). Every hook revives the problem+json error
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

/** Instrument search (`GET /v1/instruments?q=`, one page of 10): idle for an empty query; a failure toasts. */
export function useInstrumentSearch(query: string, type?: ReadonlyArray<V2InstrumentType>) {
    const q = query.trim();

    return useEarningsQuery<V2InstrumentsResponse>({
        enabled: q.length > 0,
        errorMessage: "Failed to search instruments",
        load: apiKey => getInstruments({ data: { apiKey, query: q, type: type ? [...type] : undefined } }),
        // The previous hits stay while the next query loads (the search list does not flash empty).
        placeholderData: keepPreviousData,
        queryKey: ["v2", "instruments", "search", q, key(type)],
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * One instrument (type, structure, company / fund link, `datasets`): the layout reads it once per symbol and every
 * page under it shares the answer. Status-aware: 404 `not_covered` = the symbol is not known (a page state).
 */
export function useInstrument(symbol: string) {
    return useEarningsQuery<V2Instrument>({
        enabled: symbol.trim().length > 0,
        errorMessage: null,
        load: apiKey => getInstrument({ data: { apiKey, symbol } }),
        queryKey: ["v2", "instrument", symbol.toUpperCase()],
        staleTime: V2_STALE_MS,
    });
}

export type FundsInput = { exchange?: string; limit?: number; q?: string; sort?: V2FundsSort; structure?: Array<V2FundStructure>; type?: Array<V2FundType> };

/** The listed funds by cursor (`GET /v1/funds`, filters `type` / `structure` / `q`). */
export function useFunds(input: FundsInput) {
    const q = input.q?.trim() || undefined;

    return useEarningsInfinite<V2FundsResponse>({
        enabled: true,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getFunds({
            data: { apiKey, cursor: cursor ?? undefined, exchange: input.exchange, limit: input.limit, q, sort: input.sort, structure: input.structure, type: input.type },
        }),
        queryKey: ["v2", "funds", q ?? "", key(input.type), key(input.structure), input.limit ?? "", input.exchange ?? "", input.sort ?? ""],
        staleTime: V2_STALE_MS,
    });
}

/** One fund's profile (ticker or fund key), `expand=coverage` when asked; idle for "" (a stock or an ETN never asks). */
export function useFund(fund: string, expand: ReadonlyArray<V2CompanyExpand> = []) {
    return useEarningsQuery<V2Fund>({
        enabled: fund.trim().length > 0,
        errorMessage: null,
        load: apiKey => getFund({ data: { apiKey, expand: [...expand], fund } }),
        queryKey: ["v2", "fund", fund.toUpperCase(), key(expand)],
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

type V2DividendsInput = { exDateGte?: string; exDateLte?: string; limit?: number; sort?: V2DividendsSort; symbol: string };

export function useV2DividendsInfinite(input: V2DividendsInput) {
    return useEarningsInfinite<V2DividendsResponse>({
        enabled: input.symbol.trim().length > 0,
        // The page renders the error (`ErrorState` in its table): no toast on top.
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Dividends({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "dividends", input.symbol, input.exDateGte ?? "", input.exDateLte ?? "", input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

type V2SplitsInput = { limit?: number; sort?: V2SplitsSort; symbol: string };

export function useV2SplitsInfinite(input: V2SplitsInput) {
    return useEarningsInfinite<V2SplitsResponse>({
        enabled: input.symbol.trim().length > 0,
        // The page renders the error (`ErrorState` in its table): no toast on top.
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Splits({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "splits", input.symbol, input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

type V2MarketHolidaysInput = { dateGte?: string; dateLte?: string; limit?: number; sort?: V2MarketHolidaysSort };

export function useV2MarketHolidaysInfinite(input: V2MarketHolidaysInput) {
    return useEarningsInfinite<V2MarketHolidaysResponse>({
        enabled: true,
        // The page renders the error (`ErrorState` in its table): no toast on top.
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2MarketHolidays({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "market-holidays", input.dateGte ?? "", input.dateLte ?? "", input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

// Events family (`/v1/events*`, `/v1/guidance`, `/v1/kpis`, `/v1/participants`, `/v1/investor-documents*`,
// `/v1/search/*`, backend tasks/data-api-v2 task 7). Every per-event hook takes the event id ("" keeps it idle); a
// status-aware one (`errorMessage: null`) leaves 404 `not_found` ("not derived yet"), 403 `forbidden` (audio) and 503
// `unavailable` (media) to the page (`MediaState`).

const key = (values: ReadonlyArray<string> | undefined) => [...(values ?? [])].sort().join(",");

export type V2EventsInput = {
    company?: string;
    dateKind?: V2DateKind;
    /** `false` keeps the list idle. */
    enabled?: boolean;
    expand?: Array<"calendar">;
    fiscalQuarter?: number;
    fiscalYear?: number;
    limit: number;
    scheduledAtGte?: string;
    scheduledAtLte?: string;
    sort?: V2EventsSort;
    status?: Array<V2EventStatus>;
    /** `false` when the page renders the error itself (calendar, calls list): no toast on top. Default true. */
    toastErrors?: boolean;
    /** Omitted = the API's default `earnings_call`; `all` = every event type. */
    type?: V2EventType;
};

/**
 * `GET /v1/events` by cursor: a company's events (`company`) or the calendar window (no company, ≤ 92 days). A 404
 * `not_covered` (company outside the coverage) is a page state, never a toast.
 */
export function useV2EventsInfinite(input: V2EventsInput) {
    const { enabled = true, toastErrors = true, ...query } = input;

    return useEarningsInfinite<V2EventsResponse>({
        enabled: enabled && (query.company === undefined || query.company.trim().length > 0),
        errorMessage: toastErrors ? "Failed to load events" : null,
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
            query.fiscalYear ?? "",
            query.fiscalQuarter ?? "",
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
 * `refetchInterval` (the call page, O4) decides when that rule does not poll: a call this page saw live keeps polling
 * until its recording is published (`has_audio`), which can come after `has_transcript`.
 */
export function useV2Event(eventId: string, options?: { refetchInterval?: (event: V2Event) => false | number }) {
    return useEarningsQuery<V2Event>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2Event({ data: { apiKey, eventId, expand: ["calendar", "observations"] } }),
        queryKey: ["v2", "event", eventId],
        refetchInterval: (query) => {
            const event = query.state.data;

            if (!event) return false;

            return isEarningsEventLiveish(event) ? 30 * 1000 : (options?.refetchInterval?.(event) ?? false);
        },
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

/** The Q&A pairs with their scores (`include=scores`: `scores` null while a pair is unscored). */
export function useV2QaInfinite(input: { eventId: string; limit: number }) {
    return useEarningsInfinite<V2QaResponse>({
        enabled: input.eventId.length > 0,
        errorMessage: "Failed to load Q&A",
        fetchPage: (cursor, apiKey) => getV2Qa({ data: { ...input, apiKey, cursor: cursor ?? undefined, include: "scores" } }),
        queryKey: ["v2", "qa", input.eventId, input.limit, "scores"],
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

/**
 * Status-aware: a 404 = first call on record / the comparison is not derived yet / `prior` is not the derived previous
 * call (the `detail` names it). `prior` absent = the API's default (the previous call).
 */
export function useV2EventComparison(eventId: string, prior?: string) {
    return useEarningsQuery<V2EventComparisonResponse>({
        enabled: eventId.length > 0,
        errorMessage: null,
        load: apiKey => getV2EventComparison({ data: { apiKey, eventId, prior } }),
        queryKey: ["v2", "comparison", eventId, prior ?? ""],
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
    /** The call-date window (days); none without a company or event = the API's last 365 days. */
    conferenceDateGte?: string;
    conferenceDateLte?: string;
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
            input.conferenceDateGte ?? "",
            input.conferenceDateLte ?? "",
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

// SEC family on v2 (`/v1/filings*`, `/v1/document-versions/*`, `/v1/holders`, `/v1/holder-changes`,
// `/v1/insider-trades`, `/v1/ipos`, backend tasks/data-api-v2 task 6). Every hook is status-aware (`errorMessage:
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
    /** Forms (any of). */
    form?: Array<string>;
    /** Day (`YYYY-MM-DD`), inclusive: `filed_at.gte` (the spec's `format: date`). */
    from?: string;
    /** 8-K items (any of). */
    items?: Array<string>;
    limit?: number;
    sort?: V2FilingsSort;
    /** Ticker of any instrument, a fund key or a company CIK (its primary listing). */
    symbol: string;
    /** Day (`YYYY-MM-DD`), inclusive: `filed_at.lte`. */
    to?: string;
};

/** An instrument's filings by cursor; `meta.form_facet` of the first page = the form picker. */
export function useV2FilingsInfinite(input: V2FilingsInput) {
    return useEarningsInfinite<V2FilingsResponse>({
        enabled: input.symbol.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Filings({
            data: {
                apiKey,
                cursor: cursor ?? undefined,
                filedFrom: input.from,
                filedTo: input.to,
                form: input.form,
                items: input.items,
                limit: input.limit,
                sort: input.sort,
                symbol: input.symbol,
            },
        }),
        queryKey: ["v2", "filings", input.symbol, key(input.form), input.from ?? "", input.to ?? "", input.sort ?? "", input.limit ?? "", key(input.items)],
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

export type HoldersInput = {
    instruments?: V2HoldersInstruments;
    limit?: number;
    /** 13F quarter end / N-PORT "latest report on or before" (`YYYY-MM-DD`); omitted = the server's default; never sent with `issuer_file`. */
    periodEnd?: string;
    /** One source's full list by cursor; omitted = the overview of all three (`meta.sections`, no cursor). */
    source?: V2HolderSource;
    /** ONE instrument: a stock's ticker or CIK, a fund's ticker or fund key; "" = idle. */
    symbol: string;
};

/** Who holds one instrument (`GET /v1/holders`): one source by cursor, or the overview (one page, `has_more` false). */
export function useHoldersInfinite(input: HoldersInput) {
    const periodEnd = input.source === "issuer_file" ? undefined : input.periodEnd;

    return useEarningsInfinite<V2HoldersResponse>({
        enabled: input.symbol.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getHolders({
            data: {
                apiKey,
                cursor: input.source ? (cursor ?? undefined) : undefined,
                instruments: input.instruments,
                limit: input.limit,
                periodEnd,
                source: input.source,
                symbol: input.symbol,
            },
        }),
        queryKey: ["v2", "holders", input.symbol, input.source ?? "overview", periodEnd ?? "", input.instruments ?? "", input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

export type HolderChangesInput = {
    /** Only these managers' changes (CIKs, 1–50). */
    filer?: Array<string>;
    limit?: number;
    periodEnd?: string;
    /** The quarter compared against (default the previous one). */
    priorPeriodEnd?: string;
    symbol: string;
    /** Omitted = every change but `unchanged`. */
    type?: Array<V2HolderChangeType>;
};

/** The proven 13F position changes of one security's holders vs the prior quarter, by cursor. */
export function useHolderChangesInfinite(input: HolderChangesInput) {
    return useEarningsInfinite<V2HolderChangesResponse>({
        enabled: input.symbol.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getHolderChanges({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "holder-changes", input.symbol, input.periodEnd ?? "", input.limit ?? "", key(input.type), key(input.filer), input.priorPeriodEnd ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** A 13F manager's portfolio by cursor (`GET /v1/filers/{cik}/holdings`); idle for "" (asked on a click). */
export function useFilerHoldingsInfinite(input: { cik: string; instruments?: V2HoldersInstruments; limit?: number; periodEnd?: string }) {
    return useEarningsInfinite<V2FilerHoldingsResponse>({
        enabled: input.cik.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getFilerHoldings({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "filer-holdings", input.cik, input.periodEnd ?? "", input.limit ?? "", input.instruments ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** A listed fund's composition by cursor (the freshest one, or the one stored on or before `asOf`); idle for "". */
export function useFundPositionsInfinite(input: { asOf?: string; fund: string; limit?: number }) {
    return useEarningsInfinite<V2FundPositionsResponse>({
        enabled: input.fund.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getFundPositions({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "fund-positions", input.fund.toUpperCase(), input.asOf ?? "", input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** A listed fund's sector / country / asset-class weights by cursor (the composition `useFundPositionsInfinite` shows). */
export function useFundWeightsInfinite(input: { asOf?: string; dimension?: string; fund: string; limit?: number }) {
    return useEarningsInfinite<V2FundWeightsResponse>({
        enabled: input.fund.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getFundWeights({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "fund-weights", input.fund.toUpperCase(), input.dimension ?? "", input.asOf ?? "", input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

export type V2InsiderTradesInput = {
    company: string;
    /** Day (`YYYY-MM-DD`): `filed_at.gte` (the spec's `format: date`; an instant is a 400, [FU2994]). */
    from?: string;
    /** true = derivative lines only, false = non-derivative only; omitted = both. */
    isDerivative?: boolean;
    limit?: number;
    side?: V2InsiderSide;
    sort?: V2InsiderTradesSort;
    /** Day (`YYYY-MM-DD`), inclusive: `filed_at.lte`. */
    to?: string;
    /** Days (`YYYY-MM-DD`), inclusive: `transaction_date.gte` / `.lte` (rows without a transaction date drop out). */
    tradedFrom?: string;
    tradedTo?: string;
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
                filedAtGte: input.from,
                filedAtLte: input.to,
                isDerivative: input.isDerivative,
                limit: input.limit,
                side: input.side,
                sort: input.sort,
                transactionDateGte: input.tradedFrom,
                transactionDateLte: input.tradedTo,
            },
        }),
        queryKey: [
            "v2",
            "insider-trades",
            input.company,
            input.side ?? "",
            input.from ?? "",
            input.to ?? "",
            input.limit ?? "",
            input.tradedFrom ?? "",
            input.tradedTo ?? "",
            input.isDerivative ?? "",
            input.sort ?? "",
        ],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

export type V2IposInput = {
    company?: string;
    isSpac?: boolean;
    limit?: number;
    /** `YYYY-MM-DD`: `listing_date.gte`. */
    listingDateGte?: string;
    /** `YYYY-MM-DD`: `listing_date.lte`. */
    listingDateLte?: string;
    sort?: V2IposSort;
    stage?: Array<V2IpoStage>;
};

/** Offerings by cursor (one row per offering: registration track + listing-calendar row). */
export function useV2IposInfinite(input: V2IposInput) {
    return useEarningsInfinite<V2IposResponse>({
        enabled: true,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Ipos({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: [
            "v2",
            "ipos",
            input.company ?? "",
            key(input.stage),
            input.sort ?? "",
            input.limit ?? "",
            String(input.isSpac ?? ""),
            input.listingDateGte ?? "",
            input.listingDateLte ?? "",
        ],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

export type OfferingsInput = {
    /** ONE issuer CIK or listed ticker; omitted = every offering (`/offerings`). */
    company?: string;
    enabled?: boolean;
    exemption?: string;
    /** Days (`YYYY-MM-DD`), inclusive: the latest filing's `filed_at.gte` / `.lte`. */
    filedFrom?: string;
    filedTo?: string;
    industry?: string;
    isAmendment?: boolean;
    limit?: number;
    /** USD: `total_sold.gte`. */
    totalSoldGte?: number;
};

/** Form D private offerings by cursor (a filer's with `company` = its CIK; every issuer's without); idle while `enabled` is false. */
export function useV2OfferingsInfinite(input: OfferingsInput) {
    const { enabled = true, filedFrom, filedTo, ...query } = input;

    return useEarningsInfinite<V2OfferingsResponse>({
        enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Offerings({ data: { ...query, apiKey, cursor: cursor ?? undefined, filedGte: filedFrom, filedLte: filedTo } }),
        queryKey: [
            "v2",
            "offerings",
            query.company ?? "",
            query.limit ?? "",
            filedFrom ?? "",
            filedTo ?? "",
            query.exemption ?? "",
            query.industry ?? "",
            query.isAmendment ?? "",
            query.totalSoldGte ?? "",
        ],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

// Financials + Metrics groups on v2 (`/v1/financials/*`, `/v1/metrics/*`, `/v1/segments*`, `/v1/facts/*`, backend
// tasks/data-api-v2 task 5). Status-aware (`errorMessage: null`): the plan gate of a PRO view (403 `plan_required`) and
// 404 `not_covered` are page states. A first page with `meta.coverage.state: pending` (`data: []`: the statement table
// is filled after a release) is asked again every 30 s.

const FINANCIALS_STALE_MS = 10 * 60 * 1000;

export type V2FinancialsInput = {
    /** Point in time (`YYYY-MM-DD`): the newest rendering filed on or before it. */
    asOf?: string;
    basis: V2FinancialsBasis;
    company: string;
    /** As-reported only (never sent on standardized: an unknown parameter is a 400). */
    displaySign?: V2DisplaySign;
    /** Accession: pin one filing's rendering. */
    filing?: string;
    /** `fiscal_year.gte` / `fiscal_year.lte`: the fiscal-year window. */
    fiscalYearGte?: number;
    fiscalYearLte?: number;
    limit?: number;
    period: FiscalPeriodType;
    /** As-reported only: drop Invinite-derived values. */
    reportedOnly?: boolean;
    /** Any of; omitted = all three. */
    statement?: Array<StatementType>;
    view: V2FinancialsView;
};

/** One page of the statement operation that `basis` × `view` names. */
function fetchStatementsPage(input: V2FinancialsInput, cursor: null | string, apiKey: string | undefined): Promise<V2StatementsResponse> {
    const base = {
        apiKey,
        asOf: input.asOf,
        company: input.company,
        cursor: cursor ?? undefined,
        filing: input.filing,
        fiscalYearGte: input.fiscalYearGte,
        fiscalYearLte: input.fiscalYearLte,
        limit: input.limit,
        period: input.period,
        statement: input.statement,
    };

    if (input.basis === "standardized") {
        switch (input.view) {
            case "detailed":
                return getV2StandardizedDetailed({ data: base });
            case "presentation":
                return getV2StandardizedPresentation({ data: base });
            case "summary":
                return getV2Standardized({ data: base });
        }
    }

    const data = { ...base, displaySign: input.displaySign, reportedOnly: input.reportedOnly };

    switch (input.view) {
        case "detailed":
            return getV2AsReportedDetailed({ data });
        case "presentation":
            return getV2AsReportedPresentation({ data });
        case "summary":
            return getV2AsReported({ data });
    }
}

/** A company's statements (one row per fiscal period, newest first) by cursor, in the basis × view's shape. */
export function useV2FinancialsInfinite(input: V2FinancialsInput) {
    const asReported = input.basis === "as-reported";

    return useEarningsInfinite<V2StatementsResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => fetchStatementsPage(input, cursor, apiKey),
        queryKey: [
            "v2",
            "financials",
            input.basis,
            input.view,
            input.company,
            key(input.statement),
            input.period,
            input.asOf ?? "",
            input.filing ?? "",
            asReported ? String(input.reportedOnly ?? "") : "",
            asReported ? input.displaySign ?? "" : "",
            input.limit ?? "",
            input.fiscalYearGte ?? "",
            input.fiscalYearLte ?? "",
        ],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: FINANCIALS_STALE_MS,
    });
}

type V2PeriodListInput = { company: string; fiscalYearGte?: number; fiscalYearLte?: number; limit?: number; period: FiscalPeriodType };

/** The fiscal-year window's query-key entries ("" = unset). */
const fiscalYearKey = (input: V2PeriodListInput) => [input.fiscalYearGte ?? "", input.fiscalYearLte ?? ""];

/** Ratios per period by cursor (`category` any of). */
export function useV2RatiosInfinite(input: V2PeriodListInput & { category?: Array<V2RatioCategory> }) {
    return useEarningsInfinite<V2RatiosResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Ratios({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "metrics", "ratios", input.company, input.period, key(input.category), input.limit ?? "", ...fiscalYearKey(input)],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: FINANCIALS_STALE_MS,
    });
}

/** Growth per period by cursor (`basis` omitted = both bases, one row each). */
export function useV2GrowthInfinite(input: V2PeriodListInput & { basis?: V2GrowthBasis }) {
    return useEarningsInfinite<V2GrowthResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Growth({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "metrics", "growth", input.company, input.period, input.basis ?? "", input.limit ?? "", ...fiscalYearKey(input)],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: FINANCIALS_STALE_MS,
    });
}

/** CAGR per period by cursor (`horizon` omitted = every horizon, one row each). */
export function useV2CagrInfinite(input: V2PeriodListInput & { horizon?: V2CagrHorizon }) {
    return useEarningsInfinite<V2CagrResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Cagr({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "metrics", "cagr", input.company, input.period, input.horizon ?? "", input.limit ?? "", ...fiscalYearKey(input)],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: FINANCIALS_STALE_MS,
    });
}

export type V2SegmentsInput = V2PeriodListInput & { axis?: Array<string>; metric?: Array<string> };

/** Segment facts by cursor (one row per fact). */
export function useV2SegmentsInfinite(input: V2SegmentsInput) {
    return useEarningsInfinite<V2SegmentsResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Segments({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "segments", input.company, input.period, key(input.metric), key(input.axis), input.limit ?? "", ...fiscalYearKey(input)],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: FINANCIALS_STALE_MS,
    });
}

/** Segment facts with lineage (PRO) by cursor. */
export function useV2SegmentsDetailedInfinite(input: V2SegmentsInput) {
    return useEarningsInfinite<V2SegmentsDetailedResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2SegmentsDetailed({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "segments", "detailed", input.company, input.period, key(input.metric), key(input.axis), input.limit ?? "", ...fiscalYearKey(input)],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: FINANCIALS_STALE_MS,
    });
}

/** Why a standardized fact has its value; idle for a null id. */
export function useV2Fact(factId: null | string) {
    return useEarningsQuery<V2FactResponse>({
        enabled: Boolean(factId),
        errorMessage: null,
        load: apiKey => getV2Fact({ data: { apiKey, factId: factId ?? "" } }),
        queryKey: ["v2", "fact", factId ?? ""],
        staleTime: FINANCIALS_STALE_MS,
    });
}

// Account (`/v1/me`, `/v1/me/usage`, 0 credits) and the IPO detail (backend tasks/data-api-dashboard O5).

/** The query key prefix of `useMe` (the root's query cache asks it again after any 401). */
export const ME_QUERY_KEY = ["v2", "me"] as const;

/**
 * Who the caller is (plan, limits, credits, allowed families): the key validator of the key gate and the plan source of
 * PRO badges. Status-aware (a 401 = no or an invalid key, the gate's onboarding card; no toast) and never retried on an
 * API answer.
 */
export function useMe() {
    return useEarningsQuery<V2Me>({
        enabled: true,
        errorMessage: null,
        load: apiKey => getMe({ data: { apiKey } }),
        queryKey: ME_QUERY_KEY,
        staleTime: 5 * 60 * 1000,
    });
}

export type KeyState = "checking" | "invalid" | "ready" | "unavailable";

/**
 * The key gate's state from `useMe`: `checking` until the store is hydrated and `/v1/me` answered, `invalid` on a 401
 * (no key at all is a 401 too, answered without a network call), `unavailable` on any other failure (the pages still
 * render and show their own errors), else `ready`.
 */
export function useKeyState(): { me: null | V2Me; state: KeyState } {
    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    const { data, error, isLoading } = useMe();

    return keyStateOf({ data, error, hasHydrated, isLoading });
}

/**
 * `useKeyState`'s rule (pure). A 401 wins over an earlier answer: a key revoked mid-session keeps the old `me` in the
 * cache while its refetch (asked again after any 401, `__root.tsx`) is refused, and the gate must show the card.
 */
export function keyStateOf({ data, error, hasHydrated, isLoading }: { data: null | V2Me; error: unknown; hasHydrated: boolean; isLoading: boolean }): { me: null | V2Me; state: KeyState } {
    if (isUnauthorized(error)) return { me: null, state: "invalid" };

    if (data) return { me: data, state: "ready" };

    if (error) return { me: null, state: "unavailable" };

    return { me: null, state: !hasHydrated || isLoading ? "checking" : "unavailable" };
}

/** Whether a query key is `useMe`'s (`[...ME_QUERY_KEY, <key version>]`), not another `/v1/me*` query. */
export function isMeQueryKey(queryKey: ReadonlyArray<unknown>) {
    return queryKey.length === ME_QUERY_KEY.length + 1 && ME_QUERY_KEY.every((part, index) => queryKey[index] === part);
}

/** Whether requests outside the gated page (top bar, sidebar) may run: the key answered `/v1/me`. */
export function useKeyReady() {
    return useKeyState().state === "ready";
}

/** The caller's usage over a window of days (`/v1/me/usage?days=`). */
export function useMyUsage(days: number) {
    return useEarningsQuery<V2Usage>({
        enabled: true,
        errorMessage: null,
        load: apiKey => getMyUsage({ data: { apiKey, days } }),
        queryKey: ["v2", "me", "usage", days],
        staleTime: 60 * 1000,
    });
}

/** One offering (`/v1/ipos/{ipo_id}`, the IPO calendar's row detail); idle for "". */
export function useIpo(ipoId: string) {
    return useEarningsQuery<V2IpoDetail>({
        enabled: ipoId.length > 0,
        errorMessage: null,
        load: apiKey => getIpo({ data: { apiKey, ipoId } }),
        queryKey: ["v2", "ipo", ipoId],
        staleTime: SEC_STALE_MS,
    });
}

// Browse lists (backend tasks/data-api-dashboard O5): `/instruments` and `/institutions` by cursor.

export type InstrumentsListInput = {
    exchange?: string;
    isActive?: boolean;
    limit?: number;
    q?: string;
    sort?: V2InstrumentsSort;
    structure?: Array<V2FundStructure>;
    type?: Array<V2InstrumentType>;
};

/** Every exchange-traded symbol (`GET /v1/instruments`, filters + sort) by cursor; status-aware (the page renders errors). */
export function useInstrumentsInfinite(input: InstrumentsListInput) {
    const q = input.q?.trim() || undefined;

    return useEarningsInfinite<V2InstrumentsResponse>({
        enabled: true,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getInstruments({
            data: { ...input, apiKey, cursor: cursor ?? undefined, limit: input.limit ?? 50, query: q },
        }),
        queryKey: ["v2", "instruments", "list", q ?? "", key(input.type), key(input.structure), input.exchange ?? "", String(input.isActive ?? ""), input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

export type FilersListInput = { limit?: number; phase?: V2FilerPhase; q?: string; sort?: V2FilersSort };

/** The filer registry by cursor (`GET /v1/filers`, 1 credit a page): `phase=manager` = the 13F institutions. */
export function useV2FilersInfinite(input: FilersListInput) {
    const q = input.q?.trim() || undefined;

    return useEarningsInfinite<V2FilersResponse>({
        enabled: true,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Filers({ data: { ...input, apiKey, cursor: cursor ?? undefined, q } }),
        queryKey: ["v2", "filers", "list", input.phase ?? "", q ?? "", input.sort ?? "", input.limit ?? ""],
        staleTime: SEC_STALE_MS,
    });
}

// People (backend tasks/data-api-dashboard O7 group 1): `/people`, `/people/$personId` and the search's People group.

const PEOPLE_STALE_MS = 10 * 60 * 1000;

export type PeopleInput = { company?: string; event?: string; limit?: number; q?: string; role?: V2PersonRole; sort?: V2PeopleSort };

/** People who appear on calls (`GET /v1/people`, 1 credit a page) by cursor; status-aware (the page renders errors). */
export function useV2PeopleInfinite(input: PeopleInput) {
    const q = input.q?.trim() || undefined;

    const company = input.company?.trim() || undefined;

    return useEarningsInfinite<V2PeopleResponse>({
        enabled: true,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2People({ data: { ...input, apiKey, company, cursor: cursor ?? undefined, limit: input.limit ?? 50, q } }),
        queryKey: ["v2", "people", "list", q ?? "", company ?? "", input.event ?? "", input.role ?? "", input.sort ?? "", input.limit ?? ""],
        staleTime: PEOPLE_STALE_MS,
    });
}

/** The top-bar search's People group (`GET /v1/people?q=`, one page): idle until `q` has `minLength` characters. */
export function useV2PeopleSearch(input: { limit: number; minLength: number; q: string }) {
    const q = input.q.trim();

    return useEarningsQuery<V2PeopleResponse>({
        enabled: q.length >= input.minLength,
        errorMessage: null,
        load: apiKey => getV2People({ data: { apiKey, limit: input.limit, q } }),
        placeholderData: keepPreviousData,
        queryKey: ["v2", "people", "search", q, input.limit],
        staleTime: PEOPLE_STALE_MS,
    });
}

/** One person (`GET /v1/people/{person_id}`); idle for "". Status-aware: a 404 is the page's "not found". */
export function useV2Person(personId: string) {
    return useEarningsQuery<V2Person>({
        enabled: personId.length > 0,
        errorMessage: null,
        load: apiKey => getV2Person({ data: { apiKey, personId } }),
        queryKey: ["v2", "person", personId],
        staleTime: PEOPLE_STALE_MS,
    });
}

/** The calls one person spoke on (`GET /v1/participants?person=`, one participation per call) by cursor; idle for "". */
export function useV2PersonParticipationsInfinite(input: { limit: number; personId: string }) {
    return useEarningsInfinite<V2ParticipantsResponse>({
        enabled: input.personId.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2PersonParticipations({ data: { apiKey, cursor: cursor ?? undefined, limit: input.limit, person: input.personId } }),
        queryKey: ["v2", "participants", "person", input.personId, input.limit],
        staleTime: PEOPLE_STALE_MS,
    });
}

/**
 * Several events by id (`GET /v1/events/{event_id}` each, 1 credit): a participation names its event only by id. The
 * query is `useV2Event`'s (same key, same expansions), so a call page opened from the list is already cached.
 */
export function useV2EventsById(eventIds: ReadonlyArray<string>) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    return useQueries({
        queries: eventIds.map(eventId => ({
            enabled: hasHydrated && eventId.length > 0,
            queryFn: () => getV2Event({ data: { apiKey: apiKey ?? undefined, eventId, expand: ["calendar", "observations"] } }).catch(rethrowApiError),
            queryKey: ["v2", "event", eventId, String(apiKeyUpdatedAt)],
            retry: retryUnlessApiError,
            staleTime: EARNINGS_EVENT_STALE_MS,
        })),
    });
}

/** The places of one standardized fact's source facts (`/v1/fact-places?fact=`, PRO; one page); idle for a null id. */
export function useV2FactPlaces(factId: null | string, options: { limit?: number; status?: Array<V2FactPlaceStatus> } = {}) {
    return useEarningsQuery<V2FactPlacesResponse>({
        enabled: Boolean(factId),
        errorMessage: null,
        load: apiKey => getV2FactPlaces({ data: { apiKey, fact: factId ?? "", limit: options.limit, status: options.status } }),
        queryKey: ["v2", "fact-places", factId ?? "", key(options.status), options.limit ?? ""],
        staleTime: FINANCIALS_STALE_MS,
    });
}
// News search and announcements by company (backend tasks/data-api-dashboard O7 group 2).

export type NewsSearchInput = {
    /** A ticker or a comma list; omitted = the whole market. */
    company?: string;
    field?: V2NewsSearchField;
    /** Day (`YYYY-MM-DD`, UTC): `published_at.gte` its midnight. */
    from?: string;
    limit: number;
    mode: SearchMode;
    /** The submitted query; empty = no request. */
    q: string;
    /** Day (`YYYY-MM-DD`, UTC), inclusive: `published_at.lt` the next midnight. */
    to?: string;
};

/** News search (`GET /v1/search/news`, 10 credits a page): runs once `q` is set (on submit); "More results" by `next_cursor`. */
export function useV2NewsSearchInfinite(input: NewsSearchInput) {
    const q = input.q.trim();

    return useEarningsInfinite<V2NewsSearchResponse>({
        enabled: q.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2NewsSearch({
            data: {
                apiKey,
                company: input.company || undefined,
                cursor: cursor ?? undefined,
                field: input.field,
                limit: input.limit,
                mode: input.mode,
                publishedAtGte: input.from ? dayStartInstant(input.from) : undefined,
                publishedAtLt: input.to ? dayStartInstant(input.to, true) : undefined,
                q,
            },
        }),
        queryKey: ["news", "v2", "search", q, input.company ?? "", input.field ?? "", input.mode, input.from ?? "", input.to ?? "", input.limit],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

export type AnnouncementsInput = {
    company: string;
    /** Effective on or after this day (`effective_from.gte`). */
    effectiveFrom?: string;
    /** Effective until on or before this day (`effective_to.lte`). */
    effectiveTo?: string;
    /** Day (`YYYY-MM-DD`, UTC): `announced_at.gte` its midnight. */
    from?: string;
    limit: number;
    sort?: V2AnnouncementsSort;
    /** Day (`YYYY-MM-DD`, UTC), inclusive: `announced_at.lt` the next midnight. */
    to?: string;
    topic?: Array<string>;
};

/** A company's announcements (`GET /v1/announcements?company=`, STANDARD) by cursor; status-aware (the tab renders errors). */
export function useV2AnnouncementsInfinite(input: AnnouncementsInput) {
    return useEarningsInfinite<V2AnnouncementsResponse>({
        enabled: input.company.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2AnnouncementsList({
            data: {
                announcedAtGte: input.from ? dayStartInstant(input.from) : undefined,
                announcedAtLt: input.to ? dayStartInstant(input.to, true) : undefined,
                apiKey,
                company: input.company,
                cursor: cursor ?? undefined,
                effectiveFromGte: input.effectiveFrom,
                effectiveToLte: input.effectiveTo,
                limit: input.limit,
                sort: input.sort,
                topic: input.topic,
            },
        }),
        queryKey: [
            "news",
            "v2",
            "announcements-list",
            input.company,
            key(input.topic),
            input.from ?? "",
            input.to ?? "",
            input.effectiveFrom ?? "",
            input.effectiveTo ?? "",
            input.sort ?? "",
            input.limit,
        ],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

// Filings depth (backend tasks/data-api-dashboard O7 group 3): the filing detail page's tabs (each asked only while its
// tab is open: an empty accession / version id keeps the hook idle), a document version's sections and fact places,
// the SEC data sets.

/** Rows per page of the filing detail's lists. */
const FILING_TAB_PAGE = 50;

/** A filing's numeric XBRL facts by cursor; `tag` = concepts (comma list). */
export function useV2FilingFactsInfinite(accession: string, tag?: string) {
    return useEarningsInfinite<V2FilingFactsResponse>({
        enabled: accession.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2FilingFacts({ data: { accession, apiKey, cursor: cursor ?? undefined, limit: FILING_TAB_PAGE, tag } }),
        queryKey: ["v2", "filing-facts", accession, tag ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** A filing's text facts (XBRL text blocks) by cursor; `tag` = concepts (comma list). */
export function useV2FilingNotesInfinite(accession: string, tag?: string) {
    return useEarningsInfinite<V2FilingNotesResponse>({
        enabled: accession.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2FilingNotes({ data: { accession, apiKey, cursor: cursor ?? undefined, limit: FILING_TAB_PAGE, tag } }),
        queryKey: ["v2", "filing-notes", accession, tag ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** The comment-letter graph around a filing (`maxDepth` hops, `direction`). */
export function useV2ReviewChain(accession: string, options: { direction?: V2ReviewDirection; maxDepth?: number }) {
    return useEarningsQuery<V2ReviewChainResponse>({
        enabled: accession.length > 0,
        errorMessage: null,
        load: apiKey => getV2ReviewChain({ data: { accession, apiKey, direction: options.direction, maxDepth: options.maxDepth } }),
        queryKey: ["v2", "review-chain", accession, options.direction ?? "", options.maxDepth ?? ""],
        staleTime: SEC_STALE_MS,
    });
}

/** The reported lines of one 13F-HR / NPORT-P filing by cursor. */
export function useV2FilingHoldingsInfinite(accession: string) {
    return useEarningsInfinite<V2FilingHoldingsResponse>({
        enabled: accession.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2FilingHoldings({ data: { accession, apiKey, cursor: cursor ?? undefined, limit: FILING_TAB_PAGE } }),
        queryKey: ["v2", "filing-holdings", accession],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** The section outline of one document version by cursor (`outline`: generic headings by default). */
export function useV2DocumentSectionsInfinite(versionId: string, outline?: V2SectionOutline) {
    return useEarningsInfinite<V2DocumentSectionsResponse>({
        enabled: versionId.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2DocumentSections({ data: { apiKey, cursor: cursor ?? undefined, limit: FILING_TAB_PAGE, outline, versionId } }),
        queryKey: ["v2", "document-sections", versionId, outline ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** Where facts sit in one document version by cursor (PRO). */
export function useV2FactPlacesInfinite(versionId: string) {
    return useEarningsInfinite<V2FactPlacesResponse>({
        enabled: versionId.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2FactPlaces({ data: { apiKey, cursor: cursor ?? undefined, documentVersion: versionId, limit: FILING_TAB_PAGE } }),
        queryKey: ["v2", "fact-places", "version", versionId],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}

/** The SEC data set releases the filings routes serve (one short list). */
export function useV2DatasetsInfinite() {
    return useEarningsInfinite<V2DatasetsResponse>({
        enabled: true,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Datasets({ data: { apiKey, cursor: cursor ?? undefined, limit: 100 } }),
        queryKey: ["v2", "datasets"],
        staleTime: SEC_STALE_MS,
    });
}

// O7 group 5 (backend tasks/data-api-dashboard 1-overhaul task 7): a company's KPI history.

export type V2KpiHistoryInput = { company: string; metric: string; sort?: "-conference_date" | "conference_date" };

/**
 * One normalized KPI across a company's calls (`/v1/kpis?company=&metric=&sort=`, 200 a page). "" company or metric
 * keeps it idle; the dialog renders the error (no toast).
 */
export function useV2KpiHistoryInfinite(input: V2KpiHistoryInput) {
    return useEarningsInfinite<V2KpisResponse>({
        enabled: input.company.trim().length > 0 && input.metric.trim().length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getV2Kpis({ data: { ...input, apiKey, cursor: cursor ?? undefined, limit: 200 } }),
        queryKey: ["v2", "kpis", "history", input.company, input.metric, input.sort ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

// Reference (backend tasks/data-api-dashboard O7 group 7): the catalogs, the companies list and the API's status. The
// catalogs are reference data: cached for an hour, a tab's hook only runs while its tab is open (`enabled`).

const REFERENCE_STALE_MS = 60 * 60 * 1000;

/** Rows per catalog page (the contract's maximum: the whole metric catalog is 2 pages, the mapping rules 5). */
const CATALOG_PAGE_LIMIT = 200;

type CatalogStatementInput = { enabled: boolean; statement?: Array<StatementType> };

export function useMetricCatalogInfinite(input: CatalogStatementInput) {
    return useEarningsInfinite<V2MetricCatalogResponse>({
        enabled: input.enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getMetricCatalog({ data: { apiKey, cursor: cursor ?? undefined, limit: CATALOG_PAGE_LIMIT, statement: input.statement } }),
        queryKey: ["v2", "catalog", "metrics", key(input.statement)],
        staleTime: REFERENCE_STALE_MS,
    });
}

export function useSectionCatalogInfinite(input: { enabled: boolean; form?: Array<string> }) {
    return useEarningsInfinite<V2SectionCatalogResponse>({
        enabled: input.enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getSectionCatalog({ data: { apiKey, cursor: cursor ?? undefined, form: input.form, limit: CATALOG_PAGE_LIMIT } }),
        queryKey: ["v2", "catalog", "sections", key(input.form)],
        staleTime: REFERENCE_STALE_MS,
    });
}

export function useFormCatalogInfinite(input: { enabled: boolean }) {
    return useEarningsInfinite<V2FormCatalogResponse>({
        enabled: input.enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getFormCatalog({ data: { apiKey, cursor: cursor ?? undefined, limit: CATALOG_PAGE_LIMIT } }),
        queryKey: ["v2", "catalog", "forms"],
        staleTime: REFERENCE_STALE_MS,
    });
}

export function useEventTypeCatalogInfinite(input: { enabled: boolean }) {
    return useEarningsInfinite<V2EventTypeCatalogResponse>({
        enabled: input.enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getEventTypeCatalog({ data: { apiKey, cursor: cursor ?? undefined, limit: CATALOG_PAGE_LIMIT } }),
        queryKey: ["v2", "catalog", "event-types"],
        staleTime: REFERENCE_STALE_MS,
    });
}

export function useDocumentKindCatalogInfinite(input: { enabled: boolean }) {
    return useEarningsInfinite<V2DocumentKindCatalogResponse>({
        enabled: input.enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getDocumentKindCatalog({ data: { apiKey, cursor: cursor ?? undefined, limit: CATALOG_PAGE_LIMIT } }),
        queryKey: ["v2", "catalog", "document-kinds"],
        staleTime: REFERENCE_STALE_MS,
    });
}

export function useMappingRulesInfinite(input: CatalogStatementInput & { metricId?: Array<string> }) {
    return useEarningsInfinite<V2MappingRulesResponse>({
        enabled: input.enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getMappingRules({
            data: { apiKey, cursor: cursor ?? undefined, limit: CATALOG_PAGE_LIMIT, metricId: input.metricId, statement: input.statement },
        }),
        queryKey: ["v2", "catalog", "mapping-rules", key(input.statement), key(input.metricId)],
        staleTime: REFERENCE_STALE_MS,
    });
}

export type CompaniesInput = { enabled: boolean; exchange?: Array<string>; limit?: number; q?: string; sector?: Array<string>; sort?: V2CompaniesSort };

/** Operating companies with a US listing by cursor (`GET /v1/companies`); status-aware (the list renders errors). */
export function useCompaniesInfinite(input: CompaniesInput) {
    const q = input.q?.trim() || undefined;

    return useEarningsInfinite<V2CompaniesResponse>({
        enabled: input.enabled,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getCompanies({
            data: { apiKey, cursor: cursor ?? undefined, exchange: input.exchange, limit: input.limit, q, sector: input.sector, sort: input.sort },
        }),
        queryKey: ["v2", "companies", q ?? "", key(input.exchange), key(input.sector), input.sort ?? "", input.limit ?? ""],
        staleTime: V2_STALE_MS,
    });
}

/** How long the status answer is fresh (the API judges the last 24 hours; the sidebar and the account share it). */
const STATUS_STALE_MS = 5 * 60 * 1000;

/** `GET /status` (no credits): status and uptime per product family and docs group. Status-aware, no toast. */
export function useApiStatus(enabled = true) {
    return useEarningsQuery<V2ApiStatus>({
        enabled,
        errorMessage: null,
        load: apiKey => getApiStatus({ data: { apiKey } }),
        queryKey: ["status"],
        staleTime: STATUS_STALE_MS,
    });
}

/** `GET /status/licensing` (no credits): rights per tier, the right and tier of every route. */
export function useApiLicensing(enabled = true) {
    return useEarningsQuery<V2Licensing>({
        enabled,
        errorMessage: null,
        load: apiKey => getApiLicensing({ data: { apiKey } }),
        queryKey: ["status", "licensing"],
        staleTime: REFERENCE_STALE_MS,
    });
}

// Ownership and offerings (backend tasks/data-api-dashboard O7 group 6): one insider transaction (row detail), one Form D
// offering (`/offerings/$offeringId`), a 13F manager's position changes (`/sec/$cik`). Status-aware: the page renders errors.

/** One insider transaction line (the insider table's row detail); idle for "". */
export function useInsiderTrade(id: string) {
    return useEarningsQuery<V2InsiderTradeDetail>({
        enabled: id.length > 0,
        errorMessage: null,
        load: apiKey => getInsiderTrade({ data: { apiKey, id } }),
        queryKey: ["v2", "insider-trade", id],
        staleTime: SEC_STALE_MS,
    });
}

/** One Form D offering; idle for "". */
export function useOffering(offeringId: string) {
    return useEarningsQuery<V2OfferingDetail>({
        enabled: offeringId.length > 0,
        errorMessage: null,
        load: apiKey => getOffering({ data: { apiKey, offeringId } }),
        queryKey: ["v2", "offering", offeringId],
        staleTime: SEC_STALE_MS,
    });
}

export type FilerHoldingChangesInput = {
    /** The manager's CIK; "" = idle (asked on a click). */
    cik: string;
    limit?: number;
    periodEnd?: string;
    priorPeriodEnd?: string;
    /** Omitted = every change but `unchanged`. */
    type?: Array<V2HolderChangeType>;
};

/** A 13F manager's position changes vs the prior quarter by cursor (`GET /v1/filers/{cik}/holding-changes`). */
export function useFilerHoldingChangesInfinite(input: FilerHoldingChangesInput) {
    return useEarningsInfinite<V2FilerHoldingChangesResponse>({
        enabled: input.cik.length > 0,
        errorMessage: null,
        fetchPage: (cursor, apiKey) => getFilerHoldingChanges({ data: { ...input, apiKey, cursor: cursor ?? undefined } }),
        queryKey: ["v2", "filer-holding-changes", input.cik, input.periodEnd ?? "", input.priorPeriodEnd ?? "", key(input.type), input.limit ?? ""],
        refetchInterval: refetchWhileCoveragePending,
        staleTime: SEC_STALE_MS,
    });
}
