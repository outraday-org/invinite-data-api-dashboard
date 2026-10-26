import type { InfiniteData, UseQueryOptions } from "@tanstack/react-query";

import { queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import type { AssetGroupCategory } from "@/lib/earnings/documents";

import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type {
    CagrPeriodYears,
    DividendsResponse,
    EarningsAudioResponse,
    EarningsCalendarResponse,
    EarningsCompanyDocumentResponse,
    EarningsCompanyDocumentsResponse,
    EarningsDateStatus,
    EarningsDiffResponse,
    EarningsDocumentSearchResponse,
    EarningsDocumentsResponse,
    EarningsEventResponse,
    EarningsEventsResponse,
    EarningsEventType,
    EarningsExtractionKind,
    EarningsExtractionReview,
    EarningsExtractionsResponse,
    EarningsGuidanceBasis,
    EarningsGuidanceHistoryResponse,
    EarningsGuidancePeriodKind,
    EarningsLiveResponse,
    EarningsLiveStreamResponse,
    EarningsMetricsResponse,
    EarningsParticipantsResponse,
    EarningsPressReleaseResponse,
    EarningsPriceAttributionResponse,
    EarningsProsodyResponse,
    EarningsProsodySection,
    EarningsQaResponse,
    EarningsSearchResponse,
    EarningsSearchType,
    EarningsSession,
    EarningsSlidesResponse,
    EarningsTranscriptDiffResponse,
    EarningsTranscriptFormat,
    EarningsTranscriptResponse,
    EarningsTranscriptVersionsResponse,
    FilingsResponse,
    FiscalPeriodType,
    GrowthType,
    InsiderTradesResponse,
    InstitutionalHoldingsResponse,
    InstitutionalTransactionsResponse,
    IposResponse,
    MarketHolidaysResponse,
    RatioCategory,
    SegmentedFinancialsSegmentId,
    SplitsResponse,
    StatementType,
} from "./types";

import { ApiRequestError, rethrowApiError, retryUnlessApiError } from "./errors";
import {
    getApiBaseUrl,
    getAsReportedFinancialsPresentation,
    getAvailableFormTypes,
    getCompanyDetails,
    getCompanyDividends,
    getCompanySplits,
    getEarningsAudio,
    getEarningsCalendar,
    getEarningsCompanyDocument,
    getEarningsCompanyDocuments,
    getEarningsDiff,
    getEarningsDocuments,
    getEarningsDocumentSearch,
    getEarningsEvent,
    getEarningsEvents,
    getEarningsExtractions,
    getEarningsGuidanceHistory,
    getEarningsLive,
    getEarningsLiveStream,
    getEarningsMetrics,
    getEarningsParticipants,
    getEarningsPressRelease,
    getEarningsPriceAttribution,
    getEarningsProsody,
    getEarningsQa,
    getEarningsSearch,
    getEarningsSlides,
    getEarningsTranscript,
    getEarningsTranscriptDiff,
    getEarningsTranscriptVersions,
    getFilings,
    getFinancialCagr,
    getFinancialGrowth,
    getFinancialRatios,
    getInsiderTrades,
    getInstitutionalHoldingsByCompany,
    getInstitutionalTransactions,
    getInstitutions,
    getIpos,
    getMarketHolidays,
    getSegmentedFinancials,
    getStandardizedFinancials,
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

type FilingsQueryInput = {
    formType?: string;
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
};

export const filingsOptions = (input: FilingsQueryInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getFilings({ data: input }),
        queryKey: [
            "filings",
            input.identifier,
            input.formType ?? "all",
            input.sort ?? "desc",
            input.limit ?? 40,
            input.offset ?? 0,
        ],
        staleTime: 10 * 60 * 1000,
    });

type AvailableFormTypesInput = {
    identifier: string;
};

type DividendsQueryInput = {
    endDate?: string;
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
    startDate?: string;
};

export const availableFormTypesOptions = (input: AvailableFormTypesInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getAvailableFormTypes({ data: input }),
        queryKey: ["filings", "available-form-types", input.identifier],
        staleTime: 10 * 60 * 1000,
    });

