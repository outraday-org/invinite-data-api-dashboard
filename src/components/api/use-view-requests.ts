import type { Mutation, MutationCache, Query, QueryCache, QueryKey } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type { RequestMeta } from "@/lib/api/request-meta";
import type { JsonValue } from "@/lib/api/types";

import { splitRequests } from "@/components/api/request-groups";
import { isMeQueryKey } from "@/lib/api/queries";
import { redactAnswerFor, requestsOf, SECRET_ANSWER_FIELDS } from "@/lib/api/request-meta";

/** One request behind the view: its descriptor, the answer it produced (one page of a list) or the error. */
export type ViewRequest = {
    /** The answer object (a list's page); undefined for a failed request. */
    answer: unknown;
    error: unknown;
    key: string;
    meta: RequestMeta;
    /** The query key of the hook that asked (`["write"]` for a write): the request panel's page / app split. */
    queryKey: QueryKey;
};

/** The query key every write carries (`writeRequestsOf`). */
export const WRITE_QUERY_KEY: QueryKey = ["write"];

const answersOf = (data: unknown): ReadonlyArray<unknown> => {
    if (data && typeof data === "object" && "pages" in data && Array.isArray((data as { pages: unknown }).pages)) {
        return (data as { pages: ReadonlyArray<unknown> }).pages;
    }

    return data === undefined ? [] : [data];
};

/**
 * The requests of every query the page shows right now (a query with an enabled observer: a mounted hook switched off
 * by `enabled: false` — the closed tabs of the catalog — is not this view's), in cache order, each page of a list in
 * order. `/v1/me` (the key gate's, on every page) is left out. A query whose answer carries no filed
 * requests (fixtures, an array answer) adds nothing.
 */
export function viewRequestsOf(queries: ReadonlyArray<Query>): Array<ViewRequest> {
    const out: Array<ViewRequest> = [];

    for (const query of queries) {
        if (!query.isActive() || isMeQueryKey(query.queryKey)) continue;

        answersOf(query.state.data).forEach((answer, pageIndex) => {
            requestsOf(answer).forEach((meta, index) => {
                // An operation whose answer field is secret (a bulk download's signed URL) is never a query; redacted anyway.
                const shown = SECRET_ANSWER_FIELDS[meta.operationId] ? redactAnswerFor(meta.operationId, answer as JsonValue) : answer;

                out.push({ answer: shown, error: null, key: `${query.queryHash}:${pageIndex}:${index}`, meta, queryKey: query.queryKey });
            });
        });

        // A failed request (first page or a later one) after the answers it follows.
        if (query.state.error) {
            requestsOf(query.state.error).forEach((meta, index) => {
                out.push({ answer: undefined, error: query.state.error, key: `${query.queryHash}:error:${index}`, meta, queryKey: query.queryKey });
            });
        }
    }

    return out;
}

/**
 * The writes that ran (alerts task 2): every settled mutation of the cache (kept 5 minutes after its page let go), oldest
 * first, with the requests its server function made. The answer is shown redacted like the body (`redactSecrets`): a
 * secret the API returns once (A3's destination secret) never reaches the JSON view. A field secret for one operation
 * only — the signed `url` of the two bulk downloads (sec-bulk-downloads task 8) — is redacted by the request's
 * operation id (`redactAnswerFor`), so neither the panel nor its Copy / Download as JSON ever carries it.
 */
export function writeRequestsOf(mutations: ReadonlyArray<Mutation<unknown, Error, unknown, unknown>>): Array<ViewRequest> {
    const out: Array<ViewRequest> = [];

    for (const mutation of mutations) {
        const { data, error, status } = mutation.state;

        if (status !== "success" && status !== "error") continue;

        const target = status === "success" ? data : error;

        requestsOf(target).forEach((meta, index) => {
            out.push({
                answer: status === "success" ? redactAnswerFor(meta.operationId, data as JsonValue) : undefined,
                error: status === "error" ? error : null,
                key: `write:${mutation.mutationId}:${index}`,
                meta,
                queryKey: WRITE_QUERY_KEY,
            });
        });
    }

    return out;
}

/**
 * Calls `onEvent` after every query / mutation cache event that can change the request list, while `enabled`: a query's
 * state, a query or an observer coming / going, a write settling or leaving. Never the observer option / result events
 * — each render of a `useQuery` (the panel's own included) emits them: a render loop.
 *
 * Events fire synchronously, and some while ANOTHER component renders (a `useQuery` building its query emits `added`
 * from that component's render): setting state then is React's "Cannot update a component while rendering a different
 * component". So `onEvent` never runs inside the event: the events of one tick are coalesced into one call on a
 * microtask, after the render. `onEvent` only sets state; it is memoised by the caller.
 */
function useCacheEvents(enabled: boolean, onEvent: () => void) {
    const queryClient = useQueryClient();

    const cache: QueryCache = queryClient.getQueryCache();

    const mutations: MutationCache = queryClient.getMutationCache();

    React.useEffect(() => {
        if (!enabled) return;

        let scheduled = false;

        let active = true;

        const schedule = () => {
            if (scheduled) return;

            scheduled = true;

            queueMicrotask(() => {
                scheduled = false;

                if (active) onEvent();
            });
        };

        const unsubscribeQueries = cache.subscribe((event) => {
            if (event.type === "observerOptionsUpdated" || event.type === "observerResultsUpdated") return;

            schedule();
        });

        const unsubscribeMutations = mutations.subscribe((event) => {
            if (event.type === "observerOptionsUpdated") return;

            schedule();
        });

        // Catch up with what happened before the subscription (queries of the same commit, a change of `onEvent`).
        onEvent();

        return () => {
            active = false;

            unsubscribeQueries();

            unsubscribeMutations();
        };
    }, [cache, enabled, mutations, onEvent]);
}

/** Subscribes to the query and mutation caches while `enabled` (the panel is open) and returns the view's requests. */
export function useViewRequests(enabled: boolean): Array<ViewRequest> {
    const queryClient = useQueryClient();

    const cache: QueryCache = queryClient.getQueryCache();

    const mutations: MutationCache = queryClient.getMutationCache();

    const [version, setVersion] = React.useState(0);

    const bump = React.useCallback(() => setVersion(current => current + 1), []);

    useCacheEvents(enabled, bump);

    // `version` re-reads the caches after each of their events.
    return React.useMemo(
        () => (enabled && version >= 0 ? [...viewRequestsOf(cache.getAll()), ...writeRequestsOf(mutations.getAll())] : []),
        [cache, enabled, mutations, version],
    );
}

/**
 * The number of the page's own requests (`splitRequests(…).page`) for the top bar's toggle, known while the panel is
 * closed: always subscribed, but it keeps one number — a cache event that leaves it unchanged re-renders nothing.
 */
export function useViewRequestCount(pathname: string): number {
    const cache: QueryCache = useQueryClient().getQueryCache();

    const [count, setCount] = React.useState(0);

    const recount = React.useCallback(() => setCount(splitRequests(viewRequestsOf(cache.getAll()), pathname).page.length), [cache, pathname]);

    // A navigation (a new `recount`) re-subscribes and counts again: it changes what is the page's without a cache event.
    useCacheEvents(true, recount);

    return count;
}
