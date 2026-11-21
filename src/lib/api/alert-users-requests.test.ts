import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULTS_FIXTURE, DELETE_RUNNING, ODD_USER_ID, SCRIPT_FIXTURE, SCRIPT_V2_OK, SCRIPT_VERSIONS_FIXTURE, USER_BATCH_PARTIAL, USER_ODD, USERS_PAGE_FIXTURE } from "../alerts/alerts-fixtures";
import { ApiRequestError } from "./errors";

const env = vi.hoisted(() => ({ INVINITE_DATA_API_KEY: undefined as string | undefined, INVINITE_DATA_API_URL: "https://api.test" }));

vi.mock("../env", () => ({ env }));

const { createApiClient } = await import("./client.server");

const users = await import("./alert-users-requests");

const scripts = await import("./scripts-requests");

type Sent = { body: string; method: string; url: string };

function mockFetch(answer: () => Response) {
    const sent: Array<Sent> = [];

    vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
        sent.push({ body: await request.clone().text(), method: request.method, url: request.url });

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

/** `team/a:b c` as one path segment. */
const ENCODED = "team%2Fa%3Ab%20c";

describe("end-user requests: the id is any text, one encoded segment (openapi-fetch encodeURIComponent)", () => {
    it.each([
        ["getAlertUserRequest", "GET", `https://api.test/v1/alert-users/${ENCODED}`],
        ["deleteAlertUserRequest", "DELETE", `https://api.test/v1/alert-users/${ENCODED}`],
        ["pauseAlertUserRequest", "POST", `https://api.test/v1/alert-users/${ENCODED}:pause`],
        ["resumeAlertUserRequest", "POST", `https://api.test/v1/alert-users/${ENCODED}:resume`],
    ] as const)("%s → %s %s", async (name, method, url) => {
        const sent = mockFetch(json(name === "deleteAlertUserRequest" ? DELETE_RUNNING : USER_ODD));

        const answer = await users[name](createApiClient("k"), ODD_USER_ID);

        expect(sent).toHaveLength(1);

        expect(sent[0]).toMatchObject({ method, url });

        expect(answer).toEqual(name === "deleteAlertUserRequest" ? DELETE_RUNNING : USER_ODD);
    });

    it("the encoded id decodes back to the same text (round trip)", () => {
        expect(decodeURIComponent(ENCODED)).toBe(ODD_USER_ID);
    });

    it("updateAlertUser = PATCH with the body as given (an upsert)", async () => {
        const sent = mockFetch(json(USER_ODD));

        await users.updateAlertUserRequest(createApiClient("k"), ODD_USER_ID, { display_name: null, max_active_alerts: 5, metadata: {} });

        expect(sent[0]).toMatchObject({ method: "PATCH", url: `https://api.test/v1/alert-users/${ENCODED}` });

        expect(JSON.parse(sent[0].body)).toEqual({ display_name: null, max_active_alerts: 5, metadata: {} });
    });

    it("listAlertUsers sends only the set filters (q = id prefix, status)", async () => {
        const sent = mockFetch(json(USERS_PAGE_FIXTURE));

        await users.listAlertUsersRequest(createApiClient("k"), { limit: 100, q: "team/", status: "paused" });

        const url = new URL(sent[0].url);

        expect(url.pathname).toBe("/v1/alert-users");

        expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "100", q: "team/", status: "paused" });
    });

    it("batchAlertUsers → POST /v1/alert-users:batch with the items; one result per item", async () => {
        const sent = mockFetch(json(USER_BATCH_PARTIAL));

        const answer = await users.batchAlertUsersRequest(createApiClient("k"), [{ external_user_id: ODD_USER_ID, max_active_alerts: 1 }]);

        expect(sent[0]).toMatchObject({ method: "POST", url: "https://api.test/v1/alert-users:batch" });

        expect(JSON.parse(sent[0].body)).toEqual({ items: [{ external_user_id: ODD_USER_ID, max_active_alerts: 1 }] });

        expect(answer.results).toHaveLength(3);
    });

    it("the defaults: GET / PATCH /v1/me/alert-user-defaults", async () => {
        const sent = mockFetch(json(DEFAULTS_FIXTURE));

        await users.getAlertUserDefaultsRequest(createApiClient("k"));

        await users.updateAlertUserDefaultsRequest(createApiClient("k"), { max_script_alerts: null });

        expect(sent.map(item => `${item.method} ${item.url}`)).toEqual(["GET https://api.test/v1/me/alert-user-defaults", "PATCH https://api.test/v1/me/alert-user-defaults"]);

        expect(JSON.parse(sent[1].body)).toEqual({ max_script_alerts: null });
    });

    it("a refusal is an ApiRequestError with the problem code (409 while the end user is being deleted)", async () => {
        mockFetch(problem(409, "conflict", "The end user is being deleted."));

        await expect(users.pauseAlertUserRequest(createApiClient("k"), "x")).rejects.toMatchObject({ code: "conflict", status: 409 });

        await expect(users.pauseAlertUserRequest(createApiClient("k"), "x")).rejects.toBeInstanceOf(ApiRequestError);
    });
});

describe("script requests", () => {
    it("createScript → POST /v1/scripts; createScriptVersion → POST /v1/scripts/{id}/versions", async () => {
        const sent = mockFetch(json(SCRIPT_FIXTURE, 201));

        await scripts.createScriptRequest(createApiClient("k"), { name: "EMA cross", source: "x" });

        await scripts.createScriptVersionRequest(createApiClient("k"), "scr_1", "y");

        expect(sent.map(item => `${item.method} ${item.url}`)).toEqual(["POST https://api.test/v1/scripts", "POST https://api.test/v1/scripts/scr_1/versions"]);

        expect(JSON.parse(sent[1].body)).toEqual({ source: "y" });
    });

    it("list, get and the versions", async () => {
        const sent = mockFetch(json(SCRIPT_VERSIONS_FIXTURE));

        await scripts.listScriptVersionsRequest(createApiClient("k"), "scr_1", { limit: 50 });

        expect(sent[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/scripts/scr_1/versions?limit=50" });

        mockFetch(json(SCRIPT_FIXTURE));

        await expect(scripts.getScriptRequest(createApiClient("k"), "scr_1")).resolves.toMatchObject({ latest_version: SCRIPT_V2_OK });
    });

    it("deleteScript: 204 → an object for the inspector; 409 → the API's words naming the alerts", async () => {
        mockFetch(() => new Response(null, { status: 204 }));

        await expect(scripts.deleteScriptRequest(createApiClient("k"), "scr_1")).resolves.toEqual({ done: "deleted", id: "scr_1" });

        mockFetch(problem(409, "conflict", "The script is used by alerts alt_1, alt_2"));

        await expect(scripts.deleteScriptRequest(createApiClient("k"), "scr_1")).rejects.toMatchObject({ message: "The script is used by alerts alt_1, alt_2", status: 409 });
    });
});
