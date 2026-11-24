import type { V2Event } from "@/lib/api/types";

import { formatCallTime } from "@/lib/earnings/format";
import { formatDayTimeShort } from "@/lib/format";

/**
 * A call's moment on one line in the viewer's timezone: "Nov 2, 2026 · 11:00 PM CET" (a short zone name, F13); a
 * date-only call is its calendar day (`formatCallTime`: read in UTC).
 */
export function callTimeShort(event: Pick<V2Event, "call_time_source" | "scheduled_at" | "tz">) {
    return event.call_time_source === null ? formatCallTime(event) : formatDayTimeShort(event.scheduled_at);
}

/**
 * Call date / time in the viewer's timezone on one line ("Nov 2, 2026 · 11:00 PM CET": a short zone name, F13); a
 * date-only call is its calendar day with a "date only" caption.
 */
export function CallTime({ event }: { event: Pick<V2Event, "call_time_source" | "scheduled_at" | "tz"> }) {
    const dateOnly = event.call_time_source === null;

    return (
        <div className="flex flex-col">
            <span className="tabular-nums whitespace-nowrap">{callTimeShort(event)}</span>
            {dateOnly && <span className="text-muted-foreground text-xs">date only</span>}
        </div>
    );
}
