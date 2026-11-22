import type { AlertConditionField, AlertTriggerField, AlertType } from "@/lib/api/types";

import { BAR_ALERT_TYPES, PRICE_ALERT_TYPES } from "./labels";

/**
 * The alert form's field map (backend tasks/data-api-dashboard 2-alerts task 2): which `AlertConditionInput` fields
 * each of the 17 types takes, and how each field is edited. Read from the schema's per-field descriptions ("each field
 * names the types that take it"); `condition-fields.test.ts` parses `openapi.json` and fails when a type or a field is
 * missing here, when a field here is not in the schema, or when an enum / bound differs. Labels and help are the
 * descriptions, shortened. One form for every type, never 17 hand-written ones.
 */

export type FieldKind
    = | "boolean"
        | "datetime"
        | "enum"
        | "enum-list"
        | "int-list"
        | "integer"
        | "json"
        | "number"
        | "string"
        | "string-list"
        | "template"
        | "time-of-day"
        | "weekday"
        | "weekday-list";

export type FieldSpec = {
    help: string;
    kind: FieldKind;
    label: string;
    max?: number;
    /** A list's most entries (`maxItems`). */
    maxItems?: number;
    min?: number;
    /** The enum values (`enum`, `enum-list`). */
    options?: ReadonlyArray<string>;
    /** The values one type allows of a shared enum (`scope`, `kinds`, `interval`, `frequency`), as the description says. */
    optionsByType?: Partial<Record<AlertType, ReadonlyArray<string>>>;
    /** An example (JSON fields: a valid value of the shape). */
    placeholder?: string;
    /** List fields split on commas and new lines only (keywords may hold spaces); else on whitespace too. */
    splitOnCommasOnly?: boolean;
};

const NEWS_KINDS = [
    "earnings_results",
    "results_date",
    "call_announcement",
    "event_announcement",
    "guidance",
    "m_and_a",
    "material_agreement",
    "management_change",
    "dividend",
    "capital_markets",
    "legal_spam",
    "promo",
    "other",
] as const;

const DIVIDEND_KINDS = ["declared", "ex_date", "payment"] as const;

const BAR_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo"] as const;

