import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
    AlertUser,
    AlertUserBatchItem,
    AlertUserBatchResponse,
    AlertUserDefaults,
    AlertUserDeleteResult,
    AlertUsersListResponse,
    UpdateAlertUserDefaultsRequest,
    UpdateAlertUserRequest,
} from "./types";

import { ALERT_USER_BATCH_MAX, ALERT_USER_STATUSES, alertUserBatchItemSchema, alertUserFieldsSchema, limitSchema, pathUserIdSchema } from "../alerts/alert-users";
import {
    batchAlertUsersRequest,
    deleteAlertUserRequest,
    getAlertUserDefaultsRequest,
    getAlertUserRequest,
    listAlertUsersRequest,
    pauseAlertUserRequest,
    resumeAlertUserRequest,
    updateAlertUserDefaultsRequest,
    updateAlertUserRequest,
} from "./alert-users-requests";
import { createApiClient } from "./client.server";
import { apiKeySchema, cursorSchema, pageLimitSchema } from "./server-schemas";

/**
 * The end-user server functions (backend tasks/data-api-dashboard 2-alerts task 4): the 7 alert-user operations and
 * the account's end-user defaults. Reads `GET`, writes `POST`; inputs validated with the spec's bounds
 * (`alert-users.ts`); the id is never trimmed (any character is part of it).
 */

export const listAlertUsers = createServerFn({ method: "GET" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        cursor: cursorSchema,
        limit: pageLimitSchema,
        q: z.string().min(1).max(200).optional(),
        status: z.enum(ALERT_USER_STATUSES).optional(),
    }))
    .handler(({ data }): Promise<AlertUsersListResponse> => listAlertUsersRequest(createApiClient(data.apiKey), {
        cursor: data.cursor,
        limit: data.limit,
        q: data.q,
        status: data.status,
    }));

/** A per-user operation: the id goes into the path (any text but `.` / `..`, which a URL parser drops as dot segments). */
const userInput = z.object({ apiKey: apiKeySchema, externalUserId: pathUserIdSchema });

export const getAlertUser = createServerFn({ method: "GET" })
    .inputValidator(userInput)
    .handler(({ data }): Promise<AlertUser> => getAlertUserRequest(createApiClient(data.apiKey), data.externalUserId));

export const updateAlertUser = createServerFn({ method: "POST" })
    .inputValidator(userInput.extend({ body: alertUserFieldsSchema.refine(body => Object.keys(body).length > 0, "At least one field.") }))
    .handler(({ data }): Promise<AlertUser> => updateAlertUserRequest(createApiClient(data.apiKey), data.externalUserId, data.body as UpdateAlertUserRequest));

export const deleteAlertUser = createServerFn({ method: "POST" })
    .inputValidator(userInput)
    .handler(({ data }): Promise<AlertUserDeleteResult> => deleteAlertUserRequest(createApiClient(data.apiKey), data.externalUserId));

export const batchAlertUsers = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, items: z.array(alertUserBatchItemSchema).min(1).max(ALERT_USER_BATCH_MAX) }))
    .handler(({ data }): Promise<AlertUserBatchResponse> => batchAlertUsersRequest(createApiClient(data.apiKey), data.items as Array<AlertUserBatchItem>));

export const pauseAlertUser = createServerFn({ method: "POST" })
    .inputValidator(userInput)
    .handler(({ data }): Promise<AlertUser> => pauseAlertUserRequest(createApiClient(data.apiKey), data.externalUserId));

export const resumeAlertUser = createServerFn({ method: "POST" })
    .inputValidator(userInput)
    .handler(({ data }): Promise<AlertUser> => resumeAlertUserRequest(createApiClient(data.apiKey), data.externalUserId));

export const getAlertUserDefaults = createServerFn({ method: "GET" })
    .inputValidator(z.object({ apiKey: apiKeySchema }))
    .handler(({ data }): Promise<AlertUserDefaults> => getAlertUserDefaultsRequest(createApiClient(data.apiKey)));

export const updateAlertUserDefaults = createServerFn({ method: "POST" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        body: z.strictObject({
            max_active_alerts: limitSchema.optional(),
            max_fires_per_day: limitSchema.optional(),
            max_script_alerts: limitSchema.optional(),
        }).refine(body => Object.keys(body).length > 0, "At least one default."),
    }))
    .handler(({ data }): Promise<AlertUserDefaults> => updateAlertUserDefaultsRequest(createApiClient(data.apiKey), data.body as UpdateAlertUserDefaultsRequest));
