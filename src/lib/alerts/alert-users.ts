import { z } from "zod";

import type {
    AlertUser,
    AlertUserBatchItem,
    AlertUserDefaults,
    AlertUserDeleteResult,
    AlertUserLimitField,
    AlertUserStatus,
    AlertUserUsage,
    JsonValue,
    UpdateAlertUserDefaultsRequest,
    UpdateAlertUserRequest,
} from "@/lib/api/types";

import { formatNumber } from "@/lib/format";

/**
 * The end users of the alerts platform (backend tasks/data-api-dashboard 2-alerts task 4), pure and tested: the bounds
 * of `AlertUserBatchItem` / `UpdateAlertUserRequest` as zod (the server functions and the bulk paste share them),
 * limits vs effective limits in words, the edit form ↔ request body, the defaults body of the changed fields, the
 * bulk paste (JSON or CSV) parsed and checked before anything is sent.
 */

/** `external_user_id`: the customer's own text, any character, 1–200 (never trimmed: a space is part of the id). */
export const EXTERNAL_USER_ID_MAX = 200;

export const DISPLAY_NAME_MAX = 200;

/** Every limit / default: an integer 0–100 000 000, or null. */
export const ALERT_USER_LIMIT_MAX = 100_000_000;

/** Items per `batchAlertUsers` request (the spec's `maxItems`). */
export const ALERT_USER_BATCH_MAX = 500;

export const METADATA_MAX_KEYS = 50;

export const METADATA_MAX_BYTES = 8 * 1024;

export const externalUserIdSchema = z.string().min(1, "An end user id is required.").max(EXTERNAL_USER_ID_MAX, `At most ${EXTERNAL_USER_ID_MAX} characters.`);

/**
 * Whether an id can be one path segment: `.` and `..` cannot — every URL parser (fetch, the browser, the router) reads
 * them as dot segments, so `/v1/alert-users/..` would be `/v1/` (`encodeURIComponent` leaves dots as they are).
 */
export const isPathSafeUserId = (id: string) => id !== "." && id !== "..";

export const UNADDRESSABLE_ID_TEXT = "The ids . and .. cannot be put into a URL path, so they cannot be read, changed, paused or deleted one by one (a bulk upsert still takes them).";

/** The id of the per-user operations (`/v1/alert-users/{id}…`): any text except `.` / `..`. */
export const pathUserIdSchema = externalUserIdSchema.refine(isPathSafeUserId, UNADDRESSABLE_ID_TEXT);

const LIMIT_TEXT = `A whole number from 0 to ${formatNumber(ALERT_USER_LIMIT_MAX)}, or null.`;

export const limitSchema = z.number(LIMIT_TEXT).int(LIMIT_TEXT).min(0, LIMIT_TEXT).max(ALERT_USER_LIMIT_MAX, LIMIT_TEXT).nullable();

const byteLength = (text: string) => new TextEncoder().encode(text).length;

export const metadataSchema = z
    .record(z.string(), z.json(), "An object of key / value pairs.")
    .refine(value => Object.keys(value).length <= METADATA_MAX_KEYS, `At most ${METADATA_MAX_KEYS} keys.`)
    .refine(value => byteLength(JSON.stringify(value)) <= METADATA_MAX_BYTES, "At most 8 KB.");

/** The fields of an upsert (`UpdateAlertUserRequest`): any of them, unknown ones refused. */
export const alertUserFieldsSchema = z.strictObject({
    display_name: z.string("Text, or null.").max(DISPLAY_NAME_MAX, `At most ${DISPLAY_NAME_MAX} characters.`).nullable().optional(),
    max_active_alerts: limitSchema.optional(),
    max_fires_per_day: limitSchema.optional(),
    max_script_alerts: limitSchema.optional(),
    metadata: metadataSchema.optional(),
});

/** One bulk item (`AlertUserBatchItem`): the id and the upsert's fields. */
export const alertUserBatchItemSchema = alertUserFieldsSchema.extend({ external_user_id: externalUserIdSchema });

// ── Limits and usage in words ───────────────────────────────────────────────────────────────────────────────────

export type LimitSpec = { field: AlertUserLimitField; help: string; label: string; usage: keyof Omit<AlertUserUsage, "last_fired_at"> };

