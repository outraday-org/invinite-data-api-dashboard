import type { ApiRequestError } from "@/lib/api/errors";
import type {
    Alert,
    AlertActiveWindow,
    AlertConditionField,
    AlertConditionInput,
    AlertTemplate,
    AlertTriggerInput,
    AlertType,
    CreateAlertRequest,
    JsonValue,
    UpdateAlertRequest,
} from "@/lib/api/types";

import type { FieldSpec, TriggerScalarField } from "./condition-fields";

import { ACTIVE_WINDOW_DAYS, CONDITION_FIELDS, INDICATOR_STRUCTURED_FIELDS, triggerFieldsFor } from "./condition-fields";

/**
 * The alert form's model (pure, tested): the form keeps text as typed; `toAlertBody` turns it into the request body of
 * `createAlert` / `updateAlert` (only the fields of the chosen type, unset ones left out) with a message per field that
 * cannot be read; `fromAlert` fills the form from a stored alert (edit, duplicate); `fieldErrorsOf` maps the API's 400
 * (`param`, `errors[]`) onto the same field keys (`condition.<field>`, `trigger.<field>`, `destination_ids`, …).
 */

/** A field's text: one string, or the picked values of a multi choice. */
export type FieldText = Array<string> | string;

export type ActiveWindowState = {
    activeDurationSeconds: string;
    anchorAt: string;
    days: Array<string>;
    from: string;
    interval: string;
    timezone: string;
    to: string;
    /** "" = no window. */
    type: "" | AlertActiveWindow["type"];
    unit: string;
};

export type AlertFormState = {
    clientReferenceId: string;
    condition: Partial<Record<AlertConditionField, FieldText>>;
    /** Destination ids, one per line or comma (A3 replaces the text with its picker). */
    destinationIds: string;
    externalUserId: string;
    /** `indicator`: a built-in template, or a structured condition + filters. */
    indicatorMode: "structured" | "template";
    /** `json`: the stored value was not a string (a number, a list…): its text is JSON and is sent parsed back. */
    metadata: Array<{ json?: boolean; key: string; value: string }>;
    template: { inputs: Record<string, string>; key: string };
    trigger: Partial<Record<TriggerScalarField, string>>;
    type: AlertType;
    window: ActiveWindowState;
};

const EMPTY_WINDOW: ActiveWindowState = { activeDurationSeconds: "", anchorAt: "", days: [], from: "", interval: "", timezone: "", to: "", type: "", unit: "" };

export function emptyAlertForm(type: AlertType = "filing"): AlertFormState {
    return {
        clientReferenceId: "",
        condition: {},
        destinationIds: "",
        externalUserId: "",
        indicatorMode: "template",
        metadata: [],
        template: { inputs: {}, key: "" },
        trigger: {},
        type,
        window: EMPTY_WINDOW,
    };
}

/** Field errors by key (`condition.level`, `trigger.max_fires`, `destination_ids`, `metadata`, `form`). */
export type FieldErrors = Record<string, string>;

// ── Text → JSON ───────────────────────────────────────────────────────────────────────────────────────────────────

const textOf = (value: FieldText | undefined) => (typeof value === "string" ? value.trim() : "");

const listOf = (value: FieldText | undefined, commasOnly = false): Array<string> => {
    if (Array.isArray(value)) return value;

    return textOf(value).split(commasOnly ? /[,\n]/ : /[\s,]+/).map(item => item.trim()).filter(Boolean);
};

