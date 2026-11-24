import { useEarningsInfinite, useEarningsQuery } from "./queries";
import { getCoin, getCoins } from "./server-functions-coins";

const defaults = { cancelable: true, errorMessage: null, staleTime: 60_000 } as const;

export function useCoinList(query: string, enabled: boolean) {
    const q = query.trim();

    return useEarningsInfinite({
        ...defaults,
        enabled,
        fetchPage: (cursor, apiKey, signal) => getCoins({ data: { apiKey, cursor: cursor ?? undefined, q: q || undefined }, signal }),
        queryKey: ["v2", "coins", "list", q],
    });
}

export function useCoin(coin: string, enabled: boolean) {
    return useEarningsQuery({
        ...defaults,
        enabled,
        load: (apiKey, signal) => getCoin({ data: { apiKey, coin }, signal }),
        queryKey: ["v2", "coins", "detail", coin],
    });
}
