import type {
    Alert,
    AlertBatchResponse,
    AlertEvent,
    AlertEventsResponse,
    AlertsListResponse,
    AlertTemplate,
    AlertTemplatesResponse,
    AlertType,
    AlertUser,
    AlertUserBatchResponse,
    AlertUserDefaults,
    AlertUserDeleteResult,
    AlertUsersListResponse,
    Script,
    ScriptsListResponse,
    ScriptVersion,
    ScriptVersionsResponse,
} from "@/lib/api/types";

/**
 * Alerts fixtures (tests only; backend tasks/data-api-dashboard 2-alerts task 2). The spec gives no response examples
 * for the alert operations: these follow the schemas, with the spec's own example ids and the `createAlert` request
 * example (`watchlist-aapl-8k`); one alert per type group.
 */

export const FIXTURE_ALERT_ID = "alt_01JD2Q5Z8K3M7N9P4R6T1V0W2X";

export const FIXTURE_DESTINATION_ID = "dst_01JD2Q4X7Y8Z9A0B1C2D3E4F5G";

const base = {
    cik: null,
    client_reference_id: null,
    created_at: "2026-11-20T14:00:00Z",
    destination_ids: [],
    disabled_reason: null,
    external_user_id: null,
    fire_count: 0,
    last_fired_at: null,
    metadata: {},
    status: "active",
    symbol: null,
    trigger: { mode: "every_time" },
    updated_at: "2026-11-20T14:00:00Z",
    version: 1,
} satisfies Partial<Alert>;

export function fixtureAlert(type: AlertType, patch: Partial<Alert> = {}): Alert {
    return { ...base, condition: {}, id: `alt_${type}`, type, ...patch };
}

/** The spec's `createAlert` example, as stored. */
export const ALERT_FILING = fixtureAlert("filing", {
    cik: "0000320193",
    client_reference_id: "watchlist-aapl-8k",
    condition: { form_types: ["8-K"], stage: "detected", symbols: ["AAPL"] },
    destination_ids: [FIXTURE_DESTINATION_ID],
    external_user_id: "user_8812",
    fire_count: 3,
    id: FIXTURE_ALERT_ID,
    last_fired_at: "2026-11-21T13:05:00Z",
    metadata: { list: "tech" },
    symbol: "AAPL",
});

export const ALERT_NEWS_KEYWORD = fixtureAlert("news_keyword", {
    condition: { keywords: ["supply chain", "recall"], match: "any", scope: "headline", symbols: ["AAPL", "MSFT", "NVDA", "TSLA"] },
    status: "paused",
});

export const ALERT_EARNINGS_CALL = fixtureAlert("earnings_call", { condition: { events: ["started", "transcript_ready"], symbols: ["NVDA"] }, symbol: "NVDA" });

export const ALERT_DIVIDEND = fixtureAlert("dividend", {
    condition: { amount_change: { direction: "raise", min_pct: 5 }, kinds: ["declared"], symbols: ["KO"] },
    status: "triggered",
    symbol: "KO",
    trigger: { max_fires: 1, mode: "once" },
});

export const ALERT_FUNDAMENTAL = fixtureAlert("fundamental_metric", {
    condition: { rules: [{ metric_id: "revenue", operator: "gt", period_type: "quarterly", value: "1000000000" }], symbol: "MSFT" },
    symbol: "MSFT",
});

export const ALERT_PRICE = fixtureAlert("price", {
    condition: { asset_class: "us_stock", level: 200, operator: "crosses_above", symbol: "AAPL" },
    symbol: "AAPL",
    trigger: { cooldown_seconds: 3600, expires_at: "2026-12-31T21:00:00Z", mode: "every_time", rearm: "cross_back", rearm_distance_pct: 1 },
});

export const ALERT_INDICATOR = fixtureAlert("indicator", {
    condition: { asset_class: "us_stock", interval: "1h", symbol: "SPY", template: { inputs: { length: 14, level: 30 }, key: "rsi-cross" } },
    disabled_reason: "script_error",
    status: "disabled",
    symbol: "SPY",
    trigger: { cooldown_bars: 3, mode: "every_time" },
});

export const ALERTS_PAGE_FIXTURE: AlertsListResponse = {
    data: [ALERT_FILING, ALERT_NEWS_KEYWORD, ALERT_EARNINGS_CALL, ALERT_DIVIDEND, ALERT_FUNDAMENTAL, ALERT_PRICE, ALERT_INDICATOR],
    has_more: true,
    meta: { quota: { active_alerts: 6, active_alerts_limit: 100, fires_per_day_limit: 1000, script_alerts: 1, script_alerts_limit: 10 } },
    next_cursor: "cur_2",
};

