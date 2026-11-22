import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";

import {
    alertsUsingText,
    BODY_TEMPLATE_MAX_BYTES,
    deliveriesWithStatus,
    DELIVERY_ERROR_INFO,
    DELIVERY_STATUSES,
    deliveryErrorInfo,
    DESCRIPTION_MAX,
    DESTINATION_KINDS,
    DESTINATION_PRESETS,
    destinationDisabledText,
    destinationErrorsOf,
    destinationFormOf,
    DIGEST_MAX,
    DIGEST_MIN,
    emptyDestinationForm,
    HEADER_VALUE_MAX,
    RATE_MAX,
    RATE_MIN,
    readHeaders,
    takeSecret,
    TEST_WATCH_MS,
    testTracking,
    toCreateDestinationBody,
    toUpdateDestinationBody,
    URL_MAX,
    urlProblem,
} from "./destinations";
import { DELIVERY_DEAD, DELIVERY_FAILED, DELIVERY_OK, DESTINATION_ACTIVE, DESTINATION_CREATED, DESTINATION_SECRET, FIXTURE_SECRET, fixtureDelivery } from "./destinations-fixtures";

type Schema = { enum?: Array<string>; maximum?: number; maxLength?: number; minimum?: number; properties?: Record<string, Schema>; additionalProperties?: Schema };

const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../openapi.json"), "utf8")) as {
    components: { schemas: Record<string, Schema> };
    paths: Record<string, Record<string, { requestBody: { content: { "application/json": { schema: Schema } } } }>>;
};

const createSchema = spec.paths["/v1/destinations"].post.requestBody.content["application/json"].schema.properties!;

const updateSchema = spec.paths["/v1/destinations/{id}"].patch.requestBody.content["application/json"].schema.properties!;

const form = (patch: Partial<ReturnType<typeof emptyDestinationForm>> = {}) => ({ ...emptyDestinationForm(), url: "https://hooks.example.com/a", ...patch });

describe("the model's bounds and enums are the spec's (7.1)", () => {
    it("create / update bounds", () => {
        for (const schema of [createSchema, updateSchema]) {
            expect(schema.url.maxLength).toBe(URL_MAX);

            expect(schema.description.maxLength).toBe(DESCRIPTION_MAX);

            expect(schema.headers.additionalProperties!.maxLength).toBe(HEADER_VALUE_MAX);

            expect([schema.max_events_per_minute.minimum, schema.max_events_per_minute.maximum]).toEqual([RATE_MIN, RATE_MAX]);

            expect([schema.digest_seconds.minimum, schema.digest_seconds.maximum]).toEqual([DIGEST_MIN, DIGEST_MAX]);

            expect(schema.kind.enum).toEqual([...DESTINATION_KINDS]);

            expect(schema.preset.enum).toEqual([...DESTINATION_PRESETS]);
        }

        expect(BODY_TEMPLATE_MAX_BYTES).toBe(16 * 1024);

        expect(spec.components.schemas.DestinationDelivery.properties!.status.enum).toEqual([...DELIVERY_STATUSES]);
    });

    it("every last_error code of the spec has a label and a sentence (D13, F107)", () => {
        const codes = spec.components.schemas.DestinationDelivery.properties!.last_error.enum;

        expect(codes, "openapi.json types last_error as an enum (Data API task 5 release)").toBeDefined();

        expect(Object.keys(DELIVERY_ERROR_INFO).sort()).toEqual([...codes!].sort());

        for (const info of Object.values(DELIVERY_ERROR_INFO)) {
            expect(info.label).not.toBe("");

            expect(info.meaning).toMatch(/\.$/);
        }

        expect(deliveryErrorInfo(null)).toBeNull();

        expect(deliveryErrorInfo("timeout")?.label).toBe("Timed out");

        expect(deliveryErrorInfo("brand_new_code")).toEqual({ label: "brand_new_code", meaning: "brand_new_code" });
    });
});

