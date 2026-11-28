import type { AlertConditionField, AlertTriggerField, AlertType } from "@/lib/api/types";

import { ALERT_TYPE_FIELDS } from "@/lib/api/operations.gen";

import type { AlertField } from "../../../scripts/alert-fields.mjs";

export type FieldKind = "template" | "time-of-day" | "weekday" | "weekday-list" | AlertField["kind"];

export type FieldSpec = {
    help: string;
    kind: FieldKind;
    label: string;
    max?: number;
    maxItems?: number;
    min?: number;
    options?: ReadonlyArray<string>;
    placeholder?: string;
    required?: boolean;
    splitOnCommasOnly?: boolean;
};

type Presentation = Partial<Pick<FieldSpec, "help" | "kind" | "label" | "placeholder" | "splitOnCommasOnly">>;

/** Presentation only. Applicability, shape, required fields, options and bounds come from ALERT_TYPE_FIELDS. */
export const FIELD_SPECS: Partial<Record<AlertConditionField, Presentation>> = {
    alert_ids: { help: "Only these of the script's alerts (its version's alert ids); empty = all.", label: "Script alert ids" },
    amount_change: { help: "Only a dividend whose amount moved by at least min_pct percent (direction raise / cut / any).", label: "Amount change", placeholder: "{\"direction\": \"raise\", \"min_pct\": 5}" },
    asset_class: { help: "us_stock (US stocks and ETFs), crypto (a coin by slug or ticker) or commodity (XAUUSD / XAGUSD). Empty = a stock first, then a coin.", label: "Asset class" },
    at: { help: "The instant of a once reminder.", kind: "datetime", label: "At" },
    baseline: { help: "What the move is measured from (ignored with a window); gap_open = the open against the prior close, once per session.", label: "Baseline" },
    baseline_mode: { help: "The volume baseline: mean or median of the previous bars, or rvol_slot = the same time-of-day bar of earlier sessions (default flat_mean).", label: "Baseline mode" },
    cik: { help: "The company by CIK (1–10 digits).", label: "CIK" },
    ciks: { help: "Companies by CIK (with symbols at most 100 in all).", label: "CIKs" },
    codes: { help: "Match SEC transaction codes, such as P for a purchase or S for a sale.", label: "SEC transaction codes" },
    condition: { help: "A structured trigger lhs <comparator> rhs at each bar close (instead of a template).", label: "Structured condition", placeholder: "{\"lhs\": {\"kind\": \"indicator\", \"indicator_id\": \"rsi\", \"series_key\": \"rsi\"}, \"comparator\": \"crossing_up\", \"rhs\": {\"kind\": \"value\", \"value\": 30}}" },
    crossing: { help: "Up or down across the percent threshold, compared with a known matched prior reporting person.", label: "Crossing" },
    days: { help: "Several weekdays of a daily / weekly reminder.", kind: "weekday-list", label: "Days" },
    days_before: { help: "Days before the event (0 = on the day).", label: "Days before" },
    direction: { help: "Which move fires.", label: "Direction" },
    dividend_types: { help: "Only these dividend types.", label: "Dividend types" },
    earnings_only: { help: "Only earnings news.", label: "Earnings news only" },
    evaluation: { help: "When it evaluates: bar_close (default) or pre_close = offset_minutes before the US session close.", label: "Evaluation", placeholder: "{\"kind\": \"pre_close\", \"offset_minutes\": 15}" },
    event: { help: "The event counted down to.", label: "Event" },
    events: { help: "Call lifecycle events (transcript_provisional / transcript_corrected / documents_updated need PRO; guidance_flash / keyword_hit PRO).", label: "Events" },
    filters: { help: "State filters that gate the structured condition (at most 4 comparisons, two levels).", label: "Filters", placeholder: "{\"op\": \"and\", \"children\": []}" },
    form_categories: { help: "Form categories.", label: "Form categories" },
    form_types: { help: "Raw SEC form types (8-K, S-1).", label: "Form types" },
    frequency: { help: "Reminder: once at At, hourly, daily or weekly. Script / indicator: when its alerts deliver (default once_per_bar_close).", label: "Frequency" },
    include_amendments: { help: "Also amendments (/A).", label: "Include amendments" },
    include_derivatives: { help: "Include derivative transactions (default no).", label: "Include derivatives" },
    inputs: { help: "Values for the script's declared inputs (absent = the defaults).", label: "Script inputs", placeholder: "{\"length\": 14}" },
    interval: { help: "The bar evaluated at its close. Script / indicator: the plan's shortest is FREE / LITE 1h, STANDARD 5m, PRO 1m.", label: "Interval" },
    is_spac: { help: "Leave unset for either; a yes/no filter requires a known SPAC classification.", label: "SPAC" },
    keywords: { help: "Whole-word, case-insensitive keywords (2–50 characters), one per line or comma.", label: "Keywords", splitOnCommasOnly: true },
    kinds: { help: "News: the news kinds. Dividend: declared / ex_date / payment.", label: "Kinds" },
    level: { help: "The price level (> 0).", label: "Level" },
    lookback_bars: { help: "Bars in the baseline, 5–200 (rvol_slot: sessions, 2–20).", label: "Lookback bars" },
    macro_events: { help: "Choose releases, revisions, or both.", label: "Publication events" },
    macro_families: { help: "An empty selection includes all four families.", label: "Macro families" },
    macro_series_ids: { help: "An empty selection includes every series in the selected families.", label: "Series and tenors" },
    macro_threshold: { help: "Match a published value or change.", label: "Numeric threshold" },
    managers: { help: "13F filing managers by CIK (1–10 digits, at most 100).", label: "Manager CIKs" },
    match: { help: "Any or all keywords (default any).", label: "Match" },
    mention_delta_rule: { help: "Mentions moved against the previous call (direction up / down / either, min_delta).", label: "Mention change", placeholder: "{\"direction\": \"up\", \"min_delta\": 3}" },
    min_change_pct: { help: "Absolute share change against a positive known prior holding; a complete sold-out has zero current shares.", label: "Minimum share change (%)" },
    min_market_value_usd: { help: "Form 144 proposed-sale value only; unknown totals cannot meet the minimum.", label: "Minimum proposed value (USD)" },
    min_mentions: { help: "Fire at this many mentions.", label: "Minimum mentions" },
    min_percent_of_class: { help: "An inclusive minimum, or the threshold crossed when Crossing is set.", label: "Percent of class threshold" },
    min_value_usd: { help: "Insiders: absolute shares × price; holder changes: current value, or prior value for a sold-out position. Unknown values cannot meet the minimum.", label: "Minimum value (USD)" },
    minutes_before: { help: "Minutes before the call starts (event earnings_call only).", label: "Minutes before" },
    mode: { help: "relative = a closed bar's volume ≥ multiple × its baseline; absolute = ≥ threshold; session = today's volume ≥ multiple × the 20-session average.", label: "Mode" },
    multiple: { help: "Volume multiple of the baseline (relative / session).", label: "Multiple" },
    nodes: { help: "Producer scripts a script chain reads (producers first).", label: "Script nodes", placeholder: "[]" },
    notify_on_date_change: { help: "Tell when the event date moves (default yes).", label: "Notify on date change" },
    offsets_days: { help: "A ladder of days before (comma list, 0–90).", label: "Offsets (days)" },
    operator: { help: "crosses_* fire when the price crosses the level; above / below also fire at once when it is already on that side.", label: "Operator" },
    owners: { help: "Reporting persons by CIK (1–10 digits, at most 100).", label: "Owner CIKs" },
    pct: { help: "The move in percent of the baseline.", label: "Move (%)" },
    price_direction: { help: "Only bars that closed up / down (default any).", label: "Price direction" },
    reason_codes: { help: "Only these halt reason codes.", label: "Reason codes" },
    relationships: { help: "Match proposed sellers' relationships, such as Officer or Director.", label: "Seller relationships" },
    report_kinds: { help: "Results reports to fire on.", label: "Report kinds" },
    roles: { help: "The same matching transaction must name one of these roles.", label: "Insider roles" },
    rules: { help: "AND-combined metric thresholds (1–5; metric ids of GET /v1/catalog/metrics, value a decimal string).", label: "Rules", placeholder: "[{\"metric_id\": \"is_total_revenue\", \"period_type\": \"quarterly\", \"operator\": \"gt\", \"value\": \"1000000000\"}]" },
    schedule: { help: "13D or 13G; leave unset to include both.", label: "Ownership schedule" },
    scope: { help: "Where keywords are searched.", label: "Scope" },
    script_version_id: { help: "The script version evaluated (scv_…, status ok, of a script of this account).", label: "Script version id" },
    series_inputs: { help: "A script chain: what feeds each externalSeries input, by input key.", label: "Series inputs", placeholder: "{}" },
    sides: { help: "Acquired means buy; disposed means sell, using the filing's own code.", label: "Transaction sides" },
    sources: { help: "News sources.", label: "Sources" },
    speaker_roles: { help: "Only these speakers.", label: "Speaker roles" },
    stage: { help: "detected = the moment the SEC publishes it (every filer); processed = after Invinite's processing.", label: "Stage" },
    stages: { help: "Choose the IPO registration stages to follow.", label: "IPO stages" },
    statuses: { help: "Halt or resumption (empty = both).", label: "Statuses" },
    symbol: { help: "The company by ticker; price types, script and indicator: the instrument (a US stock / ETF ticker, a crypto slug or ticker, XAUUSD / XAGUSD).", label: "Symbol" },
    symbols: { help: "Companies by ticker (a US ETF ticker for the types that take ETFs); with CIKs at most 100 in all.", label: "Symbols" },
    template: { help: "A built-in indicator template and its inputs (GET /v1/alert-templates).", kind: "template", label: "Template" },
    threshold: { help: "Bar volume threshold, > 0 (absolute mode).", label: "Threshold" },
    time_of_day_minutes: { help: "Local time the reminder fires (countdown default 09:00).", kind: "time-of-day", label: "Time of day" },
    timezone: { help: "IANA time zone (default America/New_York).", label: "Time zone" },
    weekday: { help: "Day of a weekly reminder.", kind: "weekday", label: "Weekday" },
    window_minutes: { help: "Measure the move against the price this many minutes ago instead of the baseline.", label: "Window (minutes)" },
    yield_rule: { help: "Only when the yield (percent) is above / below.", label: "Yield rule", placeholder: "{\"comparator\": \"above\", \"pct\": 4}" },
    yoy_rules: { help: "Year-over-year growth gates (signed percent; at most 2).", label: "YoY rules", placeholder: "[{\"metric\": \"eps\", \"comparator\": \"above\", \"pct\": 10}]" },
};

