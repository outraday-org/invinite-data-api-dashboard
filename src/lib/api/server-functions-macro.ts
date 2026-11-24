import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createApiClient } from "./client.server";
import { throwApiError } from "./errors";
import { familyId, MACRO_FAMILIES } from "./macro";
import { apiKeySchema, cursorSchema } from "./server-schemas";
import { v2Query } from "./v2";

const page = { apiKey: apiKeySchema, cursor: cursorSchema };

const range = { from: z.iso.date().optional(), to: z.iso.date().optional() };

const scalar = z.enum(["inflation", "gdp", "labor"]);

export const getMacroCatalog = createServerFn({ method: "POST" })
    .inputValidator(z.object({ ...page, family: z.enum(MACRO_FAMILIES).optional() }))
    .handler(async ({ data, signal }) => {
        const result = await createApiClient(data.apiKey).GET("/v1/macro/series", {
            params: { query: v2Query({ cursor: data.cursor, family: data.family, limit: 64 }) },
            signal,
        });

        if (result.error) throwApiError(result.error, result.response);

        return result.data;
    });

export const getMacroSnapshot = createServerFn({ method: "POST" })
    .inputValidator(z.object({ ...page, family: scalar }))
    .handler(async ({ data, signal }) => {
        const path = (
            {
                gdp: "/v1/macro/gdp/snapshot",
                inflation: "/v1/macro/inflation/snapshot",
                labor: "/v1/macro/labor/snapshot",
            } as const
        )[data.family];

        const result = await createApiClient(data.apiKey).GET(path, {
            params: { query: v2Query({ cursor: data.cursor, limit: 64 }) },
            signal,
        });

        if (result.error) throwApiError(result.error, result.response);

        return result.data;
    });

export const getMacroHistory = createServerFn({ method: "POST" })
    .inputValidator(z.object({ ...page, ...range, family: scalar, series: z.string().min(1).max(80) }))
    .handler(async ({ data, signal }) => {
        const client = createApiClient(data.apiKey);

        const query = v2Query({
            "cursor": data.cursor,
            "limit": 50,
            "reference_date.gte": data.from,
            "reference_date.lte": data.to,
        });

        const { family, series } = data;

        if (!familyId(series, family)) throw new Error("Select a series from this macro family.");

        const result = familyId(series, "inflation")
            ? await client.GET("/v1/macro/inflation", { params: { query: { ...query, series } }, signal })
            : familyId(series, "gdp")
                ? await client.GET("/v1/macro/gdp", { params: { query: { ...query, series } }, signal })
                : await client.GET("/v1/macro/labor", { params: { query: { ...query, series } }, signal });

        if (result.error) throwApiError(result.error, result.response);

        return result.data;
    });

export const getMacroCurves = createServerFn({ method: "POST" })
    .inputValidator(z.object({ ...page, ...range }))
    .handler(async ({ data, signal }) => {
        const result = await createApiClient(data.apiKey).GET("/v1/macro/yield-curve", {
            params: { query: v2Query({ "cursor": data.cursor, "date.gte": data.from, "date.lte": data.to, "limit": 50 }) },
            signal,
        });

        if (result.error) throwApiError(result.error, result.response);

        return result.data;
    });
export const getMacroCurveSnapshot = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema }))
    .handler(async ({ data, signal }) => {
        const result = await createApiClient(data.apiKey).GET("/v1/macro/yield-curve/snapshot", { signal });

        if (result.error) throwApiError(result.error, result.response);

        return result.data;
    });