/** The three limits, in display order, with the usage each one bounds. */
export const LIMIT_SPECS: ReadonlyArray<LimitSpec> = [
    { field: "max_active_alerts", help: "Alerts that count (active, paused, scheduled).", label: "Active alerts", usage: "active_alerts" },
    { field: "max_script_alerts", help: "Script and indicator alerts among them.", label: "Script / indicator alerts", usage: "script_alerts" },
    { field: "max_fires_per_day", help: "Fires per UTC day before the end user's deliveries pause.", label: "Fires per day (UTC)", usage: "fires_today" },
];

/** Where an effective limit comes from: the end user's own value, the account default, or none (no limit). */
export type LimitSource = "default" | "none" | "own";

export function limitSource(own: null | number, effective: null | number): LimitSource {
    if (own !== null) return "own";

    return effective === null ? "none" : "default";
}

export const LIMIT_SOURCE_TEXT: Record<LimitSource, string> = {
    default: "the account default",
    none: "no limit",
    own: "its own limit",
};

/** "3 of 10" / "3 (no limit)". */
export function usageText(used: number, limit: null | number) {
    return limit === null ? `${formatNumber(used)} (no limit)` : `${formatNumber(used)} of ${formatNumber(limit)}`;
}

/** The used share of a limit (0–1, capped), or null without a limit; a limit of 0 is full. */
export function usageShare(used: number, limit: null | number): null | number {
    if (limit === null) return null;

    if (limit === 0) return 1;

    return Math.min(1, used / limit);
}

export const ALERT_USER_STATUSES = ["active", "paused", "deleting"] as const satisfies ReadonlyArray<AlertUserStatus>;

type MissingStatus = Exclude<AlertUserStatus, (typeof ALERT_USER_STATUSES)[number]>;

export const ALERT_USER_STATUSES_COMPLETE: MissingStatus extends never ? true : never = true;

/** A status in words (the spec exposes no pause source: "paused" never says who paused). */
export const ALERT_USER_STATUS_INFO: Record<AlertUserStatus, { label: string; meaning: string; tone: "default" | "destructive" | "secondary" }> = {
    active: { label: "Active", meaning: "Its alerts run; new ones are accepted within its limits.", tone: "default" },
    deleting: { label: "Deleting", meaning: "Its erasure is running in the background; creates for this id are refused until it ends.", tone: "destructive" },
    paused: { label: "Paused", meaning: "Its alerts are paused and new ones are refused until it is resumed; the pause never ends by itself.", tone: "secondary" },
};

/** The confirm words of pause / resume / delete of one end user (pure, tested). */
export function alertUserConfirmWords(action: "delete" | "pause" | "resume", user: Pick<AlertUser, "external_user_id" | "usage">) {
    const alerts = counted(user.usage.active_alerts, "alert");

    switch (action) {
        case "delete": return {
            confirmLabel: "Delete end user",
            destructive: true,
            effect: `Erases the end user: its ${alerts} are deleted, open deliveries cancelled, and its events, deliveries and fire counters permanently removed. This cannot be undone.`,
            title: "Delete this end user?",
        };

        case "pause": return {
            confirmLabel: "Pause end user",
            destructive: false,
            effect: `Pauses deliveries of the end user's ${alerts} (every active or scheduled one) and refuses new alerts and per-alert resumes until it is resumed. The pause never ends by itself.`,
            title: "Pause this end user?",
        };

        case "resume": return {
            confirmLabel: "Resume end user",
            destructive: false,
            effect: `The end user is active again and exactly the alerts its pause paused are armed again (of its ${alerts}); an alert paused on its own stays paused.`,
            title: "Resume this end user?",
        };
    }
}

/** "1 alert", "3 alerts" (pure). */
const counted = (count: number, noun: string, plural = `${noun}s`) => `${formatNumber(count)} ${count === 1 ? noun : plural}`;

/** An erasure's answer in words. */
export function deleteResultText(result: AlertUserDeleteResult) {
    const counts = `${counted(result.alerts_deleted, "alert")}, ${counted(result.events_deleted, "event")} and ${counted(result.deliveries_deleted, "delivery", "deliveries")} removed`;

    return result.status === "deleted"
        ? `Deleted: ${counts}; nothing of the end user is left.`
        : `Deleting: ${counts} so far; the rest is removed in the background (a repeated delete continues it).`;
}