export function fixtureEvent(id: string, patch: Partial<AlertEvent> = {}): AlertEvent {
    return {
        alert_id: FIXTURE_ALERT_ID,
        external_user_id: "user_8812",
        id,
        occurred_at: "2026-11-21T13:05:00Z",
        payload: {
            alert: { client_reference_id: "watchlist-aapl-8k", external_user_id: "user_8812", id: FIXTURE_ALERT_ID, metadata: { list: "tech" }, type: "filing" },
            event_id: id,
            fired_at: "2026-11-21T13:05:00Z",
            reason: { details: { accession_number: "0000320193-26-000101", form_type: "8-K" }, summary: "AAPL filed an 8-K" },
            subject: { cik: "0000320193", symbol: "AAPL" },
        },
        type: "alert.fired",
        ...patch,
    };
}

export const EVENT_OLD = fixtureEvent("evt_01", { occurred_at: "2026-11-20T15:00:00Z" });

export const EVENT_STATUS = fixtureEvent("evt_02", {
    occurred_at: "2026-11-20T16:00:00Z",
    payload: { alert_id: FIXTURE_ALERT_ID, from: "active", reason: "paused by request", to: "paused" },
    type: "alert.status_changed",
});

export const EVENT_TEST = fixtureEvent("evt_03", {
    occurred_at: "2026-11-21T09:00:00Z",
    payload: {
        alert: { client_reference_id: null, external_user_id: null, id: FIXTURE_ALERT_ID, metadata: null, type: "filing" },
        event_id: "evt_03",
        fired_at: "2026-11-21T09:00:00Z",
        reason: { details: {}, summary: "Test event" },
        test: true,
    },
});

/** One page, oldest first (as the API lists them). */
export const EVENTS_PAGE_FIXTURE: AlertEventsResponse = { data: [EVENT_OLD, EVENT_STATUS, EVENT_TEST], has_more: false, meta: {}, next_cursor: null };

export const TEMPLATE_RSI: AlertTemplate = {
    description: "RSI crosses a level.",
    fidelity: "lossy",
    inputs: [
        { default: 14, kind: "int", max: 200, min: 2, name: "length", title: "Length" },
        { default: 30, kind: "float", max: 100, min: 0, name: "level", title: "Level" },
        { default: "up", kind: "enum", name: "direction", options: ["up", "down"], title: "Direction" },
    ],
    key: "rsi-cross",
    source: "// chartlang source",
    source_key: "builtin:rsi-cross@1",
    title: "RSI cross",
    version: 1,
};

export const TEMPLATES_FIXTURE: AlertTemplatesResponse = { data: [TEMPLATE_RSI], has_more: false, meta: {}, next_cursor: null };

/** A bulk pause of three alerts: two paused, one refused (a partial failure). */
export const BATCH_PARTIAL: AlertBatchResponse = {
    results: [
        { alert: { ...ALERT_FILING, status: "paused" }, error: null, index: 0, ok: true, op: "pause", result: "paused" },
        { alert: null, error: { code: "not_found", detail: "No alert alt_gone on this account.", param: "items[1].id", remedy: "Check the id." }, index: 1, ok: false, op: "pause", result: null },
        { alert: { ...ALERT_PRICE, status: "paused" }, error: null, index: 2, ok: true, op: "pause", result: "paused" },
    ],
};

// ── A4: end users, defaults, scripts (the spec's `listAlertUsers` / `getAlertUser` examples: `smoke-a`) ──────────────

/** An id with a slash, a colon and a space: one path segment, URL-encoded (`team%2Fa%3Ab%20c`). */
export const ODD_USER_ID = "team/a:b c";

export function fixtureAlertUser(externalUserId: string, patch: Partial<AlertUser> = {}): AlertUser {
    return {
        created_at: "2026-11-19T16:59:52.948Z",
        display_name: null,
        effective_limits: { max_active_alerts: 3, max_fires_per_day: null, max_script_alerts: null },
        external_user_id: externalUserId,
        limits: { max_active_alerts: 3, max_fires_per_day: null, max_script_alerts: null },
        metadata: {},
        status: "active",
        updated_at: "2026-11-19T16:59:59.916Z",
        usage: { active_alerts: 3, fires_today: 0, last_fired_at: null, script_alerts: 0 },
        ...patch,
    };
}

/** The spec's example: its own limit of 3, at its limit. */
export const USER_SMOKE = fixtureAlertUser("smoke-a");

/** A paused end user whose limits come from the account defaults (own values null). */
export const USER_PAUSED = fixtureAlertUser("user_8812", {
    display_name: "Jane (premium)",
    effective_limits: { max_active_alerts: 10, max_fires_per_day: 500, max_script_alerts: 1 },
    limits: { max_active_alerts: null, max_fires_per_day: null, max_script_alerts: null },
    metadata: { tier: "premium" },
    status: "paused",
    usage: { active_alerts: 4, fires_today: 12, last_fired_at: "2026-11-21T13:05:00Z", script_alerts: 1 },
});

export const USER_ODD = fixtureAlertUser(ODD_USER_ID, { limits: { max_active_alerts: null, max_fires_per_day: null, max_script_alerts: 0 }, usage: { active_alerts: 0, fires_today: 0, last_fired_at: null, script_alerts: 0 } });

