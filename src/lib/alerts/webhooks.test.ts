import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ALERT_TYPE_FIELDS, WEBHOOK_ENVELOPE, WEBHOOKS } from "@/lib/api/operations.gen";

import { webhookEntries, webhookEnvelope } from "../../../scripts/webhooks.mjs";
import { EXAMPLE_INSTANT, exampleBody, exampleOf, fieldRows, typeText } from "./webhooks";

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

describe("example bodies and field rows (the spec has no example: shapes built from the schema)", () => {
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

        expect(batch.data.fields?.find(field => field.name === "events")?.schema.items?.oneOf).toHaveLength(6);

        const fired = WEBHOOKS.find(entry => entry.type === "alert.fired")!;

        expect(fired.data.discriminator?.propertyName).toBe("alert_type");

        expect(fired.data.oneOf).toHaveLength(18);

        expect(fired.data.oneOf?.map(branch => branch.example)).toEqual(expect.arrayContaining(Object.values(ALERT_TYPE_FIELDS).map(type => type.firedExample)));

        expect(typeText({ nullable: true, type: "string" })).toBe("string or null");
    });
});