// ── The edit / add form ─────────────────────────────────────────────────────────────────────────────────────────

export type AlertUserFormState = {
    displayName: string;
    externalUserId: string;
    limits: Record<AlertUserLimitField, string>;
    /** The metadata as JSON text ("" = an empty object). */
    metadata: string;
};

const EMPTY_LIMITS: Record<AlertUserLimitField, string> = { max_active_alerts: "", max_fires_per_day: "", max_script_alerts: "" };

export function emptyAlertUserForm(externalUserId = ""): AlertUserFormState {
    return { displayName: "", externalUserId, limits: EMPTY_LIMITS, metadata: "" };
}

const limitTextOf = (value: null | number) => (value === null ? "" : String(value));

export function fromAlertUser(user: AlertUser): AlertUserFormState {
    return {
        displayName: user.display_name ?? "",
        externalUserId: user.external_user_id,
        limits: {
            max_active_alerts: limitTextOf(user.limits.max_active_alerts),
            max_fires_per_day: limitTextOf(user.limits.max_fires_per_day),
            max_script_alerts: limitTextOf(user.limits.max_script_alerts),
        },
        metadata: Object.keys(user.metadata).length > 0 ? JSON.stringify(user.metadata, null, 2) : "",
    };
}

export type FormErrors = Record<string, string>;

/** A limit's text: "" = null (the account default for an end user, no limit for a default). */
function readLimit(text: string): { error: string } | { value: null | number } {
    const trimmed = text.trim();

    if (trimmed === "") return { value: null };

    const parsed = limitSchema.safeParse(Number(trimmed));

    return parsed.success && /^\d+$/.test(trimmed) ? { value: parsed.data } : { error: LIMIT_TEXT };
}

/**
 * The upsert of the form (`PATCH /v1/alert-users/{id}`). Edit (`create: false`) sends every field it shows (an empty
 * limit = null = the account default, an empty name = null, the metadata replaces the stored object). Add
 * (`create: true`) sends only the fields filled in — the id may already exist, and a field left empty must not wipe
 * its stored value; the API wants at least one field, so an empty add form asks for one.
 */
export function toAlertUserBody(state: AlertUserFormState, { create = false }: { create?: boolean } = {}): { body: UpdateAlertUserRequest; errors: FormErrors; id: string } {
    const errors: FormErrors = {};

    const id = pathUserIdSchema.safeParse(state.externalUserId);

    if (!id.success) errors.external_user_id = id.error.issues[0].message;

    const body: UpdateAlertUserRequest = {};

    const name = state.displayName.trim();

    if (name || !create) body.display_name = name || null;

    if (name.length > DISPLAY_NAME_MAX) errors.display_name = `At most ${DISPLAY_NAME_MAX} characters.`;

    for (const { field } of LIMIT_SPECS) {
        if (create && state.limits[field].trim() === "") continue;

        const read = readLimit(state.limits[field]);

        if ("error" in read) errors[field] = read.error;
        else body[field] = read.value;
    }

    if (state.metadata.trim() === "") {
        if (!create) body.metadata = {};
    }
    else {
        try {
            const parsed = metadataSchema.safeParse(JSON.parse(state.metadata) as JsonValue);

            if (parsed.success) body.metadata = parsed.data;
            else errors.metadata = parsed.error.issues[0].message;
        }
        catch {
            errors.metadata = "Not valid JSON.";
        }
    }

    if (Object.keys(body).length === 0 && Object.keys(errors).length === 0) errors.form = "Fill in at least one field: an existing end user keeps every field left empty.";

    return { body, errors, id: state.externalUserId };
}

// ── The account's defaults ──────────────────────────────────────────────────────────────────────────────────────

export type DefaultsFormState = Record<AlertUserLimitField, string>;

export function fromDefaults(defaults: Pick<AlertUserDefaults, AlertUserLimitField>): DefaultsFormState {
    return {
        max_active_alerts: limitTextOf(defaults.max_active_alerts),
        max_fires_per_day: limitTextOf(defaults.max_fires_per_day),
        max_script_alerts: limitTextOf(defaults.max_script_alerts),
    };
}

