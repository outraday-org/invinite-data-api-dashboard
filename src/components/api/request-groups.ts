import type { QueryKey } from "@tanstack/react-query";

import type { ViewRequest } from "@/components/api/use-view-requests";

/** A query the shell (sidebar, top bar, ticker layout) asks on many pages. */
export type ShellQuery = {
    /** The query key prefix of its hook. */
    prefix: ReadonlyArray<string>;
    /** Who asks it, in a few words (shown beside the folded "App requests"). */
    source: string;
    /** The pages that show its answer themselves: there the request is the page's own. */
    pageOn: (pathname: string, queryKey: QueryKey) => boolean;
};

const isPath = (pathname: string, ...paths: ReadonlyArray<string>) => paths.includes(pathname.replace(/\/+$/, "") || "/");

/**
 * The shell's queries (checked on 2026-11-24). Rule of thumb: a request is "app" when the same request would be sent on
 * a sibling page of the same shell context; when in doubt it is the page's. The filer (`["v2", "filer", …]`) and person
 * (`["v2", "person", …]`) context requests are sent only on `/sec/$cik` / `/people/$personId`, which show the same
 * answers, so they are not here. `/v1/me` is left out before (`viewRequestsOf`). A new shell query needs a row here.
 */
export const SHELL_QUERIES: ReadonlyArray<ShellQuery> = [
    {
        // `useV2LiveEvents` of the sidebar's live count; these pages list the live calls themselves.
        pageOn: pathname => isPath(pathname, "/", "/live-calls", "/calendar") || /^\/[^/]+\/earnings-calls(\/|$)/.test(pathname),
        prefix: ["v2", "events", "live"],
        source: "sidebar live count",
    },
    {
        // `useInstrument` of `$ticker/route.tsx` and the sidebar's instrument context; the overview shows it.
        pageOn: (pathname, queryKey) => typeof queryKey[2] === "string" && pathname.replace(/\/+$/, "").toUpperCase() === `/${queryKey[2].toUpperCase()}`,
        prefix: ["v2", "instrument"],
        source: "instrument header",
    },
    { pageOn: () => false, prefix: ["v2", "instruments", "search"], source: "search" },
    { pageOn: () => false, prefix: ["v2", "people", "search"], source: "search" },
    // The search's filers; the landing page's filer lookup and `/institutions` list filers themselves.
    { pageOn: pathname => isPath(pathname, "/", "/institutions"), prefix: ["v2", "filers"], source: "search" },
];

const startsWith = (queryKey: QueryKey, prefix: ReadonlyArray<string>) => prefix.every((part, index) => queryKey[index] === part);

/** The shell query a query key belongs to; null for a page's own query. */
export function shellQueryOf(queryKey: QueryKey): null | ShellQuery {
    return SHELL_QUERIES.find(({ prefix }) => startsWith(queryKey, prefix)) ?? null;
}

const isWrite = (request: ViewRequest) => request.queryKey.length === 1 && request.queryKey[0] === "write";

/** The view's requests split into the page's own, the shell's ("App requests") and the writes; order kept. */
export function splitRequests(requests: ReadonlyArray<ViewRequest>, pathname: string): {
    app: Array<ViewRequest>;
    page: Array<ViewRequest>;
    writes: Array<ViewRequest>;
} {
    const out = { app: [] as Array<ViewRequest>, page: [] as Array<ViewRequest>, writes: [] as Array<ViewRequest> };

    for (const request of requests) {
        if (isWrite(request)) {
            out.writes.push(request);

            continue;
        }

        const shell = shellQueryOf(request.queryKey);

        (shell && !shell.pageOn(pathname, request.queryKey) ? out.app : out.page).push(request);
    }

    return out;
}

/** Who asked the app requests, each named once ("sidebar live count, instrument header"). */
export function appSourcesOf(app: ReadonlyArray<ViewRequest>): Array<string> {
    return [...new Set(app.map(request => shellQueryOf(request.queryKey)?.source).filter((source): source is string => !!source))];
}

/** Requests of one method + path folded under the first (a list's pages, a repeated call). */
export type RequestRun = {
    first: ViewRequest;
    rest: Array<ViewRequest>;
    /** Every request of the run comes from one query: its rest are "pages". */
    sameQuery: boolean;
};

// A query request's key is `<queryHash>:<page>:<index>` (`viewRequestsOf`): the hash is what precedes the last two parts.
const queryHashOf = (request: ViewRequest) => request.key.slice(0, request.key.lastIndexOf(":", request.key.lastIndexOf(":") - 1));

/** Folds the requests of the same method + path (first appearance order). */
export function foldRuns(requests: ReadonlyArray<ViewRequest>): Array<RequestRun> {
    const runs = new Map<string, RequestRun>();

    for (const request of requests) {
        const id = `${request.meta.method} ${request.meta.path}`;

        const run = runs.get(id);

        if (run) {
            run.rest.push(request);

            run.sameQuery &&= !isWrite(request) && queryHashOf(request) === queryHashOf(run.first);
        }
        else {
            runs.set(id, { first: request, rest: [], sameQuery: true });
        }
    }

    return [...runs.values()];
}
