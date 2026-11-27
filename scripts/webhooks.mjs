// The webhook payloads of `openapi.json` (`x-webhooks`) as the dashboard's reference page reads them (backend
// tasks/data-api-dashboard 2-alerts task 3). Pure: `generate-operations.mjs` writes its result into `operations.gen.ts`
// (`WEBHOOKS`, `WEBHOOK_ENVELOPE`), and a test runs it on a changed spec. Only what the spec states is carried: each
// type's summary and description, its request headers with their descriptions, the acknowledgement (its responses), and
// the `data` schema (refs resolved, `allOf` merged) — the spec has no example bodies; the page builds an example shape
// from the schema and says so. Object properties become an ordered `fields` list (the generated file is key-sorted by
// eslint; the spec's field order must survive it).

/** The schema keys the page reads; every other key is dropped. */
const KEPT = ["type", "format", "description", "enum", "nullable", "minimum", "maximum", "minItems", "maxItems", "example"];

const resolve = (spec, schema) => {
    let current = schema;

    while (current && current.$ref) current = spec.components?.schemas?.[current.$ref.split("/").at(-1)];

    return current && typeof current === "object" ? current : {};
};

/**
 * One schema with `$ref` resolved and `allOf` merged: properties and `required` united, a later part's property
 * replacing an earlier one's (a webhook's `type` enum of one value over the envelope's seven, its typed `data` over the
 * envelope's free object). Properties stay an object here (merged by name).
 */
function merged(spec, schema) {
    const current = resolve(spec, schema);

    if (!Array.isArray(current.allOf)) return current;

    const out = { type: "object" };

    for (const part of current.allOf.map(item => merged(spec, item))) {
        for (const [key, value] of Object.entries(part)) {
            if (key === "properties") out.properties = { ...out.properties, ...value };
            else if (key === "required") out.required = [...new Set([...(out.required ?? []), ...value])];
            else out[key] = value;
        }
    }

    return out;
}

/** A compact common projection for the existing table; complete variants stay on the union itself. */
function sharedSchema(branches) {
    const first = branches[0] ?? {};

    const out = { type: first.type ?? "object" };

    if (branches.every(branch => branch.enum)) out.enum = [...new Set(branches.flatMap(branch => branch.enum))];

    for (const key of KEPT.filter(key => key !== "enum" && key !== "example")) {
        if (branches.every(branch => branch[key] === first[key]) && first[key] !== undefined) out[key] = first[key];
    }

    if (first.fields) {
        out.fields = first.fields.filter(field => branches.every(branch => branch.fields?.some(candidate => candidate.name === field.name))).map((field) => {
            const matches = branches.map(branch => branch.fields.find(candidate => candidate.name === field.name));

            return { name: field.name, required: matches.every(match => match.required), schema: sharedSchema(matches.map(match => match.schema)) };
        });
    }

    if (branches.every(branch => branch.items)) out.items = sharedSchema(branches.map(branch => branch.items));

    return out;
}

/** The page's form of a schema: the kept keys, `fields` in the spec's order (with `required`), `items`, free objects. */
export function simplifySchema(spec, schema) {
    const current = merged(spec, schema);

    const branches = current.oneOf?.map(branch => simplifySchema(spec, branch));

    const out = branches ? { ...sharedSchema(branches), oneOf: branches, ...(current.discriminator ? { discriminator: current.discriminator } : {}) } : {};

    for (const key of KEPT) {
        if (current[key] !== undefined) out[key] = current[key];
    }

    if (current.additionalProperties !== undefined) out.additionalProperties = current.additionalProperties === true || typeof current.additionalProperties === "object";

    if (current.properties) {
        const required = new Set(current.required ?? []);

        out.fields = Object.entries(current.properties).map(([name, value]) => ({ name, required: required.has(name), schema: simplifySchema(spec, value) }));
    }

    if (current.items) out.items = simplifySchema(spec, current.items);

    return out;
}

/** One entry per `x-webhooks` type, in the spec's order. */
export function webhookEntries(spec) {
    return Object.entries(spec["x-webhooks"] ?? {}).map(([type, item]) => {
        const operation = item.post ?? Object.values(item)[0];

        const body = simplifySchema(spec, operation.requestBody?.content?.["application/json"]?.schema);

        return {
            acknowledgement: Object.entries(operation.responses ?? {}).map(([status, response]) => `${status}: ${response.description ?? ""}`.trim()),
            data: body.fields?.find(field => field.name === "data")?.schema ?? {},
            description: operation.description ?? "",
            headers: (operation.parameters ?? [])
                .filter(parameter => parameter.in === "header")
                .map(parameter => ({ description: parameter.description ?? "", name: parameter.name, required: parameter.required === true })),
            summary: operation.summary ?? type,
            type,
        };
    });
}

/** The envelope every webhook body shares (`AlertWebhookEnvelope`). */
export function webhookEnvelope(spec) {
    return simplifySchema(spec, { $ref: "#/components/schemas/AlertWebhookEnvelope" });
}
