import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
    ALERT_USER_BATCH_MAX,
    ALERT_USER_LIMIT_MAX,
    ALERT_USER_STATUSES,
    alertUserConfirmWords,
    batchPreviewText,
    csvRows,
    deleteResultText,
    DISPLAY_NAME_MAX,
    emptyAlertUserForm,
    EXTERNAL_USER_ID_MAX,
    fromAlertUser,
    fromDefaults,
    isPathSafeUserId,
    limitOriginText,
    limitRows,
    limitSource,
    parseAlertUserBatch,
    toAlertUserBody,
    toDefaultsBody,
    usageShare,
    usageText,
} from "./alert-users";
import { DEFAULTS_FIXTURE, DELETE_DONE, DELETE_RUNNING, ODD_USER_ID, USER_PAUSED, USER_SMOKE } from "./alerts-fixtures";

type Schema = { enum?: Array<string>; maxItems?: number; maximum?: number; maxLength?: number; minimum?: number; properties?: Record<string, Schema> };

const spec = JSON.parse(readFileSync("openapi.json", "utf8")) as { components: { schemas: Record<string, Schema> } };

const schemas = spec.components.schemas;

describe("the bounds are the spec's", () => {
    it("AlertUserBatchItem: id / name ≤ 200, limits 0–100 000 000; statuses", () => {
        const item = schemas.AlertUserBatchItem.properties!;

        expect(item.external_user_id.maxLength).toBe(EXTERNAL_USER_ID_MAX);

        expect(item.display_name.maxLength).toBe(DISPLAY_NAME_MAX);

        for (const field of ["max_active_alerts", "max_script_alerts", "max_fires_per_day"]) {
            expect(item[field]).toMatchObject({ maximum: ALERT_USER_LIMIT_MAX, minimum: 0 });
        }

        expect(schemas.AlertUser.properties!.status.enum).toEqual([...ALERT_USER_STATUSES]);
    });

    it("at most 500 items a batch", () => {
        const paths = JSON.parse(readFileSync("openapi.json", "utf8")) as { paths: Record<string, { post: { requestBody: { content: { "application/json": { schema: Schema } } } } }> };

        expect(paths.paths["/v1/alert-users:batch"].post.requestBody.content["application/json"].schema.properties!.items.maxItems).toBe(ALERT_USER_BATCH_MAX);
    });
});

describe("limits in words", () => {
    it("own value, the account default, or none", () => {
        expect(limitSource(3, 3)).toBe("own");

        expect(limitSource(null, 10)).toBe("default");

        expect(limitSource(null, null)).toBe("none");

        expect(limitRows(USER_PAUSED).map(row => [row.field, row.used, row.effective, row.source])).toEqual([
            ["max_active_alerts", 4, 10, "default"],
            ["max_script_alerts", 1, 1, "default"],
            ["max_fires_per_day", 12, 500, "default"],
        ]);
    });

    it("usage against a limit; a limit of 0 is full; none = no bar", () => {
        expect(usageText(3, 10)).toBe("3 of 10");

        expect(usageText(3, null)).toBe("3 (no limit)");

        expect(usageShare(5, 10)).toBe(0.5);

        expect(usageShare(12, 10)).toBe(1);

        expect(usageShare(0, 0)).toBe(1);

        expect(usageShare(3, null)).toBeNull();
    });

    it("the confirm words name the counted alerts; a delete's answer in words", () => {
        expect(alertUserConfirmWords("pause", USER_PAUSED).effect).toContain("Pauses deliveries of the end user's 4 alerts");

        expect(alertUserConfirmWords("delete", USER_SMOKE)).toMatchObject({ destructive: true, title: "Delete this end user?" });

        expect(deleteResultText(DELETE_DONE)).toBe("Deleted: 3 alerts, 4 events and 9 deliveries removed; nothing of the end user is left.");

        expect(deleteResultText(DELETE_RUNNING)).toContain("the rest is removed in the background");

        expect(deleteResultText({ alerts_deleted: 1, deliveries_deleted: 1, events_deleted: 0, status: "deleted" })).toBe("Deleted: 1 alert, 0 events and 1 delivery removed; nothing of the end user is left.");

        expect(limitRows(USER_SMOKE).map(limitOriginText)).toEqual(["Its own limit (3).", "Not set, and the account default sets none: no limit.", "Not set, and the account default sets none: no limit."]);
    });
});

