import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AlertWriteDone, Script, ScriptsListResponse, ScriptVersion, ScriptVersionsResponse } from "./types";

import { SCRIPT_DESCRIPTION_MAX, SCRIPT_NAME_MAX, SCRIPT_SOURCE_MAX } from "../alerts/scripts";
import { createApiClient } from "./client.server";
import {
    createScriptRequest,
    createScriptVersionRequest,
    deleteScriptRequest,
    getScriptRequest,
    listScriptsRequest,
    listScriptVersionsRequest,
} from "./scripts-requests";

/**
 * The hosted-script server functions (backend tasks/data-api-dashboard 2-alerts task 4): the 6 script operations.
 * Reads `GET`, writes `POST`; a source above 204 800 characters is refused here too (the form refuses it first).
 */

const apiKeySchema = z
    .string()
    .transform(val => val.trim())
    .pipe(z.string().min(1))
    .optional();

/** A script id (`scr_…`; `maxLength` 64). */
const idSchema = z.string().trim().min(1).max(64);

const sourceSchema = z.string().min(1).max(SCRIPT_SOURCE_MAX);

const pageInput = { cursor: z.string().min(1).optional(), limit: z.number().int().min(1).max(200).optional() };

export const listScripts = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, ...pageInput }))
    .handler(({ data }): Promise<ScriptsListResponse> => listScriptsRequest(createApiClient(data.apiKey), { cursor: data.cursor, limit: data.limit }));

export const createScript = createServerFn({ method: "POST" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        description: z.string().max(SCRIPT_DESCRIPTION_MAX).optional(),
        name: z.string().trim().min(1).max(SCRIPT_NAME_MAX),
        source: sourceSchema,
    }))
    .handler(({ data }): Promise<Script> => createScriptRequest(createApiClient(data.apiKey), {
        ...(data.description ? { description: data.description } : {}),
        name: data.name,
        source: data.source,
    }));

export const getScript = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema }))
    .handler(({ data }): Promise<Script> => getScriptRequest(createApiClient(data.apiKey), data.id));

export const deleteScript = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema }))
    .handler(({ data }): Promise<AlertWriteDone> => deleteScriptRequest(createApiClient(data.apiKey), data.id));

export const createScriptVersion = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema, source: sourceSchema }))
    .handler(({ data }): Promise<ScriptVersion> => createScriptVersionRequest(createApiClient(data.apiKey), data.id, data.source));

export const listScriptVersions = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema, ...pageInput }))
    .handler(({ data }): Promise<ScriptVersionsResponse> => listScriptVersionsRequest(createApiClient(data.apiKey), data.id, { cursor: data.cursor, limit: data.limit }));
