import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CONDITION_FIELDS, FIELD_SPECS, TRIGGER_FIELDS, TYPE_FIELDS } from "./condition-fields";
import { PRICE_ALERT_TYPES } from "./labels";

/**
 * The alert form's field map against the pinned spec: `AlertConditionInput`'s descriptions name the types of each field
 * ("… filing, filing_keyword"). This test reads them the way the map was built and fails when (a) an `Alert.type` has no
 * entry, (b) an entry names a field the schema does not have, (c) the schema gives a type a field the map lacks (or the
 * map gives one the schema does not), and when an enum, a bound or a list length differs.
 */

type Schema = {
    $ref?: string;
    description?: string;
    enum?: Array<string>;
    items?: Schema;
    maximum?: number;
    maxItems?: number;
    minimum?: number;
    properties?: Record<string, Schema>;
    type?: string;
};

const spec = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "openapi.json"), "utf8")) as { components: { schemas: Record<string, Schema> } };

const schemas = spec.components.schemas;

const conditionInput = schemas.AlertConditionInput;

const ALERT_TYPES = schemas.Alert.properties!.type.enum!;

const refOf = (schema: Schema) => (schema.$ref ? schemas[schema.$ref.split("/").at(-1)!] : null);

const sentences = (text: string) => text.replace(" (request form)", "").split(/\.\s+/).map(sentence => sentence.replace(/\.$/, ""));

/** The alert types a text names (whole words: `filing` is not `filing_keyword`). */
const typesIn = (text: string) => ALERT_TYPES.filter(type => new RegExp(`(?<![\\w.-])${type}(?![\\w-])`).test(text));

/**
 * The types of each condition field as the schema states them. A field's own description ends with its types; three
 * spellings are resolved: "Same types as `x`", "price types" (the four price types of the schema's description) and
 * "Keyword types" (the `*_keyword` types). A `$ref` field's types are in its schema's first sentence, else in the
 * sentence of `AlertConditionInput`'s description that names it (`template` / `condition` / `filters`).
 */
function schemaFieldTypes(): Record<string, Set<string>> {
    const out: Record<string, Set<string>> = {};

    for (const [field, schema] of Object.entries(conditionInput.properties!)) {
        const ref = refOf(schema);

        if (ref) {
            let types = typesIn(sentences(ref.description ?? "")[0]);

            if (types.length === 0) types = sentences(conditionInput.description!).filter(sentence => sentence.includes(`\`${field}\``)).flatMap(typesIn);

            out[field] = new Set(types);

            continue;
        }

        const last = sentences(schema.description ?? "").at(-1)!;

        const types = new Set(typesIn(last));

        const same = /Same types as `(\w+)`/.exec(last);

        if (same) for (const type of out[same[1]]) types.add(type);

        if (/price types/i.test(last)) for (const type of PRICE_ALERT_TYPES) types.add(type);

        if (/Keyword types/.test(last)) for (const type of ALERT_TYPES.filter(name => name.endsWith("_keyword"))) types.add(type);

        out[field] = types;
    }

    return out;
}

/** The map's fields per type, inverted to types per field. */
function mapFieldTypes(): Record<string, Set<string>> {
    const out: Record<string, Set<string>> = {};

    for (const [type, fields] of Object.entries(TYPE_FIELDS)) {
        for (const field of fields) (out[field] ??= new Set()).add(type);
    }

    return out;
}

