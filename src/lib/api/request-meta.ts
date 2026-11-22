import { replaceEqualDeep } from "@tanstack/react-query";

import type { Operation, OperationTier } from "./operations.gen";
import type { JsonValue } from "./types";

import { OPERATION_IDS_BY_ROUTE, OPERATIONS, PLAN_ORDER } from "./operations.gen";

/**
 * One Data API request behind a view, as the SERVER sent it (`client.server.ts` records it, the global function
 * middleware of `start.ts` carries it to the browser, the query cache keeps it beside the answer). Never a header:
 * the key cannot reach it. A write (alerts task 2) carries its JSON `body`, redacted on the server
 * (`redactSecrets`) before it is recorded.
 */
export type RequestMeta = {
    body?: JsonValue;
    /** What the answer debited (`X-Credits-Charged`); null = not stated. The base cost is the operation's. */
    credits: null | number;
    method: "DELETE" | "GET" | "PATCH" | "POST";
    /** `"unknown"` for a route the generated table does not know (a newer API than the pinned spec). */
    operationId: string;
    /** The concrete path sent (`/v1/instruments/AAPL`). */
    path: string;
    query: Record<string, Array<string> | string>;
    requestId: null | string;
    status: null | number;
};

const METHODS: ReadonlyArray<RequestMeta["method"]> = ["DELETE", "GET", "PATCH", "POST"];

const toMethod = (method: string): RequestMeta["method"] => {
    const upper = method.toUpperCase();

    return (METHODS as ReadonlyArray<string>).includes(upper) ? upper as RequestMeta["method"] : "GET";
};

/** The generated operation of an id; null for an unknown one. */
export function operationOf(operationId: string): null | Operation {
    return Object.hasOwn(OPERATIONS, operationId) ? OPERATIONS[operationId as keyof typeof OPERATIONS] : null;
}

/** What a redacted value reads as. */
export const REDACTED = "[redacted]";

// Keys whose value is a secret wherever they appear (a destination's signing secret, an auth header, a token).
const SECRET_KEY = /secret|authorization|password|passphrase|token|api[_-]?key|signing[_-]?key|private[_-]?key/i;

// A key naming WHEN something about a secret happens (`previous_secret_expires_at`): a timestamp, never the secret.
const TIMESTAMP_KEY = /_at$/i;

/**
 * A request body or answer with every secret replaced by `REDACTED` (pure; the inspector's rule): a value under a key
 * that names a secret (`secret`, `authorization`, `password`, `token`, `api_key`, `signing_key`, …) and every value of
 * a `headers` object (a destination's custom header values) — at any depth. A `null` stays `null` (there is nothing to
 * hide) and a timestamp key (`…_at`, e.g. `previous_secret_expires_at`) is shown as answered. Nothing else changes.
 */
export function redactSecrets(value: JsonValue): JsonValue {
    if (Array.isArray(value)) return value.map(redactSecrets);

    if (value === null || typeof value !== "object") return value;

    return Object.fromEntries(Object.entries(value).map(([key, item]): [string, JsonValue] => {
        if (SECRET_KEY.test(key) && !TIMESTAMP_KEY.test(key)) return [key, item === null ? null : REDACTED];

        if (key.toLowerCase() === "headers" && item !== null && typeof item === "object" && !Array.isArray(item)) {
            return [key, Object.fromEntries(Object.keys(item).map(name => [name, REDACTED]))];
        }

        return [key, redactSecrets(item)];
    }));
}

/** The descriptor of a sent request (server side; pure). A write's JSON `body` is recorded redacted. */
export function requestMetaOf(input: {
    body?: JsonValue;
    headers?: Headers;
    method: string;
    schemaPath: string;
    status?: number;
    url: string;
}): RequestMeta {
    const url = new URL(input.url);

    const method = toMethod(input.method);

    const query: RequestMeta["query"] = {};

    for (const [key, value] of url.searchParams) {
        if (Object.hasOwn(query, key)) {
            const previous = query[key];

            query[key] = [...(Array.isArray(previous) ? previous : [previous]), value];
        }
        else {
            query[key] = value;
        }
    }

    const charged = input.headers?.get("x-credits-charged");

    return {
        ...(input.body === undefined ? {} : { body: redactSecrets(input.body) }),
        credits: charged != null && charged !== "" && Number.isFinite(Number(charged)) ? Number(charged) : null,
        method,
        operationId: OPERATION_IDS_BY_ROUTE[`${method} ${input.schemaPath}`] ?? "unknown",
        path: url.pathname,
        query,
        requestId: input.headers?.get("x-request-id") ?? null,
        status: input.status ?? null,
    };
}

/** A value received from the server function boundary that is a descriptor (never trusted blindly). */
export function isRequestMeta(value: unknown): value is RequestMeta {
    if (!value || typeof value !== "object") return false;

    const candidate = value as Partial<RequestMeta>;

    return typeof candidate.operationId === "string" && typeof candidate.path === "string"
        && typeof candidate.method === "string" && !!candidate.query && typeof candidate.query === "object";
}

