import { describe, expect, it } from "vitest";

import type { Alert } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { ALERT_TYPE_FIELDS } from "@/lib/api/operations.gen";

import { isCreateAlertRequest } from "./alert-contract";
import { emptyAlertForm, fieldErrorsOf, fieldKeyOf, fromAlert, prefilledForm, readField, switchAlertType, toCreateBody, toUpdateBody } from "./alert-form";
import { ALERT_DIVIDEND, ALERT_EARNINGS_CALL, ALERT_FILING, ALERT_FUNDAMENTAL, ALERT_INDICATOR, ALERT_NEWS_KEYWORD, ALERT_PRICE, fixtureAlert, TEMPLATES_FIXTURE } from "./alerts-fixtures";
import { CONDITION_FIELDS } from "./condition-fields";

/** Instants compare as instants (the form keeps minutes in the viewer's zone; `.000Z` vs `Z` is the same time). */
const sameInstants = (value: unknown): unknown => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toISOString();

    if (Array.isArray(value)) return value.map(sameInstants);

    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sameInstants(item)]));

    return value;
};

describe("a stored alert reads back equal through the form (one type per group)", () => {
    it.each([
        ["Filings", ALERT_FILING],
        ["News", ALERT_NEWS_KEYWORD],
        ["Earnings", ALERT_EARNINGS_CALL],
        ["Corporate actions", ALERT_DIVIDEND],
        ["Fundamentals", ALERT_FUNDAMENTAL],
        ["Price", ALERT_PRICE],
        ["Indicators & scripts", ALERT_INDICATOR],
    ] as Array<[string, Alert]>)("%s: fromAlert → toCreateBody gives the stored condition, trigger and delivery", (_group, alert) => {
        const { body, errors } = toCreateBody(fromAlert(alert), TEMPLATES_FIXTURE.data);

        expect(errors).toEqual({});

        expect(body!.type).toBe(alert.type);

        expect(body!.condition).toEqual(alert.condition);

        expect(sameInstants(body!.trigger ?? {})).toEqual(sameInstants(alert.trigger));

        expect(body!.destination_ids ?? []).toEqual(alert.destination_ids);

        expect(body!.metadata ?? {}).toEqual(alert.metadata);

        expect(body!.client_reference_id ?? null).toBe(alert.client_reference_id);

        expect(body!.external_user_id ?? null).toBe(alert.external_user_id);
    });
});

describe("toCreateBody", () => {
    it("sends only the chosen type's fields and leaves unset ones out", () => {
        const state = emptyAlertForm("price");

        state.condition = { asset_class: "us_stock", level: "200.5", operator: "crosses_above", stage: "detected", symbol: "AAPL" };

        state.trigger = { cooldown_bars: "3", max_fires: "5", mode: "" };

        expect(toCreateBody(state).body).toEqual({
            condition: { asset_class: "us_stock", level: 200.5, operator: "crosses_above", symbol: "AAPL" },
            trigger: { max_fires: 5 },
            type: "price",
        });
    });

    it("lists split by type: keywords on commas / lines (they hold spaces), tickers on spaces too", () => {
        const state = emptyAlertForm("news_keyword");

        state.condition = { keywords: "supply chain, recall\nguidance cut", symbols: "AAPL MSFT,NVDA" };

        expect(toCreateBody(state).body!.condition).toEqual({ keywords: ["supply chain", "recall", "guidance cut"], symbols: ["AAPL", "MSFT", "NVDA"] });
    });

    it("a field that cannot be read is an error under its key, never sent", () => {
        const state = emptyAlertForm("price_move");

        state.condition = { pct: "0.05", window_minutes: "1.5" };

        state.trigger = { expires_at: "tomorrow" };

        state.metadata = [{ key: "", value: "x" }];

        expect(toCreateBody(state).errors).toMatchObject({
            "condition.pct": "At least 0.1.",
            "condition.window_minutes": "Not a whole number.",
            "metadata": "Every value needs a key.",
            "trigger.expires_at": "Not a date and time.",
        });

        const json = emptyAlertForm("fundamental_metric");

        json.condition = { rules: "[{" };

        expect(toCreateBody(json).errors).toMatchObject({ "condition.rules": "Not valid JSON." });
    });

    it("the indicator sends either its template or its structured condition", () => {
        const state = emptyAlertForm("indicator");

        state.condition = { condition: "{\"comparator\": \"crossing_up\", \"lhs\": {\"kind\": \"price\"}, \"rhs\": {\"kind\": \"value\", \"value\": 1}}", interval: "1h", symbol: "SPY" };

        state.template = { inputs: { length: "21" }, key: "rsi-cross" };

        expect(toCreateBody(state, TEMPLATES_FIXTURE.data).body!.condition).toEqual({ interval: "1h", symbol: "SPY", template: { inputs: { length: 21 }, key: "rsi-cross" } });

        state.indicatorMode = "structured";

        expect(toCreateBody(state, TEMPLATES_FIXTURE.data).body!.condition).toEqual({
            condition: { comparator: "crossing_up", lhs: { kind: "price" }, rhs: { kind: "value", value: 1 } },
            interval: "1h",
            symbol: "SPY",
        });

        state.indicatorMode = "template";

        state.template = { inputs: { direction: "sideways", length: "1" }, key: "rsi-cross" };

        expect(toCreateBody(state, TEMPLATES_FIXTURE.data).errors).toEqual({
            "condition.template.inputs.direction": "One of up, down.",
            "condition.template.inputs.length": "At least 2.",
        });
    });

    it("an active window and the time / weekday editors", () => {
        const state = emptyAlertForm("price_reminder");

        state.condition = { days: ["1", "5"], frequency: "weekly", symbol: "AAPL", time_of_day_minutes: "09:30", weekday: "3" };

        state.window = { ...state.window, days: ["mo", "fr"], from: "09:30", timezone: "America/New_York", to: "16:00", type: "weekly" };

        const { body } = toCreateBody(state);

        expect(body!.condition).toEqual({ days: [1, 5], frequency: "weekly", symbol: "AAPL", time_of_day_minutes: 570, weekday: 3 });

        expect(body!.trigger).toEqual({ active_window: { days: ["mo", "fr"], from: "09:30", timezone: "America/New_York", to: "16:00", type: "weekly" } });
    });
});

