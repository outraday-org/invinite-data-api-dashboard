import type { createApiClient } from "./client.server";
import type {
    AlertWriteDone,
    CreateDestinationRequest,
    Destination,
    DestinationCreated,
    DestinationDeliveriesResponse,
    DestinationSecret,
    DestinationsListResponse,
    DestinationTestAccepted,
    UpdateDestinationRequest,
} from "./types";

import { throwApiError } from "./errors";
import { v2Query } from "./v2";

/**
 * The 8 destination requests of the dashboard (backend tasks/data-api-dashboard 2-alerts task 3), one function per
 * operation on a given typed client (`server-functions-destinations.ts` passes `createApiClient(apiKey)`, the tests a
 * client over a mocked `fetch`: `/v1/destinations/{id}:rotate-secret` and `:test` are sent as written).
 *
 * Secrets: the signing secret travels in exactly two answers, `createDestinationRequest` (`DestinationCreated.secret`)
 * and `rotateDestinationSecretRequest` (`DestinationSecret.secret`) — the show-once dialog takes it out of the answer
 * (`takeSecret`). A READ answer is shown unredacted by the API inspector, so every destination a read returns passes
 * `withoutSecrets` here, on the server: the contract returns neither a secret nor a header value, and should it ever,
 * neither reaches the browser.
 */

type ApiClient = ReturnType<typeof createApiClient>;

/** Fields that would carry a secret or a header value; a `Destination` has none (`secret_hint` = the last 4 characters). */
const SECRET_FIELDS = ["secret", "headers"] as const;

/** A read's destination without any secret-bearing field (pure; the same object, changed in place, so its requests stay filed). */
export function withoutSecrets<T extends object>(destination: T): T {
    for (const field of SECRET_FIELDS) {
        if (Object.hasOwn(destination, field)) delete (destination as Record<string, unknown>)[field];
    }

    return destination;
}

/** `GET /v1/destinations` (oldest first; secrets are never returned). */
export async function listDestinationsRequest(client: ApiClient, query: { cursor?: string; limit?: number }): Promise<DestinationsListResponse> {
    const { data, error, response } = await client.GET("/v1/destinations", { params: { query: v2Query(query) } });

    if (error) throwApiError(error, response);

    data.data.forEach(withoutSecrets);

    return data;
}

export async function getDestinationRequest(client: ApiClient, id: string): Promise<Destination> {
    const { data, error, response } = await client.GET("/v1/destinations/{id}", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return withoutSecrets(data);
}

/**
 * `POST /v1/destinations` (https, port 443, public addresses only). `idempotencyKey` = one key per form submission (the
 * API replays the first answer for 24 h; 409 `idempotency_in_flight` while the first runs). The answer carries the
 * signing secret, once.
 */
export async function createDestinationRequest(
    client: ApiClient,
    input: { body: CreateDestinationRequest; idempotencyKey?: string },
): Promise<DestinationCreated> {
    const { body, idempotencyKey } = input;

    const { data, error, response } = await client.POST("/v1/destinations", {
        body,
        params: { header: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined },
    });

    if (error) throwApiError(error, response);

    return data;
}

/** `PATCH /v1/destinations/{id}` (any field, at least one; an omitted `headers` keeps the stored ones, null removes them). */
export async function updateDestinationRequest(client: ApiClient, id: string, body: UpdateDestinationRequest): Promise<Destination> {
    const { data, error, response } = await client.PATCH("/v1/destinations/{id}", { body, params: { path: { id } } });

    if (error) throwApiError(error, response);

    return withoutSecrets(data);
}

/** `DELETE /v1/destinations/{id}` (204; alerts that named it stop sending to it). */
export async function deleteDestinationRequest(client: ApiClient, id: string): Promise<AlertWriteDone> {
    const { error, response } = await client.DELETE("/v1/destinations/{id}", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return { done: "deleted", id };
}

/** `POST /v1/destinations/{id}:rotate-secret`: a new secret, in this answer only; the old one signs too until `previous_secret_expires_at`. */
export async function rotateDestinationSecretRequest(client: ApiClient, id: string): Promise<DestinationSecret> {
    const { data, error, response } = await client.POST("/v1/destinations/{id}:rotate-secret", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data;
}

/** `POST /v1/destinations/{id}:test`: queues one signed `destination.test` event (202: its event and delivery ids). */
export async function testDestinationRequest(client: ApiClient, id: string): Promise<DestinationTestAccepted> {
    const { data, error, response } = await client.POST("/v1/destinations/{id}:test", { params: { path: { id } } });

    if (error) throwApiError(error, response);

    return data;
}

/** `GET /v1/destinations/{id}/deliveries` (the delivery log, newest first; `limit` / `cursor` only). */
export async function listDestinationDeliveriesRequest(
    client: ApiClient,
    id: string,
    query: { cursor?: string; limit?: number },
): Promise<DestinationDeliveriesResponse> {
    const { data, error, response } = await client.GET("/v1/destinations/{id}/deliveries", { params: { path: { id }, query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data;
}
