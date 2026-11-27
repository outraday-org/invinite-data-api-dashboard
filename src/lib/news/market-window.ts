import { addDays, zonedDate } from "@/lib/earnings/format";

type WindowDays = { from?: string; to?: string };

const NY = "America/New_York";

const DAY = 86_400_000;

const nyClock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", minute: "2-digit", second: "2-digit", timeZone: NY });

export const marketToday = (now = new Date()) => zonedDate(now, NY);

/** The market's lower bound advances at New York midnight only when both date filters are omitted. */
export function marketWindowAnchor({ from, to }: WindowDays, market: boolean) {
    return market && !from && !to ? marketToday() : null;
}

/** UTC midnight falls the previous New York evening, before any DST change on the requested day. */
function nyMidnight(day: string) {
    const utc = Date.parse(`${day}T00:00:00Z`);

    const clock = nyClock.format(utc);

    return new Date(utc + DAY - Date.parse(`1970-01-01T${clock}Z`)).toISOString();
}

export function marketWindowBounds({ from, to }: WindowDays) {
    return { gte: from ? nyMidnight(from) : undefined, lt: to ? nyMidnight(addDays(to, 1)) : undefined };
}
export function marketWindowProblem({ from, to }: WindowDays, today = marketToday()) {
    const end = to && to < today ? to : today;

    return from && ((to && from > to) || from < addDays(end, -6)) ? "The every-company list covers at most 7 days (the last 7 by default)." : null;
}
export function newsSearchWindowProblem({ from, to }: WindowDays, now = new Date()) {
    const upper = to ? Date.parse(`${addDays(to, 1)}T00:00:00Z`) : now.getTime();

    const lower = from ? Date.parse(`${from}T00:00:00Z`) : upper - 365 * DAY;

    if (lower >= upper) return "Choose a start date before the end of the search window.";

    return upper - lower > 731 * DAY ? "News search covers at most 731 days." : null;
}
/** Compare the frame's publication day with the actual list window, including an upper-only historical market week. */
export function inNewsWindow(publishedAt: string, { from, to }: WindowDays, market: boolean, today = marketToday()) {
    const instant = new Date(publishedAt);

    if (!Number.isFinite(instant.getTime())) return false;

    const day = market ? zonedDate(instant, NY) : instant.toISOString().slice(0, 10);

    const lower = from ?? (market ? addDays(to ?? today, -6) : undefined);

    return (!lower || day >= lower) && (!to || day <= to);
}
