/** Local schema references belong to the pinned bundle; never load sibling sources or remote definitions. */
function resolveSchema(spec, schema) {
    if (!schema) throw new Error("Missing alert schema");

    return schema.$ref ? resolveSchema(spec, spec.components.schemas[schema.$ref.split("/").at(-1)]) : schema;
}

function fieldKind(raw, field, item) {
    if (raw.$ref || field.type === "object" || !field.type) return "json";

    if (field.type === "array") {
        if (item?.type === "string") return item.enum ? "enum-list" : "string-list";

        return item?.type === "integer" ? "int-list" : "json";
    }

    if (field.enum) return "enum";

    return field.format === "date-time" ? "datetime" : field.type;
}

function schemaFields(spec, raw) {
    const schema = resolveSchema(spec, raw);

    return Object.entries(schema.properties ?? {}).map(([name, rawField]) => {
        const field = resolveSchema(spec, rawField);

        const item = field.items ? resolveSchema(spec, field.items) : null;

        const bounds = item ?? field;

        return {
            name, kind: fieldKind(rawField, field, item), required: (schema.required ?? []).includes(name),
            description: field.description ?? "",
            ...(field.enum || item?.enum ? { enum: field.enum ?? item.enum } : {}),
            ...(bounds.minimum !== undefined ? { min: bounds.minimum } : {}),
            ...(bounds.maximum !== undefined ? { max: bounds.maximum } : {}),
            ...(field.maxItems !== undefined ? { maxItems: field.maxItems } : {}),
            ...(rawField.$ref || rawField.allOf?.[0]?.$ref ? { ref: rawField.$ref ?? rawField.allOf[0].$ref } : {}),
        };
    });
}

/** Zod consumes JSON Schema: normalize OpenAPI 3.0 nullable/exclusive bounds and inline local references. */
function jsonSchema(spec, raw) {
    const schema = resolveSchema(spec, raw);

    const result = { ...schema };

    delete result.example;
    delete result.discriminator;
    delete result.nullable;

    for (const key of ["properties", "$defs"]) {
        if (schema[key]) result[key] = Object.fromEntries(Object.entries(schema[key]).map(([name, value]) => [name, jsonSchema(spec, value)]));
    }

    if (schema.items) result.items = jsonSchema(spec, schema.items);

    if (typeof schema.additionalProperties === "object") result.additionalProperties = jsonSchema(spec, schema.additionalProperties);

    for (const key of ["oneOf", "anyOf", "allOf"]) {
        if (schema[key]) result[key] = schema[key].map(value => jsonSchema(spec, value));
    }

    for (const [exclusive, bound] of [["exclusiveMinimum", "minimum"], ["exclusiveMaximum", "maximum"]]) {
        if (schema[exclusive] === true) {
            result[exclusive] = schema[bound];

            delete result[bound];
        }
        else if (schema[exclusive] === false) delete result[exclusive];
    }

    return schema.nullable ? { anyOf: [result, { type: "null" }] } : result;
}

/** Build alert editor metadata exclusively from the published discriminated schemas. */
export function alertTypeFields(spec) {
    const create = resolveSchema(spec, spec.paths["/v1/alerts"].post.requestBody.content["application/json"].schema);

    const fired = resolveSchema(spec, spec.components.schemas.AlertFiredData);

    if (create.discriminator?.propertyName !== "type" || fired.discriminator?.propertyName !== "alert_type") throw new Error("Alert discriminators changed");

    return Object.fromEntries(Object.entries(create.discriminator.mapping).map(([type, ref]) => {
        const request = resolveSchema(spec, { $ref: ref });

        const payload = resolveSchema(spec, { $ref: fired.discriminator.mapping[type] });

        const reason = resolveSchema(spec, payload.properties.reason);

        if (request.properties.type.enum?.[0] !== type || !request.example) throw new Error(`Missing ${type} request example or discriminator`);

        return [type, {
            condition: schemaFields(spec, request.properties.condition),
            trigger: schemaFields(spec, request.properties.trigger),
            firedDetails: schemaFields(spec, reason.properties.details),
            example: request.example,
            firedExample: payload.example,
            requestSchema: jsonSchema(spec, request),
        }];
    }));
}
