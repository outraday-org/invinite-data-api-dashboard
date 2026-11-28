import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ALERT_TYPE_FIELDS, WEBHOOK_ENVELOPE, WEBHOOKS } from "@/lib/api/operations.gen";

import { simplifySchema, webhookEntries, webhookEnvelope } from "../../../scripts/webhooks.mjs";
import { EXAMPLE_INSTANT, exampleBody, exampleOf, fieldRows, selectedSchema, selectedVariantValue, typeText } from "./webhooks";

const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../openapi.json"), "utf8")) as { "x-webhooks": Record<string, unknown> };

const TYPES = ["alert.fired", "alert.fired.batch", "alert.status_changed", "destination.disabled", "destination.test", "account.fire_cap_reached", "alert_user.fire_cap_reached"];

describe("WEBHOOKS (generated from the pinned spec's x-webhooks at build time)", () => {
    it("is exactly what webhooks.mjs reads from openapi.json today: the 7 payloads, in the spec's order", () => {
        expect(WEBHOOKS).toEqual(webhookEntries(spec));

        expect(WEBHOOK_ENVELOPE).toEqual(webhookEnvelope(spec));

        expect(WEBHOOKS.map(entry => entry.type)).toEqual(TYPES);
    });

    it("every payload shares the same signature headers and acknowledgement (the page states them once)", () => {
        expect(WEBHOOKS[0].headers.map(header => header.name)).toEqual(["webhook-id", "webhook-timestamp", "webhook-signature"]);

        for (const entry of WEBHOOKS) {
            expect(entry.headers).toEqual(WEBHOOKS[0].headers);

            expect(entry.acknowledgement).toEqual(WEBHOOKS[0].acknowledgement);
        }

        expect(WEBHOOKS[0].acknowledgement).toEqual(["2XX: Acknowledged; anything else is retried (410 disables)"]);
    });

    it("a spec without one type yields the entries without it", () => {
        const { "destination.test": _dropped, ...rest } = spec["x-webhooks"];

        expect(webhookEntries({ ...spec, "x-webhooks": rest }).map(entry => entry.type)).toEqual(TYPES.filter(type => type !== "destination.test"));
    });
});

describe("published examples, fallback shapes and field rows", () => {
    it("the envelope with this type, the required data fields in the spec's order, id prefixes from the descriptions", () => {
        const test = WEBHOOKS.find(entry => entry.type === "destination.test")!;

        expect(exampleBody(test)).toEqual({
            data: { destination: { id: "dst_…", url: "…" }, event_id: "evt_…", sent_at: EXAMPLE_INSTANT, test: true },
            timestamp: EXAMPLE_INSTANT,
            type: "destination.test",
        });

        expect(Object.keys(exampleBody(test) as object)).toEqual(["data", "timestamp", "type"]);

        expect(Object.keys((exampleBody(test) as { data: object }).data)).toEqual(["event_id", "destination", "test", "sent_at"]);
    });

    it("arrays hold one example item; types read as words", () => {
        const batch = WEBHOOKS.find(entry => entry.type === "alert.fired.batch")!;

        expect(exampleOf(batch.data)).toEqual({ batch_id: "…", events: [{ data: ALERT_TYPE_FIELDS.filing.firedExample, timestamp: EXAMPLE_INSTANT, type: "alert.fired" }] });

        const paths = fieldRows(batch.data).map(row => row.path);

        expect(paths).toEqual(expect.arrayContaining(["batch_id", "events", "events[].type", "events[].timestamp", "events[].data"]));

        expect(batch.data.fields?.find(field => field.name === "events")?.schema.items?.discriminator?.propertyName).toBe("type");

        expect(batch.data.fields?.find(field => field.name === "events")?.schema.items?.variants).toHaveLength(6);

        const fired = WEBHOOKS.find(entry => entry.type === "alert.fired")!;

        expect(fired.data.discriminator?.propertyName).toBe("alert_type");

        expect(fired.data.variants).toHaveLength(23);

        expect(fired.data.variants?.map(branch => branch.schema.example)).toEqual(expect.arrayContaining(Object.values(ALERT_TYPE_FIELDS).map(type => type.firedExample)));

        expect(typeText({ nullable: true, type: "string" })).toBe("string or null");
    });
});

describe("discriminator variants", () => {
    it("retains mapping values and examples from a toy union", () => {
        const a = { example: { category: "a" }, properties: { category: { enum: ["a"], type: "string" } }, required: ["category"], type: "object" };

        const b = { ...a, example: { category: "b" }, properties: { category: { enum: ["b"], type: "string" } } };

        const toy = { components: { schemas: { A: a, B: b, Union: { discriminator: { mapping: { a: "#/components/schemas/A", b: "#/components/schemas/B" }, propertyName: "category" }, oneOf: [{ $ref: "#/components/schemas/A" }, { $ref: "#/components/schemas/B" }] } } } };

        const schema = simplifySchema(toy, { $ref: "#/components/schemas/Union" });

        expect(schema.variants?.map(variant => variant.value)).toEqual(["a", "b"]);

        expect(schema.variants?.map(variant => variant.schema.example)).toEqual([{ category: "a" }, { category: "b" }]);
    });

    it.each(Object.keys(ALERT_TYPE_FIELDS) as Array<keyof typeof ALERT_TYPE_FIELDS>)("%s: batch keeps the selected fire beneath exactly one event data property", (type) => {
        const batch = WEBHOOKS.find(entry => entry.type === "alert.fired.batch")!;

        expect(exampleBody(batch, type)).toEqual({ data: { batch_id: "…", events: [{ data: ALERT_TYPE_FIELDS[type].firedExample, timestamp: EXAMPLE_INSTANT, type: "alert.fired" }] }, timestamp: EXAMPLE_INSTANT, type: "alert.fired.batch" });

        const fields = fieldRows(selectedSchema(batch.data, type)).map(row => row.path);

        expect(fields).toContain("events[].data.alert_type");

        expect(fields.some(path => path.includes("data.data"))).toBe(false);

        expect(fields.some(path => path.includes("events[].data.events"))).toBe(false);
    });

    it("unknown fire selection falls back to the first published branch", () => {
        const fired = WEBHOOKS.find(entry => entry.type === "alert.fired")!;

        expect(selectedVariantValue(fired.data, "unknown")).toBe("filing");

        expect(exampleBody(fired, "unknown")).toMatchObject({ data: ALERT_TYPE_FIELDS.filing.firedExample });
    });
});
