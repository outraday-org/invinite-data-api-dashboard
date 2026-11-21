import type {
    Alert,
    AlertBatchResponse,
    AlertEvent,
    AlertEventsResponse,
    AlertsListResponse,
    AlertTemplate,
    AlertTemplatesResponse,
    AlertType,
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
