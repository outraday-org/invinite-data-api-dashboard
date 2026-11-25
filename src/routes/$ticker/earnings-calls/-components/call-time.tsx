import type { V2Event } from "@/lib/api/types";

import { formatCallTime } from "@/lib/earnings/format";
import { formatDay, formatDayTimeShort, formatInstantShort } from "@/lib/format";

/**
 * A call's moment on one line in the viewer's timezone: "Nov 2, 2026 · 11:00 PM CET" (a short zone name, F13); a
 * date-only call is its calendar day (`formatCallTime`: read in UTC).
 */
export function callTimeShort(event: Pick<V2Event, "call_time_source" | "scheduled_at" | "tz">) {
    return event.call_time_source === null ? formatCallTime(event) : formatDayTimeShort(event.scheduled_at);
}

/** The call's day in the viewer's timezone ("Nov 24, 2026"); a date-only call is its stated calendar day. */
export function CallDay({ event }: { event: Pick<V2Event, "call_time_source" | "scheduled_at" | "tz"> }) {
    return (
        <span className="tabular-nums whitespace-nowrap">
            {event.call_time_source === null ? formatCallTime(event) : formatDay(event.scheduled_at)}
        </span>
    );
}

/** The call's start in the viewer's timezone ("12:00 PM CET"); a date-only call has none ("Time TBA"). */
export function CallClock({ event }: { event: Pick<V2Event, "call_time_source" | "scheduled_at"> }) {
    if (event.call_time_source === null) return <span className="text-muted-foreground whitespace-nowrap">Time TBA</span>;

    return <span className="tabular-nums whitespace-nowrap">{formatInstantShort(event.scheduled_at)}</span>;
}
