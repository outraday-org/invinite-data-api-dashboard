import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestMeta } from "./request-meta";

import { DELIVERIES_PAGE_FIXTURE, DESTINATION_ACTIVE, DESTINATION_CREATED, DESTINATION_SECRET, DESTINATION_TEST_ACCEPTED, DESTINATIONS_PAGE_FIXTURE, FIXTURE_SECRET } from "../alerts/destinations-fixtures";
import { ApiRequestError } from "./errors";
import { idempotencyKeyFor } from "./mutations";
import { REDACTED } from "./request-meta";

const env = vi.hoisted(() => ({ INVINITE_DATA_API_KEY: undefined as string | undefined, INVINITE_DATA_API_URL: "https://api.test" }));

vi.mock("../env", () => ({ env }));

const { createApiClient, recordApiRequests } = await import("./client.server");

const requests = await import("./destinations-requests");

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

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the colon verbs reach the API as written (openapi-fetch path encoding)", () => {
    it("rotateDestinationSecret → POST /v1/destinations/{id}:rotate-secret", async () => {
        const sent = mockFetch(json(DESTINATION_SECRET));

        const answer = await requests.rotateDestinationSecretRequest(createApiClient("k"), "dst_1");

        expect(sent).toHaveLength(1);

        expect(sent[0]).toMatchObject({ method: "POST", url: "https://api.test/v1/destinations/dst_1:rotate-secret" });

        expect(answer.previous_secret_expires_at).toBe(DESTINATION_SECRET.previous_secret_expires_at);
    });

    it("testDestination → POST /v1/destinations/{id}:test, answering the event and delivery ids (202)", async () => {
        const sent = mockFetch(json(DESTINATION_TEST_ACCEPTED, 202));

        expect(await requests.testDestinationRequest(createApiClient("k"), "dst_1")).toEqual(DESTINATION_TEST_ACCEPTED);

        expect(sent[0]).toMatchObject({ method: "POST", url: "https://api.test/v1/destinations/dst_1:test" });
    });

    it("an id with reserved characters is encoded inside the path, the verb stays", async () => {
        const sent = mockFetch(json(DESTINATION_SECRET));

        await requests.rotateDestinationSecretRequest(createApiClient("k"), "dst/x y");

        expect(sent[0].url).toBe("https://api.test/v1/destinations/dst%2Fx%20y:rotate-secret");
    });
});

describe("the other destination operations", () => {
    it("list, get and the delivery log send their paging; delete answers an object for its 204; update is a PATCH", async () => {
        const sent = mockFetch(json(DESTINATIONS_PAGE_FIXTURE));

        await requests.listDestinationsRequest(createApiClient("k"), { cursor: "c1", limit: 200 });

        mockFetch(json(DESTINATION_ACTIVE));

        await requests.getDestinationRequest(createApiClient("k"), "dst_1");

        const later = mockFetch(json(DELIVERIES_PAGE_FIXTURE));

        await requests.listDestinationDeliveriesRequest(createApiClient("k"), "dst_1", { cursor: "c2", limit: 100 });

        expect(sent[0].url).toBe("https://api.test/v1/destinations?cursor=c1&limit=200");

        expect(later[0].url).toBe("https://api.test/v1/destinations/dst_1/deliveries?cursor=c2&limit=100");

        const patch = mockFetch(json({ ...DESTINATION_ACTIVE, status: "active" }));

        await requests.updateDestinationRequest(createApiClient("k"), "dst_1", { status: "active" });

        expect(patch[0]).toMatchObject({ method: "PATCH", url: "https://api.test/v1/destinations/dst_1" });

        expect(JSON.parse(patch[0].body)).toEqual({ status: "active" });

        const removed = mockFetch(() => new Response(null, { status: 204 }));

        expect(await requests.deleteDestinationRequest(createApiClient("k"), "dst_1")).toEqual({ done: "deleted", id: "dst_1" });

        expect(removed[0]).toMatchObject({ method: "DELETE", url: "https://api.test/v1/destinations/dst_1" });
    });

    it("createDestination sends the submission's Idempotency-Key; a double submit of the same body sends the same key", async () => {
        const sent = mockFetch(json(DESTINATION_CREATED, 201));

        const body = { url: "https://hooks.example.com/invinite-alerts" };

        let held = idempotencyKeyFor(null, body, () => "key-1");

        await requests.createDestinationRequest(createApiClient("k"), { body, idempotencyKey: held.key });

        held = idempotencyKeyFor(held, body, () => "key-2");

        await requests.createDestinationRequest(createApiClient("k"), { body, idempotencyKey: held.key });

        expect(sent.map(request => request.headers.get("Idempotency-Key"))).toEqual(["key-1", "key-1"]);

        expect(sent[0]).toMatchObject({ method: "POST", url: "https://api.test/v1/destinations" });
    });

    it("a refused URL (private address) arrives as ApiRequestError with its param", async () => {
        mockFetch(() => new Response(
            JSON.stringify({ code: "invalid_parameter", detail: "url: private addresses are not allowed", docs_url: "https://x", param: "url", remedy: "r", request_id: "req_2", status: 400, title: "Invalid", type: "https://x" }),
            { headers: { "Content-Type": "application/problem+json" }, status: 400 },
        ));

        const error = await requests.createDestinationRequest(createApiClient("k"), { body: { url: "https://10.0.0.1/hook" } }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiRequestError);

        expect((error as ApiRequestError).body.param).toBe("url");
    });
});