/** `datetime-local` text (the viewer's zone) → ISO 8601 with offset; an ISO text passes as is. */
export function instantOf(text: string): null | string {
    const date = new Date(text);

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO 8601 → the `datetime-local` text of the viewer's zone (minutes; seconds too when the instant has them). */
export function localDateTimeOf(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");

    const seconds = date.getSeconds() === 0 ? "" : `:${pad(date.getSeconds())}`;

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}${seconds}`;
}

const minutesOf = (text: string): null | number => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(text);

    if (!match) return null;

    const minutes = Number(match[1]) * 60 + Number(match[2]);

    return Number(match[1]) < 24 && Number(match[2]) < 60 ? minutes : null;
};

const clockOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Read = { error: string } | { value: JsonValue | undefined };

const inBounds = (n: number, spec: Pick<FieldSpec, "max" | "min">): null | string => {
    if (spec.min !== undefined && n < spec.min) return `At least ${spec.min}.`;

    if (spec.max !== undefined && n > spec.max) return `At most ${spec.max}.`;

    return null;
};

/** One field's text as its JSON value (undefined = not set), or why it cannot be read. */
export function readField(spec: FieldSpec, raw: FieldText | undefined): Read {
    switch (spec.kind) {
        case "boolean": {
            const text = textOf(raw);

            return { value: text === "" ? undefined : text === "true" };
        }

        case "datetime": {
            const text = textOf(raw);

            if (text === "") return { value: undefined };

            const iso = instantOf(text);

            return iso ? { value: iso } : { error: "Not a date and time." };
        }

        case "enum":
        case "string": {
            const text = textOf(raw);

            return { value: text === "" ? undefined : text };
        }

        case "enum-list":
        case "string-list": {
            const items = listOf(raw, spec.splitOnCommasOnly);

            if (spec.maxItems !== undefined && items.length > spec.maxItems) return { error: `At most ${spec.maxItems} entries.` };

            return { value: items.length > 0 ? items : undefined };
        }

        case "int-list":
        case "weekday-list": {
            const items = listOf(raw);

            const numbers = items.map(Number);

            if (numbers.some(n => !Number.isInteger(n))) return { error: "Whole numbers only, separated by commas." };

            const bad = numbers.map(n => inBounds(n, spec)).find(Boolean);

            if (bad) return { error: bad };

            if (spec.maxItems !== undefined && numbers.length > spec.maxItems) return { error: `At most ${spec.maxItems} entries.` };

            return { value: numbers.length > 0 ? numbers : undefined };
        }

        case "integer":
        case "number":
        case "weekday": {
            const text = textOf(raw);

            if (text === "") return { value: undefined };

            const n = Number(text);

            if (!Number.isFinite(n) || (spec.kind !== "number" && !Number.isInteger(n))) return { error: spec.kind === "number" ? "Not a number." : "Not a whole number." };

            const bad = inBounds(n, spec);

            return bad ? { error: bad } : { value: n };
        }

        case "json": {
            const text = textOf(raw);

            if (text === "") return { value: undefined };

            try {
                const value = JSON.parse(text) as JsonValue;

                if (value === null || typeof value !== "object") return { error: "Must be a JSON object or list." };

                if (spec.maxItems !== undefined && Array.isArray(value) && value.length > spec.maxItems) return { error: `At most ${spec.maxItems} entries.` };

                return { value };
            }
            catch {
                return { error: "Not valid JSON." };
            }
        }

        case "template": {
            return { value: undefined };
        }

        case "time-of-day": {
            const text = textOf(raw);

            if (text === "") return { value: undefined };

            const minutes = minutesOf(text);

            return minutes === null ? { error: "A time as HH:MM." } : { value: minutes };
        }
    }
}

/** A template's input text as its value (int / float / bool / enum); undefined = the template's default. */
function templateInputValue(input: AlertTemplate["inputs"][number], text: string): Read {
    const trimmed = text.trim();

    if (trimmed === "") return { value: undefined };

    if (input.kind === "bool") return { value: trimmed === "true" };

    if (input.kind === "enum") return input.options && !input.options.includes(trimmed) ? { error: `One of ${input.options.join(", ")}.` } : { value: trimmed };

    const n = Number(trimmed);

    if (!Number.isFinite(n) || (input.kind === "int" && !Number.isInteger(n))) return { error: input.kind === "int" ? "Not a whole number." : "Not a number." };

    return inBounds(n, { max: input.max, min: input.min }) ? { error: inBounds(n, { max: input.max, min: input.min })! } : { value: n };
}

function windowOf(window: ActiveWindowState, errors: FieldErrors): AlertActiveWindow | undefined {
    if (window.type === "") return undefined;

    if (window.type === "weekly") {
        return {
            type: "weekly",
            ...(window.timezone.trim() ? { timezone: window.timezone.trim() } : {}),
            ...(window.days.length > 0 ? { days: window.days.filter((day): day is (typeof ACTIVE_WINDOW_DAYS)[number] => (ACTIVE_WINDOW_DAYS as ReadonlyArray<string>).includes(day)) } : {}),
            ...(window.from.trim() ? { from: window.from.trim() } : {}),
            ...(window.to.trim() ? { to: window.to.trim() } : {}),
        };
    }

    const out: AlertActiveWindow = { type: "every" };

    if (window.anchorAt.trim()) {
        const iso = instantOf(window.anchorAt.trim());

        if (iso) out.anchor_at = iso;
        else errors["trigger.active_window.anchor_at"] = "Not a date and time.";
    }

    for (const [key, text, min] of [["interval", window.interval, 1], ["active_duration_seconds", window.activeDurationSeconds, 60]] as const) {
        if (!text.trim()) continue;

        const n = Number(text);

        if (!Number.isInteger(n) || n < min) errors[`trigger.active_window.${key}`] = `A whole number of at least ${min}.`;
        else out[key] = n;
    }

    if (window.unit) out.unit = window.unit as NonNullable<AlertActiveWindow["unit"]>;

    return out;
}

/** The condition / trigger / references of a form, with a message per field that cannot be read. */
function readForm(state: AlertFormState, templates: ReadonlyArray<AlertTemplate>) {
    const errors: FieldErrors = {};

    const condition: Record<string, JsonValue> = {};

    for (const spec of CONDITION_FIELDS[state.type]) {
        // The indicator shows one of its two ways; the other's fields are never sent.
        if (state.type === "indicator") {
            if (state.indicatorMode === "template" && INDICATOR_STRUCTURED_FIELDS.includes(spec.name)) continue;

            if (state.indicatorMode === "structured" && spec.name === "template") continue;
        }

        if (spec.kind === "template") {
            const key = state.template.key.trim();

            if (!key) continue;

            const template = templates.find(item => item.key === key);

            const inputs: Record<string, JsonValue> = {};

            for (const input of template?.inputs ?? []) {
                const read = templateInputValue(input, state.template.inputs[input.name] ?? "");

                if ("error" in read) errors[`condition.template.inputs.${input.name}`] = read.error;
                else if (read.value !== undefined) inputs[input.name] = read.value;
            }

            condition.template = { key, ...(Object.keys(inputs).length > 0 ? { inputs } : {}) };

            continue;
        }

        const read = readField(spec, state.condition[spec.name]);

        if ("error" in read) errors[`condition.${spec.name}`] = read.error;
        else if (read.value !== undefined) condition[spec.name] = read.value;
    }

    const trigger: Record<string, JsonValue> = {};

    for (const spec of triggerFieldsFor(state.type)) {
        const read = readField(spec, state.trigger[spec.name]);

        if ("error" in read) errors[`trigger.${spec.name}`] = read.error;
        else if (read.value !== undefined) trigger[spec.name] = read.value;
    }

    const window = windowOf(state.window, errors);

    if (window) trigger.active_window = window;

    const destinationIds = listOf(state.destinationIds);

    if (destinationIds.length > 10) errors.destination_ids = "At most 10 destinations.";

    const metadata: Record<string, JsonValue> = {};

    for (const { json, key, value } of state.metadata) {
        if (!key.trim() && !value.trim()) continue;

        if (!key.trim()) errors.metadata = "Every value needs a key.";
        else if (Object.hasOwn(metadata, key.trim())) errors.metadata = `The key ${key.trim()} is given twice.`;
        else if (!json) metadata[key.trim()] = value;
        else {
            try {
                metadata[key.trim()] = JSON.parse(value) as JsonValue;
            }
            catch {
                errors.metadata = `The value of ${key.trim()} was stored as JSON and is no longer valid JSON.`;
            }
        }
    }

    if (Object.keys(metadata).length > 50) errors.metadata = "At most 50 keys.";

    return { condition: condition as AlertConditionInput, destinationIds, errors, metadata, trigger: trigger as AlertTriggerInput };
}

/** The body of `POST /v1/alerts` (only what is set), or the field errors. */
export function toCreateBody(state: AlertFormState, templates: ReadonlyArray<AlertTemplate> = []): { body: CreateAlertRequest; errors: FieldErrors } {
    const { condition, destinationIds, errors, metadata, trigger } = readForm(state, templates);

    const body: CreateAlertRequest = {
        condition,
        type: state.type,
        ...(Object.keys(trigger).length > 0 ? { trigger } : {}),
        ...(destinationIds.length > 0 ? { destination_ids: destinationIds } : {}),
        ...(state.clientReferenceId.trim() ? { client_reference_id: state.clientReferenceId.trim() } : {}),
        ...(state.externalUserId.trim() ? { external_user_id: state.externalUserId.trim() } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };

    return { body, errors };
}

/**
 * The body of `PATCH /v1/alerts/{id}`: the whole condition, trigger, destinations and metadata as the form holds them
 * (an emptied reference is sent as null = cleared), and `version` = the version the form was loaded at (a 409
 * `conflict` when the alert changed since). The type is never sent: it never changes.
 */
export function toUpdateBody(state: AlertFormState, version: number, templates: ReadonlyArray<AlertTemplate> = []): { body: UpdateAlertRequest; errors: FieldErrors } {
    const { condition, destinationIds, errors, metadata, trigger } = readForm(state, templates);

    return {
        body: {
            client_reference_id: state.clientReferenceId.trim() || null,
            condition,
            destination_ids: destinationIds,
            external_user_id: state.externalUserId.trim() || null,
            metadata,
            trigger,
            version,
        },
        errors,
    };
}

// ── JSON → text (edit, duplicate) ────────────────────────────────────────────────────────────────────────────────

/** A stored value as the field's text. */
export function fieldText(spec: FieldSpec, value: unknown): FieldText | undefined {
    if (value === undefined || value === null) return undefined;

    switch (spec.kind) {
        case "boolean": return value === true ? "true" : "false";

        case "datetime": return typeof value === "string" ? localDateTimeOf(value) : undefined;

        case "enum-list":
        case "weekday-list": return Array.isArray(value) ? value.map(String) : undefined;

        case "int-list":
        case "string-list": return Array.isArray(value) ? value.map(String).join(spec.splitOnCommasOnly ? "\n" : ", ") : undefined;

        case "json": return JSON.stringify(value, null, 2);

        case "template": return undefined;

        case "time-of-day": return typeof value === "number" ? clockOf(value) : undefined;

        default: return String(value);
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The form of a stored alert (edit; `duplicate` drops the client reference id, which is unique per account). Fields of
 * the condition the type does not take (`resolved`) are not read.
 */
export function fromAlert(alert: Alert, { duplicate = false }: { duplicate?: boolean } = {}): AlertFormState {
    const state = emptyAlertForm(alert.type);

    const stored: Record<string, unknown> = isRecord(alert.condition) ? alert.condition : {};

    for (const spec of CONDITION_FIELDS[alert.type]) {
        if (spec.kind === "template") {
            const template = stored.template;

            if (isRecord(template) && typeof template.key === "string") {
                const inputs = isRecord(template.inputs) ? template.inputs : {};

                state.template = { inputs: Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, String(value)])), key: template.key };
            }

            continue;
        }

        const text = fieldText(spec, stored[spec.name]);

        if (text !== undefined) state.condition[spec.name] = text;
    }

    if (alert.type === "indicator") state.indicatorMode = stored.condition !== undefined && stored.template === undefined ? "structured" : "template";

    const trigger: Record<string, unknown> = isRecord(alert.trigger) ? alert.trigger : {};

    for (const spec of triggerFieldsFor(alert.type)) {
        const text = fieldText(spec, trigger[spec.name]);

        if (typeof text === "string") state.trigger[spec.name] = text;
    }

    const window = trigger.active_window;

    if (isRecord(window) && (window.type === "weekly" || window.type === "every")) {
        state.window = {
            activeDurationSeconds: window.active_duration_seconds === undefined ? "" : String(window.active_duration_seconds),
            anchorAt: typeof window.anchor_at === "string" ? localDateTimeOf(window.anchor_at) : "",
            days: Array.isArray(window.days) ? window.days.map(String) : [],
            from: typeof window.from === "string" ? window.from : "",
            interval: window.interval === undefined ? "" : String(window.interval),
            timezone: typeof window.timezone === "string" ? window.timezone : "",
            to: typeof window.to === "string" ? window.to : "",
            type: window.type,
            unit: typeof window.unit === "string" ? window.unit : "",
        };
    }

    state.destinationIds = alert.destination_ids.join("\n");

    state.externalUserId = alert.external_user_id ?? "";

    state.clientReferenceId = duplicate ? "" : alert.client_reference_id ?? "";

    state.metadata = Object.entries(isRecord(alert.metadata) ? alert.metadata : {}).map(([key, value]) => (typeof value === "string" ? { key, value } : { json: true, key, value: JSON.stringify(value) }));

    return state;
}

/**
 * The pre-filled form of `/alerts/new?type=&symbol=` (A4's entry points): the symbol in the type's company field.
 * `version` (a script version id, "Create alert from this version") makes it a `script` alert of that version;
 * `template` (a template key, "Use template") an `indicator` alert of that built-in template.
 */
export function prefilledForm(type: AlertType | undefined, symbol: string | undefined, { template, version }: { template?: string; version?: string } = {}): AlertFormState {
    const state = emptyAlertForm(version ? "script" : template ? "indicator" : type);

    if (version) state.condition.script_version_id = version;
    else if (template) state.template = { inputs: {}, key: template };

    if (!symbol) return state;

    const names = CONDITION_FIELDS[state.type].map(spec => spec.name);

    if (names.includes("symbols")) state.condition.symbols = symbol;
    else if (names.includes("symbol")) state.condition.symbol = symbol;

    return state;
}

// ── API errors → fields ──────────────────────────────────────────────────────────────────────────────────────────

// `type` and `version` have no editable field (fixed on edit, sent by the form): their problems go under `form`.
const TOP_LEVEL_KEYS = new Set(["client_reference_id", "destination_ids", "external_user_id", "metadata"]);

/** The form key a problem `param` names (`condition.rules.0.value` → `condition.rules`); null = no field of the form. */
export function fieldKeyOf(param: null | string | undefined): null | string {
    if (!param) return null;

    const parts = param.split(".");

    if (parts[0] === "condition" || parts[0] === "trigger") {
        if (parts[1] === "template" || parts[1] === "active_window") return parts.slice(0, parts[2] === "inputs" ? 4 : 2).join(".");

        return parts.length > 1 ? `${parts[0]}.${parts[1].replace(/\[\d+\]$/, "")}` : parts[0];
    }

    const top = parts[0].replace(/\[\d+\]$/, "");

    return TOP_LEVEL_KEYS.has(top) ? top : null;
}

/**
 * A 400's problems on the form's fields (`param` and every `errors[]` entry); what names no field goes under `form`.
 */
export function fieldErrorsOf(error: ApiRequestError): FieldErrors {
    const out: FieldErrors = {};

    const problems = error.body.errors?.length ? error.body.errors : [{ code: error.code, detail: error.message, param: error.body.param ?? null }];

    for (const problem of problems) {
        const key = fieldKeyOf(problem.param) ?? "form";

        out[key] = out[key] ? `${out[key]} ${problem.detail}` : problem.detail;
    }

    return out;
}
