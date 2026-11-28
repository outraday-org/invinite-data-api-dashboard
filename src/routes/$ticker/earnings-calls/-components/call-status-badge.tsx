import type { V2DateStatus, V2Event } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { LiveDot } from "./live-dot";

export const DATE_STATUS_LABELS: Record<V2DateStatus, string> = {
    cancelled: "Cancelled",
    confirmed: "Confirmed",
    estimated: "Estimated",
    postponed: "Postponed",
    unconfirmed: "Unconfirmed",
};

export type CallBadgeStatus = "held" | "live" | "no_call" | "not_covered" | "published" | V2DateStatus;

const LABELS: Record<CallBadgeStatus, string> = {
    ...DATE_STATUS_LABELS,
    held: "Held",
    live: "Live",
    no_call: "No call",
    not_covered: "Not covered",
    published: "Transcript available",
};

const TONES: Partial<Record<CallBadgeStatus, string>> = {
    cancelled: "bg-muted text-muted-foreground line-through",
    confirmed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    estimated: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    live: "bg-red-500/15 text-red-700 dark:text-red-300",
    postponed: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
    published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    unconfirmed: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

type StatusEvent = Pick<V2Event, "calendar" | "date_status" | "has_transcript">;

/** Availability is independent of the calendar outcome; only an authoritative caller can supply live membership. */
export function callBadgeStatus(event: StatusEvent, live = false): CallBadgeStatus {
    if (live) return "live";

    if (event.has_transcript) return "published";

    const status = event.calendar?.call.status;

    if (status === "no_call" || status === "not_expected") return "no_call";

    if (status === "not_covered" || status === "held") return status;

    if (status === "cancelled" || status === "postponed") return status;

    return event.date_status;
}

export function callStatusDetail(event: StatusEvent, eventStatus?: null | string): string {
    return [
        `Date: ${DATE_STATUS_LABELS[event.date_status]}`,
        event.calendar?.call.status ? `Call: ${event.calendar.call.status.replaceAll("_", " ")}` : null,
        eventStatus ? `Event: ${eventStatus}` : null,
        event.has_transcript ? "Transcript available" : "Transcript is not available",
    ].filter(Boolean).join(" · ");
}

export function CallStatusTag({ status, title }: { status: CallBadgeStatus; title?: string }) {
    return (
        <Badge className={cn(TONES[status])} title={title} variant="outline">
            {status === "live" && <LiveDot className="size-1.5" />}
            {LABELS[status]}
        </Badge>
    );
}

export function CallStatusBadge({ event, live = false }: { event: StatusEvent; live?: boolean }) {
    const status = callBadgeStatus(event, live);
    const title = callStatusDetail(event);

    return (
        <div className="flex items-center gap-1">
            <CallStatusTag status={event.date_status} title={title} />
            {status !== event.date_status && <CallStatusTag status={status} title={title} />}
        </div>
    );
}
