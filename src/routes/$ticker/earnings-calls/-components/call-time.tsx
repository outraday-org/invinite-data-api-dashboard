import type { V2Event } from "@/lib/api/types";

import { formatCallTime } from "@/lib/earnings/format";
import { cn } from "@/lib/utils";

/**
 * Call date / time in the company's timezone; a "date only" caption while the time is unknown.
 * `reserveCaption` keeps the caption's line (invisible) for a timed call, so table rows share one height.
 */
export function CallTime({
    event,
    reserveCaption = false,
}: {
    event: Pick<V2Event, "call_time_source" | "scheduled_at" | "tz">;
    reserveCaption?: boolean;
}) {
    const dateOnly = event.call_time_source === null;

    return (
        <div className="flex flex-col">
            <span className="tabular-nums whitespace-nowrap">{formatCallTime(event)}</span>
            {(dateOnly || reserveCaption) && (
                <span
                    aria-hidden={!dateOnly}
                    className={cn("text-muted-foreground text-[0.625rem]", !dateOnly && "invisible")}
                >
                    date only
                </span>
            )}
        </div>
    );
}
