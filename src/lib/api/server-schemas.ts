import { z } from "zod";

/**
 * The input schemas every server function module shares (`server-functions*.ts`): the stored key, an API resource id,
 * and one cursor page. One copy, so a bound changes in one place.
 */

/** The stored API key: trimmed; empty = none (`createApiClient` then answers a typed 401 without a request). */
export const apiKeySchema = z
    .string()
    .transform(val => val.trim())
    .pipe(z.string().min(1))
    .optional();

/** An id of the API (`alt_…`, `evt_…`, `dst_…`, `scr_…`; `maxLength` 64 in the spec). */
export const resourceIdSchema = z.string().trim().min(1).max(64);

/** The previous page's `next_cursor`. */
export const cursorSchema = z.string().min(1).optional();

/** `limit` of a cursor list (1–200). */
export const pageLimitSchema = z.number().int().min(1).max(200).optional();

/** The two fields of a cursor page, spread into an input object. */
export const pageInput = { cursor: cursorSchema, limit: pageLimitSchema };
