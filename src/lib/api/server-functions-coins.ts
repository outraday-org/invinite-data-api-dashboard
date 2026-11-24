import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createApiClient } from "./client.server";
import { throwApiError } from "./errors";
import { apiKeySchema, cursorSchema } from "./server-schemas";
import { v2Query } from "./v2";

export const getCoins = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, q: z.string().trim().max(256).optional() }))
    .handler(async ({ data, signal }) => {
        const result = await createApiClient(data.apiKey).GET("/v1/coins", {
            params: { query: v2Query({ cursor: data.cursor, limit: 50, q: data.q }) },
            signal,
        });

        if (result.error) throwApiError(result.error, result.response);

        return result.data;
    });

export const getCoin = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, coin: z.string().min(1).max(256) }))
    .handler(async ({ data, signal }) => {
        const result = await createApiClient(data.apiKey).GET("/v1/coins/{coin}", {
            params: { path: { coin: data.coin } },
            signal,
        });

        if (result.error) throwApiError(result.error, result.response);

        return result.data;
    });