describe("the edit form", () => {
    it("round-trips an end user; empty limits = null (the account default); the id is kept as typed", () => {
        const state = fromAlertUser({ ...USER_PAUSED, external_user_id: ODD_USER_ID });

        const { body, errors, id } = toAlertUserBody(state);

        expect(errors).toEqual({});

        expect(id).toBe(ODD_USER_ID);

        expect(body).toEqual({ display_name: "Jane (premium)", max_active_alerts: null, max_fires_per_day: null, max_script_alerts: null, metadata: { tier: "premium" } });
    });

    it("adding sends only the filled fields (an existing id keeps the rest); an empty add form asks for one", () => {
        const add = { displayName: "", externalUserId: "u1", limits: { max_active_alerts: "", max_fires_per_day: "50", max_script_alerts: "" }, metadata: "" };

        expect(toAlertUserBody(add, { create: true })).toEqual({ body: { max_fires_per_day: 50 }, errors: {}, id: "u1" });

        expect(toAlertUserBody({ ...add, limits: { ...add.limits, max_fires_per_day: "" } }, { create: true }).errors.form).toContain("at least one field");

        // Editing keeps sending every field it shows.
        expect(toAlertUserBody(add).body).toEqual({ display_name: null, max_active_alerts: null, max_fires_per_day: 50, max_script_alerts: null, metadata: {} });
    });

    it("the ids . and .. cannot be addressed by path", () => {
        expect(toAlertUserBody({ ...emptyAlertUserForm(".."), displayName: "x" }).errors.external_user_id).toContain("cannot be put into a URL path");

        expect(isPathSafeUserId("...")).toBe(true);

        expect(parseAlertUserBatch(JSON.stringify([{ external_user_id: ".." }])).problems).toEqual([]);
    });

    it("refuses a bad limit, bad JSON, an empty id", () => {
        const state = { displayName: "", externalUserId: "", limits: { max_active_alerts: "-1", max_fires_per_day: "1.5", max_script_alerts: "100000001" }, metadata: "{" };

        const { errors } = toAlertUserBody(state);

        expect(Object.keys(errors).sort()).toEqual(["external_user_id", "max_active_alerts", "max_fires_per_day", "max_script_alerts", "metadata"]);
    });

    it("the defaults body has only the changed fields (null clears one); nothing changed = no body", () => {
        expect(toDefaultsBody(fromDefaults(DEFAULTS_FIXTURE), DEFAULTS_FIXTURE)).toEqual({ body: null, errors: {} });

        expect(toDefaultsBody({ max_active_alerts: "", max_fires_per_day: "100", max_script_alerts: "" }, DEFAULTS_FIXTURE).body).toEqual({ max_active_alerts: null, max_fires_per_day: 100 });
    });
});

describe("bulk upsert: paste → checked items", () => {
    it("JSON list or { items }", () => {
        const items = [{ external_user_id: "a", max_active_alerts: 5 }, { display_name: null, external_user_id: ODD_USER_ID }];

        expect(parseAlertUserBatch(JSON.stringify(items))).toEqual({ format: "json", items, problems: [] });

        expect(parseAlertUserBatch(JSON.stringify({ items })).items).toEqual(items);
    });

    it("CSV with a header: empty = not set, null = null, quoted cells, metadata JSON; the id kept as written", () => {
        const text = "external_user_id,display_name,max_active_alerts,max_script_alerts,metadata\nuser_1,\"Doe, Jane\",50,,\n\"team/a:b c\",,null,0,\"{\"\"tier\"\":\"\"x\"\"}\"\n";

        expect(parseAlertUserBatch(text)).toEqual({
            format: "csv",
            items: [
                { display_name: "Doe, Jane", external_user_id: "user_1", max_active_alerts: 50 },
                { external_user_id: ODD_USER_ID, max_active_alerts: null, max_script_alerts: 0, metadata: { tier: "x" } },
            ],
            problems: [],
        });
    });

    it("every problem before anything is sent: bounds, unknown fields, a repeated id, a bad header", () => {
        const parsed = parseAlertUserBatch(JSON.stringify([
            { external_user_id: "a".repeat(201) },
            { external_user_id: "b", max_active_alerts: 100_000_001 },
            { external_user_id: "c", plan: "pro" },
            { external_user_id: "d" },
            { display_name: "x".repeat(201), external_user_id: "d" },
            { external_user_id: "e", metadata: Object.fromEntries(Array.from({ length: 51 }, (_, at) => [`k${at}`, at])) },
        ]));

        expect(parsed.problems.map(problem => problem.item)).toEqual([1, 2, 3, 5, 6]);

        expect(parsed.problems.find(problem => problem.item === 3)?.message).toBe("Unknown field plan.");

        expect(batchPreviewText(parsed)).toContain("problems to fix before anything is sent");

        expect(parseAlertUserBatch("id,name\nx,y").problems[0]).toMatchObject({ item: 0 });

        expect(parseAlertUserBatch("not json [").problems[0]).toMatchObject({ item: 0 });
    });

    it("a repeated id is named with its first item", () => {
        expect(parseAlertUserBatch("external_user_id\nd\nd").problems).toEqual([{ item: 2, message: "The id d is given twice (item 1)." }]);
    });

    it("above 500 items the preview says how many requests", () => {
        const many = parseAlertUserBatch(JSON.stringify(Array.from({ length: 1201 }, (_, at) => ({ external_user_id: `u${at}` }))));

        expect(many.problems).toEqual([]);

        expect(batchPreviewText(many)).toBe("1,201 end users to create or update in 3 requests of at most 500.");
    });

    it("csvRows: quotes, escaped quotes, CRLF, line breaks inside quotes, blank lines dropped", () => {
        expect(csvRows("a,b\r\n\"x\"\"y\",\"1\n2\"\r\n\r\n")).toEqual({ rows: [["a", "b"], ["x\"y", "1\n2"]], unclosed: false });

        expect(csvRows("a\n\"open,1\nb,2").unclosed).toBe(true);

        expect(parseAlertUserBatch("external_user_id,display_name\nu1,\"Jane\nu2,x").problems).toEqual([{ item: 0, message: "A double quote is never closed: every quoted cell needs its closing \"." }]);
    });
});
