import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ViewRequest } from "@/components/api/use-view-requests";
import type { RequestMeta } from "@/lib/api/request-meta";

import { appSourcesOf, foldRuns, SHELL_QUERIES, splitRequests } from "@/components/api/request-groups";

const meta = (path: string, patch: Partial<RequestMeta> = {}): RequestMeta => ({
    credits: 1,
    method: "GET",
    operationId: "unknown",
    path,
    query: {},
    requestId: null,
    status: 200,
    ...patch,
});

const request = (queryKey: ReadonlyArray<unknown>, path: string, key = `${JSON.stringify(queryKey)}:0:0`): ViewRequest => ({
    answer: {},
    error: null,
    key,
    meta: meta(path),
    queryKey,
});

const LIVE = request(["v2", "events", "live"], "/v1/events");

const INSTRUMENT = request(["v2", "instrument", "AAPL"], "/v1/instruments/AAPL");

const SEARCH = request(["v2", "instruments", "search", "app", ""], "/v1/instruments");

const LOOKUP_FILERS = request(["v2", "filers", "berk", 20, ""], "/v1/filers");

const DIVIDENDS = request(["v2", "dividends", "AAPL"], "/v1/dividends");

const WRITE = request(["write"], "/v1/alerts", "write:1:0");

const ALL = [LIVE, INSTRUMENT, SEARCH, LOOKUP_FILERS, DIVIDENDS, WRITE];

const paths = (requests: ReadonlyArray<ViewRequest>) => requests.map(item => item.meta.path);

describe("splitRequests", () => {
    it("/AAPL/dividends: the dividends are the page's; live count, instrument, search and filers are the shell's", () => {
        const { app, page, writes } = splitRequests(ALL, "/AAPL/dividends");

        expect(paths(page)).toEqual(["/v1/dividends"]);

        expect(paths(app)).toEqual(["/v1/events", "/v1/instruments/AAPL", "/v1/instruments", "/v1/filers"]);

        expect(paths(writes)).toEqual(["/v1/alerts"]);

        expect(appSourcesOf(app)).toEqual(["sidebar live count", "instrument header", "search"]);
    });

    it("/account: only its own requests are the page's", () => {
        const status = request(["v2", "status"], "/status");

        expect(paths(splitRequests([LIVE, status], "/account").page)).toEqual(["/status"]);
    });

    it("/AAPL (the overview) shows the instrument itself; another symbol's stays the shell's", () => {
        expect(paths(splitRequests([INSTRUMENT, LIVE], "/AAPL").page)).toEqual(["/v1/instruments/AAPL"]);

        expect(paths(splitRequests([INSTRUMENT], "/aapl/").page)).toEqual(["/v1/instruments/AAPL"]);

        expect(paths(splitRequests([INSTRUMENT], "/MSFT").page)).toEqual([]);
    });

    it("/alerts: a write is listed apart, never as the page's", () => {
        const alerts = request(["alerts", "list"], "/v1/alerts");

        const { page, writes } = splitRequests([alerts, WRITE], "/alerts");

        expect(paths(page)).toEqual(["/v1/alerts"]);

        expect(writes).toEqual([WRITE]);
    });

    it("/live-calls, the calls list and the call page list the live calls themselves", () => {
        for (const pathname of ["/live-calls", "/", "/calendar", "/AAPL/earnings-calls", "/AAPL/earnings-calls/evt_1"]) {
            expect({ page: paths(splitRequests([LIVE], pathname).page), pathname }).toEqual({ page: ["/v1/events"], pathname });
        }
    });

    it("/: the filer lookup's filers are the page's; on /institutions too", () => {
        expect(paths(splitRequests([LOOKUP_FILERS, SEARCH], "/").page)).toEqual(["/v1/filers"]);

        expect(paths(splitRequests([LOOKUP_FILERS], "/institutions").page)).toEqual(["/v1/filers"]);
    });

    it("every shell query prefix is the key prefix of a real hook", () => {
        const source = readFileSync(resolve(__dirname, "../../lib/api/queries.ts"), "utf8");

        for (const { prefix } of SHELL_QUERIES) {
            expect({ found: source.includes(`queryKey: [${prefix.map(part => JSON.stringify(part)).join(", ")}`), prefix }).toEqual({ found: true, prefix });
        }
    });
});

describe("foldRuns", () => {
    it("folds a list's pages under its first; other paths stay apart", () => {
        const page1 = request(["v2", "dividends", "AAPL"], "/v1/dividends", "h:0:0");

        const page2 = request(["v2", "dividends", "AAPL"], "/v1/dividends", "h:1:0");

        const runs = foldRuns([page1, INSTRUMENT, page2]);

        expect(runs.map(run => [run.first.key, run.rest.map(item => item.key), run.sameQuery])).toEqual([
            ["h:0:0", ["h:1:0"], true],
            [INSTRUMENT.key, [], true],
        ]);
    });

    it("two queries asking the same path are 'requests', not 'pages'", () => {
        const one = request(["a"], "/v1/filings", "[\"a\"]:0:0");

        const two = request(["b"], "/v1/filings", "[\"b\"]:0:0");

        expect(foldRuns([one, two])[0].sameQuery).toBe(false);
    });
});
