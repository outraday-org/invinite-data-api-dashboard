import createClient from "openapi-fetch";

import type { paths } from "./schema";

import { env } from "../env";

export function createApiClient(apiKey?: string) {
    const resolvedKey = apiKey?.trim() || env.INVINITE_DATA_API_KEY;

    return createClient<paths>({
        baseUrl: env.INVINITE_DATA_API_URL,
        headers: {
            Authorization: `Bearer ${resolvedKey}`,
        },
    });
}

/**
 * The key-less client of the public `/status*` routes (task 21). Never reuse `createApiClient`
 * there: it always attaches `Authorization` — `Bearer undefined` when no key is configured.
 */
export function createPublicApiClient() {
    return createClient<paths>({ baseUrl: env.INVINITE_DATA_API_URL });
}

export const api = createApiClient();