describe("the form → create body", () => {
    it("https and port 443 only; the API refuses private addresses itself", () => {
        expect(urlProblem("")).toMatch(/Enter/);

        expect(urlProblem("http://hooks.example.com")).toMatch(/https/);

        expect(urlProblem("https://hooks.example.com:8443/x")).toMatch(/Port 8443/);

        expect(urlProblem("not a url")).toMatch(/Not a URL/);

        expect(urlProblem(`https://a.example.com/${"x".repeat(URL_MAX)}`)).toMatch(/2048/);

        expect(urlProblem("https://hooks.example.com:443/x")).toBeNull();

        expect(urlProblem("https://10.0.0.1/hook")).toBeNull();
    });

    it("leaves empty optional fields out (the API's defaults apply) and sends what was set", () => {
        expect(toCreateDestinationBody(form())).toEqual({ body: { kind: "webhook", preset: "standard", url: "https://hooks.example.com/a" }, errors: {} });

        const { body, errors } = toCreateDestinationBody(form({
            bodyTemplate: "{\"t\": \"{{type}}\"}",
            description: " Prod ",
            digestSeconds: "60",
            headerRows: [{ name: "X-Token", value: "v1" }, { name: "", value: "" }],
            kind: "batch_webhook",
            maxEventsPerMinute: "1200",
        }));

        expect(errors).toEqual({});

        expect(body).toEqual({
            body_template: "{\"t\": \"{{type}}\"}",
            description: "Prod",
            digest_seconds: 60,
            headers: { "X-Token": "v1" },
            kind: "batch_webhook",
            max_events_per_minute: 1200,
            preset: "standard",
            url: "https://hooks.example.com/a",
        });
    });

    it("checks the bounds: rate, digest (not with claude_routine), template size, headers", () => {
        expect(toCreateDestinationBody(form({ maxEventsPerMinute: "0" })).errors.max_events_per_minute).toBe("From 1 to 100,000.");

        expect(toCreateDestinationBody(form({ maxEventsPerMinute: "1.5" })).errors.max_events_per_minute).toBe("A whole number.");

        expect(toCreateDestinationBody(form({ digestSeconds: "3601" })).errors.digest_seconds).toBe("From 1 to 3,600.");

        expect(toCreateDestinationBody(form({ digestSeconds: "30", preset: "claude_routine" })).errors.digest_seconds).toMatch(/Claude routine/);

        expect(toCreateDestinationBody(form({ bodyTemplate: "é".repeat(BODY_TEMPLATE_MAX_BYTES / 2 + 1) })).errors.body_template).toBe("At most 16 KB.");

        expect(readHeaders(Array.from({ length: 21 }, (_, index) => ({ name: `X-${index}`, value: "v" }))).problem).toBe("At most 20 headers.");

        expect(readHeaders([{ name: "X-A", value: "1" }, { name: "x-a", value: "2" }]).problem).toMatch(/twice/);

        expect(readHeaders([{ name: "", value: "secret" }]).problem).toMatch(/name/);

        expect(readHeaders([{ name: "Bad Name", value: "v" }]).problem).toMatch(/not a valid header name/);

        expect(readHeaders([{ name: "X-A", value: "v".repeat(HEADER_VALUE_MAX + 1) }]).problem).toMatch(/longer than 1024/);
    });

    it("a problem never echoes a header value", () => {
        const { errors } = toCreateDestinationBody(form({ headerRows: [{ name: "X-A", value: "tok_1" }, { name: "X-A", value: "tok_2" }] }));

        expect(JSON.stringify(errors)).not.toMatch(/tok_/);
    });
});