const TRIGGER_PRESENTATION: Partial<Record<AlertTriggerField, Presentation>> = {
    cooldown_bars: { label: "Cooldown (bars)" },
    cooldown_seconds: { label: "Cooldown (seconds)" },
    max_fires: { label: "Max fires" },
    mode: { label: "Mode" },
    rearm: { label: "Re-arm" },
    rearm_distance_pct: { label: "Re-arm distance (%)" },
};

export const fieldLabel = (name: string) => name.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());

/** Usable defaults cover newly added schema fields without another applicability table. */
export function presentField(field: AlertField, presentation: Presentation = {}): FieldSpec {
    return {
        help: field.description,
        kind: field.kind,
        label: fieldLabel(field.name),
        max: field.max,
        maxItems: field.maxItems,
        min: field.min,
        options: field.enum,
        required: field.required,
        ...presentation,
    };
}

const TYPE_PRESENTATION: Partial<Record<AlertType, Partial<Record<AlertConditionField, Presentation>>>> = {
    beneficial_ownership: {
        include_amendments: { help: "Include Schedule 13D / 13G amendments (default yes)." },
    },
    holder_change: {
        kinds: { help: "Choose new, increased, decreased or sold-out positions.", label: "Position changes" },
        min_value_usd: { help: "Current position value, or prior value for a sold-out position. An unknown value cannot meet the minimum." },
    },
    insider_trade: {
        min_value_usd: { help: "Absolute shares × price on the same matching transaction. An unknown price cannot meet the minimum." },
    },
};

