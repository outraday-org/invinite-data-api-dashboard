import type { EarningsEvent } from "@/lib/api/types";

import { formatCallTime } from "@/lib/earnings/format";

/** Call date / time in the company's timezone; a "date only" caption while the time is unknown. */
export function CallTime({ event }: { event: Pick<EarningsEvent, "call_time_source" | "scheduled_at" | "tz"> }) {
    return (
        <div className="flex flex-col">
            <span className="tabular-nums whitespace-nowrap">{formatCallTime(event)}</span>
            {event.call_time_source === null && (
                <span className="text-muted-foreground text-[0.625rem]">date only</span>
            )}
        </div>
    );
}
