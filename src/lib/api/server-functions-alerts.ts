import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
    Alert,
    AlertBatchItem,
    AlertBatchResponse,
    AlertEvent,
    AlertEventsResponse,
    AlertsListResponse,
    AlertTemplatesResponse,
    AlertTestAccepted,
    AlertWriteDone,
    CreateAlertRequest,
    UpdateAlertRequest,
} from "./types";

import { ALERT_EVENT_TYPES, ALERT_STATUSES, ALERT_TYPES } from "../alerts/labels";
import {
    batchAlertsRequest,
    createAlertRequest,
    deleteAlertRequest,
    getAlertEventRequest,
    getAlertRequest,
    listAlertEventsForAlertRequest,
    listAlertEventsRequest,
    listAlertsRequest,
    listAlertTemplatesRequest,
    pauseAlertRequest,
    resumeAlertRequest,
    testAlertRequest,
    updateAlertRequest,
} from "./alerts-requests";
import { createApiClient } from "./client.server";
import { apiKeySchema, cursorSchema, pageLimitSchema, resourceIdSchema } from "./server-schemas";

/**
 * The alert server functions (backend tasks/data-api-dashboard 2-alerts task 2; `server-functions.ts` passed 1 800
 * lines). Reads are `GET`, writes `POST` (the dashboard's first writes): the key comes from the same store as every
 * read and never reaches a browser request to the API. Each validates its input with zod and sends the request through
 * `alerts-requests.ts`.
 */

const alertTypeSchema = z.enum(ALERT_TYPES as [AlertTypeName, ...Array<AlertTypeName>]);

type AlertTypeName = (typeof ALERT_TYPES)[number];

const eventTypeSchema = z.enum(ALERT_EVENT_TYPES);

/** A request body: free JSON objects (the per-type shape is the API's to check; its 400 names the field). */
const bodySchema = z.record(z.string(), z.json());

export const listAlerts = createServerFn({ method: "POST" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        clientReferenceId: z.string().trim().min(1).max(200).optional(),
        cursor: cursorSchema,
        destinationId: z.string().trim().min(1).max(64).optional(),
        externalUserId: z.string().trim().min(1).max(200).optional(),
        limit: pageLimitSchema,
        status: z.enum(ALERT_STATUSES).optional(),
        symbol: z.string().trim().min(1).max(64).optional(),
        type: alertTypeSchema.optional(),
    }))
    .handler(({ data }): Promise<AlertsListResponse> => listAlertsRequest(createApiClient(data.apiKey), {
        client_reference_id: data.clientReferenceId,
        cursor: data.cursor,
        destination_id: data.destinationId,
        external_user_id: data.externalUserId,
        limit: data.limit,
        status: data.status,
        symbol: data.symbol,
        type: data.type,
    }));

export const getAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: resourceIdSchema }))
    .handler(({ data }): Promise<Alert> => getAlertRequest(createApiClient(data.apiKey), data.id));

export const createAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        body: bodySchema,
        idempotencyKey: z.string().min(1).max(255).optional(),
        validateOnly: z.boolean().optional(),
    }))
    .handler(({ data }): Promise<Alert | AlertWriteDone> => createAlertRequest(createApiClient(data.apiKey), {
        body: data.body as CreateAlertRequest,
        idempotencyKey: data.idempotencyKey,
        validateOnly: data.validateOnly,
    }));

export const updateAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, body: bodySchema, id: resourceIdSchema }))
    .handler(({ data }): Promise<Alert> => updateAlertRequest(createApiClient(data.apiKey), data.id, data.body as UpdateAlertRequest));

export const deleteAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: resourceIdSchema }))
    .handler(({ data }): Promise<AlertWriteDone> => deleteAlertRequest(createApiClient(data.apiKey), data.id));

export const pauseAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: resourceIdSchema }))
    .handler(({ data }): Promise<Alert> => pauseAlertRequest(createApiClient(data.apiKey), data.id));

export const resumeAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: resourceIdSchema }))
    .handler(({ data }): Promise<Alert> => resumeAlertRequest(createApiClient(data.apiKey), data.id));

export const testAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: resourceIdSchema }))
    .handler(({ data }): Promise<AlertTestAccepted> => testAlertRequest(createApiClient(data.apiKey), data.id));

/** At most 500 items per request (the spec's `maxItems`); the caller splits a larger selection. */
export const ALERT_BATCH_MAX = 500;

export const batchAlerts = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, items: z.array(bodySchema).min(1).max(ALERT_BATCH_MAX) }))
    .handler(({ data }): Promise<AlertBatchResponse> => batchAlertsRequest(createApiClient(data.apiKey), data.items as Array<AlertBatchItem>));

export const listAlertEvents = createServerFn({ method: "POST" })
    .inputValidator(z.object({
        after: z.string().trim().min(1).max(64).optional(),
        alertId: z.string().trim().min(1).max(64).optional(),
        apiKey: apiKeySchema,
        cursor: cursorSchema,
        externalUserId: z.string().trim().min(1).max(200).optional(),
        limit: pageLimitSchema,
        type: eventTypeSchema.optional(),
    }))
    .handler(({ data }): Promise<AlertEventsResponse> => listAlertEventsRequest(createApiClient(data.apiKey), {
        after: data.after,
        alert_id: data.alertId,
        cursor: data.cursor,
        external_user_id: data.externalUserId,
        limit: data.limit,
        type: data.type,
    }));

export const getAlertEvent = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, id: resourceIdSchema }))
    .handler(({ data }): Promise<AlertEvent> => getAlertEventRequest(createApiClient(data.apiKey), data.id));

export const listAlertEventsForAlert = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, id: resourceIdSchema, limit: pageLimitSchema, type: eventTypeSchema.optional() }))
    .handler(({ data }): Promise<AlertEventsResponse> => listAlertEventsForAlertRequest(createApiClient(data.apiKey), data.id, {
        cursor: data.cursor,
        limit: data.limit,
        type: data.type,
    }));

export const listAlertTemplates = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, cursor: cursorSchema, limit: pageLimitSchema }))
    .handler(({ data }): Promise<AlertTemplatesResponse> => listAlertTemplatesRequest(createApiClient(data.apiKey), { cursor: data.cursor, limit: data.limit }));
