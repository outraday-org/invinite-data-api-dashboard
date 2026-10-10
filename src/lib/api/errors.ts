/**
 * An API error that keeps the HTTP status. Every earnings server function throws it
 * (`throwApiError`), so the status-aware pages (audio, slides, documents, search, live
 * stream, a 404 on event / transcript / press release / metrics / diff / prosody) can
 * render a state per status instead of a toast.
 *
 * Server functions serialise a thrown Error with its own properties (TanStack Start /
 * seroval) but revive it as a plain `Error`, so `status`, `code` and `body` are own fields
 * and the client side recovers the class with `fromSerialized`.
 */
export type ApiErrorBody = {
    error: string;
    message: string;
};

export class ApiRequestError extends Error {
    body: ApiErrorBody;

    code: string;

    status: number;

    constructor(status: number, body: ApiErrorBody) {
        super(body.message);

        this.name = "ApiRequestError";

        this.status = status;

        this.code = body.error;

        this.body = body;
    }
}

function toErrorBody(value: unknown, status: number): ApiErrorBody {
    const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

    const error = typeof record.error === "string" ? record.error : `http_${status}`;

    const message = typeof record.message === "string" ? record.message : `Request failed with status ${status}`;

    return { error, message };
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

    return new ApiRequestError(record.status, { error: record.code, message });
}

/** `.catch` handler of the status-aware hooks: rethrows as `ApiRequestError` when possible. */
export function rethrowApiError(error: unknown): never {
    throw fromSerialized(error) ?? error;
}

/** React Query `retry`: an API answer (4xx / 503 state) is final, transport errors retry twice. */
export function retryUnlessApiError(failureCount: number, error: unknown) {
    return !(error instanceof ApiRequestError) && failureCount < 2;
}

/** REST plan gate: `403 { error: "Forbidden" }` (the WebSocket's code is `forbidden_tier`). */
export function isTierError(error: unknown) {
    return error instanceof ApiRequestError && error.status === 403 && error.code === "Forbidden";
}