/** Every field of `AlertConditionInput`: its editor, label and help. */
export const FIELD_SPECS: Record<AlertConditionField, FieldSpec> = {
    alert_ids: { help: "Only these of the script's alerts (its version's alert ids); empty = all.", kind: "string-list", label: "Script alert ids", maxItems: 50 },
    amount_change: { help: "Only a dividend whose amount moved by at least min_pct percent (direction raise / cut / any).", kind: "json", label: "Amount change", placeholder: "{\"direction\": \"raise\", \"min_pct\": 5}" },
    asset_class: { help: "us_stock (US stocks and ETFs), crypto (a coin by slug or ticker) or commodity (XAUUSD / XAGUSD). Empty = a stock first, then a coin.", kind: "enum", label: "Asset class", options: ["us_stock", "crypto", "commodity"] },
    at: { help: "The instant of a once reminder.", kind: "datetime", label: "At" },
    baseline: { help: "What the move is measured from (ignored with a window); gap_open = the open against the prior close, once per session.", kind: "enum", label: "Baseline", options: ["prior_close", "intraday_open", "session_high", "session_low", "gap_open"] },
    baseline_mode: { help: "The volume baseline: mean or median of the previous bars, or rvol_slot = the same time-of-day bar of earlier sessions (default flat_mean).", kind: "enum", label: "Baseline mode", options: ["flat_mean", "rvol_slot", "median"] },
    cik: { help: "The company by CIK (1–10 digits).", kind: "string", label: "CIK" },
    ciks: { help: "Companies by CIK (with symbols at most 100 in all).", kind: "string-list", label: "CIKs", maxItems: 100 },
    condition: {
        help: "A structured trigger lhs <comparator> rhs at each bar close (instead of a template).",
        kind: "json",
        label: "Structured condition",
        placeholder: "{\"lhs\": {\"kind\": \"indicator\", \"indicator_id\": \"rsi\", \"series_key\": \"rsi\"}, \"comparator\": \"crossing_up\", \"rhs\": {\"kind\": \"value\", \"value\": 30}}",
    },
    days: { help: "Several weekdays of a daily / weekly reminder.", kind: "weekday-list", label: "Days", max: 6, maxItems: 7, min: 0 },
    days_before: { help: "Days before the event (0 = on the day).", kind: "integer", label: "Days before", max: 90, min: 0 },
    direction: { help: "Which move fires.", kind: "enum", label: "Direction", options: ["up", "down", "both"] },
    dividend_types: { help: "Only these dividend types.", kind: "string-list", label: "Dividend types", maxItems: 20 },
    earnings_only: { help: "Only earnings news.", kind: "boolean", label: "Earnings news only" },
    evaluation: { help: "When it evaluates: bar_close (default) or pre_close = offset_minutes before the US session close.", kind: "json", label: "Evaluation", placeholder: "{\"kind\": \"pre_close\", \"offset_minutes\": 15}" },
    event: { help: "The event counted down to.", kind: "enum", label: "Event", options: ["earnings_call", "ex_dividend", "dividend_payment"] },
    events: {
        help: "Call lifecycle events (transcript_provisional / transcript_corrected / documents_updated need STANDARD; guidance_flash / keyword_hit PRO).",
        kind: "enum-list",
        label: "Events",
        options: ["scheduled", "started", "ended", "rescheduled", "transcript_provisional", "transcript_ready", "transcript_corrected", "assets_ready", "documents_updated", "guidance_flash", "keyword_hit"],
    },
    filters: {
        help: "State filters that gate the structured condition (at most 4 comparisons, two levels).",
        kind: "json",
        label: "Filters",
        placeholder: "{\"op\": \"and\", \"children\": []}",
    },
    form_categories: { help: "Form categories.", kind: "enum-list", label: "Form categories", options: ["annual_report", "quarterly_report", "current_report", "insider_trade", "registration", "other"] },
    form_types: { help: "Raw SEC form types (8-K, S-1).", kind: "string-list", label: "Form types", maxItems: 50 },
    frequency: {
        help: "Reminder: once at At, hourly, daily or weekly. Script / indicator: when its alerts deliver (default once_per_bar_close).",
        kind: "enum",
        label: "Frequency",
        options: ["once", "hourly", "daily", "weekly", "once_per_bar", "once_per_bar_close", "every_time"],
        optionsByType: {
            indicator: ["once", "once_per_bar", "once_per_bar_close", "every_time"],
            price_reminder: ["once", "hourly", "daily", "weekly"],
            script: ["once", "once_per_bar", "once_per_bar_close", "every_time"],
        },
    },
    include_amendments: { help: "Also amendments (/A).", kind: "boolean", label: "Include amendments" },
    inputs: { help: "Values for the script's declared inputs (absent = the defaults).", kind: "json", label: "Script inputs", placeholder: "{\"length\": 14}" },
    interval: {
        help: "The bar evaluated at its close. Script / indicator: the plan's shortest is FREE / LITE 1h, STANDARD 5m, PRO 1m.",
        kind: "enum",
        label: "Interval",
        options: BAR_INTERVALS,
        optionsByType: { indicator: BAR_INTERVALS, script: BAR_INTERVALS, volume_spike: ["1m", "5m", "15m", "30m", "1h", "1d", "1w", "1mo"] },
    },
    keywords: { help: "Whole-word, case-insensitive keywords (2–50 characters), one per line or comma.", kind: "string-list", label: "Keywords", maxItems: 20, splitOnCommasOnly: true },
    kinds: {
        help: "News: the news kinds. Dividend: declared / ex_date / payment.",
        kind: "enum-list",
        label: "Kinds",
        options: [...NEWS_KINDS, ...DIVIDEND_KINDS],
        optionsByType: { dividend: DIVIDEND_KINDS, news: NEWS_KINDS },
    },
    level: { help: "The price level (> 0).", kind: "number", label: "Level", min: 0 },
    lookback_bars: { help: "Bars in the baseline, 5–200 (rvol_slot: sessions, 2–20).", kind: "integer", label: "Lookback bars", max: 200, min: 2 },
    match: { help: "Any or all keywords (default any).", kind: "enum", label: "Match", options: ["any", "all"] },
    mention_delta_rule: { help: "Mentions moved against the previous call (direction up / down / either, min_delta).", kind: "json", label: "Mention change", placeholder: "{\"direction\": \"up\", \"min_delta\": 3}" },
    min_mentions: { help: "Fire at this many mentions.", kind: "integer", label: "Minimum mentions", max: 1000, min: 1 },
    minutes_before: { help: "Minutes before the call starts (event earnings_call only).", kind: "integer", label: "Minutes before", max: 1440, min: 1 },
    mode: { help: "relative = a closed bar's volume ≥ multiple × its baseline; absolute = ≥ threshold; session = today's volume ≥ multiple × the 20-session average.", kind: "enum", label: "Mode", options: ["relative", "absolute", "session"] },
    multiple: { help: "Volume multiple of the baseline (relative / session).", kind: "number", label: "Multiple", max: 100, min: 1.1 },
    nodes: { help: "Producer scripts a script chain reads (producers first).", kind: "json", label: "Script nodes", maxItems: 4, placeholder: "[]" },
    notify_on_date_change: { help: "Tell when the event date moves (default yes).", kind: "boolean", label: "Notify on date change" },
    offsets_days: { help: "A ladder of days before (comma list, 0–90).", kind: "int-list", label: "Offsets (days)", max: 90, maxItems: 10, min: 0 },
    operator: { help: "crosses_* fire when the price crosses the level; above / below also fire at once when it is already on that side.", kind: "enum", label: "Operator", options: ["crosses_above", "crosses_below", "crosses", "above", "below"] },
    pct: { help: "The move in percent of the baseline.", kind: "number", label: "Move (%)", max: 1000, min: 0.1 },
    price_direction: { help: "Only bars that closed up / down (default any).", kind: "enum", label: "Price direction", options: ["up", "down", "any"] },
    reason_codes: { help: "Only these halt reason codes.", kind: "string-list", label: "Reason codes", maxItems: 50 },
    report_kinds: { help: "Results reports to fire on.", kind: "enum-list", label: "Report kinds", options: ["preliminary", "final"] },
    rules: {
        help: "AND-combined metric thresholds (1–5; metric ids of GET /v1/catalog/metrics, value a decimal string).",
        kind: "json",
        label: "Rules",
        maxItems: 5,
        placeholder: "[{\"metric_id\": \"is_total_revenue\", \"period_type\": \"quarterly\", \"operator\": \"gt\", \"value\": \"1000000000\"}]",
    },
    scope: {
        help: "Where keywords are searched.",
        kind: "enum",
        label: "Scope",
        options: ["full", "risk_factors", "mdna", "legal_proceedings", "headline", "headline_and_description", "prepared", "qna"],
        optionsByType: {
            earnings_call_keyword: ["full", "prepared", "qna"],
            filing_keyword: ["full", "risk_factors", "mdna", "legal_proceedings"],
            news_keyword: ["headline", "headline_and_description"],
        },
    },
    script_version_id: { help: "The script version evaluated (scv_…, status ok, of a script of this account).", kind: "string", label: "Script version id" },
    series_inputs: { help: "A script chain: what feeds each externalSeries input, by input key.", kind: "json", label: "Series inputs", placeholder: "{}" },
    sources: { help: "News sources.", kind: "string-list", label: "Sources", maxItems: 20 },
    speaker_roles: { help: "Only these speakers.", kind: "enum-list", label: "Speaker roles", options: ["management", "analyst"] },
    stage: { help: "detected = the moment the SEC publishes it (every filer); processed = after Invinite's processing.", kind: "enum", label: "Stage", options: ["detected", "processed"] },
    statuses: { help: "Halt or resumption (empty = both).", kind: "enum-list", label: "Statuses", options: ["halted", "resumed"] },
    symbol: { help: "The company by ticker; price types, script and indicator: the instrument (a US stock / ETF ticker, a crypto slug or ticker, XAUUSD / XAGUSD).", kind: "string", label: "Symbol" },
    symbols: { help: "Companies by ticker (a US ETF ticker for the types that take ETFs); with CIKs at most 100 in all.", kind: "string-list", label: "Symbols", maxItems: 100 },
    template: { help: "A built-in indicator template and its inputs (GET /v1/alert-templates).", kind: "template", label: "Template" },
    threshold: { help: "Bar volume threshold, > 0 (absolute mode).", kind: "number", label: "Threshold", min: 0 },
    time_of_day_minutes: { help: "Local time the reminder fires (countdown default 09:00).", kind: "time-of-day", label: "Time of day", max: 1439, min: 0 },
    timezone: { help: "IANA time zone (reminder default America/New_York).", kind: "string", label: "Time zone" },
    weekday: { help: "Day of a weekly reminder.", kind: "weekday", label: "Weekday", max: 6, min: 0 },
    window_minutes: { help: "Measure the move against the price this many minutes ago instead of the baseline.", kind: "integer", label: "Window (minutes)", max: 1440, min: 1 },
    yield_rule: { help: "Only when the yield (percent) is above / below.", kind: "json", label: "Yield rule", placeholder: "{\"comparator\": \"above\", \"pct\": 4}" },
    yoy_rules: { help: "Year-over-year growth gates (signed percent; at most 2).", kind: "json", label: "YoY rules", maxItems: 2, placeholder: "[{\"metric\": \"eps\", \"comparator\": \"above\", \"pct\": 10}]" },
};