describe("CONDITION_FIELDS against openapi.json", () => {
    it("(a) every Alert.type has an entry, and no other type", () => {
        expect(Object.keys(CONDITION_FIELDS).sort()).toEqual([...ALERT_TYPES].sort());
    });

    it("(b) every field the map names is a field of AlertConditionInput", () => {
        const schemaFields = new Set(Object.keys(conditionInput.properties!));

        expect(Object.keys(FIELD_SPECS).filter(field => !schemaFields.has(field))).toEqual([]);

        expect(Object.values(TYPE_FIELDS).flat().filter(field => !schemaFields.has(field))).toEqual([]);
    });

    it("(c) each type takes exactly the fields the schema's descriptions give it", () => {
        const fromSchema = schemaFieldTypes();

        const fromMap = mapFieldTypes();

        for (const field of Object.keys(conditionInput.properties!)) {
            expect({ field, types: [...(fromMap[field] ?? [])].sort() }).toEqual({ field, types: [...fromSchema[field]].sort() });
        }
    });

    it("the parser still finds its anchors (a reworded description fails here, not silently)", () => {
        expect(conditionInput.description).toContain("An `indicator` alert takes a built-in `template`");

        expect(conditionInput.properties!.symbol.description).toContain("Same types as `cik`");

        expect(conditionInput.properties!.match.description).toContain("Keyword types");
    });

    it("every field has a spec; enums, bounds and list lengths are the schema's", () => {
        expect(Object.keys(FIELD_SPECS).sort()).toEqual(Object.keys(conditionInput.properties!).sort());

        for (const [field, schema] of Object.entries(conditionInput.properties!)) {
            const mine = FIELD_SPECS[field as keyof typeof FIELD_SPECS];

            const options = schema.enum ?? schema.items?.enum;

            if (options) {
                expect({ field, options: [...(mine.options ?? [])].sort() }).toEqual({ field, options: [...options].sort() });

                for (const subset of Object.values(mine.optionsByType ?? {})) expect(subset.every(option => options.includes(option))).toBe(true);
            }

            const bounds = schema.type === "array" ? schema.items : schema;

            expect({ field, max: mine.max, min: mine.min }).toEqual({ field, max: bounds?.maximum, min: bounds?.minimum });

            expect({ field, maxItems: mine.maxItems }).toEqual({ field, maxItems: schema.maxItems });
        }
    });

    it("the editor fits the schema type", () => {
        const kindsOf: Partial<Record<string, ReadonlyArray<string>>> = {
            "array:integer": ["int-list", "weekday-list"],
            "array:object": ["json"],
            "array:string": ["string-list"],
            "array:string:enum": ["enum-list"],
            "boolean": ["boolean"],
            "integer": ["integer", "time-of-day", "weekday"],
            "number": ["number"],
            "object": ["json"],
            "ref": ["json", "template"],
            "string": ["string", "datetime"],
            "string:enum": ["enum"],
        };

        for (const [field, schema] of Object.entries(conditionInput.properties!)) {
            let shape: string = schema.$ref ? "ref" : schema.type!;

            if (schema.type === "array") shape = `array:${schema.items?.type ?? "object"}${schema.items?.enum ? ":enum" : ""}`;
            else if (schema.enum) shape = `${schema.type}:enum`;

            expect({ field, ok: kindsOf[shape]?.includes(FIELD_SPECS[field as keyof typeof FIELD_SPECS].kind) }).toEqual({ field, ok: true });
        }
    });
});

describe("TRIGGER_FIELDS against AlertTriggerInput", () => {
    const trigger = schemas.AlertTriggerInput.properties!;

    it("every scalar field of the schema, with its bounds and enums (active_window has its own editor)", () => {
        expect(TRIGGER_FIELDS.map(field => field.name).sort()).toEqual(Object.keys(trigger).filter(name => name !== "active_window").sort());

        for (const field of TRIGGER_FIELDS) {
            const schema = trigger[field.name];

            expect({ max: field.max, min: field.min, name: field.name, options: field.options }).toEqual({
                max: schema.maximum,
                min: schema.minimum,
                name: field.name,
                options: schema.enum,
            });
        }
    });

    it("the type-restricted fields follow their descriptions (script / indicator; price types)", () => {
        expect(trigger.cooldown_bars.description).toContain("script / indicator");

        expect(trigger.rearm.description).toContain("Price types");

        expect(TRIGGER_FIELDS.find(field => field.name === "cooldown_bars")?.types).toEqual(["indicator", "script"]);

        expect(TRIGGER_FIELDS.find(field => field.name === "rearm")?.types).toEqual(PRICE_ALERT_TYPES);
    });
});
