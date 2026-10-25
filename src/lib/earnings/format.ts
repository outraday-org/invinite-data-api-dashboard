import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";
import type { EarningsDateStatus, EarningsEvent } from "@/lib/api/types";

import { formatEnDateTime } from "@/lib/date";

type CallTimeFields = Pick<EarningsEvent, "call_time_source" | "scheduled_at" | "tz">;

type FiscalFields = Pick<EarningsEvent, "fiscal_quarter" | "fiscal_year">;

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/**
 * "Oct 29, 2026 · 4:30 PM ET" in the company's timezone; only the date ("Oct 29, 2026")
 * when the start time is unknown (`call_time_source === null`: a date-only event's
 * `scheduled_at` is midnight UTC of its calendar date — read it in UTC, never in `tz`).
 */
export function formatCallTime(event: CallTimeFields) {
    const at = new Date(event.scheduled_at);

    if (Number.isNaN(at.getTime())) return event.scheduled_at;

    const date = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        timeZone: event.call_time_source === null ? "UTC" : event.tz,
        year: "numeric",
    }).format(at);

    if (event.call_time_source === null) return date;

    const time = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: event.tz,
        timeZoneName: "shortGeneric",
    }).format(at).replace(/\u202F/g, " "); // ICU's narrow no-break space before AM / PM

    return `${date} · ${time}`;
}

/** "Q3 FY2026", "FY2026" without a quarter, "—" without a fiscal year. */
export function formatFiscalPeriod(event: FiscalFields) {
    if (event.fiscal_year === null) return "—";

    return event.fiscal_quarter === null
        ? `FY${event.fiscal_year}`
        : `Q${event.fiscal_quarter} FY${event.fiscal_year}`;
}

/**
 * The row label of an event: an earnings call's fiscal period; a non-earnings event (investor day,
 * conference, AGM, other) by its title, else its fiscal period ("—" without either).
 */
export function eventLabel(event: FiscalFields & Pick<EarningsEvent, "event_title" | "event_type">) {
    if (event.event_type === "earnings_call") return formatFiscalPeriod(event);

    return event.event_title?.trim() || formatFiscalPeriod(event);
}

const DATE_STATUS_VARIANTS: Record<EarningsDateStatus, BadgeVariant> = {
    cancelled: "destructive",
    confirmed: "default",
    estimated: "outline",
    postponed: "destructive",
    unconfirmed: "secondary",
};

/** `Badge` variant of a call's `date_status`. */
export function dateStatusVariant(status: EarningsDateStatus): BadgeVariant {
    return DATE_STATUS_VARIANTS[status];
}

/** `m:ss` or `h:mm:ss` of a millisecond position (same output as the admin console's `formatClock`). */
export function formatMs(ms: number) {
    const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;

    const hours = Math.floor(total / 3600);

    const minutes = Math.floor((total % 3600) / 60);

    const seconds = total % 60;

    const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");

    const ss = String(seconds).padStart(2, "0");

    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

const NEW_YORK = "America/New_York";

/** `YYYY-MM-DD` of an instant in an IANA timezone. */
export function zonedDate(at: Date, tz: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "2-digit",
        timeZone: tz,
        year: "numeric",
    }).formatToParts(at);

    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";

    return `${part("year")}-${part("month")}-${part("day")}`;
}

/** `YYYY-MM-DD` plus `days` (calendar arithmetic, no timezone). */
function addDays(date: string, days: number) {
    const at = new Date(`${date}T00:00:00Z`);

    at.setUTCDate(at.getUTCDate() + days);

    return at.toISOString().slice(0, 10);
}

/**
 * `YYYY-MM-DD` the call is on (the pipeline's `eventCalendarDate`): a date-only event's
 * `scheduled_at` is midnight UTC of its calendar date — read it in UTC, never in `tz`; a timed
 * call's date in `tz`.
 */
export function callCalendarDate(event: Pick<EarningsEvent, "call_time_source" | "scheduled_at">, tz: string) {
    const at = new Date(event.scheduled_at);

    return event.call_time_source === null ? zonedDate(at, "UTC") : zonedDate(at, tz);
}

/**
 * A call that has not happened yet: a timed call starts after `now`; a date-only call
 * (`call_time_source === null`) is on or after today in `tz` (`callCalendarDate`).
 */
export function isUpcoming(event: CallTimeFields, now: Date) {
    if (event.call_time_source === null) return callCalendarDate(event, event.tz) >= zonedDate(now, event.tz);

    return new Date(event.scheduled_at).getTime() > now.getTime();
}

/** The call's calendar date (`callCalendarDate`) is today in `tz`. */
export function isCallToday(event: CallTimeFields, now: Date) {
    return callCalendarDate(event, event.tz) === zonedDate(now, event.tz);
}

export type CalendarWindow = { from: string; to: string };

/** The calendar's default window: yesterday … today + 14 days, New York calendar days. */
export function calendarDefaultWindow(now: Date): CalendarWindow {
    const today = zonedDate(now, NEW_YORK);

    return { from: addDays(today, -1), to: addDays(today, 14) };
}

/** `from` / `to` in order (swapped when `from > to`). */
export function orderedWindow<T extends Partial<CalendarWindow>>(window: T): T {
    if (window.from && window.to && window.from > window.to) {
        return { ...window, from: window.to, to: window.from };
    }

    return window;
}

/** The window a calendar request uses: the search's days over the default window, in order. */
export function calendarWindow(search: Partial<CalendarWindow>, now: Date): CalendarWindow {
    const defaults = calendarDefaultWindow(now);

    return orderedWindow({ from: search.from ?? defaults.from, to: search.to ?? defaults.to });
}

/** "started 12 min ago", "started 1 h 05 min ago", "started just now" (clock skew → just now). */
export function formatStartedAgo(startedAt: string, now: Date) {
    const minutes = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000);

    if (!Number.isFinite(minutes) || minutes < 1) return "started just now";

    if (minutes < 60) return `started ${minutes} min ago`;

    return `started ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min ago`;
}

export const SESSION_LABELS: Record<NonNullable<EarningsEvent["session"]>, string> = {
    amc: "After close",
    bmo: "Before open",
    intraday: "Intraday",
};

/** "812 B", "4.2 KB", "38.1 MB" (1024-based); `null` → "—". */
export function formatBytes(bytes: null | number) {
    if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "—";

    if (bytes < 1024) return `${bytes} B`;

    const units = ["KB", "MB", "GB"];

    let value = bytes / 1024;

    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;

        unit += 1;
    }

    return `${value.toFixed(1)} ${units[unit]}`;
}

/** An API timestamp with its time ("Oct 29, 2026, 4:30 PM"), "—" when absent. */
export function formatInstant(value: null | string | undefined) {
    return value ? formatEnDateTime(value, { hideTime: false }) : "—";
}
