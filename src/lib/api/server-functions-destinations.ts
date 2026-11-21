import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

import { BODY_TEMPLATE_MAX_BYTES, HEADER_VALUE_MAX, HEADERS_MAX } from "../alerts/destinations";
import { createApiClient } from "./client.server";
import {
    createDestinationRequest,
    deleteDestinationRequest,
    getDestinationRequest,
    listDestinationDeliveriesRequest,
    listDestinationsRequest,
    rotateDestinationSecretRequest,
    testDestinationRequest,
    updateDestinationRequest,
} from "./destinations-requests";

/**
 * The destination server functions (backend tasks/data-api-dashboard 2-alerts task 3), beside the alert ones
 * (`server-functions-alerts.ts`): reads `GET`, writes `POST`, the key from the same store as every read. Each validates
 * its input with zod and sends the request through `destinations-requests.ts`. A body is checked field by field here
 * (the contract's bounds); its header values are never logged, and the inspector records them redacted.
 */

const apiKeySchema = z
    .string()
    .transform(val => val.trim())
    .pipe(z.string().min(1))
    .optional();

/** A destination id (`dst_…`; `maxLength` 64 in the spec). */
const idSchema = z.string().trim().min(1).max(64);

const pageSchema = { cursor: z.string().min(1).optional(), limit: z.number().int().min(1).max(200).optional() };

const kindSchema = z.enum(["webhook", "batch_webhook"]);

const presetSchema = z.enum(["standard", "claude_routine"]);

/** Custom headers: at most 20, each value ≤ 1 024 characters (stored encrypted, never returned). */
const headersSchema = z.record(z.string().min(1).max(256), z.string().max(HEADER_VALUE_MAX)).refine(headers => Object.keys(headers).length <= HEADERS_MAX, `At most ${HEADERS_MAX} headers`);

/** `body_template` ≤ 16 KB (UTF-8 bytes). */
const templateSchema = z.string().refine(text => new TextEncoder().encode(text).length <= BODY_TEMPLATE_MAX_BYTES, "At most 16 KB");

const createBodySchema = z.object({
    body_template: templateSchema.optional(),
    description: z.string().max(500).optional(),
    digest_seconds: z.number().int().min(1).max(3600).nullable().optional(),
    headers: headersSchema.optional(),
    kind: kindSchema.optional(),
    max_events_per_minute: z.number().int().min(1).max(100_000).optional(),
    preset: presetSchema.optional(),
    url: z.string().min(1).max(2048),
});

const updateBodySchema = z.object({
    body_template: templateSchema.nullable().optional(),
    description: z.string().max(500).nullable().optional(),
    digest_seconds: z.number().int().min(1).max(3600).nullable().optional(),
    headers: headersSchema.nullable().optional(),
    kind: kindSchema.optional(),
    max_events_per_minute: z.number().int().min(1).max(100_000).optional(),
    preset: presetSchema.optional(),
    status: z.enum(["active", "disabled"]).optional(),
    url: z.string().min(1).max(2048).optional(),
}).refine(body => Object.keys(body).length > 0, "At least one field");

export const listDestinations = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, ...pageSchema }))
    .handler(({ data }): Promise<DestinationsListResponse> => listDestinationsRequest(createApiClient(data.apiKey), { cursor: data.cursor, limit: data.limit }));

export const getDestination = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema }))
    .handler(({ data }): Promise<Destination> => getDestinationRequest(createApiClient(data.apiKey), data.id));

export const createDestination = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, body: createBodySchema, idempotencyKey: z.string().min(1).max(255).optional() }))
    .handler(({ data }): Promise<DestinationCreated> => createDestinationRequest(createApiClient(data.apiKey), {
        body: data.body as CreateDestinationRequest,
        idempotencyKey: data.idempotencyKey,
    }));

export const updateDestination = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, body: updateBodySchema, id: idSchema }))
    .handler(({ data }): Promise<Destination> => updateDestinationRequest(createApiClient(data.apiKey), data.id, data.body as UpdateDestinationRequest));

export const deleteDestination = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema }))
    .handler(({ data }): Promise<AlertWriteDone> => deleteDestinationRequest(createApiClient(data.apiKey), data.id));

export const rotateDestinationSecret = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema }))
    .handler(({ data }): Promise<DestinationSecret> => rotateDestinationSecretRequest(createApiClient(data.apiKey), data.id));

export const testDestination = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema }))
    .handler(({ data }): Promise<DestinationTestAccepted> => testDestinationRequest(createApiClient(data.apiKey), data.id));

export const listDestinationDeliveries = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: idSchema, ...pageSchema }))
    .handler(({ data }): Promise<DestinationDeliveriesResponse> => listDestinationDeliveriesRequest(createApiClient(data.apiKey), data.id, {
        cursor: data.cursor,
        limit: data.limit,
    }));
