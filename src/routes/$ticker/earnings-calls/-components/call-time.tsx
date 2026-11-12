import type { V2Event } from "@/lib/api/types";

import { formatCallTime } from "@/lib/earnings/format";

/**
 * Call date / time in the viewer's timezone; a "date only" caption while the time is unknown.
 */
export function CallTime({ event }: { event: Pick<V2Event, "call_time_source" | "scheduled_at" | "tz"> }) {
    const dateOnly = event.call_time_source === null;

    return (
        <div className="flex flex-col">
            <span className="tabular-nums whitespace-nowrap">{formatCallTime(event)}</span>
            {dateOnly && <span className="text-muted-foreground text-[0.625rem]">date only</span>}
        </div>
    );
}
