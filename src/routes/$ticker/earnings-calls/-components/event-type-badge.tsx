import type { EarningsEvent } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";

/** The event type for anything but an earnings call (investor day, conference, AGM, other); nothing otherwise. */
export function EventTypeBadge({ event }: { event: Pick<EarningsEvent, "event_type"> }) {
    if (event.event_type === "earnings_call") return null;

    return <Badge variant="secondary">{event.event_type.replaceAll("_", " ")}</Badge>;
}
