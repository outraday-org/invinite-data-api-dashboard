/**
 * The dashboard's one formatter module: one format per kind of value, English, everywhere.
 *
 * - a day ("Oct 29, 2026"): `formatDay` — a date-only string is its calendar day (never shifted by a timezone);
 * - a moment ("Oct 29, 2026, 4:30 PM EDT"): `formatInstant` — the viewer's timezone, with its label;
 * - money by magnitude ("$3.95T", "$812.4M"): `formatMoneyCompact`; exact money ("$0.2500"): `formatMoney`;
 * - share counts ("15,204,137,000"): `formatShares`; any other count: `formatNumber`;
 * - a fiscal year end ("Sep 30"): `fiscalYearEndText`.
 *
 * Absent or unparsable values are "—" (an unparsable string is shown as given).
 */

import { formatNumberEn } from "@/lib/utils";

export const DASH = "—";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type Absent = null | undefined;

/** A date-only string's calendar day as a UTC date (so formatting in UTC never shifts it). */
function parseDay(value: string): Date {
    return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
}

/** "Oct 29, 2026". A date-only string is its own calendar day; a timestamp is its day in `timeZone` (default: the viewer's). */
export function formatDay(value: Absent | string, timeZone?: string): string {
    if (!value) return DASH;

    const parsed = parseDay(value);

    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        timeZone: DATE_ONLY.test(value) ? "UTC" : timeZone,
        year: "numeric",
    }).format(parsed);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A fiscal year end `MM-DD` ("09-30") → "Sep 30"; anything else as answered, none = "—". */
export function fiscalYearEndText(value: Absent | string): string {
    const match = value ? /^(\d{2})-(\d{2})$/.exec(value) : null;

    const month = match ? MONTHS[Number(match[1]) - 1] : undefined;

    if (!match || !month) return value || DASH;

    return `${month} ${Number(match[2])}`;
}

/** "Oct 29, 2026, 4:30 PM EDT" in `timeZone` (default: the viewer's), with the zone's label; a date-only string → `formatDay`. */
export function formatInstant(value: Absent | string, timeZone?: string): string {
    if (!value) return DASH;

    if (DATE_ONLY.test(value)) return formatDay(value);

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        timeZone,
        timeZoneName: "short",
        year: "numeric",
    }).format(parsed).replace(/\u202F/g, " "); // ICU's narrow no-break space before AM / PM
}

const GMT_OFFSET = /^GMT[+-]/;

/** A zone's short name at `date`: `en-US` knows the American ones ("EST"), `en-GB` the European ones ("CET"); else the offset. */
function shortZoneName(date: Date, timeZone: string | undefined): string {
    const name = (locale: string) => new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
        .formatToParts(date)
        .find(part => part.type === "timeZoneName")?.value ?? "";

    const american = name("en-US");

    if (!GMT_OFFSET.test(american)) return american;

    const british = name("en-GB");

    return GMT_OFFSET.test(british) || !british ? american : british;
}

/**
 * "1:00 PM CET" in `timeZone` (default: the viewer's): the time with the zone's short name, for narrow lists (a long
 * zone name wrapped times onto a second line). A zone without a short name shows its offset ("GMT+5:30"); a date-only
 * string → `formatDay`. `formatInstant` stays the full form.
 */
export function formatInstantShort(value: Absent | string, timeZone?: string): string {
    if (!value) return DASH;

    if (DATE_ONLY.test(value)) return formatDay(value);

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return value;

    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(parsed).replace(/\u202F/g, " ");

    return `${time} ${shortZoneName(parsed, timeZone)}`;
}

/**
 * "Nov 2, 2026 · 11:00 PM CET": the day and `formatInstantShort`'s time, in `timeZone` (default: the viewer's) — a list
 * row's moment on one line (F13); a date-only string → `formatDay`.
 */
export function formatDayTimeShort(value: Absent | string, timeZone?: string): string {
    if (!value) return DASH;

    if (DATE_ONLY.test(value) || Number.isNaN(new Date(value).getTime())) return formatDay(value, timeZone);

    return `${formatDay(value, timeZone)} · ${formatInstantShort(value, timeZone)}`;
}

const COMPACT_STEPS: ReadonlyArray<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
];

/** "$3.95T", "$812.4M", "$12.5K", "$950" — the unit by magnitude (US dollars unless `currency` says otherwise). */
export function formatMoneyCompact(value: Absent | number, currency = "USD"): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return DASH;

    const magnitude = Math.abs(value);

    const step = COMPACT_STEPS.find(([size]) => magnitude >= size);

    const symbol = currencySymbol(currency);

    const sign = value < 0 ? "-" : "";

    if (!step) return `${sign}${symbol}${formatNumber(magnitude, { maximumFractionDigits: 2 })}`;

    const [size, unit] = step;

    const scaled = magnitude / size;

    return `${sign}${symbol}${formatNumber(scaled, { maximumFractionDigits: 2 })}${unit}`;
}

/** The currency's narrow symbol ("$"), else the code and a space ("CHF "). */
function currencySymbol(currency: string): string {
    try {
        const part = new Intl.NumberFormat("en-US", { currency, currencyDisplay: "narrowSymbol", style: "currency" })
            .formatToParts(0)
            .find(entry => entry.type === "currency");

        return part?.value ?? `${currency} `;
    }
    catch {
        return `${currency} `;
    }
}

/** Exact money ("$1,234.50"); `maximumFractionDigits` for per-share amounts (a dividend keeps up to 4). */
export function formatMoney(value: Absent | number, { currency = "USD", maximumFractionDigits = 2 }: { currency?: string; maximumFractionDigits?: number } = {}): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return DASH;

    try {
        return new Intl.NumberFormat("en-US", {
            currency,
            maximumFractionDigits,
            minimumFractionDigits: Math.min(2, maximumFractionDigits),
            style: "currency",
        }).format(value);
    }
    catch {
        return formatNumber(value, { maximumFractionDigits });
    }
}

/** A share count, whole shares grouped ("15,204,137,000"); fractional shares keep up to 4 decimals. */
export function formatShares(value: Absent | number): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return DASH;

    return formatNumber(value, { maximumFractionDigits: 4 });
}

/** Any other count or number, grouped in English ("1,234"). */
export function formatNumber(value: Absent | number, options?: Intl.NumberFormatOptions): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return DASH;

    return formatNumberEn(value, options);
}
