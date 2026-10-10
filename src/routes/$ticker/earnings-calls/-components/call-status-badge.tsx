import type { EarningsEvent } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { dateStatusVariant } from "@/lib/earnings/format";

import { LiveDot } from "./live-dot";

/** The `date_status` badge, plus "Live" while capturing and "Published" once the transcript is out. */
export function CallStatusBadge({ event }: { event: Pick<EarningsEvent, "capture_status" | "date_status"> }) {
    return (
        <div className="flex items-center gap-1">
            <Badge variant={dateStatusVariant(event.date_status)}>{event.date_status}</Badge>
            {event.capture_status === "capturing" && (
                <Badge variant="destructive">
                    <LiveDot className="size-1.5" />
                    Live
                </Badge>
            )}
            {event.capture_status === "published" && <Badge variant="secondary">Published</Badge>}
        </div>
    );
}
