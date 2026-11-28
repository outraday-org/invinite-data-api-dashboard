import type { AlertBatchResult, AlertEventType, AlertStatus, AlertType } from "@/lib/api/types";

/**
 * Words of the alerts area (backend tasks/data-api-dashboard 2-alerts task 2): the 23 alert types in 10 groups with one
 * line on what fires, the statuses, the event types. Every list is compile-time exhaustive over the contract enum
 * (`satisfies` + the `*_COMPLETE` checks), and `labels.test.ts` compares them with `openapi.json`.
 */

export type AlertTypeInfo = { label: string; summary: string };

/** One line per type: what fires (the spec's `AlertConditionInput` descriptions, shortened). */
export const ALERT_TYPE_INFO: Record<AlertType, AlertTypeInfo> = {
    beneficial_ownership: { label: "Beneficial ownership", summary: "A Schedule 13D or 13G reporting person matches ownership or crossing thresholds." },
    dividend: { label: "Dividend", summary: "A company declares a dividend, or its ex-date / payment day arrives." },
    earnings_call: { label: "Earnings call", summary: "A call is scheduled, starts, ends, or its transcript and assets are ready." },
    earnings_call_keyword: { label: "Earnings call keyword", summary: "Keywords are said on a call (prepared remarks or Q&A)." },
    earnings_results: { label: "Earnings results", summary: "A company reports results, optionally gated by EPS / revenue growth." },
    event_countdown: { label: "Event countdown", summary: "Days (or minutes) before an earnings call, ex-dividend day or dividend payment." },
    filing: { label: "SEC filing", summary: "A company files a form (by form type or category) — on detection or once processed." },
    filing_keyword: { label: "Filing keyword", summary: "Keywords appear in a filing (whole text, risk factors, MD&A, legal proceedings)." },
    fundamental_metric: { label: "Fundamental metric", summary: "A reported metric crosses a threshold (up to 5 rules, all must hold)." },
    halt: { label: "Trading halt", summary: "A company's stock is halted or resumes trading." },
    holder_change: { label: "Holder change", summary: "A manager reports a matching position change in a stock or fund." },
    indicator: { label: "Indicator", summary: "A built-in indicator template or a structured condition fires at a bar close." },
    insider_sale_notice: { label: "Insider sale notice", summary: "A Form 144 proposes a sale matching value and relationship filters." },
    insider_trade: { label: "Insider trade", summary: "A reported transaction matches side, owner, role and value filters." },
    ipo_stage: { label: "IPO stage", summary: "An IPO enters a non-trading registration stage." },
    macro: { label: "US macro", summary: "An agency publishes or revises an economic reading, optionally matching a numeric threshold." },
    news: { label: "News", summary: "A news item about the companies arrives (by kind and source)." },
    news_keyword: { label: "News keyword", summary: "Keywords appear in a news headline or description." },
    price: { label: "Price level", summary: "The price crosses, or is above / below, a level." },
    price_move: { label: "Price move", summary: "The price moves by a percentage from a baseline or within a window." },
    price_reminder: { label: "Price reminder", summary: "The current price, once or on a schedule." },
    script: { label: "Script", summary: "One of your uploaded chartlang scripts raises an alert." },
    volume_spike: { label: "Volume spike", summary: "A bar's volume reaches a multiple of its baseline or a threshold." },
};

export type AlertTypeGroup = { label: string; types: ReadonlyArray<AlertType> };

/** The type picker's groups, in display order (every type exactly once: `labels.test.ts`). */
export const ALERT_TYPE_GROUPS: ReadonlyArray<AlertTypeGroup> = [
    { label: "Filings", types: ["filing", "filing_keyword"] },
    { label: "Ownership", types: ["insider_trade", "holder_change", "beneficial_ownership", "insider_sale_notice"] },
    { label: "IPOs", types: ["ipo_stage"] },
    { label: "News", types: ["news", "news_keyword"] },
    { label: "Earnings", types: ["earnings_call", "earnings_call_keyword", "earnings_results"] },
    { label: "Corporate actions", types: ["dividend", "halt", "event_countdown"] },
    { label: "US macro", types: ["macro"] },
    { label: "Fundamentals", types: ["fundamental_metric"] },
    { label: "Price", types: ["price", "price_move", "volume_spike", "price_reminder"] },
    { label: "Indicators & scripts", types: ["indicator", "script"] },
];

/** Every type, in the picker's order. */
export const ALERT_TYPES = ALERT_TYPE_GROUPS.flatMap(group => group.types);