type SplitsQueryInput = {
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
};

type InsiderTradesQueryInput = {
    acquiredDisposed?: "A" | "D";
    endDate?: string;
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
    startDate?: string;
};

type InstitutionalTransactionsQueryInput = {
    calendarQuarter?: number;
    calendarYear?: number;
    endDate?: string;
    identifier: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
    startDate?: string;
    type?: "added" | "new_buy" | "reduced" | "sold_out";
};

type InstitutionalHoldingsQueryInput = {
    identifier: string;
    limit?: number;
    minValue?: number;
    offset?: number;
    sort?: "asc" | "desc";
};

type InstitutionsQueryInput = {
    ciks?: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
};

type MarketHolidaysQueryInput = {
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
};

export const dividendsOptions = (input: DividendsQueryInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getCompanyDividends({ data: input }),
        queryKey: [
            "dividends",
            input.identifier,
            input.startDate ?? "all",
            input.endDate ?? "all",
            input.sort ?? "desc",
            input.limit ?? 40,
            input.offset ?? 0,
        ],
        staleTime: 10 * 60 * 1000,
    });

export const splitsOptions = (input: SplitsQueryInput) =>
    queryOptions({
        enabled: input.identifier.trim().length > 0,
        queryFn: () => getCompanySplits({ data: input }),
        queryKey: [
            "splits",
            input.identifier,
            input.sort ?? "desc",
            input.limit ?? 40,
            input.offset ?? 0,
        ],
        staleTime: 10 * 60 * 1000,
    });

type IposQueryInput = {
    endDate?: string;
    limit?: number;
    offset?: number;
    sort?: "asc" | "desc";
    startDate?: string;
};