const COMPANIES: ReadonlyArray<AlertConditionField> = ["symbols", "ciks"];

const ONE_COMPANY: ReadonlyArray<AlertConditionField> = ["symbol", "cik"];

const INSTRUMENT: ReadonlyArray<AlertConditionField> = ["symbol", "asset_class"];

/** The fields each type takes, in form order (the schema's descriptions; the Data API's per-type validators agree). */
export const TYPE_FIELDS: Record<AlertType, ReadonlyArray<AlertConditionField>> = {
    dividend: [...COMPANIES, "kinds", "dividend_types", "amount_change", "yield_rule"],
    earnings_call: [...COMPANIES, "events", "keywords"],
    earnings_call_keyword: [...COMPANIES, "keywords", "match", "scope", "speaker_roles", "min_mentions", "mention_delta_rule"],
    earnings_results: [...ONE_COMPANY, "report_kinds", "yoy_rules"],
    event_countdown: [...ONE_COMPANY, "event", "days_before", "offsets_days", "minutes_before", "time_of_day_minutes", "timezone", "notify_on_date_change"],
    filing: [...COMPANIES, "form_types", "form_categories", "include_amendments", "stage"],
    filing_keyword: [...COMPANIES, "form_types", "keywords", "match", "scope"],
    fundamental_metric: [...ONE_COMPANY, "rules"],
    halt: [...COMPANIES, "statuses", "reason_codes"],
    indicator: [...INSTRUMENT, "interval", "template", "condition", "filters", "evaluation", "frequency"],
    news: [...COMPANIES, "kinds", "sources", "earnings_only"],
    news_keyword: [...COMPANIES, "keywords", "match", "scope", "sources", "earnings_only"],
    price: [...INSTRUMENT, "operator", "level"],
    price_move: [...INSTRUMENT, "direction", "pct", "baseline", "window_minutes"],
    price_reminder: [...INSTRUMENT, "frequency", "at", "time_of_day_minutes", "weekday", "days", "timezone"],
    script: [...INSTRUMENT, "interval", "script_version_id", "inputs", "series_inputs", "nodes", "alert_ids", "evaluation", "frequency"],
    volume_spike: [...INSTRUMENT, "interval", "mode", "multiple", "threshold", "lookback_bars", "baseline_mode", "price_direction"],
};

