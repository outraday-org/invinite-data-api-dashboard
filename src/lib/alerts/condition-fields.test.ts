import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { AlertType } from "@/lib/api/types";

import { ALERT_TYPE_FIELDS } from "@/lib/api/operations.gen";

import type { AlertField } from "../../../scripts/alert-fields.mjs";
import type { FieldKind, FieldSpec } from "./condition-fields";

import { alertTypeFields } from "../../../scripts/alert-fields.mjs";
import { isCatalogMetricId } from "../reference/catalog";
import {
    ACTIVE_WINDOW_DAYS,
    ACTIVE_WINDOW_UNITS,
    CONDITION_FIELDS,
    conditionFieldsFor,
    FIELD_SPECS,

    fieldLabel,

    presentField,
    triggerFieldsFor,
    TYPE_FIELDS,
} from "./condition-fields";

type Schema = {
    $ref?: string;
    allOf?: ReadonlyArray<Schema>;
    example?: unknown;
    description?: string;
    discriminator?: { mapping: Record<string, string>; propertyName: string };
    enum?: ReadonlyArray<string>;
    items?: Schema;
    maximum?: number;
    maxItems?: number;
    minimum?: number;
    properties?: Record<string, Schema>;
    required?: ReadonlyArray<string>;
};

const spec = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "openapi.json"), "utf8")) as {
    components: { schemas: Record<string, Schema> };
};

const schemas = spec.components.schemas;

function resolve(raw: Schema | undefined): Schema {
    if (!raw) throw new Error("Missing alert component or field");

    return raw.$ref ? resolve(schemas[raw.$ref.split("/").at(-1)!]) : raw;
}

const create = resolve(schemas.AlertCreateRequest);

const mapping = create.discriminator?.mapping;

if (!mapping) throw new Error("Create alert discriminator mapping is missing");

const types = Object.keys(ALERT_TYPE_FIELDS) as Array<AlertType>;

const presentation: Partial<Record<string, Partial<FieldSpec>>> = FIELD_SPECS;

const presentationKeys = ["help", "kind", "label", "placeholder", "splitOnCommasOnly"];

function verifyMetadata(fields: ReadonlyArray<AlertField>, raw: Schema | undefined) {
    const schema = resolve(raw);

    expect(fields.map(field => field.name)).toEqual(Object.keys(schema.properties ?? {}));

    for (const field of fields) {
        const rawField = schema.properties?.[field.name];

        const declared = resolve(rawField);

        const item = declared.items ? resolve(declared.items) : undefined;

        const bounds = item ?? declared;

        expect(field.required, field.name).toBe((schema.required ?? []).includes(field.name));

        expect(field.description, field.name).toBe(declared.description ?? "");

        expect(field.enum, field.name).toEqual(declared.enum ?? item?.enum);

        expect(field.min, field.name).toBe(bounds.minimum);

        expect(field.max, field.name).toBe(bounds.maximum);

        expect(field.maxItems, field.name).toBe(declared.maxItems);

        const ref = rawField?.$ref ?? (rawField?.allOf?.length === 1 ? rawField.allOf[0].$ref : undefined);

        expect(field.ref, field.name).toBe(ref);
    }
}

function verifyPresentation(field: FieldSpec, metadata: AlertField) {
    const kindOverrides: Partial<Record<AlertField["kind"], ReadonlyArray<FieldKind>>> = {
        "int-list": ["weekday-list"],
        "integer": ["time-of-day", "weekday"],
        "json": ["template"],
        "string": ["datetime"],
    };

    expect(field.label.trim().length, metadata.name).toBeGreaterThan(0);

    expect(typeof field.help, metadata.name).toBe("string");

    expect([metadata.kind, ...(kindOverrides[metadata.kind] ?? [])], metadata.name).toContain(field.kind);

    expect(field.required, metadata.name).toBe(metadata.required);

    expect(field.options, metadata.name).toEqual(metadata.enum);

    expect(field.min, metadata.name).toBe(metadata.min);

    expect(field.max, metadata.name).toBe(metadata.max);

    expect(field.maxItems, metadata.name).toBe(metadata.maxItems);
}

