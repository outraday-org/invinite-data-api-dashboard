import type { Alert, AlertEvent, AlertEventsResponse } from "@/lib/api/types";

import { MACRO_ALERT_SERIES } from "@/lib/api/operations.gen";
import { shouldLoadNextPage } from "@/lib/api/use-auto-load-pages";
import { isRecord } from "@/lib/guards";

import type { MacroFamily } from "./macro-condition";

import { alertEventTypeLabel } from "./labels";
import { familyLabels, isMacroSeries } from "./macro-condition";

/**
 * Pure view helpers of the alerts pages (tested): what an alert watches in one line, an event in one line, and the
 * event list newest first (the API lists events oldest first: the loaded pages are re-ordered, the live ones joined).
 */

const strings = (value: unknown): Array<string> => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/** Subjects shown by name before "+N". */
const TARGETS_SHOWN = 3;

/**
 * What an alert watches: its one symbol / CIK, or the companies of its condition ("AAPL, MSFT, NVDA +1"); no company
 * named = every company (a `dividend` / `earnings_call` alert may watch all).
 */
export function alertTarget(alert: Pick<Alert, "cik" | "condition" | "symbol">): string {
    const condition = isRecord(alert.condition) ? alert.condition : {};

    if (Array.isArray(condition.macro_events)) {
        if (isRecord(condition.macro_threshold) && isMacroSeries(condition.macro_threshold.series_id)) return MACRO_ALERT_SERIES[condition.macro_threshold.series_id].label;

        const ids = strings(condition.macro_series_ids).filter(isMacroSeries);

        if (ids.length) return ids.map(id => MACRO_ALERT_SERIES[id].label).join(", ");

        return strings(condition.macro_families).map(f => Object.hasOwn(familyLabels, f) ? familyLabels[f as MacroFamily] : f).join(", ") || "All US macro series";
    }

    const one = alert.symbol ?? (typeof condition.symbol === "string" ? condition.symbol : null);

    if (one) return one;

    const names = [...strings(condition.symbols), ...strings(condition.ciks).map(cik => `CIK ${cik}`)];

    if (names.length === 0) {
        const cik = alert.cik ?? (typeof condition.cik === "string" ? condition.cik : null);

        return cik ? `CIK ${cik}` : "Every company";
    }

    return names.length > TARGETS_SHOWN ? `${names.slice(0, TARGETS_SHOWN).join(", ")} +${names.length - TARGETS_SHOWN}` : names.join(", ");
}

/** Whether an event was sent by "Send test event" (`payload.test`). */
export function isTestEvent(event: Pick<AlertEvent, "payload">) {
    return isRecord(event.payload) && event.payload.test === true;
}

/** One line of an event: the fire's `reason.summary`, a status change's from → to, else the type in words. */
export function eventSummary(event: Pick<AlertEvent, "payload" | "type">): string {
    const payload = isRecord(event.payload) ? event.payload : {};

    const reason = payload.reason;

    if (isRecord(reason) && typeof reason.summary === "string" && reason.summary) {
        const details = reason.details;

        if (isRecord(details) && typeof details.release_id === "string" && typeof details.version === "number")
            return `${reason.summary} · ${details.release_id} · version ${details.version}`;

        return reason.summary;
    }

    if (typeof payload.from === "string" && typeof payload.to === "string") return `${payload.from} → ${payload.to}`;

    return alertEventTypeLabel(event.type);
}

/** Newest first, one row per id (a live event the REST pages also hold is shown once). */
export function eventsNewestFirst(pages: ReadonlyArray<Pick<AlertEventsResponse, "data">>, live: ReadonlyArray<AlertEvent> = []): Array<AlertEvent> {
    const byId = new Map<string, AlertEvent>();

    for (const event of [...pages.flatMap(page => page.data), ...live]) byId.set(event.id, event);

    return [...byId.values()].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id));
}

/** The newest event id of the loaded pages (the live subscription's `after`: missed events are replayed from it). */
export function newestEventId(pages: ReadonlyArray<Pick<AlertEventsResponse, "data">>): string | undefined {
    return eventsNewestFirst(pages).at(0)?.id;
}

/** Pages an event list loads by itself (the API lists oldest first: the newest events are on the last page). */
export const EVENT_PAGES_AUTO = 10;

/**
 * Whether an event list should load its next (newer) page by itself: `shouldLoadNextPage` with fewer than `max` pages
 * loaded — at most `max` billed pages (1 credit each) per view; then "Load more". `useEventList` runs it
 * (`useAutoLoadPages`); the events page reads it to know the list settled.
 */
export function shouldAutoLoad(state: { hasNextPage: boolean; isFetching: boolean; nextPageFailed: boolean; pageCount: number }, max = EVENT_PAGES_AUTO) {
    const { pageCount, ...rest } = state;

    return shouldLoadNextPage({ ...rest, pagesLoaded: pageCount }, max);
}

/** What the loaded pages of an oldest-first event list cover, for the note above it. */
export function loadedEventsNote(count: number, hasNextPage: boolean): null | string {
    if (count === 0) return null;

    if (!hasNextPage) return count === 1 ? "The only event." : `All ${count} events, newest first.`;

    return `${count} events loaded, newest of them first. The API lists events oldest first and more recent ones exist: Load more.`;
}