describe("the form → update body (PATCH: only what changed)", () => {
    it("a stored destination's form keeps the headers (values are write-only) and sends nothing unchanged", () => {
        const state = destinationFormOf(DESTINATION_ACTIVE);

        expect(state.headersMode).toBe("keep");

        expect(state.headerRows).toEqual([]);

        expect(toUpdateDestinationBody(state, DESTINATION_ACTIVE)).toEqual({ body: {}, errors: { form: "Nothing changed." } });
    });

    it("sends changed fields; an emptied description / template / digest is null; headers keep / replace / remove", () => {
        const state = { ...destinationFormOf({ ...DESTINATION_ACTIVE, body_template: "x", digest_seconds: 30 }), bodyTemplate: "", description: "", digestSeconds: "", maxEventsPerMinute: "900" };

        const stored = { ...DESTINATION_ACTIVE, body_template: "x", digest_seconds: 30 };

        expect(toUpdateDestinationBody(state, stored).body).toEqual({ body_template: null, description: null, digest_seconds: null, max_events_per_minute: 900 });

        expect(toUpdateDestinationBody({ ...destinationFormOf(DESTINATION_ACTIVE), headerRows: [{ name: "X-New", value: "v" }], headersMode: "replace" }, DESTINATION_ACTIVE).body).toEqual({ headers: { "X-New": "v" } });

        expect(toUpdateDestinationBody({ ...destinationFormOf(DESTINATION_ACTIVE), headersMode: "remove" }, DESTINATION_ACTIVE).body).toEqual({ headers: null });

        expect(toUpdateDestinationBody({ ...destinationFormOf(DESTINATION_ACTIVE), maxEventsPerMinute: "" }, DESTINATION_ACTIVE).errors.max_events_per_minute).toBe("From 1 to 100,000.");
    });
});

describe("the secret rule", () => {
    it("takeSecret reads the one-time secret and deletes it from the answer object in place", () => {
        const created = structuredClone(DESTINATION_CREATED);

        expect(takeSecret(created)).toBe(FIXTURE_SECRET);

        expect("secret" in created).toBe(false);

        expect(created.id).toBe(DESTINATION_ACTIVE.id);

        const rotated = structuredClone(DESTINATION_SECRET);

        expect(takeSecret(rotated)).toBe(DESTINATION_SECRET.secret);

        expect(JSON.stringify(rotated)).toBe(JSON.stringify({ previous_secret_expires_at: DESTINATION_SECRET.previous_secret_expires_at }));

        expect(takeSecret({})).toBeNull();
    });
});

describe("test delivery tracking", () => {
    it("waiting while pending / in flight or not listed, done once succeeded / failed / dead, timed out after 30 s", () => {
        expect(testTracking("dlv_x", [DELIVERY_OK], 0)).toEqual({ delivery: null, state: "waiting" });

        const pending = fixtureDelivery("x", { status: "pending" });

        expect(testTracking("dlv_x", [pending], 5_000)).toEqual({ delivery: pending, state: "waiting" });

        expect(testTracking("dlv_x", [pending], TEST_WATCH_MS)).toEqual({ delivery: pending, state: "timed_out" });

        expect(testTracking("dlv_ok", [DELIVERY_OK], 0)).toEqual({ delivery: DELIVERY_OK, state: "done" });

        expect(testTracking("dlv_failed", [DELIVERY_FAILED], TEST_WATCH_MS).state).toBe("done");

        expect(testTracking("dlv_dead", [DELIVERY_DEAD], 0).state).toBe("done");
    });
});

describe("words", () => {
    it("the disabled reasons, the status filter over loaded rows, the alerts-using count", () => {
        expect(destinationDisabledText("gone")).toMatch(/410/);

        expect(destinationDisabledText("failing")).toMatch(/72 hours/);

        expect(destinationDisabledText("manual")).toMatch(/by you/);

        expect(destinationDisabledText("other")).toBe("Disabled: other.");

        expect(destinationDisabledText(null)).toBeNull();

        expect(deliveriesWithStatus([DELIVERY_OK, DELIVERY_FAILED, DELIVERY_DEAD], "failed")).toEqual([DELIVERY_FAILED]);

        expect(deliveriesWithStatus([DELIVERY_OK], null)).toEqual([DELIVERY_OK]);

        expect(alertsUsingText(3, false)).toBe("3");

        expect(alertsUsingText(100, true)).toBe("100+");
    });

    it("a 400 maps onto the field it names, else the form", () => {
        const url = new ApiRequestError(400, { error: "invalid_parameter", message: "private address", param: "url" });

        expect(destinationErrorsOf(url)).toEqual({ url: "private address" });

        const many = new ApiRequestError(400, {
            error: "invalid_parameter",
            errors: [{ code: "invalid", detail: "too long", param: "headers.X-A" }, { code: "invalid", detail: "odd", param: null }],
            message: "2 problems",
        });

        expect(destinationErrorsOf(many)).toEqual({ form: "odd", headers: "too long" });
    });
});
