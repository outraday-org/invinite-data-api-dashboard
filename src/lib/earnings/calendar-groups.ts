import type { V2Event } from "@/lib/api/types";
import type { CalendarWindow } from "@/lib/earnings/format";

import { callCalendarDate, zonedDate } from "@/lib/earnings/format";

const NEW_YORK = "America/New_York";

export type EventDayGroup<T> = { day: string; events: Array<T> };

/** The New York calendar day an event is grouped under (a date-only event: its stated UTC date). */
export const newYorkCallDay = (event: Pick<V2Event, "call_time_source" | "scheduled_at">) => callCalendarDate(event, NEW_YORK);

/** The viewer's IANA timezone (the browser's; the server's during a server render). */
export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The calendar day of an event in `timeZone` (a date-only event: its stated UTC date, never shifted). */
export const callDayIn = (event: Pick<V2Event, "call_time_source" | "scheduled_at">, timeZone: string) => callCalendarDate(event, timeZone);

/** Today's calendar day in `timeZone`. */
export const todayIn = (now: Date, timeZone: string) => zonedDate(now, timeZone);

/**
 * The calendar's day groups: every event under its New York calendar day (`callCalendarDate`: a timed call's day in
 * New York, a date-only event's stated UTC date — never shifted by a zone), days ascending, the events of a day in the
 * order they came (the API's `scheduled_at` order).
 */
export function groupEventsByNewYorkDay<T extends Pick<V2Event, "call_time_source" | "scheduled_at">>(events: ReadonlyArray<T>): Array<EventDayGroup<T>> {
    return groupEventsByDay(events, NEW_YORK);
}

/** `groupEventsByNewYorkDay` in any timezone (the calendar: the viewer's). */
export function groupEventsByDay<T extends Pick<V2Event, "call_time_source" | "scheduled_at">>(events: ReadonlyArray<T>, timeZone: string): Array<EventDayGroup<T>> {
    const byDay = new Map<string, Array<T>>();

    for (const event of events) {
        const day = callDayIn(event, timeZone);

        const list = byDay.get(day);

        if (list) list.push(event);
        else byDay.set(day, [event]);
    }

    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, events: list }));
}

/** "Mon, Nov 23" (a `YYYY-MM-DD` read as its own calendar day). */
export function dayHeading(day: string) {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC", weekday: "short" }).format(new Date(`${day}T00:00:00Z`));
}

/** A `YYYY-MM-DD` day moved by `days` calendar days. */
export const addDays = (date: string, days: number) => {
    const at = new Date(`${date}T00:00:00Z`);

    at.setUTCDate(at.getUTCDate() + days);

    return at.toISOString().slice(0, 10);
};

export const CALENDAR_PRESETS = ["today", "this-week", "next-week"] as const;

export type CalendarPreset = (typeof CALENDAR_PRESETS)[number];

/** A preset's New York days: today; this week (Monday … Sunday around today); next week. */
export function calendarPresetWindow(preset: CalendarPreset, now: Date): CalendarWindow {
    const today = zonedDate(now, NEW_YORK);

    if (preset === "today") return { from: today, to: today };

    // 0 = Monday … 6 = Sunday.
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;

    const monday = addDays(today, -weekday + (preset === "next-week" ? 7 : 0));

    return { from: monday, to: addDays(monday, 6) };
}

/** The preset a window equals, else null (a hand-picked range). */
export function presetOf(window: CalendarWindow, now: Date): CalendarPreset | null {
    return CALENDAR_PRESETS.find((preset) => {
        const candidate = calendarPresetWindow(preset, now);

        return candidate.from === window.from && candidate.to === window.to;
    }) ?? null;
}

/** The Monday … Sunday days of the week a `YYYY-MM-DD` day falls in. */
export function weekDaysOf(day: string): Array<string> {
    const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

    const monday = addDays(day, -weekday);

    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** The ISO 8601 week number of a `YYYY-MM-DD` day (week 1 holds the year's first Thursday). */
export function isoWeekNumber(day: string) {
    const at = new Date(`${day}T00:00:00Z`);

    // The Thursday of the day's week decides its year.
    at.setUTCDate(at.getUTCDate() + 3 - ((at.getUTCDay() + 6) % 7));

    const firstThursday = new Date(Date.UTC(at.getUTCFullYear(), 0, 4));

    return 1 + Math.round(((at.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