export const USERS_PAGE_FIXTURE: AlertUsersListResponse = { data: [USER_SMOKE, USER_ODD, USER_PAUSED], has_more: false, meta: {}, next_cursor: null };

/** The spec's example of `getAlertUserDefaults`. */
export const DEFAULTS_FIXTURE: AlertUserDefaults = { max_active_alerts: 2, max_fires_per_day: null, max_script_alerts: null, updated_at: "2026-11-19T16:59:52.616Z" };

export const DELETE_DONE: AlertUserDeleteResult = { alerts_deleted: 3, deliveries_deleted: 9, events_deleted: 4, status: "deleted" };

export const DELETE_RUNNING: AlertUserDeleteResult = { alerts_deleted: 3, deliveries_deleted: 1000, events_deleted: 1000, status: "deleting" };

/** A bulk upsert of three: created, updated, one refused. */
export const USER_BATCH_PARTIAL: AlertUserBatchResponse = {
    results: [
        { alert_user: fixtureAlertUser("user_9001"), error: null, index: 0, ok: true, result: "created" },
        { alert_user: USER_PAUSED, error: null, index: 1, ok: true, result: "updated" },
        { alert_user: null, error: { code: "conflict", detail: "The end user is being deleted.", param: "items[2].external_user_id", remedy: "Wait until the deletion ends." }, index: 2, ok: false, result: null },
    ],
};

/** The spec's `createScript` example source (EMA cross). */
export const SCRIPT_SOURCE = `import { defineIndicator, input } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA cross",
    apiVersion: 1,
    overlay: true,
    inputs: { fast: input.int(9, { min: 1, max: 200 }), slow: input.int(21, { min: 2, max: 500 }) },
    compute({ bar, ta, alert, inputs }) {
        const fast = ta.ema(bar.close, inputs.fast);
        const slow = ta.ema(bar.close, inputs.slow);
        if (ta.crossover(fast, slow).current) alert("EMA cross up at " + bar.close);
    }
});
`;

export const FIXTURE_SCRIPT_ID = "scr_01JD2Q6A1B2C3D4E5F6G7H8J9K";

/** Version 1: a compile error on line 9 (and a warning on line 6). */
export const SCRIPT_V1_ERROR: ScriptVersion = {
    alert_ids: [],
    compiler_version: "1.14.0",
    created_at: "2026-11-20T10:00:00Z",
    diagnostics: [
        { code: "unused-input", column: 5, line: 6, message: "Input slow is never read.", severity: "warning" },
        { code: "type-error", column: 22, line: 9, message: "Property 'emaa' does not exist on ta.", severity: "error" },
    ],
    id: "scv_01JD2Q6B0000000000000000V1",
    manifest: null,
    script_id: FIXTURE_SCRIPT_ID,
    source: SCRIPT_SOURCE.replace("ta.ema(bar.close, inputs.fast)", "ta.emaa(bar.close, inputs.fast)"),
    source_sha256: "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0",
    status: "error",
    version: 1,
};

/** Version 2: compiled; the manifest declares `fast` / `slow` (chartlang's `defaultValue`). */
export const SCRIPT_V2_OK: ScriptVersion = {
    alert_ids: ["main.ts:11:57#0"],
    compiler_version: "1.14.0",
    created_at: "2026-11-20T11:00:00Z",
    diagnostics: [],
    id: "scv_01JD2Q6B0000000000000000V2",
    manifest: {
        apiVersion: 1,
        inputs: { fast: { defaultValue: 9, kind: "int", max: 200, min: 1 }, slow: { defaultValue: 21, kind: "int", max: 500, min: 2, title: "Slow length" } },
        kind: "indicator",
        name: "EMA cross",
    },
    script_id: FIXTURE_SCRIPT_ID,
    source: SCRIPT_SOURCE,
    source_sha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    status: "ok",
    version: 2,
};

export const SCRIPT_FIXTURE: Script = {
    created_at: "2026-11-20T10:00:00Z",
    description: "Fast EMA crossing above the slow one",
    id: FIXTURE_SCRIPT_ID,
    latest_version: SCRIPT_V2_OK,
    name: "EMA cross",
    updated_at: "2026-11-20T11:00:00Z",
    version_count: 2,
};

export const SCRIPTS_PAGE_FIXTURE: ScriptsListResponse = {
    data: [SCRIPT_FIXTURE, { ...SCRIPT_FIXTURE, description: null, id: "scr_full", latest_version: { ...SCRIPT_V1_ERROR, version: 20 }, name: "At the limit", version_count: 20 }],
    has_more: false,
    meta: {},
    next_cursor: null,
};

export const SCRIPT_VERSIONS_FIXTURE: ScriptVersionsResponse = { data: [SCRIPT_V1_ERROR, SCRIPT_V2_OK], has_more: false, meta: {}, next_cursor: null };