export const iposOptions = (input: IposQueryInput) =>
    queryOptions({
        queryFn: () => getIpos({ data: input }),
        queryKey: [
            "ipos",
            input.startDate ?? "all",
            input.endDate ?? "all",
            input.sort ?? "desc",
            input.limit ?? 40,
            input.offset ?? 0,
        ],
        staleTime: 10 * 60 * 1000,
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

// Helper to show error toast
function useErrorToast(error: Error | null, message: string) {
    React.useEffect(() => {
        if (error) {
            toast.error(message, {
                description: error.message,
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

export function useFilings(input: FilingsQueryInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...filingsOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getFilings({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [...filingsOptions(input).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load filings");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useAvailableFormTypes(input: AvailableFormTypesInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            ...availableFormTypesOptions(input),
            enabled: hasHydrated && input.identifier.trim().length > 0,
            queryFn: () =>
                getAvailableFormTypes({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [...availableFormTypesOptions(input).queryKey, String(apiKeyUpdatedAt)],
        }),
    );

    useErrorToast(result.error, "Failed to load form types");

    return {
        ...result,
        data: result.data,
    };
}

type FilingsInfiniteInput = Omit<FilingsQueryInput, "offset"> & {
    limit: number;
};

type DividendsInfiniteInput = Omit<DividendsQueryInput, "offset"> & {
    limit: number;
};

type SplitsInfiniteInput = Omit<SplitsQueryInput, "offset"> & {
    limit: number;
};

type InsiderTradesInfiniteInput = Omit<InsiderTradesQueryInput, "offset"> & {
    limit: number;
};

type InstitutionalTransactionsInfiniteInput = Omit<InstitutionalTransactionsQueryInput, "offset"> & {
    limit: number;
};

type InstitutionalHoldingsInfiniteInput = Omit<InstitutionalHoldingsQueryInput, "offset"> & {
    limit: number;
};

type IposInfiniteInput = Omit<IposQueryInput, "offset"> & {
    limit: number;
};

type MarketHolidaysInfiniteInput = Omit<MarketHolidaysQueryInput, "offset"> & {
    limit: number;
};

export function useFilingsInfinite(input: FilingsInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "filings",
        "infinite",
        input.identifier,
        input.formType ?? "all",
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        FilingsResponse,
        Error,
        InfiniteData<FilingsResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated && input.identifier.trim().length > 0,
        getNextPageParam: (lastPage: FilingsResponse) => {
            const nextUrl = lastPage.companies[0]?.next_url;

            if (!nextUrl) return undefined;

            let nextOffset: null | number = null;

            try {
                const parsed = new URL(nextUrl, "http://localhost");

                const offsetParam = parsed.searchParams.get("offset");

                if (offsetParam) nextOffset = Number(offsetParam);
            }
            catch {
                nextOffset = null;
            }

            if (nextOffset === null || Number.isNaN(nextOffset)) return undefined;

            return nextOffset;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getFilings({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load filings");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useDividendsInfinite(input: DividendsInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "dividends",
        "infinite",
        input.identifier,
        input.startDate ?? "all",
        input.endDate ?? "all",
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        DividendsResponse,
        Error,
        InfiniteData<DividendsResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated && input.identifier.trim().length > 0,
        getNextPageParam: (lastPage: DividendsResponse) => {
            const nextUrl = lastPage.companies[0]?.next_url;

            if (!nextUrl) return undefined;

            const parsed = new URL(nextUrl, "http://local");

            const offset = parsed.searchParams.get("offset");

            if (!offset) return undefined;

            const parsedOffset = Number(offset);

            return Number.isNaN(parsedOffset) ? undefined : parsedOffset;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getCompanyDividends({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load dividends");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useSplitsInfinite(input: SplitsInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "splits",
        "infinite",
        input.identifier,
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        SplitsResponse,
        Error,
        InfiniteData<SplitsResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated && input.identifier.trim().length > 0,
        getNextPageParam: (lastPage: SplitsResponse) => {
            const nextUrl = lastPage.companies[0]?.next_url;

            if (!nextUrl) return undefined;

            const parsed = new URL(nextUrl, "http://local");

            const offset = parsed.searchParams.get("offset");

            if (!offset) return undefined;

            const parsedOffset = Number(offset);

            return Number.isNaN(parsedOffset) ? undefined : parsedOffset;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getCompanySplits({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load stock splits");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useInsiderTradesInfinite(input: InsiderTradesInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "insider-trades",
        "infinite",
        input.identifier,
        input.acquiredDisposed ?? "all",
        input.startDate ?? "all",
        input.endDate ?? "all",
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        InsiderTradesResponse,
        Error,
        InfiniteData<InsiderTradesResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated && input.identifier.trim().length > 0,
        getNextPageParam: (lastPage: InsiderTradesResponse) => {
            const nextUrl = lastPage.next_url;

            if (!nextUrl) return undefined;

            let nextOffset: null | number = null;

            try {
                const parsed = new URL(nextUrl, "http://localhost");

                const offsetParam = parsed.searchParams.get("offset");

                if (offsetParam) nextOffset = Number(offsetParam);
            }
            catch {
                nextOffset = null;
            }

            if (nextOffset === null || Number.isNaN(nextOffset)) return undefined;

            return nextOffset;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getInsiderTrades({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load insider trades");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useInstitutionalTransactionsInfinite(input: InstitutionalTransactionsInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "institutional-transactions",
        "infinite",
        input.identifier,
        input.type ?? "all",
        input.calendarYear ?? "all",
        input.calendarQuarter ?? "all",
        input.startDate ?? "all",
        input.endDate ?? "all",
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        InstitutionalTransactionsResponse,
        Error,
        InfiniteData<InstitutionalTransactionsResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated && input.identifier.trim().length > 0,
        getNextPageParam: (lastPage: InstitutionalTransactionsResponse) => {
            const nextUrl = lastPage.next_url;

            if (!nextUrl) return undefined;

            let nextOffset: null | number = null;

            try {
                const parsed = new URL(nextUrl, "http://localhost");

                const offsetParam = parsed.searchParams.get("offset");

                if (offsetParam) nextOffset = Number(offsetParam);
            }
            catch {
                nextOffset = null;
            }

            if (nextOffset === null || Number.isNaN(nextOffset)) return undefined;

            return nextOffset;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getInstitutionalTransactions({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load institutional transactions");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useInstitutionalHoldingsInfinite(input: InstitutionalHoldingsInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "institutional-holdings",
        "infinite",
        input.identifier,
        input.minValue ?? "all",
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        InstitutionalHoldingsResponse,
        Error,
        InfiniteData<InstitutionalHoldingsResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated && input.identifier.trim().length > 0,
        getNextPageParam: (lastPage: InstitutionalHoldingsResponse) => {
            const nextUrl = lastPage.next_url;

            if (!nextUrl) return undefined;

            let nextOffset: null | number = null;

            try {
                const parsed = new URL(nextUrl, "http://localhost");

                const offsetParam = parsed.searchParams.get("offset");

                if (offsetParam) nextOffset = Number(offsetParam);
            }
            catch {
                nextOffset = null;
            }

            if (nextOffset === null || Number.isNaN(nextOffset)) return undefined;

            return nextOffset;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getInstitutionalHoldingsByCompany({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load institutional ownership");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useInstitutions(input: InstitutionsQueryInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const result = useQuery(
        queryOptions({
            enabled: hasHydrated && Boolean(input.ciks?.trim()),
            queryFn: () => getInstitutions({ data: { ...input, apiKey: apiKey ?? undefined } }),
            queryKey: [
                "institutions",
                input.ciks ?? "all",
                input.sort ?? "asc",
                input.limit ?? 100,
                input.offset ?? 0,
                String(apiKeyUpdatedAt),
            ],
            staleTime: 10 * 60 * 1000,
        }),
    );

    useErrorToast(result.error, "Failed to load institutions");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useIposInfinite(input: IposInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "ipos",
        "infinite",
        input.startDate ?? "all",
        input.endDate ?? "all",
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        IposResponse,
        Error,
        InfiniteData<IposResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated,
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.ipos.length < input.limit) return undefined;

            return allPages.length * input.limit;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getIpos({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load IPOs");

    return {
        ...result,
        data: result.data ?? null,
    };
}

export function useMarketHolidaysInfinite(input: MarketHolidaysInfiniteInput) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const queryKey = [
        "market-holidays",
        "infinite",
        input.sort ?? "desc",
        input.limit,
        String(apiKeyUpdatedAt),
    ] as const;

    const result = useInfiniteQuery<
        MarketHolidaysResponse,
        Error,
        InfiniteData<MarketHolidaysResponse, number>,
        typeof queryKey,
        number
    >({
        enabled: hasHydrated,
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.holidays.length < input.limit) return undefined;

            return allPages.length * input.limit;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getMarketHolidays({
                data: {
                    ...input,
                    apiKey: apiKey ?? undefined,
                    offset: Number(pageParam) || 0,
                },
            }),
        queryKey,
        staleTime: 10 * 60 * 1000,
    });

    useErrorToast(result.error, "Failed to load market holidays");

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

// Earnings calls (IDA `/v1/earnings-calls/*`)

/** One call: `eventId`, or `identifier` + `date` (New York day) / `year` + `quarter`. */
export type EarningsEventSelector = {
    date?: string;
    eventId?: string;
    identifier?: string;
    quarter?: number;
    year?: number;
};

const EARNINGS_LIST_STALE_MS = 60 * 1000;

const EARNINGS_EVENT_STALE_MS = 10 * 60 * 1000;

const hasEventSelector = (s: EarningsEventSelector) =>
    Boolean(s.eventId?.trim() || s.identifier?.trim());

const selectorKey = (s: EarningsEventSelector) =>
    [s.eventId ?? "", s.identifier ?? "", s.date ?? "", s.year ?? "", s.quarter ?? ""] as const;

/** The `offset` of a top-level `next_url` (as `useInsiderTradesInfinite`), else undefined = last page. */
function offsetOfNextUrl(nextUrl: null | string | undefined) {
    if (!nextUrl) return undefined;

    try {
        const offset = Number(new URL(nextUrl, "http://localhost").searchParams.get("offset"));

        return Number.isNaN(offset) || offset <= 0 ? undefined : offset;
    }
    catch {
        return undefined;
    }
}

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

function useEarningsInfinite<TPage extends { next_url?: null | string }>(options: {
    enabled: boolean;
    errorMessage: null | string;
    fetchPage: (offset: number, apiKey: string | undefined) => Promise<TPage>;
    queryKey: ReadonlyArray<unknown>;
    quietStatuses?: ReadonlyArray<number>;
    staleTime: number;
}) {
    const { apiKey, apiKeyUpdatedAt, hasHydrated } = useApiKey();

    const { enabled, errorMessage, fetchPage, queryKey, quietStatuses, staleTime } = options;

    const result = useInfiniteQuery<TPage, Error, InfiniteData<TPage, number>, ReadonlyArray<unknown>, number>({
        enabled: hasHydrated && enabled,
        getNextPageParam: lastPage => offsetOfNextUrl(lastPage.next_url),
        initialPageParam: 0,
        queryFn: ({ pageParam }) => fetchPage(Number(pageParam) || 0, apiKey ?? undefined).catch(rethrowApiError),
        queryKey: [...queryKey, String(apiKeyUpdatedAt)],
        retry: retryUnlessApiError,
        staleTime,
    });

    useErrorToast(toastableError(result.error, errorMessage, quietStatuses), errorMessage ?? "");

    return {
        ...result,
        data: result.data ?? null,
    };
}

type EarningsCalendarInfiniteInput = {
    eventType?: EarningsEventType;
    exchange?: string;
    from?: string;
    limit: number;
    session?: EarningsSession;
    sort?: "asc" | "desc";
    status?: Array<EarningsDateStatus>;
    to?: string;
};

export function useEarningsCalendarInfinite(input: EarningsCalendarInfiniteInput) {
    return useEarningsInfinite<EarningsCalendarResponse>({
        enabled: true,
        errorMessage: "Failed to load the earnings calendar",
        fetchPage: (offset, apiKey) => getEarningsCalendar({ data: { ...input, apiKey, offset } }),
        queryKey: [
            "earnings",
            "calendar",
            input.from ?? "",
            input.to ?? "",
            input.status?.join(",") ?? "",
            input.session ?? "",
            input.exchange ?? "",
            input.eventType ?? "",
            input.sort ?? "",
            input.limit,
        ],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

type EarningsEventsInfiniteInput = {
    eventType?: EarningsEventType;
    from?: string;
    identifier: string;
    include?: "observations";
    limit: number;
    sort?: "asc" | "desc";
    to?: string;
};

export function useEarningsEventsInfinite(input: EarningsEventsInfiniteInput) {
    return useEarningsInfinite<EarningsEventsResponse>({
        enabled: input.identifier.trim().length > 0,
        errorMessage: "Failed to load earnings calls",
        fetchPage: (offset, apiKey) => getEarningsEvents({ data: { ...input, apiKey, offset } }),
        queryKey: [
            "earnings",
            "events",
            input.identifier,
            input.eventType ?? "",
            input.from ?? "",
            input.to ?? "",
            input.include ?? "",
            input.sort ?? "",
            input.limit,
        ],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

/**
 * Calls being captured right now; refetched every 15 s while the tab is visible.
 * Status-aware (no toast: a failing refetch would toast every 15 s; the strip shows a note).
 * `enabled: false` keeps it idle (the call page asks only for a call that may be live).
 */
export function useEarningsLive(enabled = true) {
    return useEarningsQuery<EarningsLiveResponse>({
        enabled,
        errorMessage: null,
        load: apiKey => getEarningsLive({ data: { apiKey } }),
        queryKey: ["earnings", "live"],
        refetchInterval: 15 * 1000,
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

// Pipeline capture states of a call that is (about to be) live or just ended without a transcript.
const LIVE_CAPTURE_STATUSES = new Set(["armed", "captured", "capturing"]);

/** Whether a call may be live (or just ended) and not published yet: the call page then polls it. */
export function isEarningsEventLiveish(event: Pick<EarningsEventResponse, "capture_status" | "has_transcript">) {
    return !event.has_transcript && LIVE_CAPTURE_STATUSES.has(event.capture_status);
}

/**
 * Status-aware: the call page renders a 404 as `NotFound`. Refetched every 30 s while the call
 * is live or just ended without a transcript (`isEarningsEventLiveish`), so the live player
 * appears when capture starts and the Transcript tab lights up when `has_transcript` flips.
 */
export function useEarningsEvent(eventId: string) {
    return useEarningsQuery<EarningsEventResponse>({
        enabled: eventId.trim().length > 0,
        errorMessage: null,
        load: apiKey => getEarningsEvent({ data: { apiKey, eventId } }),
        queryKey: ["earnings", "event", eventId],
        refetchInterval: query => (query.state.data && isEarningsEventLiveish(query.state.data) ? 30 * 1000 : false),
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsTranscriptInput = EarningsEventSelector & {
    asOf?: string;
    format?: EarningsTranscriptFormat;
    version?: number;
};

/** Status-aware: a 404 is a state ("no cleaned layer for this version", no transcript yet). */
export function useEarningsTranscript(input: EarningsTranscriptInput) {
    return useEarningsQuery<EarningsTranscriptResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsTranscript({ data: { ...input, apiKey } }),
        queryKey: [
            "earnings",
            "transcript",
            ...selectorKey(input),
            input.format ?? "",
            input.version ?? "",
            input.asOf ?? "",
        ],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

export function useEarningsTranscriptVersions(input: EarningsEventSelector) {
    return useEarningsQuery<EarningsTranscriptVersionsResponse>({
        enabled: hasEventSelector(input),
        errorMessage: "Failed to load transcript versions",
        load: apiKey => getEarningsTranscriptVersions({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "transcript-versions", ...selectorKey(input)],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsTranscriptDiffInput = EarningsEventSelector & {
    from: number;
    to?: number;
};

export function useEarningsTranscriptDiff(input: EarningsTranscriptDiffInput) {
    return useEarningsQuery<EarningsTranscriptDiffResponse>({
        enabled: hasEventSelector(input),
        errorMessage: "Failed to compare transcript versions",
        load: apiKey => getEarningsTranscriptDiff({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "transcript-diff", ...selectorKey(input), input.from, input.to ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsQaInfiniteInput = EarningsEventSelector & {
    limit: number;
};

export function useEarningsQaInfinite(input: EarningsQaInfiniteInput) {
    return useEarningsInfinite<EarningsQaResponse>({
        enabled: hasEventSelector(input),
        errorMessage: "Failed to load Q&A",
        fetchPage: (offset, apiKey) => getEarningsQa({ data: { ...input, apiKey, offset } }),
        queryKey: ["earnings", "qa", ...selectorKey(input), input.limit],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsParticipantsInput = EarningsEventSelector & {
    include?: "evidence";
};

export function useEarningsParticipants(input: EarningsParticipantsInput) {
    return useEarningsQuery<EarningsParticipantsResponse>({
        enabled: hasEventSelector(input),
        errorMessage: "Failed to load participants",
        load: apiKey => getEarningsParticipants({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "participants", ...selectorKey(input), input.include ?? ""],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsPressReleaseInput = EarningsEventSelector & {
    include?: "body";
};

/** Status-aware: a 404 = "No press release stored for this call". */
export function useEarningsPressRelease(input: EarningsPressReleaseInput) {
    return useEarningsQuery<EarningsPressReleaseResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsPressRelease({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "press-release", ...selectorKey(input), input.include ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsExtractionsInfiniteInput = EarningsEventSelector & {
    kind?: EarningsExtractionKind;
    limit: number;
    review?: EarningsExtractionReview;
};

export function useEarningsExtractionsInfinite(input: EarningsExtractionsInfiniteInput) {
    return useEarningsInfinite<EarningsExtractionsResponse>({
        enabled: hasEventSelector(input),
        errorMessage: "Failed to load guidance and KPIs",
        fetchPage: (offset, apiKey) => getEarningsExtractions({ data: { ...input, apiKey, offset } }),
        queryKey: [
            "earnings",
            "extractions",
            ...selectorKey(input),
            input.kind ?? "",
            input.review ?? "",
            input.limit,
        ],
        quietStatuses: [404],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsGuidanceHistoryInput = {
    basis?: EarningsGuidanceBasis;
    identifier: string;
    limit?: number;
    metric: string;
    periodKind?: EarningsGuidancePeriodKind;
};

export function useEarningsGuidanceHistory(input: EarningsGuidanceHistoryInput) {
    return useEarningsQuery<EarningsGuidanceHistoryResponse>({
        enabled: input.identifier.trim().length > 0 && input.metric.trim().length > 0,
        errorMessage: "Failed to load guidance history",
        load: apiKey => getEarningsGuidanceHistory({ data: { ...input, apiKey } }),
        queryKey: [
            "earnings",
            "guidance-history",
            input.identifier,
            input.metric,
            input.periodKind ?? "",
            input.basis ?? "",
            input.limit ?? "",
        ],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Status-aware: `404 diff_unavailable` = first call on record / not derived yet. */
export function useEarningsDiff(input: EarningsEventSelector) {
    return useEarningsQuery<EarningsDiffResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsDiff({ data: { ...input, apiKey, vs: "prior" } }),
        queryKey: ["earnings", "diff", ...selectorKey(input)],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/** Status-aware: `404 metrics_unavailable` until the call has been derived. */
export function useEarningsMetrics(input: EarningsEventSelector) {
    return useEarningsQuery<EarningsMetricsResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsMetrics({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "metrics", ...selectorKey(input)],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsProsodyInput = EarningsEventSelector & {
    section?: EarningsProsodySection;
};

/** Status-aware: `404 prosody_unavailable` until the call has been derived. */
export function useEarningsProsody(input: EarningsProsodyInput) {
    return useEarningsQuery<EarningsProsodyResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsProsody({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "prosody", ...selectorKey(input), input.section ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/**
 * Status-aware: `404 price_attribution_unavailable` until the first minute row exists. While
 * the call is live (`live: true` — the caller passes `isEarningsEventLiveish`) the minute rows
 * grow once a minute: refetched every 60 s (same query key, so the live player's seed and the
 * Price moves tab share the answer).
 */
export function useEarningsPriceAttribution(input: EarningsEventSelector, { live = false }: { live?: boolean } = {}) {
    return useEarningsQuery<EarningsPriceAttributionResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsPriceAttribution({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "price-attribution", ...selectorKey(input)],
        refetchInterval: live ? 60 * 1000 : false,
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

// Status-aware hooks: no toast; `error` is an ApiRequestError (`status`, `code`) for the
// page to render `audio_unavailable` / `media_unavailable` / `search_disabled` / a plan gate
// (`isTierError`) as a state.

/**
 * The recording at its permanent public URL, in one request (no polling: a call without a
 * servable recording answers `403 audio_unavailable`).
 */
export function useEarningsAudio(input: EarningsEventSelector) {
    return useEarningsQuery<EarningsAudioResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsAudio({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "audio", ...selectorKey(input)],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsSlidesInput = EarningsEventSelector & {
    include?: "markdown";
    pages?: string;
};

export function useEarningsSlides(input: EarningsSlidesInput) {
    return useEarningsQuery<EarningsSlidesResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        load: apiKey => getEarningsSlides({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "slides", ...selectorKey(input), input.include ?? "", input.pages ?? ""],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsDocumentsInfiniteInput = EarningsEventSelector & {
    include?: "body";
    kind?: Array<string>;
    limit?: number;
};

export function useEarningsDocumentsInfinite(input: EarningsDocumentsInfiniteInput) {
    return useEarningsInfinite<EarningsDocumentsResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        fetchPage: (offset, apiKey) =>
            getEarningsDocuments({ data: { ...input, apiKey, offset } }),
        queryKey: [
            "earnings",
            "documents",
            ...selectorKey(input),
            input.kind?.join(",") ?? "",
            input.include ?? "",
            input.limit ?? "",
        ],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsSearchInput = {
    eventId?: string;
    from?: string;
    identifier?: string;
    limit?: number;
    q: string;
    to?: string;
    type?: EarningsSearchType;
};

/** "Ask this call": runs once `q` is non-empty (set it on submit, not per keystroke). */
export function useEarningsSearch(input: EarningsSearchInput) {
    return useEarningsQuery<EarningsSearchResponse>({
        enabled: input.q.trim().length > 0,
        errorMessage: null,
        load: apiKey => getEarningsSearch({ data: { ...input, apiKey } }),
        queryKey: [
            "earnings",
            "search",
            input.q,
            input.eventId ?? "",
            input.identifier ?? "",
            input.from ?? "",
            input.to ?? "",
            input.type ?? "",
            input.limit ?? "",
        ],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsCompanyDocumentsInfiniteInput = {
    category?: Array<AssetGroupCategory>;
    eventId?: string;
    identifier: string;
    /** `calls` adds every earnings call's documents (`source: "call"`) to the same list. */
    include?: Array<"calls">;
    kind?: Array<string>;
    limit?: number;
    section?: Array<string>;
    year?: number;
};

/** A company's IR documents (`/company-documents`); status-aware, the Documents page renders its own error state. */
export function useEarningsCompanyDocumentsInfinite(input: EarningsCompanyDocumentsInfiniteInput) {
    return useEarningsInfinite<EarningsCompanyDocumentsResponse>({
        enabled: input.identifier.trim().length > 0,
        errorMessage: null,
        fetchPage: (offset, apiKey) => getEarningsCompanyDocuments({ data: { ...input, apiKey, offset } }),
        queryKey: [
            "earnings",
            "company-documents",
            input.identifier,
            input.category?.join(",") ?? "",
            input.section?.join(",") ?? "",
            input.kind?.join(",") ?? "",
            input.year ?? "",
            input.eventId ?? "",
            input.include?.join(",") ?? "",
            input.limit ?? "",
        ],
        staleTime: EARNINGS_LIST_STALE_MS,
    });
}

/** One company document; `pages` adds the per-page text (≤ 2 MB). A null id keeps it idle. */
export function useEarningsCompanyDocument(documentId: null | string, { pages = false }: { pages?: boolean } = {}) {
    return useEarningsQuery<EarningsCompanyDocumentResponse>({
        enabled: Boolean(documentId),
        errorMessage: null,
        load: apiKey => getEarningsCompanyDocument({ data: { apiKey, documentId: documentId ?? "", pages } }),
        queryKey: ["earnings", "company-document", documentId ?? "", pages],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

type EarningsDocumentSearchInput = {
    identifier?: string;
    kind?: Array<string>;
    limit?: number;
    q: string;
    section?: Array<string>;
    table?: "company_documents" | "event_documents";
    year?: number;
};

/** Document search (passages with page numbers): runs once `q` is non-empty (set it on submit). */
export function useEarningsDocumentSearch(input: EarningsDocumentSearchInput) {
    return useEarningsQuery<EarningsDocumentSearchResponse>({
        enabled: input.q.trim().length > 0,
        errorMessage: null,
        load: apiKey => getEarningsDocumentSearch({ data: { ...input, apiKey } }),
        queryKey: [
            "earnings",
            "document-search",
            input.q,
            input.identifier ?? "",
            input.kind?.join(",") ?? "",
            input.section?.join(",") ?? "",
            input.year ?? "",
            input.table ?? "",
            input.limit ?? "",
        ],
        staleTime: EARNINGS_EVENT_STALE_MS,
    });
}

/**
 * The live HLS stream URL of a call (the live player). Never cached (`gcTime: 0`), never
 * retried. Each request costs 5 credits, so it is asked again only every 15 s while
 * `not_started`; otherwise the player refetches it itself — before the loaded URL expires and
 * once on a 403. An empty selector keeps it idle (a call without `live_audio`).
 */
export function useEarningsLiveStream(input: EarningsEventSelector) {
    return useEarningsQuery<EarningsLiveStreamResponse>({
        enabled: hasEventSelector(input),
        errorMessage: null,
        gcTime: 0,
        load: apiKey => getEarningsLiveStream({ data: { ...input, apiKey } }),
        queryKey: ["earnings", "live-stream", ...selectorKey(input)],
        refetchInterval: query => (query.state.data?.status === "not_started" ? 15 * 1000 : false),
        retry: false,
        // Never stale: no refetch on window focus / remount (each one would cost 5 credits).
        staleTime: Number.POSITIVE_INFINITY,
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