export type ConditionFieldSpec = FieldSpec & { name: AlertConditionField };

/** A field's spec for one type: the type's own options of a shared enum. */
function specFor(type: AlertType, name: AlertConditionField): ConditionFieldSpec {
    const spec = FIELD_SPECS[name];

    const options = spec.optionsByType?.[type] ?? spec.options;

    return { ...spec, name, ...(options ? { options } : {}) };
}

/** THE map: each type's condition fields with their editor. */
export const CONDITION_FIELDS: Record<AlertType, ReadonlyArray<ConditionFieldSpec>> = Object.fromEntries(
    Object.entries(TYPE_FIELDS).map(([type, names]) => [type, names.map(name => specFor(type as AlertType, name))]),
) as unknown as Record<AlertType, ReadonlyArray<ConditionFieldSpec>>;

/** The indicator's two ways (a template, or a structured condition + filters); the form shows one. */
export const INDICATOR_STRUCTURED_FIELDS: ReadonlyArray<AlertConditionField> = ["condition", "filters"];

// Trigger (`AlertTriggerInput`): the same fields for every type, except two that name their types.

export type TriggerScalarField = Exclude<AlertTriggerField, "active_window">;

export type TriggerFieldSpec = FieldSpec & { name: TriggerScalarField; types?: ReadonlyArray<AlertType> };

