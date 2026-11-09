/**
 * An API error that keeps the HTTP status. Every earnings server function throws it
 * (`throwApiError`), so the status-aware pages (audio, slides, documents, search, live
 * stream, a 404 on event / transcript / press release / metrics / diff / prosody / price
 * attribution — `price_attribution_unavailable` until the call is attributed) can render a
 * state per status instead of a toast.
 *
 * Server functions serialise a thrown Error with its own properties (TanStack Start /
 * seroval) but revive it as a plain `Error`, so `status`, `code` and `body` are own fields
 * and the client side recovers the class with `fromSerialized`.
 *
 * Two body shapes: v1 `{ error, message, code? }` and the RFC 9457 problem of `/v2/*` (and `/health`, `/status*`)
 * `{ type, title, status, detail, code, param?, errors?, request_id, docs_url }` — read as `error` = the problem
 * `code`, `message` = `detail`, `requestId` = `request_id` (shown in the error toasts).
 */
export type ApiErrorBody = {
    /** The SEC store's reason (`SecStoreError.code`, e.g. `search_provider_not_registered`); absent elsewhere. */
    code?: string;
    error: string;
    /** A problem body's `errors[]`: every parameter problem of a 400 (`invalid_parameter` / `unknown_parameter`). */
    errors?: Array<ApiErrorParamProblem>;
    message: string;
    /** A problem body's offending parameter (`invalid_parameter` / `unknown_parameter`). */
    param?: string;
    /** A problem body's `request_id` (= the response's `X-Request-Id`): quoted to support. */
    requestId?: string;
    /** The SEC store's typed readiness of a refused answer (403 excluded / 404 unknown / 424 failed / 503 not_ready). */
    readiness?: ApiErrorReadiness;
};

export type ApiErrorParamProblem = { code: string; detail: string; param: null | string };

export type ApiErrorReadiness = { reason: null | string; status: string };

export class ApiRequestError extends Error {
    body: ApiErrorBody;

    code: string;

    /** `body.code`: the reason behind the state (`/v1/sec/*`), else null. */
    reason: null | string;

    /** `body.requestId`: the problem body's `request_id`, else null. */
    requestId: null | string;

    status: number;

    constructor(status: number, body: ApiErrorBody) {
        super(body.message);

        this.name = "ApiRequestError";

        this.status = status;

        this.code = body.error;

        this.reason = body.code ?? null;

        this.requestId = body.requestId ?? null;

        this.body = body;
    }
}

/** An RFC 9457 problem (`/v2/*`): `title` + `detail` + `code`, no v1 `error` field. */
function isProblem(record: Record<string, unknown>) {
    return typeof record.error !== "string" && typeof record.code === "string" && typeof record.detail === "string" && typeof record.title === "string";
}

function toProblemBody(record: Record<string, unknown>): ApiErrorBody {
    const body: ApiErrorBody = { error: String(record.code), message: String(record.detail) };

    if (typeof record.param === "string") body.param = record.param;

    if (typeof record.request_id === "string") body.requestId = record.request_id;

    const errors = toParamProblems(record.errors);

    if (errors) body.errors = errors;

    return body;
}

function toParamProblems(value: unknown): Array<ApiErrorParamProblem> | null {
    if (!Array.isArray(value)) return null;

    const problems = value.flatMap((item: unknown): Array<ApiErrorParamProblem> => {
        if (typeof item !== "object" || item === null) return [];

        const { code, detail, param } = item as Record<string, unknown>;

        if (typeof code !== "string" || typeof detail !== "string") return [];

        return [{ code, detail, param: typeof param === "string" ? param : null }];
    });

    return problems.length > 0 ? problems : null;
}

function toErrorBody(value: unknown, status: number): ApiErrorBody {
    const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

    if (isProblem(record)) return toProblemBody(record);

    const error = typeof record.error === "string" ? record.error : `http_${status}`;

    const message = typeof record.message === "string" ? record.message : `Request failed with status ${status}`;

    const body: ApiErrorBody = { error, message };

    if (typeof record.code === "string") body.code = record.code;

    // A revived body (`fromSerialized`) keeps the problem's fields under their own names.
    if (typeof record.param === "string") body.param = record.param;

    if (typeof record.requestId === "string") body.requestId = record.requestId;

    const errors = toParamProblems(record.errors);

    if (errors) body.errors = errors;

    const readiness = toReadiness(record.readiness);

    if (readiness) body.readiness = readiness;

    return body;
}

function toReadiness(value: unknown): ApiErrorReadiness | null {
    if (typeof value !== "object" || value === null || !("status" in value) || typeof value.status !== "string") return null;

    const reason = "reason" in value && typeof value.reason === "string" ? value.reason : null;

    return { reason, status: value.status };
}

/** Throws an openapi-fetch `error` body as an `ApiRequestError` carrying the response status. */
export function throwApiError(error: unknown, response: Response): never {
    throw new ApiRequestError(response.status, toErrorBody(error, response.status));
}

/** The `ApiRequestError` behind a value that crossed the server-function boundary, else null. */
export function fromSerialized(value: unknown): ApiRequestError | null {
    if (value instanceof ApiRequestError) return value;

    if (typeof value !== "object" || value === null) return null;

    const record = value as Record<string, unknown>;

    if (typeof record.status !== "number" || typeof record.code !== "string") return null;

    const body = toErrorBody(record.body, record.status);

    const message = typeof record.message === "string" && record.message.length > 0 ? record.message : body.message;

    return new ApiRequestError(record.status, { ...body, error: record.code, message });
}

/** `.catch` handler of the status-aware hooks: rethrows as `ApiRequestError` when possible. */
export function rethrowApiError(error: unknown): never {
    throw fromSerialized(error) ?? error;
}

/** React Query `retry`: an API answer (4xx / 503 state) is final, transport errors retry twice. */
export function retryUnlessApiError(failureCount: number, error: unknown) {
    return !(error instanceof ApiRequestError) && failureCount < 2;
}

/**
 * REST plan gate: v1 `403 { error: "Forbidden" }`, v2 `403` problem `plan_required` (the WebSocket's code is
 * `forbidden_tier`).
 */
export function isTierError(error: unknown) {
    return error instanceof ApiRequestError && error.status === 403 && (error.code === "Forbidden" || error.code === "plan_required");
}

/**
 * An error's text for a toast: a v2 problem (it states a request id) appends its code and request id
 * (` (<code>, request <id>)`); every other error is its message.
 */
export function errorDescription(error: Error) {
    if (!(error instanceof ApiRequestError) || !error.requestId) return error.message;

    return `${error.message} (${error.code}, request ${error.requestId})`;
}
