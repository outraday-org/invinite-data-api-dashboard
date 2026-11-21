import createClient from "openapi-fetch";

import type { paths } from "./schema";

import { env } from "../env";

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

    return createClient<paths>({
        baseUrl: env.INVINITE_DATA_API_URL,
        headers: {
            Authorization: `Bearer ${resolvedKey}`,
        },
    });
}
