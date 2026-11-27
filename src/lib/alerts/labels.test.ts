import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
    ALERT_EVENT_TYPE_LABELS,
    ALERT_EVENT_TYPES,
    ALERT_STATUS_INFO,
    ALERT_STATUSES,
    ALERT_TYPE_GROUPS,
    ALERT_TYPE_INFO,
    ALERT_TYPES,
    alertEventTypeLabel,
    alertTypeLabel,
    batchResultText,
    canPause,
    canResume,
    disabledReasonText,
} from "./labels";

type Schema = {
    $ref?: string;
    discriminator?: { mapping: Record<string, string>; propertyName: string };
    enum?: ReadonlyArray<string>;
    oneOf?: ReadonlyArray<Schema>;
    properties?: Record<string, Schema>;
    required?: ReadonlyArray<string>;
};

const schemas = (JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "openapi.json"), "utf8")) as {
    components: { schemas: Record<string, Schema> };
}).components.schemas;

function variants(name: string, property: string) {
    const union = schemas[name];

    const discriminator = union.discriminator;

    expect(discriminator?.propertyName, name).toBe(property);

    if (!discriminator) throw new Error(`${name} has no discriminator mapping`);

    expect(union.oneOf?.map(branch => branch.$ref).sort(), name).toEqual(Object.values(discriminator.mapping).sort());

    return Object.entries(discriminator.mapping).map(([value, ref]) => {
        const branch = schemas[ref.split("/").at(-1)!];

        expect(branch.required, ref).toContain(property);

        expect(branch.properties?.[property].enum, ref).toEqual([value]);

        return { schema: branch, value };
    });
}

const alertVariants = variants("Alert", "type");

const eventVariants = variants("AlertEvent", "type");

describe("alert labels against discriminated contract variants", () => {
    it("groups every alert variant exactly once with a label and a summary", () => {
        const types = alertVariants.map(branch => branch.value).sort();

        expect([...ALERT_TYPES].sort()).toEqual(types);

        expect(new Set(ALERT_TYPES).size).toBe(ALERT_TYPES.length);

        expect(Object.keys(ALERT_TYPE_INFO).sort()).toEqual(types);

        for (const group of ALERT_TYPE_GROUPS) {
            expect(group.label.trim().length).toBeGreaterThan(0);

            expect(group.types.length).toBeGreaterThan(0);
        }

        for (const info of Object.values(ALERT_TYPE_INFO)) {
            expect(info.label.trim().length).toBeGreaterThan(0);

            expect(info.summary.trim().length).toBeGreaterThan(0);
        }

        expect(variants("AlertFiredData", "alert_type").map(branch => branch.value).sort()).toEqual(types);
    });

    it.each(alertVariants)("$value shares the labelled status vocabulary", ({ schema }) => {
        expect([...(schema.properties?.status.enum ?? [])].sort()).toEqual([...ALERT_STATUSES].sort());

        expect(schema.required).toContain("status");

        expect(Object.keys(ALERT_STATUS_INFO).sort()).toEqual([...ALERT_STATUSES].sort());
    });

    it("labels every stored event discriminator without adding the delivery-only batch", () => {
        const types = eventVariants.map(branch => branch.value).sort();

        expect([...ALERT_EVENT_TYPES].sort()).toEqual(types);

        expect(Object.keys(ALERT_EVENT_TYPE_LABELS).sort()).toEqual(types);

        expect(types).not.toContain("alert.fired.batch");

        for (const label of Object.values(ALERT_EVENT_TYPE_LABELS)) expect(label.trim().length).toBeGreaterThan(0);
    });

    it("preserves raw labels for future or unrecognized values", () => {
        expect(alertTypeLabel("future_alert")).toBe("future_alert");

        expect(alertEventTypeLabel("future.event")).toBe("future.event");
    });

    it("offers pause and resume for the supported statuses", () => {
        expect(ALERT_STATUSES.filter(canPause)).toEqual(["active", "scheduled"]);

        expect(ALERT_STATUSES.filter(canResume)).toEqual(["paused", "triggered"]);
    });

    it("describes disabled reasons and individual batch outcomes", () => {
        expect(disabledReasonText("script_error")).toBe("Its script aborted on 3 bars in a row.");

        expect(disabledReasonText("some_new_reason")).toBe("some new reason");

        expect(disabledReasonText(null)).toBeNull();

        expect(batchResultText({ alert: null, error: null, index: 0, ok: true, op: "pause", result: "paused" })).toBe("Paused");

        expect(batchResultText({ alert: null, error: { code: "not_found", detail: "No alert.", param: null, remedy: "r" }, index: 1, ok: false, op: "pause", result: null })).toBe("Refused: not_found — No alert.");
    });
});