describe("toUpdateBody", () => {
    it("sends the loaded version, the whole condition / trigger / delivery, and null for an emptied reference", () => {
        const state = fromAlert(ALERT_FILING);

        state.clientReferenceId = "";

        const { body } = toUpdateBody(state, 7);

        expect(body).toMatchObject({ client_reference_id: null, destination_ids: ALERT_FILING.destination_ids, external_user_id: "user_8812", trigger: { mode: "every_time" }, version: 7 });

        expect(body).toHaveProperty("type", ALERT_FILING.type);
    });
});

describe("fromAlert / prefilledForm", () => {
    it("metadata that was not a string is sent back as its value, not as text", () => {
        const alert = { ...ALERT_FILING, metadata: { list: "tech", tags: ["a", "b"], tier: 3 } };

        const state = fromAlert(alert);

        expect(toCreateBody(state).body!.metadata).toEqual({ list: "tech", tags: ["a", "b"], tier: 3 });

        state.metadata = state.metadata.map(row => (row.key === "tier" ? { ...row, value: "{" } : row));

        expect(toCreateBody(state).errors.metadata).toContain("tier");
    });

    it("an instant with seconds keeps them through the form", () => {
        const alert = { ...ALERT_PRICE, trigger: { ...ALERT_PRICE.trigger, activate_at: "2026-12-01T14:30:45Z" } };

        expect(new Date(String(toCreateBody(fromAlert(alert)).body!.trigger?.activate_at)).toISOString()).toBe("2026-12-01T14:30:45.000Z");
    });

    it("a duplicate drops the client reference id (unique per account)", () => {
        expect(fromAlert(ALERT_FILING).clientReferenceId).toBe("watchlist-aapl-8k");

        expect(fromAlert(ALERT_FILING, { duplicate: true }).clientReferenceId).toBe("");
    });

    it("?type=&symbol= puts the symbol into the type's company field", () => {
        expect(prefilledForm("price", "AAPL").condition).toEqual({ symbol: "AAPL" });

        expect(prefilledForm("filing", "AAPL").condition).toEqual({ symbols: "AAPL" });

        expect(prefilledForm(undefined, undefined)).toEqual(emptyAlertForm());
    });
});

