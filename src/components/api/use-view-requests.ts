import type { Query, QueryCache } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type { RequestMeta } from "@/lib/api/request-meta";

import { isMeQueryKey } from "@/lib/api/queries";
import { requestsOf } from "@/lib/api/request-meta";

/** One request behind the view: its descriptor, the answer it produced (one page of a list) or the error. */
export type ViewRequest = {
    /** The answer object (a list's page); undefined for a failed request. */
    answer: unknown;
    error: unknown;
    key: string;
    meta: RequestMeta;
};

const answersOf = (data: unknown): ReadonlyArray<unknown> => {
    if (data && typeof data === "object" && "pages" in data && Array.isArray((data as { pages: unknown }).pages)) {
        return (data as { pages: ReadonlyArray<unknown> }).pages;
    }

    return data === undefined ? [] : [data];
};

/**
 * The requests of every query the page shows right now (a query with a mounted observer), in cache order, each page
 * of a list in order. `/v1/me` (the key gate's, on every page) is left out. A query whose answer carries no filed
 * requests (fixtures, an array answer) adds nothing.
 */
export function viewRequestsOf(queries: ReadonlyArray<Query>): Array<ViewRequest> {
    const out: Array<ViewRequest> = [];

    for (const query of queries) {
        if (query.getObserversCount() === 0 || isMeQueryKey(query.queryKey)) continue;

        answersOf(query.state.data).forEach((answer, pageIndex) => {
            requestsOf(answer).forEach((meta, index) => {
                out.push({ answer, error: null, key: `${query.queryHash}:${pageIndex}:${index}`, meta });
            });
        });

        // A failed request (first page or a later one) after the answers it follows.
        if (query.state.error) {
            requestsOf(query.state.error).forEach((meta, index) => {
                out.push({ answer: undefined, error: query.state.error, key: `${query.queryHash}:error:${index}`, meta });
            });
        }
    }

    return out;
}

/** Subscribes to the query cache while `enabled` (the sheet is open) and returns the view's requests. */
export function useViewRequests(enabled: boolean): Array<ViewRequest> {
    const queryClient = useQueryClient();

    const cache: QueryCache = queryClient.getQueryCache();

    const [version, setVersion] = React.useState(0);

    React.useEffect(() => {
        if (!enabled) return;

        // Only what changes the list: a query's state, a query or an observer coming / going. Never the observer
        // option / result events — each render of a `useQuery` (this sheet's own included) emits them: a render loop.
        return cache.subscribe((event) => {
            if (event.type === "observerOptionsUpdated" || event.type === "observerResultsUpdated") return;

            setVersion(current => current + 1);
        });
    }, [cache, enabled]);

    // `version` re-reads the cache after each of its events.
    return React.useMemo(() => (enabled && version >= 0 ? viewRequestsOf(cache.getAll()) : []), [cache, enabled, version]);
}
