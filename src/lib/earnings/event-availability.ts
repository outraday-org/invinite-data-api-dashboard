import * as React from "react";

import type { V2Event } from "@/lib/api/types";

export const AVAILABILITY_POLL_MS = 30_000;
export const AVAILABILITY_WINDOW_MS = 10 * 60_000;

const TERMINAL_CALLS = new Set(["cancelled", "no_call", "not_covered", "not_expected", "postponed"]);

export function deniedAvailability(error: unknown): boolean {
    return typeof error === "object" && error !== null && "status" in error
        && (error.status === 401 || error.status === 403 || error.status === 404);
}

export function availabilityInterval(event: Pick<V2Event, "calendar" | "date_status" | "has_transcript">, options: {
    error: unknown;
    nowMs: number;
    untilMs: number;
    visible: boolean;
}): false | number {
    if (!options.visible || options.nowMs >= options.untilMs || deniedAvailability(options.error) || event.has_transcript) return false;

    if (TERMINAL_CALLS.has(event.date_status) || TERMINAL_CALLS.has(event.calendar?.call.status ?? "")) return false;

    return AVAILABILITY_POLL_MS;
}

const subscribeVisibility = (notify: () => void) => {
    document.addEventListener("visibilitychange", notify);

    return () => document.removeEventListener("visibilitychange", notify);
};

/** Visibility never resets an availability budget. */
export function usePageVisible(): boolean {
    return React.useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => false);
}

/** One budget per explicit detail activation or manual refresh, not per row or successful poll. */
export function useEventAvailability(eventId: string) {
    const visible = usePageVisible();
    const [session, setSession] = React.useState(() => ({ eventId, untilMs: Date.now() + AVAILABILITY_WINDOW_MS }));
    const [expired, setExpired] = React.useState(false);

    React.useEffect(() => {
        setSession({ eventId, untilMs: Date.now() + AVAILABILITY_WINDOW_MS });
        setExpired(false);
    }, [eventId]);

    React.useEffect(() => {
        if (!visible) return undefined;

        const timer = setTimeout(() => setExpired(true), Math.max(0, session.untilMs - Date.now()));

        return () => clearTimeout(timer);
    }, [session.untilMs, visible]);

    const restart = React.useCallback(() => {
        setSession({ eventId, untilMs: Date.now() + AVAILABILITY_WINDOW_MS });
        setExpired(false);
    }, [eventId]);

    return { active: !expired && session.eventId === eventId, restart, untilMs: session.untilMs, visible };
}
