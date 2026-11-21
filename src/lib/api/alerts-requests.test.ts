import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestMeta } from "./request-meta";

import { ALERT_FILING, BATCH_PARTIAL, EVENTS_PAGE_FIXTURE } from "../alerts/alerts-fixtures";
import { ApiRequestError } from "./errors";
import { idempotencyKeyFor } from "./mutations";
import { REDACTED } from "./request-meta";

const env = vi.hoisted(() => ({ INVINITE_DATA_API_KEY: undefined as string | undefined, INVINITE_DATA_API_URL: "https://api.test" }));

vi.mock("../env", () => ({ env }));

const { createApiClient, recordApiRequests } = await import("./client.server");

const requests = await import("./alerts-requests");

type Sent = { body: string; headers: Headers; method: string; url: string };

/** A mocked `fetch` answering `answer` and keeping what was sent (URL as encoded, method, headers, body). */
function mockFetch(answer: () => Response) {
    const sent: Array<Sent> = [];

    vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
        sent.push({ body: await request.clone().text(), headers: request.headers, method: request.method, url: request.url });

        return answer();
    }));

    return sent;
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "X-Request-Id": "req_1" }, status });

const problem = (status: number, code: string, detail: string) => () => new Response(
    JSON.stringify({ code, detail, docs_url: "https://x", remedy: "r", request_id: "req_p", status, title: code, type: "https://x" }),
    { headers: { "Content-Type": "application/problem+json" }, status },
);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the colon verbs reach the API as written (openapi-fetch path encoding)", () => {
    it.each([
        ["pauseAlertRequest", "https://api.test/v1/alerts/alt_1:pause"],
        ["resumeAlertRequest", "https://api.test/v1/alerts/alt_1:resume"],
        ["testAlertRequest", "https://api.test/v1/alerts/alt_1:test"],
    ] as const)("%s → POST %s", async (name, url) => {
        const sent = mockFetch(json(name === "testAlertRequest" ? { event_id: "evt_9" } : ALERT_FILING, name === "testAlertRequest" ? 202 : 200));

        await requests[name](createApiClient("k"), "alt_1");

        expect(sent).toHaveLength(1);

        expect(sent[0]).toMatchObject({ method: "POST", url });
    });

    it("batchAlerts → POST /v1/alerts:batch with the items", async () => {
        const sent = mockFetch(json(BATCH_PARTIAL));

        const answer = await requests.batchAlertsRequest(createApiClient("k"), [{ id: "alt_1", op: "pause" }, { id: "alt_gone", op: "pause" }]);

        expect(sent[0]).toMatchObject({ method: "POST", url: "https://api.test/v1/alerts:batch" });

        expect(JSON.parse(sent[0].body)).toEqual({ items: [{ id: "alt_1", op: "pause" }, { id: "alt_gone", op: "pause" }] });

        expect(answer.results.filter(result => !result.ok)).toHaveLength(1);
    });

    it("an id with reserved characters is encoded inside the path, the verb stays", async () => {
        const sent = mockFetch(json(ALERT_FILING));

        await requests.pauseAlertRequest(createApiClient("k"), "alt/x y");

        expect(sent[0].url).toBe("https://api.test/v1/alerts/alt%2Fx%20y:pause");
    });
});

describe("listAlerts (Data API 7.1 filters)", () => {
    it("sends symbol and destination_id with the 7.0 filters; unset ones are not sent", async () => {
        const sent = mockFetch(json({ data: [], has_more: false, meta: {}, next_cursor: null }));

        await requests.listAlertsRequest(createApiClient("k"), { destination_id: "dst_1", limit: 100, status: "active", symbol: "AAPL" });

        const url = new URL(sent[0].url);

        expect(url.pathname).toBe("/v1/alerts");

        expect(Object.fromEntries(url.searchParams)).toEqual({ destination_id: "dst_1", limit: "100", status: "active", symbol: "AAPL" });
    });
});