export const TRIGGER_FIELDS: ReadonlyArray<TriggerFieldSpec> = [
    { help: "once = the alert becomes triggered after its first fire (default every_time).", kind: "enum", label: "Mode", name: "mode", options: ["once", "every_time"] },
    { help: "Minimum seconds between fires (at most 366 days).", kind: "integer", label: "Cooldown (seconds)", max: 31_622_400, min: 0, name: "cooldown_seconds" },
    { help: "Minimum bars between fires (script / indicator).", kind: "integer", label: "Cooldown (bars)", max: 1_000_000, min: 1, name: "cooldown_bars", types: BAR_ALERT_TYPES },
    { help: "The alert becomes triggered after this many fires.", kind: "integer", label: "Max fires", max: 1_000_000, min: 1, name: "max_fires" },
    { help: "The alert becomes expired then.", kind: "datetime", label: "Expires at", name: "expires_at" },
    { help: "Delete instead of expired (needs Expires at).", kind: "boolean", label: "Delete on expiry", name: "delete_on_expiry" },
    { help: "The alert is scheduled until then.", kind: "datetime", label: "Activate at", name: "activate_at" },
    { help: "No fires until then.", kind: "datetime", label: "Pause until", name: "pause_until" },
    { help: "Price types: when a crossed level arms again.", kind: "enum", label: "Re-arm", name: "rearm", options: ["auto", "cross_back"], types: PRICE_ALERT_TYPES },
    { help: "Price types: hysteresis in percent.", kind: "number", label: "Re-arm distance (%)", max: 100, min: 0, name: "rearm_distance_pct", types: PRICE_ALERT_TYPES },
];

/** The trigger fields a type takes. */
export function triggerFieldsFor(type: AlertType): ReadonlyArray<TriggerFieldSpec> {
    return TRIGGER_FIELDS.filter(field => !field.types || field.types.includes(type));
}

/** `active_window`'s two shapes: `weekly` (days + from / to in a zone) or `every` (anchor, interval, unit, duration). */
export const ACTIVE_WINDOW_DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;

export const ACTIVE_WINDOW_UNITS = ["hours", "days", "weeks"] as const;

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
