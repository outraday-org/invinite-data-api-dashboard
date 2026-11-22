import { describe, expect, it } from "vitest";

import { TIER_BADGE_LABELS } from "@/components/ui/credit-hint";

import type { RequestMeta } from "./request-meta";

import { OPERATIONS, PLAN_ORDER, STREAM_TIER } from "./operations.gen";
import { cliOf, curlOf, fileRequests, planAllows, REDACTED, redactSecrets, requestMetaOf, requestsOf, shareWithRequests } from "./request-meta";

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

    it("a colon-verb operation keeps its positional id (`/v1/destinations/{id}:rotate-secret`)", () => {
        expect(cliOf(meta({ method: "POST", operationId: "rotateDestinationSecret", path: "/v1/destinations/dst_1:rotate-secret", query: {} }))).toBe("invd destinations rotate-secret dst_1");

        expect(cliOf(meta({ method: "POST", operationId: "pauseAlertUser", path: "/v1/alert-users/team%2Fa%3Ab%20c:pause", query: {} }))).toBe("invd alert-users pause 'team/a:b c'");
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

    it("Data API 9.0: a PRO plan is refused an ENTERPRISE operation, LITE (a prepaid account's /v1/me plan) reaches a LITE one", () => {
        expect(planAllows("pro", OPERATIONS.listDatasets.tier)).toBe(false);

        expect(planAllows("enterprise", OPERATIONS.listDatasets.tier)).toBe(true);

        expect(planAllows("lite", OPERATIONS.getStandardizedFinancials.tier)).toBe(true);

        expect(planAllows("free", OPERATIONS.getStandardizedFinancials.tier)).toBe(false);

        expect(planAllows("standard", OPERATIONS.listKpis.tier)).toBe(false);
    });

    it("every x-tier of the pinned spec is a plan with a badge label; the stream is PRO", () => {
        const tiers = new Set(Object.values(OPERATIONS).map(operation => operation.tier).filter(tier => tier !== null));

        expect([...tiers].sort()).toEqual(["enterprise", "free", "lite", "pro", "standard"]);

        expect(PLAN_ORDER.map(tier => TIER_BADGE_LABELS[tier])).toEqual(["FREE", "LITE", "STANDARD", "PRO", "ENTERPRISE"]);

        expect(STREAM_TIER).toBe("pro");
    });
});

describe("redactSecrets (alerts task 2: write bodies and answers in the inspector)", () => {
    it("replaces a secret by key name at any depth and every header value; nothing else changes", () => {
        const body = {
            authorization: "Bearer x",
            condition: { keywords: ["token economy"], symbols: ["AAPL"] },
            destinations: [{ headers: { "X-Api-Key": "abc", "X-Trace": "1" }, signing_key: "sk", url: "https://hook.example" }],
            metadata: { password: "p", plan: "gold" },
            secret: "whsec_1",
        };

        expect(redactSecrets(body)).toEqual({
            authorization: REDACTED,
            condition: { keywords: ["token economy"], symbols: ["AAPL"] },
            destinations: [{ headers: { "X-Api-Key": REDACTED, "X-Trace": REDACTED }, signing_key: REDACTED, url: "https://hook.example" }],
            metadata: { password: REDACTED, plan: "gold" },
            secret: REDACTED,
        });
    });

    it("a null secret stays null and a timestamp about a secret is shown (`previous_secret_expires_at`)", () => {
        expect(redactSecrets({ previous_secret_expires_at: "2026-11-23T15:52:00Z", secret: "whsec_1", secret_hint: null })).toEqual({
            previous_secret_expires_at: "2026-11-23T15:52:00Z",
            secret: REDACTED,
            secret_hint: null,
        });

        expect(redactSecrets({ previous_secret_expires_at: null })).toEqual({ previous_secret_expires_at: null });
    });

    it("requestMetaOf records a write's body redacted, a read without one", () => {
        const write = requestMetaOf({ body: { secret: "s", type: "filing" }, method: "POST", schemaPath: "/v1/alerts", url: "https://api.test/v1/alerts" });

        expect(write).toMatchObject({ body: { secret: REDACTED, type: "filing" }, method: "POST", operationId: "createAlert" });

        expect("body" in requestMetaOf({ method: "GET", schemaPath: "/v1/alerts", url: "https://api.test/v1/alerts" })).toBe(false);
    });

    it("the colon-verb routes resolve to their operations", () => {
        expect(requestMetaOf({ method: "POST", schemaPath: "/v1/alerts/{id}:pause", url: "https://api.test/v1/alerts/alt_1:pause" }).operationId).toBe("pauseAlert");

        expect(requestMetaOf({ method: "POST", schemaPath: "/v1/alerts:batch", url: "https://api.test/v1/alerts:batch" }).operationId).toBe("batchAlerts");
    });
});