describe("createAlert", () => {
    const body = { condition: { symbols: ["AAPL"] }, type: "filing" as const };

    it("sends the Idempotency-Key of the submission; a double submit of the same body sends the same key", async () => {
        const sent = mockFetch(json(ALERT_FILING, 201));

        let held = idempotencyKeyFor(null, body, () => "key-1");

        await requests.createAlertRequest(createApiClient("k"), { body, idempotencyKey: held.key });

        held = idempotencyKeyFor(held, body, () => "key-2");

        await requests.createAlertRequest(createApiClient("k"), { body, idempotencyKey: held.key });

        expect(sent.map(request => request.headers.get("Idempotency-Key"))).toEqual(["key-1", "key-1"]);

        expect(idempotencyKeyFor(held, { ...body, type: "news" }, () => "key-3").key).toBe("key-3");
    });

    it("validate_only=true sends no key and answers an object for the 204", async () => {
        const sent = mockFetch(() => new Response(null, { status: 204 }));

        const answer = await requests.createAlertRequest(createApiClient("k"), { body, idempotencyKey: "ignored", validateOnly: true });

        expect(new URL(sent[0].url).searchParams.get("validate_only")).toBe("true");

        expect(sent[0].headers.get("Idempotency-Key")).toBeNull();

        expect(answer).toEqual({ done: "validated", id: null });
    });

    it("a 400 problem arrives as ApiRequestError with its param", async () => {
        mockFetch(() => new Response(
            JSON.stringify({ code: "invalid_parameter", detail: "condition.level: must be > 0", docs_url: "https://x", param: "condition.level", remedy: "r", request_id: "req_2", status: 400, title: "Invalid", type: "https://x" }),
            { headers: { "Content-Type": "application/problem+json" }, status: 400 },
        ));

        const error = await requests.createAlertRequest(createApiClient("k"), { body }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiRequestError);

        expect(error).toMatchObject({ code: "invalid_parameter", status: 400 });

        expect((error as ApiRequestError).body.param).toBe("condition.level");
    });
});

describe("updateAlert / deleteAlert / events / templates", () => {
    it("PATCH with the version; a moved version is a 409 conflict", async () => {
        const sent = mockFetch(problem(409, "conflict", "The alert is at version 3"));

        const error = await requests.updateAlertRequest(createApiClient("k"), "alt_1", { condition: {}, version: 2 }).catch((caught: unknown) => caught);

        expect(sent[0]).toMatchObject({ method: "PATCH", url: "https://api.test/v1/alerts/alt_1" });

        expect(JSON.parse(sent[0].body)).toMatchObject({ version: 2 });

        expect(error).toMatchObject({ code: "conflict", status: 409 });
    });

    it("DELETE answers an object (204 has no body)", async () => {
        const sent = mockFetch(() => new Response(null, { status: 204 }));

        expect(await requests.deleteAlertRequest(createApiClient("k"), "alt_1")).toEqual({ done: "deleted", id: "alt_1" });

        expect(sent[0]).toMatchObject({ method: "DELETE", url: "https://api.test/v1/alerts/alt_1" });
    });

    it("the event reads send their filters", async () => {
        const sent = mockFetch(json(EVENTS_PAGE_FIXTURE));

        await requests.listAlertEventsRequest(createApiClient("k"), { after: "evt_1", alert_id: "alt_1", limit: 200, type: "alert.fired" });

        await requests.listAlertEventsForAlertRequest(createApiClient("k"), "alt_1", { cursor: "c2", limit: 200 });

        await requests.getAlertEventRequest(createApiClient("k"), "evt_1");

        await requests.listAlertTemplatesRequest(createApiClient("k"), { limit: 200 });

        expect(sent.map(request => request.url)).toEqual([
            "https://api.test/v1/alert-events?after=evt_1&alert_id=alt_1&limit=200&type=alert.fired",
            "https://api.test/v1/alerts/alt_1/events?cursor=c2&limit=200",
            "https://api.test/v1/alert-events/evt_1",
            "https://api.test/v1/alert-templates?limit=200",
        ]);
    });
});

describe("the inspector's recorder on writes", () => {
    it("records a write's body redacted (secrets by key name, header values) and never a request header", async () => {
        mockFetch(json(ALERT_FILING, 201));

        const recorded: Array<RequestMeta> = [];

        await recordApiRequests(recorded, () => requests.createAlertRequest(createApiClient("the-key"), {
            body: { condition: { symbols: ["AAPL"] }, metadata: { api_key: "k1", headers: { "X-Auth": "s3cr3t" }, list: "tech", secret: "whsec_1" }, type: "filing" },
            idempotencyKey: "idem-1",
        }));

        expect(recorded).toHaveLength(1);

        expect(recorded[0]).toMatchObject({ method: "POST", operationId: "createAlert", path: "/v1/alerts", status: 201 });

        expect(recorded[0].body).toEqual({
            condition: { symbols: ["AAPL"] },
            metadata: { api_key: REDACTED, headers: { "X-Auth": REDACTED }, list: "tech", secret: REDACTED },
            type: "filing",
        });

        const text = JSON.stringify(recorded);

        expect(text).not.toContain("the-key");

        expect(text).not.toContain("idem-1");

        expect(text).not.toContain("s3cr3t");
    });

    it("a read records no body; outside a recorded call nothing is kept", async () => {
        mockFetch(json(ALERT_FILING));

        const recorded: Array<RequestMeta> = [];

        await recordApiRequests(recorded, () => requests.getAlertRequest(createApiClient("k"), "alt_1"));

        expect(recorded[0].body).toBeUndefined();

        await requests.pauseAlertRequest(createApiClient("k"), "alt_1");

        expect(recorded).toHaveLength(1);
    });
});