describe("API problems on the form's fields", () => {
    it("fieldKeyOf maps a problem param to a form key", () => {
        expect(fieldKeyOf("condition.rules.0.value")).toBe("condition.rules");

        expect(fieldKeyOf("condition.symbols[3]")).toBe("condition.symbols");

        expect(fieldKeyOf("condition.template.inputs.length")).toBe("condition.template.inputs.length");

        expect(fieldKeyOf("trigger.active_window.from")).toBe("trigger.active_window");

        expect(fieldKeyOf("destination_ids[0]")).toBe("destination_ids");

        expect(fieldKeyOf("limit")).toBeNull();

        expect(fieldKeyOf(null)).toBeNull();
    });

    it("fieldErrorsOf: every errors[] entry under its field, the rest under form", () => {
        const error = new ApiRequestError(400, {
            error: "invalid_parameter",
            errors: [
                { code: "invalid_parameter", detail: "level: must be > 0", param: "condition.level" },
                { code: "invalid_parameter", detail: "unknown destination", param: "destination_ids[1]" },
                { code: "invalid_parameter", detail: "something else", param: null },
            ],
            message: "3 problems",
        });

        expect(fieldErrorsOf(error)).toEqual({ "condition.level": "level: must be > 0", "destination_ids": "unknown destination", "form": "something else" });

        // The type and the version have no field to show it under: the form says it.
        expect(fieldErrorsOf(new ApiRequestError(400, { error: "invalid_parameter", message: "type: refused", param: "type" }))).toEqual({ form: "type: refused" });

        expect(fieldKeyOf("version")).toBeNull();

        expect(fieldKeyOf("metadata")).toBe("metadata");
    });

    it("readField keeps the schema's bounds", () => {
        expect(readField(CONDITION_FIELDS.earnings_call_keyword.find(field => field.name === "min_mentions")!, "1001")).toEqual({ error: "At most 1000." });

        expect(readField(CONDITION_FIELDS.event_countdown.find(field => field.name === "offsets_days")!, "1, 7, 30")).toEqual({ value: [1, 7, 30] });

        expect(readField(CONDITION_FIELDS.filing.find(field => field.name === "symbols")!, "")).toEqual({ value: undefined });
    });
});

describe("SDK 13 per-type form contract", () => {
    it.each(Object.keys(ALERT_TYPE_FIELDS) as Array<keyof typeof ALERT_TYPE_FIELDS>)("%s: the published create example round-trips through the form", (type) => {
        const example: unknown = structuredClone(ALERT_TYPE_FIELDS[type].example);

        expect(isCreateAlertRequest(example)).toBe(true);

        if (!isCreateAlertRequest(example)) throw new Error("Invalid published example");

        const state = fromAlert(fixtureAlert(type));

        state.trigger = {};

        expect(toCreateBody(state)).toEqual({ body: example, errors: {} });
    });

    it("required fields block requests and report the missing field", () => {
        expect(toCreateBody(emptyAlertForm("price"))).toEqual({ body: null, errors: {
            "condition.level": "Required for Price level.",
            "condition.operator": "Required for Price level.",
            "condition.symbol": "Required for Price level.",
        } });
    });

    it("a shared enum value is cleared when another type rejects it, while compatible text and delivery remain", () => {
        const state = emptyAlertForm("news_keyword");

        state.condition = { keywords: "supply chain", scope: "headline", symbols: "AAPL" };

        state.trigger = { cooldown_seconds: "60", mode: "every_time" };

        state.destinationIds = "dst_keep";

        state.externalUserId = "user_keep";

        state.metadata = [{ key: "list", value: "tech" }];

        state.template = { inputs: { length: "14" }, key: "stale" };

        const next = switchAlertType(state, "filing_keyword");

        expect(next.condition).toEqual({ keywords: "supply chain", symbols: "AAPL" });

        expect(next.trigger).toEqual(state.trigger);

        expect(next.destinationIds).toBe(state.destinationIds);

        expect(next.externalUserId).toBe(state.externalUserId);

        expect(next.metadata).toEqual(state.metadata);

        expect(next.template).toEqual({ inputs: {}, key: "" });
    });

    it("type switches apply the new field's pattern and length constraints", () => {
        const state = emptyAlertForm("script");

        state.condition.symbol = "0xcrypto";

        expect(switchAlertType(state, "fundamental_metric").condition.symbol).toBeUndefined();

        state.condition.symbol = "a-very-long-crypto-coin-slug";

        expect(switchAlertType(state, "fundamental_metric").condition.symbol).toBeUndefined();

        state.condition.symbol = "AAPL";

        expect(switchAlertType(state, "fundamental_metric").condition.symbol).toBe("AAPL");
    });

    it("type switches reject incompatible intervals and trigger fields, and restore macro defaults", () => {
        const state = emptyAlertForm("script");

        state.condition = { interval: "4h", symbol: "AAPL" };

        state.trigger = { cooldown_bars: "3", cooldown_seconds: "30" };

        expect(switchAlertType(state, "volume_spike")).toMatchObject({ condition: { symbol: "AAPL" }, trigger: { cooldown_seconds: "30" } });

        expect(switchAlertType(state, "macro").condition).toEqual({ macro_events: ["macro.released", "macro.revised"] });
    });
});
