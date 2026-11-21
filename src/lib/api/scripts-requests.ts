import type { createApiClient } from "./client.server";
import type { AlertWriteDone, CreateScriptRequest, Script, ScriptsListResponse, ScriptVersion, ScriptVersionsResponse } from "./types";

import { throwApiError } from "./errors";
import { v2Query } from "./v2";

/**
 * The hosted-script requests of the alerts area (backend tasks/data-api-dashboard 2-alerts task 4): the 6 script
 * operations, one function per operation on a given typed client. There is no update-script operation (name and
 * description are fixed after upload). A compile error is still a 201: the version carries `status: error` and its
 * `diagnostics`.
 */

type ApiClient = ReturnType<typeof createApiClient>;

/** `GET /v1/scripts` (oldest first, each with its latest version). */
export async function listScriptsRequest(client: ApiClient, query: { cursor?: string; limit?: number }): Promise<ScriptsListResponse> {
    const { data, error, response } = await client.GET("/v1/scripts", { params: { query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data as ScriptsListResponse;
}

/** `POST /v1/scripts`: the script and its version 1, compiled server-side (one compile per account at a time). */
export async function createScriptRequest(client: ApiClient, body: CreateScriptRequest): Promise<Script> {
    const { data, error, response } = await client.POST("/v1/scripts", { body });

    if (error) throwApiError(error, response);

    return data as Script;
}

export async function getScriptRequest(client: ApiClient, id: string): Promise<Script> {
    const { data, error, response } = await client.GET("/v1/scripts/{id}", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data as Script;
}

/** `DELETE /v1/scripts/{id}` (204; 409 `conflict` while an alert uses one of its versions — its `detail` names them). */
export async function deleteScriptRequest(client: ApiClient, id: string): Promise<AlertWriteDone> {
    const { error, response } = await client.DELETE("/v1/scripts/{id}", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return { done: "deleted", id };
}

/** `POST /v1/scripts/{id}/versions` (the next version, at most 20 per script; existing alerts keep theirs). */
export async function createScriptVersionRequest(client: ApiClient, id: string, source: string): Promise<ScriptVersion> {
    const { data, error, response } = await client.POST("/v1/scripts/{id}/versions", { body: { source }, params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data as ScriptVersion;
}

/** `GET /v1/scripts/{id}/versions` (oldest first). */
export async function listScriptVersionsRequest(client: ApiClient, id: string, query: { cursor?: string; limit?: number }): Promise<ScriptVersionsResponse> {
    const { data, error, response } = await client.GET("/v1/scripts/{id}/versions", { params: { path: { id }, query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data as ScriptVersionsResponse;
}