// The browser's registry: the requests of each answer (or thrown error), keyed by the object the query cache holds.
const filed = new WeakMap<object, ReadonlyArray<RequestMeta>>();

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

/** Files the requests a server function made under its answer / error (the function middleware's client half). */
export function fileRequests(target: unknown, requests: unknown) {
    if (!isObject(target) || !Array.isArray(requests)) return;

    const valid = requests.filter(isRequestMeta);

    if (valid.length > 0) filed.set(target, valid);
}

/** The requests behind an answer (one page of a list), an error, or nothing. */
export function requestsOf(target: unknown): ReadonlyArray<RequestMeta> {
    return isObject(target) ? filed.get(target) ?? [] : [];
}

const pagesOf = (value: unknown): null | ReadonlyArray<unknown> => {
    if (!isObject(value) || !("pages" in value)) return null;

    const { pages } = value as { pages: unknown };

    return Array.isArray(pages) ? pages : null;
};

/**
 * The query client's `structuralSharing`: React Query's own `replaceEqualDeep`, then the requests of the new answer
 * (or of each new page) are carried onto the object the cache keeps (a changed answer is a copy).
 */
export function shareWithRequests(previous: unknown, next: unknown): unknown {
    const shared = replaceEqualDeep(previous, next);

    const carry = (to: unknown, from: unknown) => {
        const requests = requestsOf(from);

        if (isObject(to) && requests.length > 0) filed.set(to, requests);
    };

    carry(shared, next);

    const nextPages = pagesOf(next);

    const sharedPages = pagesOf(shared);

    if (nextPages && sharedPages) nextPages.forEach((page, index) => carry(sharedPages[index], page));

    return shared;
}

/** The query string as sent (keys in order, a repeated key repeated). */
export function queryString(query: RequestMeta["query"]): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    }

    const text = params.toString();

    return text ? `?${text}` : "";
}

/** The full URL of a request on the given API base URL. */
export function requestUrl(baseUrl: string, meta: Pick<RequestMeta, "path" | "query">): string {
    return `${baseUrl.replace(/\/+$/, "")}${meta.path}${queryString(meta.query)}`;
}

/** A word the shell reads as itself (the CLI's `shellWord`): plain, else single-quoted. */
export function shellWord(text: string): string {
    if (/^[\w.,:/@+=-]+$/.test(text)) return text;

    return `'${text.replaceAll("'", "'\\''")}'`;
}

/**
 * The copyable `curl` of a request. The key is ALWAYS the shell variable `$INVINITE_API_KEY`, never a stored value.
 */
export function curlOf(baseUrl: string, meta: RequestMeta): string {
    const parts = ["curl", "-sS"];

    if (meta.method !== "GET") parts.push("-X", meta.method);

    parts.push("-H", "\"Authorization: Bearer $INVINITE_API_KEY\"");

    if (meta.body !== undefined) parts.push("-H", "'Content-Type: application/json'", "--data", shellWord(JSON.stringify(meta.body)));

    parts.push(shellWord(requestUrl(baseUrl, meta)));

    return parts.join(" ");
}

/** The path parameters of a concrete path under its template (`/v1/funds/{fund}` + `/v1/funds/SPY` → `{ fund: "SPY" }`). */
export function pathParamsOf(template: string, path: string): Record<string, string> {
    const names = template.split("/");

    const values = path.split("/");

    const params: Record<string, string> = {};

    if (names.length !== values.length) return params;

    names.forEach((name, index) => {
        const match = /^\{(.+)\}$/.exec(name);

        if (match) params[match[1]] = decodeURIComponent(values[index]);
    });

    return params;
}

/** A parameter's CLI flag (`invd`'s `flagName`): `filed_at.gte` → `--filed-at-gte`. */
export const cliFlag = (parameter: string) => `--${parameter.replace(/[_.]/g, "-").toLowerCase()}`;

/**
 * The `invd` line of a request (`x-cli`: group, action, positional parameter; every other parameter as its long flag).
 * Null when the operation has no CLI entry or is not known.
 */
export function cliOf(meta: RequestMeta): null | string {
    const operation = operationOf(meta.operationId);

    if (!operation?.cli) return null;

    const { action, group, positional } = operation.cli;

    const values: Record<string, Array<string> | string> = { ...pathParamsOf(operation.path, meta.path), ...meta.query };

    const words = ["invd", group];

    if (action) words.push(action);

    const asText = (value: Array<string> | string) => (Array.isArray(value) ? value.join(",") : value);

    if (positional && Object.hasOwn(values, positional)) words.push(shellWord(asText(values[positional])));

    for (const [name, value] of Object.entries(values)) {
        if (name === positional) continue;

        // A path parameter that is not the positional one has no flag spelling; the CLI asks for it as a flag of its name.
        words.push(cliFlag(name), shellWord(asText(value)));
    }

    return words.join(" ");
}

export type Plan = (typeof PLAN_ORDER)[number];

/** Whether a plan may call an operation of `tier` (the spec's plan order; null tier = every plan). */
export function planAllows(plan: Plan, tier: null | OperationTier): boolean {
    if (!tier) return true;

    return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(tier);
}
