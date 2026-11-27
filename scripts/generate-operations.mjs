// Generates `src/lib/api/operations.gen.ts` from the pinned `openapi.json` (part of `pnpm generate:api`).
//
// One entry per operation: method, path template, summary, the base credit cost (`x-credits`, null where the spec has
// none), the plan tier (`x-tier`), the CLI command (`x-cli`) and the docs page. Plus the route index (method + path
// template → operationId) the server's request recorder uses, and the plan order of `/v1/me` (its `plan` enum, the
// Data API's access rank), and the webhook payloads of `x-webhooks` (`webhooks.mjs`: the reference page `/alerts/webhooks`
// follows the pinned spec). Never edit the output by hand; `pnpm run check` (eslint --fix) formats it before a commit.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { alertTypeFields } from "./alert-fields.mjs";
import { webhookEntries, webhookEnvelope } from "./webhooks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const spec = JSON.parse(readFileSync(resolve(root, "openapi.json"), "utf8"));

/**
 * The SDK names (`reference/sdk-contract.json` of the same API reference bundle as `openapi.json`): the class, method,
 * parameter and body names of the TypeScript and Python SDKs, for the request panel's code. Never derived here.
 */
const sdkContract = JSON.parse(readFileSync(resolve(root, "sdk-contract.json"), "utf8"));

if (sdkContract.provenance?.specSha256 && sdkContract.provenance.specSha256 !== createHash("sha256").update(readFileSync(resolve(root, "openapi.json"))).digest("hex")) {
    throw new Error("sdk-contract.json was exported for another openapi.json: adopt both from the same API reference bundle");
}

/** A parameter's value kind: how the SDK code writes it (the SDKs type numbers, booleans and dates). */
const paramKind = (schema = {}) => {
    if (schema.type === "integer" || schema.type === "number") return "number";

    if (schema.type === "boolean") return "boolean";

    if (schema.format === "date") return "date";

    if (schema.format === "date-time") return "datetime";

    return "string";
};

const resolveParameter = parameter => (parameter.$ref ? spec.components.parameters[parameter.$ref.split("/").at(-1)] : parameter);

/** An operation's SDK call (null when the SDK has none): class, methods, path + query parameters, the body argument. */
const sdkOf = (id, operation, pathItem) => {
    const entry = sdkContract.operations[id];

    if (!entry) return null;

    const params = {};

    for (const raw of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
        const parameter = resolveParameter(raw);

        if (parameter.in !== "path" && parameter.in !== "query") continue;

        const names = sdkContract.parameters[parameter.name];

        if (!names) throw new Error(`${id}: parameter ${parameter.name} has no SDK names in sdk-contract.json`);

        params[parameter.name] = { kind: paramKind(parameter.schema), py: names.pyName, ts: names.tsName };
    }

    return {
        body: entry.body ? { model: entry.body.model, py: entry.body.pyName, ts: entry.body.tsName } : null,
        className: entry.className,
        params,
        py: entry.pyMethod,
        ts: entry.tsMethod,
    };
};

const METHODS = ["get", "post", "patch", "put", "delete"];

/** The docs page of an operation in the Invinite Data app: `/docs/get--_v1_funds_{fund}`. */
const docsUrl = (method, path) => `https://data.invinite.com/docs/${method}--${path.replaceAll("/", "_")}`;

const resolveRef = (schema) => {
    let current = schema;

    while (current && current.$ref) current = spec.components.schemas[current.$ref.split("/").at(-1)];

    return current;
};

const me = resolveRef(spec.paths["/v1/me"].get.responses["200"].content["application/json"].schema);

/** `/v1/me`'s `plan` enum: every value an account's plan may take, and the only values an `x-tier` may take. */
const accountPlans = me.properties.plan.enum;

/** An operation's `x-tier`, refused by name when it is not one of the plans (never copied through unchecked). */
const tierOf = (id, operation) => {
    const tier = operation["x-tier"];

    if (tier === undefined) return null;

    if (!accountPlans.includes(tier)) throw new Error(`${id}: x-tier "${tier}" is not a plan of /v1/me (${accountPlans.join(", ")})`);

    return tier;
};

const operations = {};

const routes = {};

for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
        const operation = item[method];

        if (!operation) continue;

        const id = operation.operationId;

        if (!id) throw new Error(`${method.toUpperCase()} ${path} has no operationId`);

        if (operations[id]) throw new Error(`operationId ${id} is used twice`);

        const cli = operation["x-cli"];

        operations[id] = {
            cli: cli
                ? {
                        action: cli.action || null,
                        group: cli.group,
                        positional: typeof cli.positional === "string" ? cli.positional : (cli.positional?.name ?? null),
                    }
                : null,
            credits: typeof operation["x-credits"] === "number" ? operation["x-credits"] : null,
            docsUrl: docsUrl(method, path),
            method: method.toUpperCase(),
            path,
            sdk: sdkOf(id, operation, item),
            summary: operation.summary ?? id,
            tier: tierOf(id, operation),
        };

        routes[`${method.toUpperCase()} ${path}`] = id;
    }
}

/** The WebSocket (`ws` on `/v1/stream`, outside `OPERATIONS`): the plan the socket and every channel need. */
const stream = spec.paths["/v1/stream"]?.ws;

if (!stream) throw new Error("openapi.json has no ws /v1/stream operation");

const streamTier = tierOf(stream.operationId, stream);

if (!streamTier) throw new Error(`${stream.operationId}: ws /v1/stream has no x-tier`);

