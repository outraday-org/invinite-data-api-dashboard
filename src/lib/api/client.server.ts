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

export const api = createApiClient();
