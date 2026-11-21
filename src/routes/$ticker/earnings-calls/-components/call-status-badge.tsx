import type { V2DateStatus, V2Event } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { dateStatusVariant } from "@/lib/earnings/format";

import { LiveDot } from "./live-dot";

/** The `date_status` in words (Title Case). */
export const DATE_STATUS_LABELS: Record<V2DateStatus, string> = {
    cancelled: "Cancelled",
    confirmed: "Confirmed",
    estimated: "Estimated",
    postponed: "Postponed",
    unconfirmed: "Unconfirmed",
};

/** The `date_status` badge, plus "Live" while capturing and "Published" once the transcript is out. */
export function CallStatusBadge({ event }: { event: Pick<V2Event, "capture_status" | "date_status"> }) {
    return (
        <div className="flex items-center gap-1">
            <Badge variant={dateStatusVariant(event.date_status)}>{DATE_STATUS_LABELS[event.date_status]}</Badge>
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
