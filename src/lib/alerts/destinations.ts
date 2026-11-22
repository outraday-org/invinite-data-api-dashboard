import type { ApiRequestError } from "@/lib/api/errors";
import type {
    CreateDestinationRequest,
    Destination,
    DestinationDelivery,
    DestinationDeliveryStatus,
    DestinationKind,
    DestinationPreset,
    UpdateDestinationRequest,
} from "@/lib/api/types";

/**
 * The destination model of the alerts area (backend tasks/data-api-dashboard 2-alerts task 3), pure: the form state and
 * its create / update bodies with the contract's bounds, the words of kinds / presets / statuses / delivery statuses,
 * the one-time secret rule (`takeSecret`) and the test-delivery tracking. Every bound is the spec's
 * (`CreateDestinationRequest` / `UpdateDestinationRequest`, 7.1); `destinations.test.ts` checks them against it.
 */

export const DESTINATION_KINDS = ["webhook", "batch_webhook"] as const satisfies ReadonlyArray<DestinationKind>;

export const DESTINATION_PRESETS = ["standard", "claude_routine"] as const satisfies ReadonlyArray<DestinationPreset>;

export const DELIVERY_STATUSES = ["pending", "in_flight", "succeeded", "failed", "dead"] as const satisfies ReadonlyArray<DestinationDeliveryStatus>;

type MissingDeliveryStatus = Exclude<DestinationDeliveryStatus, (typeof DELIVERY_STATUSES)[number]>;

export const DELIVERY_STATUSES_COMPLETE: MissingDeliveryStatus extends never ? true : never = true;

export const KIND_INFO: Record<DestinationKind, { label: string; meaning: string }> = {
    batch_webhook: { label: "Batch webhook", meaning: "Every pending event in one alert.fired.batch request (at most 500 events and 1 MB)." },
    webhook: { label: "Webhook", meaning: "One event per request." },
};

export const PRESET_INFO: Record<DestinationPreset, { label: string; meaning: string }> = {
    claude_routine: { label: "Claude routine", meaning: "The body format for a Claude routine; no digest window." },
    standard: { label: "Standard", meaning: "The standard body: the webhook envelope (type, timestamp, data)." },
};

type Tone = "default" | "destructive" | "outline" | "secondary";

export const DELIVERY_STATUS_INFO: Record<DestinationDeliveryStatus, { label: string; meaning: string; tone: Tone }> = {
    dead: { label: "Dead", meaning: "Given up: no further attempt.", tone: "destructive" },
    failed: { label: "Failed", meaning: "The last attempt failed; another follows at the next attempt time.", tone: "destructive" },
    in_flight: { label: "In flight", meaning: "Being sent right now.", tone: "secondary" },
    pending: { label: "Pending", meaning: "Queued, not sent yet.", tone: "outline" },
    succeeded: { label: "Succeeded", meaning: "Your endpoint acknowledged it with a 2xx.", tone: "default" },
};

/** A delivery's `last_error` code (the contract's nullable enum, owner decision D13 of backend task 5). */
export type DeliveryErrorCode = NonNullable<DestinationDelivery["last_error"]>;

/**
 * Every `last_error` code in words (backend `tasks/data-api-ui-walk-findings-2026-11-22` task 5, F107): a short label
 * for the log and the API's sentence as its title. `destinations.test.ts` checks the keys against the spec's enum.
 */