/** The changed defaults only (null clears one = no limit); `body` null = nothing changed (the API wants ≥ 1 field). */
export function toDefaultsBody(state: DefaultsFormState, loaded: Pick<AlertUserDefaults, AlertUserLimitField>): { body: null | UpdateAlertUserDefaultsRequest; errors: FormErrors } {
    const errors: FormErrors = {};

    const body: UpdateAlertUserDefaultsRequest = {};

    for (const { field } of LIMIT_SPECS) {
        const read = readLimit(state[field]);

        if ("error" in read) errors[field] = read.error;
        else if (read.value !== loaded[field]) body[field] = read.value;
    }

    return { body: Object.keys(body).length > 0 ? body : null, errors };
}

/** A limit in words for a default / limits card. */
export function limitValueText(value: null | number) {
    return value === null ? "No limit" : formatNumber(value);
}

/** Which of the end user's effective limits differ from its own (they come from the defaults). */
export function limitRows(user: Pick<AlertUser, "effective_limits" | "limits" | "usage">) {
    return LIMIT_SPECS.map(spec => ({
        ...spec,
        effective: user.effective_limits[spec.field],
        own: user.limits[spec.field],
        source: limitSource(user.limits[spec.field], user.effective_limits[spec.field]),
        used: user.usage[spec.usage],
    }));
}

export type LimitRow = ReturnType<typeof limitRows>[number];

/** Where a limit comes from, in one line: its own value, the account default's, or none at all (pure). */
export function limitOriginText(row: Pick<LimitRow, "effective" | "own" | "source">) {
    switch (row.source) {
        case "default": return `Not set: the account default applies (${limitValueText(row.effective)}).`;

        case "none": return "Not set, and the account default sets none: no limit.";

        case "own": return `Its own limit (${limitValueText(row.own)}).`;
    }
}

// ── Bulk upsert: paste → items ──────────────────────────────────────────────────────────────────────────────────

export type BatchProblem = { item: number; message: string };

export type ParsedBatch = { format: "csv" | "json" | null; items: Array<AlertUserBatchItem>; problems: Array<BatchProblem> };

/** The CSV columns a paste may have (a header row is required; `metadata` holds JSON text). */
export const BATCH_CSV_COLUMNS = ["external_user_id", "display_name", "max_active_alerts", "max_script_alerts", "max_fires_per_day", "metadata"] as const;

const LIMIT_COLUMNS = new Set<string>(["max_active_alerts", "max_fires_per_day", "max_script_alerts"]);

/** RFC 4180 rows: commas, double quotes with `""` as a quote, line breaks inside quotes (pure); `unclosed` = a quote never closed. */
export function csvRows(text: string): { rows: Array<Array<string>>; unclosed: boolean } {
    const rows: Array<Array<string>> = [];

    let row: Array<string> = [];

    let cell = "";

    let quoted = false;

    for (let at = 0; at < text.length; at++) {
        const char = text[at];

        if (quoted) {
            if (char === "\"" && text[at + 1] === "\"") {
                cell += "\"";

                at++;
            }
            else if (char === "\"") quoted = false;
            else cell += char;

            continue;
        }

        if (char === "\"" && cell === "") quoted = true;
        else if (char === ",") {
            row.push(cell);

            cell = "";
        }
        else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[at + 1] === "\n") at++;

            row.push(cell);

            rows.push(row);

            row = [];

            cell = "";
        }
        else cell += char;
    }

    if (cell !== "" || row.length > 0) {
        row.push(cell);

        rows.push(row);
    }

    // A blank line is no item.
    return { rows: rows.filter(cells => cells.some(value => value.trim() !== "")), unclosed: quoted };
}

/** One CSV cell as the item's value: "" = not set (the field stays as it is), `null` = null. */
function csvValue(column: string, raw: string): { error: string } | { value: JsonValue | undefined } {
    // The id is taken as written (a space is part of it); the other cells are trimmed.
    const text = column === "external_user_id" ? raw : raw.trim();

    if (text === "") return { value: undefined };

    if (column !== "external_user_id" && text === "null") return { value: null };

    if (LIMIT_COLUMNS.has(column)) return /^\d+$/.test(text) ? { value: Number(text) } : { error: `${column}: ${LIMIT_TEXT}` };

    if (column === "metadata") {
        try {
            return { value: JSON.parse(text) as JsonValue };
        }
        catch {
            return { error: "metadata: not valid JSON." };
        }
    }

    return { value: text };
}

