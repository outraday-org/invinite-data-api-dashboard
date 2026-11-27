import type { JsonValue } from "@/lib/api/types";

import type { WebhookEntry, WebhookSchema } from "../../../scripts/webhooks.mjs";

/**
 * The webhook reference's derived text (backend tasks/data-api-dashboard 2-alerts task 3), pure. The spec provides
 * examples on the per-type 13.0 fire schemas; exampleOf preserves them. Otherwise exampleBody builds a shape — the first
 * enum value, a placeholder by type, an id prefix where the description names one (`evt_…`) — and the page labels it so.
 */

export type { WebhookEntry, WebhookField, WebhookHeader, WebhookSchema } from "../../../scripts/webhooks.mjs";

/** The instant every example uses (a placeholder; examples are shapes, not recorded deliveries). */
export const EXAMPLE_INSTANT = "2026-11-21T14:30:00Z";

/** An id prefix the description names (`` `evt_…` `` → `evt_`), else null. */
function idPrefixOf(description: string | undefined): null | string {
    const match = /`([a-z]+_)…`/.exec(description ?? "");

    return match ? match[1] : null;
}

/** An example value of a schema (pure, deterministic): an object shows its required fields (all where none is required). */
export function exampleOf(schema: WebhookSchema): JsonValue {
    if (schema.example !== undefined) return schema.example;

    if (schema.oneOf?.length) return exampleOf(schema.oneOf[0]);

    if (schema.enum && schema.enum.length > 0) return schema.enum[0];

    switch (schema.type) {
        case "array": return schema.items ? [exampleOf(schema.items)] : [];

        case "boolean": return true;

        case "integer":
        case "number": return schema.minimum ?? 0;

        case "string": {
            if (schema.format === "date-time") return EXAMPLE_INSTANT;

            if (schema.format === "date") return EXAMPLE_INSTANT.slice(0, 10);

            const prefix = idPrefixOf(schema.description);

            return prefix ? `${prefix}…` : "…";
        }

        default: {
            if (!schema.fields) return {};

            // The required fields where the schema names any (every field is in the page's table), else all of them.
            const fields = schema.fields.some(field => field.required) ? schema.fields.filter(field => field.required) : schema.fields;

            return Object.fromEntries(fields.map(field => [field.name, exampleOf(field.schema)]));
        }
    }
}

/** A webhook's whole example body: the envelope with this type, the example instant and the type's `data`. */
export function exampleBody(entry: Pick<WebhookEntry, "data" | "type">): JsonValue {
    return { data: exampleOf(entry.data), timestamp: EXAMPLE_INSTANT, type: entry.type };
}

/** A schema's type in words: `string (date-time)`, `array of object`, `"a" | "b"`, `… or null`. */
export function typeText(schema: WebhookSchema): string {
    let text: string;

    if (schema.enum && schema.enum.length > 0) text = schema.enum.map(value => JSON.stringify(value)).join(" | ");
    else if (schema.type === "array") text = `array of ${schema.items ? typeText(schema.items) : "any"}`;
    else if (schema.format) text = `${schema.type ?? "any"} (${schema.format})`;
    else text = schema.type ?? (schema.fields ? "object" : "any");

    return schema.nullable ? `${text} or null` : text;
}

/** One row of a field table: the dotted path (`alert.id`, `events[].data`), its schema and whether it is required. */
export type FieldRow = { depth: number; path: string; required: boolean; schema: WebhookSchema };

/** Every field of a schema, depth first in the spec's order (array items as `name[]`). */
export function fieldRows(schema: WebhookSchema, prefix = "", depth = 0): Array<FieldRow> {
    const rows: Array<FieldRow> = [];

    for (const field of schema.fields ?? []) {
        const path = prefix ? `${prefix}.${field.name}` : field.name;

        rows.push({ depth, path, required: field.required, schema: field.schema });

        rows.push(...fieldRows(field.schema, path, depth + 1));

        if (field.schema.items?.fields) rows.push(...fieldRows(field.schema.items, `${path}[]`, depth + 1));
    }

    return rows;
}
