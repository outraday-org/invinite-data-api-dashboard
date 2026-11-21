import type { createApiClient } from "./client.server";
import type {
    AlertUser,
    AlertUserBatchItem,
    AlertUserBatchResponse,
    AlertUserDefaults,
    AlertUserDeleteResult,
    AlertUsersListQuery,
    AlertUsersListResponse,
    UpdateAlertUserDefaultsRequest,
    UpdateAlertUserRequest,
} from "./types";

import { throwApiError } from "./errors";
import { v2Query } from "./v2";

/**
 * The end-user requests of the alerts area (backend tasks/data-api-dashboard 2-alerts task 4): the 7 alert-user
 * operations and the account's end-user defaults, one function per operation on a given typed client (the server
 * functions pass `createApiClient(apiKey)`, the tests a client over a mocked `fetch`).
 *
 * `external_user_id` is the customer's own text (any character, 1–200): it is passed as is and openapi-fetch puts it
 * into the path with `encodeURIComponent` (`/` → `%2F`, `:` → `%3A`, a space → `%20`), so `team/a:b c` stays one
 * segment and the colon verbs `:pause` / `:resume` stay verbs (`alert-users-requests.test.ts`).
 */

type ApiClient = ReturnType<typeof createApiClient>;

/** `GET /v1/alert-users` (ordered by id; `q` = an id prefix, `status`; only the set ones are sent). */
export async function listAlertUsersRequest(client: ApiClient, query: AlertUsersListQuery): Promise<AlertUsersListResponse> {
    const { data, error, response } = await client.GET("/v1/alert-users", { params: { query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data as AlertUsersListResponse;
}

export async function getAlertUserRequest(client: ApiClient, externalUserId: string): Promise<AlertUser> {
    const { data, error, response } = await client.GET("/v1/alert-users/{external_user_id}", { params: { path: { external_user_id: externalUserId } } });

    if (error) throwApiError(error, response);

    return data as AlertUser;
}

/** `PATCH /v1/alert-users/{id}`: an upsert (a missing end user is created); a missing field stays as it is. */
export async function updateAlertUserRequest(client: ApiClient, externalUserId: string, body: UpdateAlertUserRequest): Promise<AlertUser> {
    const { data, error, response } = await client.PATCH("/v1/alert-users/{external_user_id}", { body, params: { path: { external_user_id: externalUserId } } });

    if (error) throwApiError(error, response);

    return data as AlertUser;
}

/** `DELETE /v1/alert-users/{id}`: the erasure's counts; `status: deleting` = the rest runs in the background. */
export async function deleteAlertUserRequest(client: ApiClient, externalUserId: string): Promise<AlertUserDeleteResult> {
    const { data, error, response } = await client.DELETE("/v1/alert-users/{external_user_id}", { params: { path: { external_user_id: externalUserId } } });

    if (error) throwApiError(error, response);

    return data;
}

/** `POST /v1/alert-users:batch` (≤ 500 upserts; one result per item, a refused item never undoes another). */
export async function batchAlertUsersRequest(client: ApiClient, items: Array<AlertUserBatchItem>): Promise<AlertUserBatchResponse> {
    const { data, error, response } = await client.POST("/v1/alert-users:batch", { body: { items } });

    if (error) throwApiError(error, response);

    return data as AlertUserBatchResponse;
}

/** `POST /v1/alert-users/{id}:pause` (creates the end user paused when absent; 409 while it is being deleted). */
export async function pauseAlertUserRequest(client: ApiClient, externalUserId: string): Promise<AlertUser> {
    const { data, error, response } = await client.POST("/v1/alert-users/{external_user_id}:pause", { params: { path: { external_user_id: externalUserId } } });

    if (error) throwApiError(error, response);

    return data as AlertUser;
}

/** `POST /v1/alert-users/{id}:resume` (re-arms exactly the alerts its pause paused). */
export async function resumeAlertUserRequest(client: ApiClient, externalUserId: string): Promise<AlertUser> {
    const { data, error, response } = await client.POST("/v1/alert-users/{external_user_id}:resume", { params: { path: { external_user_id: externalUserId } } });

    if (error) throwApiError(error, response);

    return data as AlertUser;
}

/** `GET /v1/me/alert-user-defaults` (every value null until set). */
export async function getAlertUserDefaultsRequest(client: ApiClient): Promise<AlertUserDefaults> {
    const { data, error, response } = await client.GET("/v1/me/alert-user-defaults");

    if (error) throwApiError(error, response);

    return data;
}

/** `PATCH /v1/me/alert-user-defaults` (at least one field; null clears a default = no limit). */
export async function updateAlertUserDefaultsRequest(client: ApiClient, body: UpdateAlertUserDefaultsRequest): Promise<AlertUserDefaults> {
    const { data, error, response } = await client.PATCH("/v1/me/alert-user-defaults", { body });

    if (error) throwApiError(error, response);

    return data;
}