/**
 * The route tiers in access order: `/v1/me`'s plans (the spec's enum order) that some operation's `x-tier` names. An
 * account plan no route requires (`payg`, credits without a plan) is not a rung of the ladder; `planAllows` ranks it.
 */
const usedTiers = new Set([...Object.values(operations).map(operation => operation.tier), streamTier]);

const planOrder = accountPlans.filter(plan => usedTiers.has(plan));

const sortedEntries = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));

// Sort nested schema keys before emitting so ESLint does not need one fix pass per nesting level.
const sortDeep = value => Array.isArray(value)
    ? value.map(sortDeep)
    : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })).map(([key, item]) => [key, sortDeep(item)]))
        : value;

// Serialize the already-projected webhook metadata with shared JSON subtrees. No contract inference here:
// each union/example is still the single webhooks.mjs projection, without duplicating it for every envelope.
function sharedJsonSource(values) {
    const counts = new Map();

    const visit = (value) => {
        if (!value || typeof value !== "object") return;

        const key = JSON.stringify(value);

        if (key.length > 500) counts.set(key, (counts.get(key) ?? 0) + 1);

        for (const child of Object.values(value)) visit(child);
    };

    values.forEach(visit);

    const declarations = [];

    const names = new Map();

    const emit = (value, depth = 0, inline = false) => {
        if (!value || typeof value !== "object") return JSON.stringify(value);

        const key = JSON.stringify(value);

        if (!inline && (counts.get(key) ?? 0) > 1) {
            if (!names.has(key)) {
                const name = `SHARED_WEBHOOK_${names.size}`;

                names.set(key, name);

                declarations.push(`const ${name} = ${emit(value, 0, true)};`);
            }

            return names.get(key);
        }

        const pad = "    ".repeat(depth);

        const entries = Array.isArray(value)
            ? value.map(item => emit(item, depth + 1))
            : Object.entries(value).map(([name, item]) => `${JSON.stringify(name)}: ${emit(item, depth + 1)}`);

        const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];

        return entries.length ? `${open}\n${entries.map(entry => `${pad}    ${entry},`).join("\n")}\n${pad}${close}` : `${open}${close}`;
    };

    const expressions = values.map(value => emit(value));

    return { declarations: declarations.join("\n\n"), expressions };
}

const webhookSource = sharedJsonSource([sortDeep(webhookEntries(spec)), sortDeep(webhookEnvelope(spec))]);

const output = `// Generated by scripts/generate-operations.mjs from openapi.json (${spec.info.version}). Do not edit.

import type { WebhookEntry, WebhookSchema } from "../../../scripts/webhooks.mjs";
import type { AlertTypeMetadata } from "../../../scripts/alert-fields.mjs";
import type { AlertType } from "./types";

export const ALERT_TYPE_FIELDS = ${JSON.stringify(sortDeep(alertTypeFields(spec)), null, 4)} satisfies { [T in AlertType]: AlertTypeMetadata<T> };

export type OperationMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

/** The plan an operation needs: one of \`/v1/me\`'s plans that a route requires (the generator refuses any other \`x-tier\`). */
export type OperationTier = (typeof PLAN_ORDER)[number];

export type OperationCli = { action: null | string; group: string; positional: null | string };

export type OperationSdkParamKind = "boolean" | "date" | "datetime" | "number" | "string";

/** The SDK call of an operation (\`sdk-contract.json\`): TS / Python method, each parameter's names, the body argument. */
export type OperationSdk = {
    body: null | { model: string; py: string; ts: string };
    className: string;
    params: Record<string, { kind: OperationSdkParamKind; py: string; ts: string }>;
    py: string;
    ts: string;
};

/** The SDK packages (\`sdk-contract.json\`). */
export const SDK_PACKAGES = ${JSON.stringify(sdkContract.packages)} as const;

export type Operation = {
    cli: null | OperationCli;
    credits: null | number;
    docsUrl: string;
    method: OperationMethod;
    path: string;
    sdk: null | OperationSdk;
    summary: string;
    tier: null | OperationTier;
};

export const OPERATIONS = ${JSON.stringify(sortedEntries(operations), null, 4)} as const satisfies Record<string, Operation>;

export type OperationId = keyof typeof OPERATIONS;

export const MACRO_ALERT_SERIES = ${JSON.stringify(spec.paths["/v1/macro/series"].get["x-macro-alert-series"], null, 4)} as const;

/** \`"GET /v1/funds/{fund}"\` → operationId. */
export const OPERATION_IDS_BY_ROUTE: Readonly<Record<string, OperationId>> = ${JSON.stringify(sortedEntries(routes), null, 4)};

/** The plan the live stream (\`ws /v1/stream\`, \`${stream.operationId}\`) and each of its channels need. */
export const STREAM_TIER: OperationTier = ${JSON.stringify(streamTier)};

/** The route tiers in access order: \`/v1/me\`'s \`plan\` values (the spec's enum order) that an \`x-tier\` names. */
export const PLAN_ORDER = ${JSON.stringify(planOrder)} as const;

/** The webhook payloads of \`x-webhooks\` in the spec's order (\`scripts/webhooks.mjs\`). */
${webhookSource.declarations}

export const WEBHOOKS: ReadonlyArray<WebhookEntry> = ${webhookSource.expressions[0]};

/** The envelope every webhook body shares (\`AlertWebhookEnvelope\`). */
export const WEBHOOK_ENVELOPE: WebhookSchema = ${webhookSource.expressions[1]};
`;

writeFileSync(resolve(root, "src/lib/api/operations.gen.ts"), output);

console.log(`operations.gen.ts: ${Object.keys(operations).length} operations, ${webhookEntries(spec).length} webhooks`);