export const DELIVERY_ERROR_INFO: Record<DeliveryErrorCode, { label: string; meaning: string }> = {
    account_deleted: { label: "Account deleted", meaning: "The account was deleted before the delivery was sent." },
    alert_user_deleted: { label: "End user deleted", meaning: "The alert's end user was deleted before the delivery was sent." },
    blocked_address: { label: "Address blocked", meaning: "The URL is not https on port 443, or its host did not resolve to public addresses only." },
    body_too_large: { label: "Body too large", meaning: "The request body exceeded the size limit; the delivery is not retried." },
    destination_deleted: { label: "Destination deleted", meaning: "The destination was deleted before the delivery was sent." },
    destination_disabled: { label: "Destination disabled", meaning: "The destination was disabled before the delivery was sent." },
    event_missing: { label: "Event missing", meaning: "The event was no longer stored when the delivery was due." },
    gone: { label: "Gone (410)", meaning: "Your endpoint answered 410 Gone; the destination was disabled." },
    http_status: { label: "Error status", meaning: "Your endpoint answered with a status other than 2xx (see the last answer)." },
    lease_expired: { label: "Worker stopped", meaning: "The delivery worker stopped during the attempt; the attempt counts, and the delivery is retried unless it was the last." },
    network: { label: "Network error", meaning: "The connection failed or broke before an answer." },
    redirect: { label: "Redirect", meaning: "Your endpoint answered with a redirect, which is never followed." },
    sealed_unreadable: { label: "Secret unreadable", meaning: "The destination's stored secret or headers could not be read; the delivery is not retried." },
    timeout: { label: "Timed out", meaning: "No answer within 10 seconds, or the host name did not resolve in time." },
};

/** `last_error` in words (null = no failure; a code this build does not know is shown as sent). */
export function deliveryErrorInfo(code: null | string): null | { label: string; meaning: string } {
    if (!code) return null;

    return Object.hasOwn(DELIVERY_ERROR_INFO, code) ? DELIVERY_ERROR_INFO[code] : { label: code, meaning: code };
}

/** Why a destination is disabled, in words (`manual` / `gone` / `failing` of the contract; anything else as sent). */
export function destinationDisabledText(reason: null | string): null | string {
    if (!reason) return null;

    switch (reason) {
        case "failing": return "Disabled after only failures for 72 hours with at least 10 failed attempts in a row.";

        case "gone": return "Disabled because your endpoint answered 410 Gone.";

        case "manual": return "Disabled by you (status set to disabled).";

        default: return `Disabled: ${reason}.`;
    }
}

export const kindLabel = (kind: string) => (Object.hasOwn(KIND_INFO, kind) ? KIND_INFO[kind as DestinationKind].label : kind);

export const presetLabel = (preset: string) => (Object.hasOwn(PRESET_INFO, preset) ? PRESET_INFO[preset as DestinationPreset].label : preset);

// The contract's bounds (CreateDestinationRequest / UpdateDestinationRequest).
export const URL_MAX = 2048;

export const DESCRIPTION_MAX = 500;

export const HEADERS_MAX = 20;

export const HEADER_VALUE_MAX = 1024;

/** `body_template` ≤ 16 KB (measured in UTF-8 bytes). */
export const BODY_TEMPLATE_MAX_BYTES = 16 * 1024;

export const RATE_MIN = 1;

export const RATE_MAX = 100_000;

/** `max_events_per_minute` when the create omits it. */
export const RATE_DEFAULT = 600;

export const DIGEST_MIN = 1;

export const DIGEST_MAX = 3600;

/** One custom header row of the form; `value` is write-only (never read back from the API). */
export type HeaderRow = { name: string; value: string };

/**
 * What an edit does with the stored headers: `keep` sends no `headers` (the stored ones stay; their values cannot be
 * read back), `replace` sends the rows as the new set, `remove` sends null. A create always sends its rows.
 */
export type HeadersMode = "keep" | "remove" | "replace";

export type DestinationFormState = {
    bodyTemplate: string;
    description: string;
    /** Seconds, as typed; "" = off. */
    digestSeconds: string;
    headerRows: Array<HeaderRow>;
    headersMode: HeadersMode;
    kind: DestinationKind;
    /** As typed; "" = the default (600) on create. */
    maxEventsPerMinute: string;
    preset: DestinationPreset;
    url: string;
};

export type DestinationField = "body_template" | "description" | "digest_seconds" | "form" | "headers" | "max_events_per_minute" | "url";

export type DestinationErrors = Partial<Record<DestinationField, string>>;

