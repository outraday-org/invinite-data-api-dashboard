import { describe, expect, it } from "vitest";

import type { RequestMeta } from "./request-meta";

import { cliOf, curlOf, fileRequests, planAllows, requestMetaOf, requestsOf, shareWithRequests } from "./request-meta";

const meta = (patch: Partial<RequestMeta> = {}): RequestMeta => ({
    credits: 1,
    method: "GET",
    operationId: "listInsiderTrades",
    path: "/v1/insider-trades",
    query: { "company": "AAPL", "filed_at.gte": "2026-01-01", "limit": "50" },
    requestId: "req_1",
    status: 200,
    ...patch,
});

describe("requestMetaOf (server recorder)", () => {
    it("reads the operation, the concrete path, the query as sent and the answer's headers — never a request header", () => {
        const recorded = requestMetaOf({
            headers: new Headers({ "X-Credits-Charged": "2", "X-Request-Id": "req_9" }),
            method: "get",
            schemaPath: "/v1/funds/{fund}",
            status: 200,
            url: "https://api.test/v1/funds/SPY?expand=a&tag=x&tag=y",
        });

        expect(recorded).toEqual({
            credits: 2,
            method: "GET",
            operationId: "getFund",
            path: "/v1/funds/SPY",
            query: { expand: "a", tag: ["x", "y"] },
            requestId: "req_9",
            status: 200,
        });

        expect(JSON.stringify(recorded)).not.toMatch(/Bearer|Authorization/i);
    });

    it("an unknown route is `unknown`, a missing header null", () => {
        expect(requestMetaOf({ method: "GET", schemaPath: "/v9/x", url: "https://api.test/v9/x" })).toMatchObject({ credits: null, operationId: "unknown", requestId: null });
    });
});

describe("curlOf / cliOf", () => {
    it("the curl uses $INVINITE_API_KEY and the exact URL", () => {
        expect(curlOf("https://api.data.invinite.com/", meta())).toBe(
            "curl -sS -H \"Authorization: Bearer $INVINITE_API_KEY\" 'https://api.data.invinite.com/v1/insider-trades?company=AAPL&filed_at.gte=2026-01-01&limit=50'",
        );
    });

    it("the CLI line puts the positional parameter first and every other one as its long flag", () => {
        expect(cliOf(meta())).toBe("invd insider-trades list AAPL --filed-at-gte 2026-01-01 --limit 50");

        expect(cliOf(meta({ operationId: "getInstrument", path: "/v1/instruments/BRK.B", query: {} }))).toBe("invd instruments get BRK.B");

        expect(cliOf(meta({ operationId: "unknown" }))).toBeNull();
    });
});

describe("the browser registry", () => {
    it("files requests under an answer and carries them through structural sharing (pages one by one)", () => {
        const page1 = { data: [1], next_cursor: "c" };

        const page2 = { data: [2], next_cursor: null };

        fileRequests(page1, [meta({ requestId: "p1" })]);

        fileRequests(page2, [meta({ requestId: "p2" }), { not: "a meta" }]);

        const previous = { pageParams: [null], pages: [{ data: [1], next_cursor: "c" }] };

        const shared = shareWithRequests(previous, { pageParams: [null, "c"], pages: [page1, page2] }) as { pages: Array<unknown> };

        expect(requestsOf(shared.pages[0]).map(entry => entry.requestId)).toEqual(["p1"]);

        expect(requestsOf(shared.pages[1]).map(entry => entry.requestId)).toEqual(["p2"]);

        expect(requestsOf("text")).toEqual([]);
    });
});

describe("planAllows", () => {
    it("follows the spec's plan order", () => {
        expect(planAllows("free", "pro")).toBe(false);

        expect(planAllows("lite", "standard")).toBe(false);

        expect(planAllows("standard", "standard")).toBe(true);

        expect(planAllows("enterprise", "pro")).toBe(true);

        expect(planAllows("free", null)).toBe(true);
    });
});
