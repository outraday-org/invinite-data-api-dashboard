import type { createApiClient } from "./client.server";
import type {
    Alert,
    AlertBatchItem,
    AlertBatchResponse,
    AlertEvent,
    AlertEventsResponse,
    AlertEventType,
    AlertsListQuery,
    AlertsListResponse,
    AlertTemplatesResponse,
    AlertTestAccepted,
    AlertWriteDone,
    CreateAlertRequest,
    UpdateAlertRequest,
} from "./types";

import { throwApiError } from "./errors";
import { v2Query } from "./v2";

/**
 * The 13 alert requests of the dashboard (backend tasks/data-api-dashboard 2-alerts task 2), one function per operation,
 * each on a given typed client: the server functions (`server-functions-alerts.ts`) pass `createApiClient(apiKey)`, the
 * tests a client over a mocked `fetch` (the colon verbs `/v1/alerts/{id}:pause` / `:resume` / `:test` and
 * `/v1/alerts:batch` are sent as written; the `Idempotency-Key` header of a create).
 *
 * Every function throws an `ApiRequestError` for a problem answer and returns an object — a write answered with no body
 * (204) returns `AlertWriteDone`, so the API inspector can file the request under it.
 */

type ApiClient = ReturnType<typeof createApiClient>;

/** `GET /v1/alerts` (filters as the API names them; only the set ones are sent). */
export async function listAlertsRequest(client: ApiClient, query: AlertsListQuery): Promise<AlertsListResponse> {
    const { data, error, response } = await client.GET("/v1/alerts", { params: { query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data as AlertsListResponse;
}

export async function getAlertRequest(client: ApiClient, id: string): Promise<Alert> {
    const { data, error, response } = await client.GET("/v1/alerts/{id}", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data as Alert;
}

/**
 * `POST /v1/alerts`. `idempotencyKey` = one key per form submission (the API replays the first answer for 24 h);
 * `validateOnly` runs every check and answers 204 without creating (the key is then not sent: the API ignores it).
 */
export async function createAlertRequest(
    client: ApiClient,
    input: { body: CreateAlertRequest; idempotencyKey?: string; validateOnly?: boolean },
): Promise<Alert | AlertWriteDone> {
    const { body, idempotencyKey, validateOnly } = input;

    const { data, error, response } = await client.POST("/v1/alerts", {
        body,
        params: {
            header: validateOnly || !idempotencyKey ? undefined : { "Idempotency-Key": idempotencyKey },
            query: validateOnly ? { validate_only: true } : undefined,
        },
    });

    if (error) throwApiError(error, response);

    if (response.status === 204 || data === undefined) return { done: "validated", id: null };

    return data as Alert;
}

/** `PATCH /v1/alerts/{id}`; `body.version` = the version the form was loaded at (409 `conflict` when it moved). */
export async function updateAlertRequest(client: ApiClient, id: string, body: UpdateAlertRequest): Promise<Alert> {
    const { data, error, response } = await client.PATCH("/v1/alerts/{id}", { body, params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data as Alert;
}

export async function deleteAlertRequest(client: ApiClient, id: string): Promise<AlertWriteDone> {
    const { error, response } = await client.DELETE("/v1/alerts/{id}", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return { done: "deleted", id };
}

export async function pauseAlertRequest(client: ApiClient, id: string): Promise<Alert> {
    const { data, error, response } = await client.POST("/v1/alerts/{id}:pause", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data as Alert;
}

export async function resumeAlertRequest(client: ApiClient, id: string): Promise<Alert> {
    const { data, error, response } = await client.POST("/v1/alerts/{id}:resume", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data as Alert;
}

/** `POST /v1/alerts/{id}:test`: queues one test `alert.fired` to the alert's destinations (202, the event id). */
export async function testAlertRequest(client: ApiClient, id: string): Promise<AlertTestAccepted> {
    const { data, error, response } = await client.POST("/v1/alerts/{id}:test", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data;
}

/** `POST /v1/alerts:batch` (≤ 500 items; one result per item, a refused item never undoes another). */
export async function batchAlertsRequest(client: ApiClient, items: Array<AlertBatchItem>): Promise<AlertBatchResponse> {
    const { data, error, response } = await client.POST("/v1/alerts:batch", { body: { items } });

    if (error) throwApiError(error, response);

    return data as AlertBatchResponse;
}

export type AlertEventsQuery = {
    after?: string;
    alert_id?: string;
    cursor?: string;
    external_user_id?: string;
    limit?: number;
    type?: AlertEventType;
};

/** `GET /v1/alert-events` (oldest first; `after` continues after an event id). */
export async function listAlertEventsRequest(client: ApiClient, query: AlertEventsQuery): Promise<AlertEventsResponse> {
    const { data, error, response } = await client.GET("/v1/alert-events", { params: { query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data as AlertEventsResponse;
}

export async function getAlertEventRequest(client: ApiClient, id: string): Promise<AlertEvent> {
    const { data, error, response } = await client.GET("/v1/alert-events/{id}", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data as AlertEvent;
}

/** `GET /v1/alerts/{id}/events` (one alert's events, oldest first). */
export async function listAlertEventsForAlertRequest(
    client: ApiClient,
    id: string,
    query: { cursor?: string; limit?: number; type?: AlertEventType },
): Promise<AlertEventsResponse> {
    const { data, error, response } = await client.GET("/v1/alerts/{id}/events", { params: { path: { id }, query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data as AlertEventsResponse;
}

/** `GET /v1/alert-templates` (the built-in templates of the `indicator` type). */
export async function listAlertTemplatesRequest(client: ApiClient, query: { cursor?: string; limit?: number }): Promise<AlertTemplatesResponse> {
    const { data, error, response } = await client.GET("/v1/alert-templates", { params: { query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data as AlertTemplatesResponse;
}
