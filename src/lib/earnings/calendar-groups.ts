import type { V2Event } from "@/lib/api/types";
import type { CalendarWindow } from "@/lib/earnings/format";

import { callCalendarDate, zonedDate } from "@/lib/earnings/format";

const NEW_YORK = "America/New_York";

export type EventDayGroup<T> = { day: string; events: Array<T> };

/** The New York calendar day an event is grouped under (a date-only event: its stated UTC date). */
export const newYorkCallDay = (event: Pick<V2Event, "call_time_source" | "scheduled_at">) => callCalendarDate(event, NEW_YORK);

/**
 * The calendar's day groups: every event under its New York calendar day (`callCalendarDate`: a timed call's day in
 * New York, a date-only event's stated UTC date — never shifted by a zone), days ascending, the events of a day in the
 * order they came (the API's `scheduled_at` order).
 */
export function groupEventsByNewYorkDay<T extends Pick<V2Event, "call_time_source" | "scheduled_at">>(events: ReadonlyArray<T>): Array<EventDayGroup<T>> {
    const byDay = new Map<string, Array<T>>();

    for (const event of events) {
        const day = newYorkCallDay(event);

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

const addDays = (date: string, days: number) => {
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
