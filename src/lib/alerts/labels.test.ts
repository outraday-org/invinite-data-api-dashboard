import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ALERT_EVENT_TYPE_LABELS, ALERT_EVENT_TYPES, ALERT_STATUS_INFO, ALERT_STATUSES, ALERT_TYPE_GROUPS, ALERT_TYPE_INFO, ALERT_TYPES, batchResultText, canPause, canResume, disabledReasonText } from "./labels";

type Schema = { enum?: Array<string>; items?: Schema; properties?: Record<string, Schema> };

const schemas = (JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "openapi.json"), "utf8")) as { components: { schemas: Record<string, Schema> } }).components.schemas;

describe("alert labels against openapi.json", () => {
    it("the 7 groups hold every Alert.type exactly once, each with a label and a line", () => {
        const types = schemas.Alert.properties!.type.enum!;

        expect(ALERT_TYPE_GROUPS).toHaveLength(7);

        expect([...ALERT_TYPES].sort()).toEqual([...types].sort());

        expect(new Set(ALERT_TYPES).size).toBe(ALERT_TYPES.length);

        expect(Object.keys(ALERT_TYPE_INFO).sort()).toEqual([...types].sort());
    });

    it("statuses and event types are the contract's", () => {
        expect([...ALERT_STATUSES].sort()).toEqual([...schemas.Alert.properties!.status.enum!].sort());

        expect(Object.keys(ALERT_STATUS_INFO).sort()).toEqual([...ALERT_STATUSES].sort());

        expect([...ALERT_EVENT_TYPES].sort()).toEqual([...schemas.AlertEvent.properties!.type.enum!].sort());

        expect(Object.keys(ALERT_EVENT_TYPE_LABELS).sort()).toEqual([...ALERT_EVENT_TYPES].sort());
    });

    it("pause / resume follow the operations' descriptions", () => {
        expect(ALERT_STATUSES.filter(canPause)).toEqual(["active", "scheduled"]);

        expect(ALERT_STATUSES.filter(canResume)).toEqual(["paused", "triggered"]);
    });

    it("disabled reasons and batch results in words", () => {
        expect(disabledReasonText("script_error")).toBe("Its script aborted on 3 bars in a row.");

        expect(disabledReasonText("some_new_reason")).toBe("some new reason");

        expect(disabledReasonText(null)).toBeNull();

        expect(batchResultText({ alert: null, error: null, index: 0, ok: true, op: "pause", result: "paused" })).toBe("Paused");

        expect(batchResultText({ alert: null, error: { code: "not_found", detail: "No alert.", param: null, remedy: "r" }, index: 1, ok: false, op: "pause", result: null })).toBe("Refused: not_found — No alert.");
    });
});