export function emptyDestinationForm(): DestinationFormState {
    return {
        bodyTemplate: "",
        description: "",
        digestSeconds: "",
        headerRows: [],
        headersMode: "replace",
        kind: "webhook",
        maxEventsPerMinute: "",
        preset: "standard",
        url: "",
    };
}

/** The form of a stored destination (edit): header values are write-only, so the stored headers are kept by default. */
export function destinationFormOf(destination: Destination): DestinationFormState {
    return {
        bodyTemplate: destination.body_template ?? "",
        description: destination.description ?? "",
        digestSeconds: destination.digest_seconds === null ? "" : String(destination.digest_seconds),
        headerRows: [],
        headersMode: "keep",
        kind: destination.kind,
        maxEventsPerMinute: String(destination.max_events_per_minute),
        preset: destination.preset,
        url: destination.url,
    };
}

/**
 * The URL rules the form checks itself (the contract: https, port 443, public addresses only — the third is the API's
 * to refuse, its 400 shows under the field). Null = fine.
 */
export function urlProblem(text: string): null | string {
    const value = text.trim();

    if (!value) return "Enter the https URL of your endpoint.";

    if (value.length > URL_MAX) return `At most ${URL_MAX} characters.`;

    let url: URL;

    try {
        url = new URL(value);
    }
    catch {
        return "Not a URL (https://…).";
    }

    if (url.protocol !== "https:") return "The URL must start with https:// (the API delivers over https only).";

    if (url.port !== "" && url.port !== "443") return `Port ${url.port} is not allowed: the API delivers to port 443 only.`;

    return null;
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/** A whole number within bounds, or the problem in words. */
function intProblem(text: string, min: number, max: number): null | string {
    if (!/^\d+$/.test(text.trim())) return "A whole number.";

    const value = Number(text);

    return value < min || value > max ? `From ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.` : null;
}

/** The header rows as the API takes them; problems (a missing name, a duplicate, too many, too long) in words. */
export function readHeaders(rows: ReadonlyArray<HeaderRow>): { headers: Record<string, string>; problem: null | string } {
    const filled = rows.filter(row => row.name.trim() !== "" || row.value !== "");

    if (filled.length > HEADERS_MAX) return { headers: {}, problem: `At most ${HEADERS_MAX} headers.` };

    const headers: Record<string, string> = {};

    const seen = new Set<string>();

    for (const row of filled) {
        const name = row.name.trim();

        if (!name) return { headers: {}, problem: "Every header needs a name." };

        if (!/^[!#$%&'*+.^`|~\w-]+$/.test(name)) return { headers: {}, problem: `"${name}" is not a valid header name.` };

        if (seen.has(name.toLowerCase())) return { headers: {}, problem: `The header "${name}" is listed twice.` };

        if (row.value.length > HEADER_VALUE_MAX) return { headers: {}, problem: `The value of "${name}" is longer than ${HEADER_VALUE_MAX} characters.` };

        seen.add(name.toLowerCase());

        headers[name] = row.value;
    }

    return { headers, problem: null };
}

type Read = {
    bodyTemplate: null | string;
    description: null | string;
    digestSeconds: null | number;
    errors: DestinationErrors;
    headers: Record<string, string>;
    maxEventsPerMinute: null | number;
    url: string;
};

/** Every field read and checked against the contract's bounds (pure). */
function readForm(state: DestinationFormState): Read {
    const errors: DestinationErrors = {};

    const url = state.url.trim();

    const urlError = urlProblem(url);

    if (urlError) errors.url = urlError;

    const description = state.description.trim();

    if (description.length > DESCRIPTION_MAX) errors.description = `At most ${DESCRIPTION_MAX} characters.`;

    const { headers, problem } = state.headersMode === "replace" ? readHeaders(state.headerRows) : { headers: {}, problem: null };

    if (problem) errors.headers = problem;

    if (byteLength(state.bodyTemplate) > BODY_TEMPLATE_MAX_BYTES) errors.body_template = "At most 16 KB.";

    const rateText = state.maxEventsPerMinute.trim();

    const rateError = rateText === "" ? null : intProblem(rateText, RATE_MIN, RATE_MAX);

    if (rateError) errors.max_events_per_minute = rateError;

    const digestText = state.digestSeconds.trim();

    const digestError = digestText === "" ? null : intProblem(digestText, DIGEST_MIN, DIGEST_MAX);

    if (digestError) errors.digest_seconds = digestError;
    else if (digestText !== "" && state.preset === "claude_routine") errors.digest_seconds = "A digest cannot be used with the Claude routine preset.";

    return {
        bodyTemplate: state.bodyTemplate === "" ? null : state.bodyTemplate,
        description: description === "" ? null : description,
        digestSeconds: digestText === "" ? null : Number(digestText),
        errors,
        headers,
        maxEventsPerMinute: rateText === "" ? null : Number(rateText),
        url,
    };
}

/** The create body (`CreateDestinationRequest`): empty optional fields are left out (the API's defaults apply). */
export function toCreateDestinationBody(state: DestinationFormState): { body: CreateDestinationRequest; errors: DestinationErrors } {
    const read = readForm({ ...state, headersMode: "replace" });

    const body: CreateDestinationRequest = {
        kind: state.kind,
        preset: state.preset,
        url: read.url,
        ...(read.description === null ? {} : { description: read.description }),
        ...(Object.keys(read.headers).length > 0 ? { headers: read.headers } : {}),
        ...(read.bodyTemplate === null ? {} : { body_template: read.bodyTemplate }),
        ...(read.maxEventsPerMinute === null ? {} : { max_events_per_minute: read.maxEventsPerMinute }),
        ...(read.digestSeconds === null ? {} : { digest_seconds: read.digestSeconds }),
    };

    return { body, errors: read.errors };
}

/**
 * The update body (`UpdateDestinationRequest`, PATCH): only what changed against the stored destination; an emptied
 * description / template / digest is sent as null (removes it). Headers per `headersMode`. Nothing changed = an error
 * under the form (the contract needs at least one field).
 */
export function toUpdateDestinationBody(state: DestinationFormState, stored: Destination): { body: UpdateDestinationRequest; errors: DestinationErrors } {
    const read = readForm(state);

    const body: UpdateDestinationRequest = {};

    if (read.url !== stored.url) body.url = read.url;

    if (state.kind !== stored.kind) body.kind = state.kind;

    if (state.preset !== stored.preset) body.preset = state.preset;

    if (read.description !== (stored.description ?? null)) body.description = read.description;

    if (read.bodyTemplate !== (stored.body_template ?? null)) body.body_template = read.bodyTemplate;

    if (read.maxEventsPerMinute !== null && read.maxEventsPerMinute !== stored.max_events_per_minute) body.max_events_per_minute = read.maxEventsPerMinute;

    if (read.digestSeconds !== (stored.digest_seconds ?? null)) body.digest_seconds = read.digestSeconds;

    if (state.headersMode === "replace") body.headers = read.headers;
    else if (state.headersMode === "remove") body.headers = null;

    const errors = { ...read.errors };

    if (state.maxEventsPerMinute.trim() === "" && !errors.max_events_per_minute) errors.max_events_per_minute = `From ${RATE_MIN} to ${RATE_MAX.toLocaleString("en-US")}.`;

    if (Object.keys(errors).length === 0 && Object.keys(body).length === 0) errors.form = "Nothing changed.";

    return { body, errors };
}

/** The API's 400 under the form field it names (`param`: `url`, `headers.X-Auth`, …); else under the form. */
export function destinationFieldOf(param: null | string | undefined): DestinationField {
    const head = (param ?? "").split(/[.[]/)[0];

    const fields: ReadonlyArray<DestinationField> = ["body_template", "description", "digest_seconds", "headers", "max_events_per_minute", "url"];

    return (fields as ReadonlyArray<string>).includes(head) ? head as DestinationField : "form";
}

/** A 400's problems under their fields (`param` / `errors[]`); a problem naming no field goes under the form. */
export function destinationErrorsOf(error: ApiRequestError): DestinationErrors {
    const out: DestinationErrors = {};

    const problems = error.body.errors?.length ? error.body.errors : [{ code: error.code, detail: error.message, param: error.body.param ?? null }];

    for (const problem of problems) {
        const key = destinationFieldOf(problem.param);

        out[key] = out[key] ? `${out[key]} ${problem.detail}` : problem.detail;
    }

    return out;
}

/** An answer that carries the one-time signing secret (`DestinationCreated`, `DestinationSecret`). */
type WithSecret = { secret?: string };

/**
 * THE secret rule: reads the signing secret out of a write's answer and deletes it from that object in place, so the
 * mutation's state, the mutation cache and the API inspector (which shows that very object) never hold it afterwards.
 * The caller keeps the returned string only in the show-once dialog's component state. Null when there is none.
 */
export function takeSecret(answer: WithSecret): null | string {
    const secret = typeof answer.secret === "string" ? answer.secret : null;

    delete answer.secret;

    return secret;
}

/** What a forgotten header value reads as. */
export const FORGOTTEN = "[sent]";

/**
 * Header values are write-only: once a create / update settled, its input (the mutation's `variables`, which the
 * mutation cache keeps for minutes) forgets them in place — the names stay, every value becomes `FORGOTTEN`. The form
 * state builds a new body for each submission, so a retry still sends the typed values.
 */
export function forgetHeaderValues(input: { body: { headers?: null | Record<string, string> } }) {
    const { headers } = input.body;

    if (!headers) return;

    for (const name of Object.keys(headers)) headers[name] = FORGOTTEN;
}

/** `whsec_…abcd` from the API's last-4 hint (`secret_hint`). */
export const secretHintText = (hint: string) => `whsec_…${hint}`;

/** "600 / min" */
export const rateText = (perMinute: number) => `${perMinute.toLocaleString("en-US")} / min`;

/** "off" or "60 s" */
export const digestText = (seconds: null | number) => (seconds === null ? "Off" : `${seconds.toLocaleString("en-US")} s`);

/** How long a test delivery is watched for its outcome before the dialog says so and stops polling. */
export const TEST_WATCH_MS = 30_000;

/** How often the deliveries list is asked again while a test delivery is watched. */
export const TEST_POLL_MS = 2_000;

const TERMINAL: ReadonlySet<DestinationDeliveryStatus> = new Set(["dead", "failed", "succeeded"]);

export type TestTracking
    = { delivery: DestinationDelivery; state: "done" }
        | { delivery: DestinationDelivery | null; state: "timed_out" }
        | { delivery: DestinationDelivery | null; state: "waiting" };

/**
 * Where a test delivery stands (pure): `done` once the loaded deliveries show it succeeded / failed / dead, `timed_out`
 * after `TEST_WATCH_MS` without that (polling stops), else `waiting` (pending / in flight or not listed yet).
 */
export function testTracking(deliveryId: string, deliveries: ReadonlyArray<DestinationDelivery>, elapsedMs: number): TestTracking {
    const delivery = deliveries.find(row => row.id === deliveryId) ?? null;

    if (delivery && TERMINAL.has(delivery.status)) return { delivery, state: "done" };

    return elapsedMs >= TEST_WATCH_MS ? { delivery, state: "timed_out" } : { delivery, state: "waiting" };
}

/** The deliveries of the loaded pages with one status (the operation has no status filter: this filters the loaded rows). */
export function deliveriesWithStatus(rows: ReadonlyArray<DestinationDelivery>, status: DestinationDeliveryStatus | null): Array<DestinationDelivery> {
    return status === null ? [...rows] : rows.filter(row => row.status === status);
}

/** "3" (the only page) or "100+" (`has_more`): how many alerts deliver to a destination, from the first page. */
export const alertsUsingText = (count: number, hasMore: boolean) => (hasMore ? `${count}+` : String(count));