describe("per-type alert editor fields", () => {
    it("regenerates exactly from the pinned contract, without interpreting descriptions", () => {
        expect(alertTypeFields(spec)).toEqual(ALERT_TYPE_FIELDS);

        expect(create.discriminator?.propertyName).toBe("type");

        expect(types).toHaveLength(23);

        expect([...types].sort()).toEqual(Object.keys(mapping).sort());

        expect(Object.keys(CONDITION_FIELDS).sort()).toEqual([...types].sort());

        expect(Object.keys(TYPE_FIELDS).sort()).toEqual([...types].sort());
    });

    it.each(types)("%s uses its own condition, trigger and fired-detail schemas", (type) => {
        const request = resolve({ $ref: mapping[type] });

        const generated = ALERT_TYPE_FIELDS[type];

        const condition: ReadonlyArray<AlertField> = generated.condition;

        const trigger: ReadonlyArray<AlertField> = generated.trigger;

        const firedMapping = schemas.AlertFiredData.discriminator?.mapping;

        const payload = resolve({ $ref: firedMapping?.[type] });

        const reason = resolve(payload.properties?.reason);

        expect(request.properties?.type.enum).toEqual([type]);

        verifyMetadata(condition, request.properties?.condition);

        verifyMetadata(trigger, request.properties?.trigger);

        verifyMetadata(generated.firedDetails, reason.properties?.details);

        expect(generated.example).toEqual(request.example);

        expect(generated.firedExample).toEqual(payload.example);

        const presented = conditionFieldsFor(type);

        expect(presented.map(field => field.name)).toEqual(condition.map(field => field.name));

        expect(CONDITION_FIELDS[type]).toEqual(presented);

        expect(TYPE_FIELDS[type]).toEqual(condition.map(field => field.name));

        for (const [index, field] of presented.entries()) verifyPresentation(field, condition[index]);

        const scalarTriggers = trigger.filter(field => field.name !== "active_window");

        const triggerEditors = triggerFieldsFor(type);

        expect(triggerEditors.map(field => field.name)).toEqual(scalarTriggers.map(field => field.name));

        for (const [index, field] of triggerEditors.entries()) verifyPresentation(field, scalarTriggers[index]);
    });

    it("keeps presentation entries applicable and free of schema constraints", () => {
        const names = new Set<string>(types.flatMap(type => ALERT_TYPE_FIELDS[type].condition.map(field => field.name)));

        for (const [name, entry] of Object.entries(FIELD_SPECS)) {
            expect(names.has(name), name).toBe(true);

            expect(Object.keys(entry).filter(key => !presentationKeys.includes(key)), name).toEqual([]);
        }

        for (const type of types) {
            for (const metadata of ALERT_TYPE_FIELDS[type].condition) {
                const field = presentField(metadata, presentation[metadata.name]);

                verifyPresentation(field, metadata);
            }
        }
    });

    it("provides a usable default for an added field without a presentation entry", () => {
        const metadata: AlertField = {
            description: "A newly published optional label.",
            kind: "string",
            name: "future_signal_label",
            required: false,
        };

        const field = presentField(metadata);

        expect(field.label).toBe(fieldLabel(metadata.name));

        expect(field.help).toBe(metadata.description);

        verifyPresentation(field, metadata);
    });

    it("takes active-window choices from the per-type trigger schema", () => {
        for (const type of types) {
            const request = resolve({ $ref: mapping[type] });

            const trigger = resolve(request.properties?.trigger);

            const window = resolve(trigger.properties?.active_window);

            expect(ACTIVE_WINDOW_DAYS).toEqual(resolve(resolve(window.properties?.days).items).enum);

            expect(ACTIVE_WINDOW_UNITS).toEqual(resolve(window.properties?.unit).enum);
        }
    });
});

describe("JSON editor placeholders", () => {
    it("parses every effective JSON placeholder and uses a catalog metric in the rule example", () => {
        for (const type of types) {
            for (const field of conditionFieldsFor(type)) {
                if (field.kind === "json" && field.placeholder) expect(() => JSON.parse(field.placeholder!)).not.toThrow();
            }
        }

        const ruleField = conditionFieldsFor("fundamental_metric").find(field => field.name === "rules");

        const [rule] = JSON.parse(ruleField?.placeholder ?? "[]") as Array<{ metric_id: string }>;

        expect(isCatalogMetricId(rule.metric_id)).toBe(true);
    });
});
