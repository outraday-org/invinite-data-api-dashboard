import type { Middleware } from "openapi-fetch";

import { AsyncLocalStorage } from "node:async_hooks";
import createClient from "openapi-fetch";

import type { RequestMeta } from "./request-meta";
import type { paths } from "./schema";
import type { JsonValue } from "./types";

import { env } from "../env";
import { requestMetaOf } from "./request-meta";

// The requests of the server function call in progress (`recordApiRequests`); none outside one.
const apiRequests = new AsyncLocalStorage<Array<RequestMeta>>();

/**
 * Runs `fn` (one server function call) while every Data API answer it receives is recorded into `into`: method, the
 * concrete path and query as sent, a write's JSON body (redacted: `redactSecrets`), status, `X-Request-Id`,
 * `X-Credits-Charged` — never a header of the request, so the key cannot be recorded. The global function middleware (`request-middleware.ts`) sends the list to the browser.
 */
export function recordApiRequests<T>(into: Array<RequestMeta>, fn: () => T): T {
    return apiRequests.run(into, fn);
}

// The JSON body of each write in flight, read before `fetch` consumes it (`onRequest`), recorded with its answer.
const writeBodies = new WeakMap<Request, JsonValue>();

/** A write's JSON body (a clone is read: the request itself is still sent); undefined for a read or a non-JSON body. */
async function jsonBodyOf(request: Request): Promise<JsonValue | undefined> {
    if (request.method === "GET" || request.method === "HEAD" || request.body === null) return undefined;

    try {
        return JSON.parse(await request.clone().text()) as JsonValue;
    }
    catch {
        return undefined;
    }
}

const recordingMiddleware: Middleware = {
    async onRequest({ request }) {
        // Only inside a recorded server function call: nothing is kept otherwise.
        if (!apiRequests.getStore()) return undefined;

        const body = await jsonBodyOf(request);

        if (body !== undefined) writeBodies.set(request, body);

        return undefined;
    },
    onResponse({ request, response, schemaPath }) {
        apiRequests.getStore()?.push(requestMetaOf({
            // Redacted by `requestMetaOf` before it is stored: no secret field reaches the browser's registry.
            body: writeBodies.get(request),
            headers: response.headers,
            method: request.method,
            schemaPath,
            status: response.status,
            url: request.url,
        }));

        return undefined;
    },
};

/** The problem `code` of the synthetic 401 a request without any key answers (no network call is made). */
export const MISSING_API_KEY_CODE = "missing_api_key";

/**
 * The answer of a request made without a key: a 401 problem, as the API would send it, without touching the network
 * (never `Bearer undefined`). Every server function then throws it as an `ApiRequestError` (`throwApiError`), so the key
 * gate shows the onboarding card.
 */
function missingKeyFetch(): Promise<Response> {
    const problem = {
        code: MISSING_API_KEY_CODE,
        detail: "No API key is set. Enter your Invinite Data API key to load data.",
        status: 401,
        title: "API key required",
        type: "about:blank",
    };

    return Promise.resolve(new Response(JSON.stringify(problem), {
        headers: { "Content-Type": "application/problem+json" },
        status: 401,
    }));
}

export function createApiClient(apiKey?: string) {
    const resolvedKey = apiKey?.trim() || env.INVINITE_DATA_API_KEY?.trim();

    if (!resolvedKey) return createClient<paths>({ baseUrl: env.INVINITE_DATA_API_URL, fetch: missingKeyFetch });

    const client = createClient<paths>({
        baseUrl: env.INVINITE_DATA_API_URL,
        headers: {
            Authorization: `Bearer ${resolvedKey}`,
        },
    });

    client.use(recordingMiddleware);

    return client;
}