/** The price types (`symbol` + `asset_class`; `rearm` / `rearm_distance_pct` of the trigger). */
export const PRICE_ALERT_TYPES: ReadonlyArray<AlertType> = ["price", "price_move", "volume_spike", "price_reminder"];

/** The bar types (`cooldown_bars` of the trigger). */
export const BAR_ALERT_TYPES: ReadonlyArray<AlertType> = ["indicator", "script"];

export const alertTypeLabel = (type: string) => (Object.hasOwn(ALERT_TYPE_INFO, type) ? ALERT_TYPE_INFO[type as AlertType].label : type);

export const ALERT_STATUSES = ["active", "paused", "scheduled", "triggered", "expired", "disabled"] as const satisfies ReadonlyArray<AlertStatus>;

type MissingStatus = Exclude<AlertStatus, (typeof ALERT_STATUSES)[number]>;

export const ALERT_STATUSES_COMPLETE: MissingStatus extends never ? true : never = true;

export type StatusTone = "default" | "destructive" | "outline" | "secondary";

/** A status in words, its badge tone and what it means. */
export const ALERT_STATUS_INFO: Record<AlertStatus, { label: string; meaning: string; tone: StatusTone }> = {
    active: { label: "Active", meaning: "Watching; fires when its condition holds.", tone: "default" },
    disabled: { label: "Disabled", meaning: "Switched off by the platform (the reason is shown).", tone: "destructive" },
    expired: { label: "Expired", meaning: "Its expiry time passed; it never fires again.", tone: "outline" },
    paused: { label: "Paused", meaning: "Not firing until resumed.", tone: "secondary" },
    scheduled: { label: "Scheduled", meaning: "Starts at its activation time.", tone: "secondary" },
    triggered: { label: "Triggered", meaning: "Reached its last fire (once / max fires); resume arms it again.", tone: "outline" },
};

/** An alert enum value in words, as the form's options show it ("prior_close" → "prior close"). */
export function enumWords(value: string) {
    return value.replaceAll("_", " ");
}

/** `disabled_reason` in words (an unknown reason is shown as stated). */
export function disabledReasonText(reason: null | string) {
    if (!reason) return null;

    if (reason === "script_error") return "Its script aborted on 3 bars in a row.";

    return reason.replaceAll("_", " ");
}

/** Which row actions a status offers: pause an active / scheduled alert, resume a paused / triggered one. */
export function canPause(status: AlertStatus) {
    return status === "active" || status === "scheduled";
}

export function canResume(status: AlertStatus) {
    return status === "paused" || status === "triggered";
}

export const ALERT_EVENT_TYPES = [
    "alert.fired",
    "alert.status_changed",
    "destination.disabled",
    "destination.test",
    "account.fire_cap_reached",
    "alert_user.fire_cap_reached",
] as const satisfies ReadonlyArray<AlertEventType>;

type MissingEventType = Exclude<AlertEventType, (typeof ALERT_EVENT_TYPES)[number]>;

export const ALERT_EVENT_TYPES_COMPLETE: MissingEventType extends never ? true : never = true;

export const ALERT_EVENT_TYPE_LABELS: Record<AlertEventType, string> = {
    "account.fire_cap_reached": "Account fire cap reached",
    "alert.fired": "Alert fired",
    "alert.status_changed": "Status changed",
    "alert_user.fire_cap_reached": "End-user fire cap reached",
    "destination.disabled": "Destination disabled",
    "destination.test": "Destination test",
};

export const alertEventTypeLabel = (type: string) => (Object.hasOwn(ALERT_EVENT_TYPE_LABELS, type) ? ALERT_EVENT_TYPE_LABELS[type as AlertEventType] : type);

/** One item's answer of a bulk request: `batchAlerts` (`AlertBatchResult`) or `batchAlertUsers` (A4). */
export type BatchItemResult = Pick<AlertBatchResult, "error" | "index" | "ok"> & { result: null | string };

/** A batch item's outcome in words ("Paused", "Refused: not_found — …"). */
export function batchResultText<TResult extends BatchItemResult>(result: TResult) {
    if (result.ok) return result.result ? result.result.charAt(0).toUpperCase() + result.result.slice(1) : "Done";

    return result.error ? `Refused: ${result.error.code} — ${result.error.detail}` : "Refused";
}

/** The docs group of the alert operations in `/v1/me`'s `allowed_families` (the plan gate). */
export const ALERTS_FAMILY = "Alerts";

/** Whether the key's plan reaches the alert operations (`/v1/me` `allowed_families` holds the docs group "Alerts"). */
export function plansAlerts(me: null | { allowed_families: ReadonlyArray<string> }) {
    return me === null || me.allowed_families.includes(ALERTS_FAMILY);
}