export type ConditionFieldSpec = FieldSpec & { name: AlertConditionField };

export function conditionFieldsFor(type: AlertType): ReadonlyArray<ConditionFieldSpec> {
    return ALERT_TYPE_FIELDS[type].condition.map(field => ({ ...presentField(field, { ...FIELD_SPECS[field.name], ...TYPE_PRESENTATION[type]?.[field.name] }), name: field.name }));
}

export const CONDITION_FIELDS = Object.fromEntries(Object.keys(ALERT_TYPE_FIELDS).map(type => [type, conditionFieldsFor(type as AlertType)])) as Record<AlertType, ReadonlyArray<ConditionFieldSpec>>;

export const TYPE_FIELDS: Record<string, ReadonlyArray<AlertConditionField>> = Object.fromEntries(Object.entries(CONDITION_FIELDS).map(([type, fields]) => [type, fields.map(field => field.name)]));

export const INDICATOR_STRUCTURED_FIELDS: ReadonlyArray<AlertConditionField> = ["condition", "filters"];

export type TriggerScalarField = Exclude<AlertTriggerField, "active_window">;
export type TriggerFieldSpec = FieldSpec & { name: TriggerScalarField };

export function triggerFieldsFor(type: AlertType): ReadonlyArray<TriggerFieldSpec> {
    return ALERT_TYPE_FIELDS[type].trigger.filter(field => field.name !== "active_window").map(field => ({ ...presentField(field, TRIGGER_PRESENTATION[field.name]), name: field.name }));
}

// The active-window editor also gets its choices from the generated trigger schema.
export const ACTIVE_WINDOW_DAYS = ALERT_TYPE_FIELDS.filing.requestSchema.properties.trigger.properties.active_window.properties.days.items.enum;
export const ACTIVE_WINDOW_UNITS = ALERT_TYPE_FIELDS.filing.requestSchema.properties.trigger.properties.active_window.properties.unit.enum;
export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