describe("secrets never reach the browser through a read or the recorder", () => {
    it("a read answer is scrubbed of any secret / header value on the server (the contract has none; should it ever)", async () => {
        const leaking = { ...DESTINATION_ACTIVE, headers: { "X-Receiver-Token": "tok_live_1" }, secret: "whsec_leak" };

        mockFetch(json({ ...DESTINATIONS_PAGE_FIXTURE, data: [leaking] }));

        const page = await requests.listDestinationsRequest(createApiClient("k"), {});

        mockFetch(json(leaking));

        const one = await requests.getDestinationRequest(createApiClient("k"), "dst_1");

        mockFetch(json(leaking));

        const updated = await requests.updateDestinationRequest(createApiClient("k"), "dst_1", { description: "x" });

        const text = JSON.stringify([page, one, updated]);

        expect(text).not.toContain("whsec_leak");

        expect(text).not.toContain("tok_live_1");

        expect(one.secret_hint).toBe("abcd");

        expect(one.header_names).toEqual(["X-Receiver-Token"]);
    });

    it("records a create's body with every header value redacted, never the key, never the answer's secret", async () => {
        mockFetch(json(DESTINATION_CREATED, 201));

        const recorded: Array<RequestMeta> = [];

        await recordApiRequests(recorded, () => requests.createDestinationRequest(createApiClient("the-key"), {
            body: { description: "Prod", headers: { "Authorization": "Bearer tok_live_2", "X-Receiver-Token": "tok_live_3" }, url: "https://hooks.example.com/a" },
            idempotencyKey: "idem-1",
        }));

        expect(recorded).toHaveLength(1);

        expect(recorded[0]).toMatchObject({ method: "POST", operationId: "createDestination", path: "/v1/destinations", status: 201 });

        expect(recorded[0].body).toEqual({ description: "Prod", headers: { "Authorization": REDACTED, "X-Receiver-Token": REDACTED }, url: "https://hooks.example.com/a" });

        const text = JSON.stringify(recorded);

        for (const secret of ["the-key", "idem-1", "tok_live_2", "tok_live_3", FIXTURE_SECRET]) expect(text).not.toContain(secret);
    });

    it("records an update's replaced headers redacted, and the rotate / test writes by their colon-verb operation ids", async () => {
        mockFetch(json(DESTINATION_ACTIVE));

        const recorded: Array<RequestMeta> = [];

        await recordApiRequests(recorded, () => requests.updateDestinationRequest(createApiClient("k"), "dst_1", { headers: { "X-Auth": "tok_live_4" } }));

        mockFetch(json(DESTINATION_SECRET));

        await recordApiRequests(recorded, () => requests.rotateDestinationSecretRequest(createApiClient("k"), "dst_1"));

        mockFetch(json(DESTINATION_TEST_ACCEPTED, 202));

        await recordApiRequests(recorded, () => requests.testDestinationRequest(createApiClient("k"), "dst_1"));

        expect(recorded.map(meta => meta.operationId)).toEqual(["updateDestination", "rotateDestinationSecret", "testDestination"]);

        expect(recorded[0].body).toEqual({ headers: { "X-Auth": REDACTED } });

        expect(JSON.stringify(recorded)).not.toContain("tok_live_4");

        expect(JSON.stringify(recorded)).not.toContain(DESTINATION_SECRET.secret);
    });
});
