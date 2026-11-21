import type { Mutation, MutationCache, Query, QueryCache } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type { RequestMeta } from "@/lib/api/request-meta";
import type { JsonValue } from "@/lib/api/types";

import { isMeQueryKey } from "@/lib/api/queries";
import { redactSecrets, requestsOf } from "@/lib/api/request-meta";

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

/**
 * The writes that ran (alerts task 2): every settled mutation of the cache (kept 5 minutes after its page let go), oldest
 * first, with the requests its server function made. The answer is shown redacted like the body (`redactSecrets`): a
 * secret the API returns once (A3's destination secret) never reaches the JSON view.
 */
export function writeRequestsOf(mutations: ReadonlyArray<Mutation<unknown, Error, unknown, unknown>>): Array<ViewRequest> {
    const out: Array<ViewRequest> = [];

    for (const mutation of mutations) {
        const { data, error, status } = mutation.state;

        if (status !== "success" && status !== "error") continue;

        const target = status === "success" ? data : error;

        requestsOf(target).forEach((meta, index) => {
            out.push({
                answer: status === "success" ? redactSecrets(data as JsonValue) : undefined,
                error: status === "error" ? error : null,
                key: `write:${mutation.mutationId}:${index}`,
                meta,
            });
        });
    }

    return out;
}

/** Subscribes to the query and mutation caches while `enabled` (the sheet is open) and returns the view's requests. */
export function useViewRequests(enabled: boolean): Array<ViewRequest> {
    const queryClient = useQueryClient();

    const cache: QueryCache = queryClient.getQueryCache();

    const mutations: MutationCache = queryClient.getMutationCache();

    const [version, setVersion] = React.useState(0);

    React.useEffect(() => {
        if (!enabled) return;

        // Only what changes the list: a query's state, a query or an observer coming / going. Never the observer
        // option / result events — each render of a `useQuery` (this sheet's own included) emits them: a render loop.
        const unsubscribeQueries = cache.subscribe((event) => {
            if (event.type === "observerOptionsUpdated" || event.type === "observerResultsUpdated") return;

            setVersion(current => current + 1);
        });

        // A write settling or leaving the cache (its observer events are left out, as above).
        const unsubscribeMutations = mutations.subscribe((event) => {
            if (event.type === "observerOptionsUpdated") return;

            setVersion(current => current + 1);
        });

        return () => {
            unsubscribeQueries();

            unsubscribeMutations();
        };
    }, [cache, enabled, mutations]);

    // `version` re-reads the caches after each of their events.
    return React.useMemo(
        () => (enabled && version >= 0 ? [...viewRequestsOf(cache.getAll()), ...writeRequestsOf(mutations.getAll())] : []),
        [cache, enabled, mutations, version],
    );
}