function rawItemsOf(text: string): { format: ParsedBatch["format"]; problems: Array<BatchProblem>; raw: Array<unknown> } {
    const trimmed = text.trim();

    if (trimmed === "") return { format: null, problems: [], raw: [] };

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
            const parsed: unknown = JSON.parse(trimmed);

            const list = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown }).items;

            if (!Array.isArray(list)) return { format: "json", problems: [{ item: 0, message: "JSON must be a list of items or { \"items\": [...] }." }], raw: [] };

            return { format: "json", problems: [], raw: list };
        }
        catch {
            return { format: "json", problems: [{ item: 0, message: "Not valid JSON." }], raw: [] };
        }
    }

    const { rows: [header, ...rows], unclosed } = csvRows(text);

    if (unclosed) return { format: "csv", problems: [{ item: 0, message: "A double quote is never closed: every quoted cell needs its closing \"." }], raw: [] };

    const columns = header.map(column => column.trim());

    const unknown = columns.filter(column => !(BATCH_CSV_COLUMNS as ReadonlyArray<string>).includes(column));

    if (!columns.includes("external_user_id") || unknown.length > 0) {
        return {
            format: "csv",
            problems: [{ item: 0, message: `The first row must name the columns: external_user_id and any of ${BATCH_CSV_COLUMNS.slice(1).join(", ")}${unknown.length > 0 ? ` (unknown: ${unknown.join(", ")})` : ""}.` }],
            raw: [],
        };
    }

    const problems: Array<BatchProblem> = [];

    const raw = rows.map((cells, index) => {
        const item: Record<string, JsonValue> = {};

        if (cells.length > columns.length) problems.push({ item: index + 1, message: `${cells.length} cells for ${columns.length} columns.` });

        columns.forEach((column, at) => {
            const read = csvValue(column, cells[at] ?? "");

            if ("error" in read) problems.push({ item: index + 1, message: read.error });
            else if (read.value !== undefined) item[column] = read.value;
        });

        return item;
    });

    return { format: "csv", problems, raw };
}

/**
 * A pasted bulk upsert (JSON list / `{ items }`, or CSV with a header row), every item checked against
 * `AlertUserBatchItem` (ids 1–200, names ≤ 200, limits 0–100 000 000 or null, metadata ≤ 50 keys / 8 KB, no other
 * field) and for a repeated id. `item` = the 1-based position (0 = the paste as a whole).
 */
export function parseAlertUserBatch(text: string): ParsedBatch {
    const { format, problems, raw } = rawItemsOf(text);

    const items: Array<AlertUserBatchItem> = [];

    const seen = new Map<string, number>();

    raw.forEach((value, index) => {
        const position = index + 1;

        const parsed = alertUserBatchItemSchema.safeParse(value);

        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const path = issue.path.join(".");

                problems.push({ item: position, message: issue.code === "unrecognized_keys" ? `Unknown field ${issue.keys.join(", ")}.` : `${path ? `${path}: ` : ""}${issue.message}` });
            }

            return;
        }

        const first = seen.get(parsed.data.external_user_id);

        if (first !== undefined) problems.push({ item: position, message: `The id ${parsed.data.external_user_id} is given twice (item ${first}).` });
        else seen.set(parsed.data.external_user_id, position);

        items.push(parsed.data as AlertUserBatchItem);
    });

    problems.sort((a, b) => a.item - b.item);

    return { format, items, problems };
}

/** The preview line of a parsed paste: items, the requests it takes (≤ 500 each), the problems. */
export function batchPreviewText(parsed: ParsedBatch) {
    const count = parsed.items.length;

    const requests = Math.ceil(count / ALERT_USER_BATCH_MAX);

    const items = `${formatNumber(count)} end user${count === 1 ? "" : "s"}`;

    const split = requests > 1 ? ` in ${requests} requests of at most ${ALERT_USER_BATCH_MAX}` : "";

    if (parsed.problems.length > 0) return `${items} read; ${parsed.problems.length} problem${parsed.problems.length === 1 ? "" : "s"} to fix before anything is sent.`;

    return `${items} to create or update${split}.`;
}
