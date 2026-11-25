import type { V2CalendarStatus, V2Event, V2EventCalendar } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";

import { callBadgeStatus, callStatusDetail, CallStatusTag } from "./call-status-badge";
import { CallClock, CallDay } from "./call-time";

/**
 * The per-event `calendar` (2026-11) on the calendar rows: the call's day and time (viewer's timezone) with the time's
 * quality and source, plus the event status. A report can exist without a call; a call time is never inferred from the
 * release (the report itself is not a column since 2026-11-25).
 */

export const CALENDAR_STATUS_LABELS: Record<V2CalendarStatus, string> = {
    announced: "Announced",
    cancelled: "Cancelled",
    confirmed: "Confirmed",
    estimated: "Estimated",
    postponed: "Postponed",
    reported: "Reported",
};

type CallTimeQuality = NonNullable<V2EventCalendar["call"]["time_quality"]>;

export const CALL_TIME_QUALITY_LABELS: Record<CallTimeQuality, string> = {
    date_only: "date only",
    estimate: "estimated time",
    first_party: "first-party time",
    first_party_low: "first-party time (low confidence)",
    none: "no time",
    provisional: "provisional time",
    vendor: "vendor time",
};

/**
 * The small meta line under a call time (quality · source): it wraps at a fixed width, since a table cell does not
 * (`whitespace-nowrap`) — unwrapped it made the calendar wider than its column, so its day headings never stuck.
 */
const CELL_META_CLASS = "text-muted-foreground block max-w-52 min-w-36 text-xs whitespace-normal";

const NO_CALL_STATUSES = new Set(["no_call", "not_expected"]);

/** A report-only event: no call expected, or no call day / start at all. */
export function hasNoCall(calendar: null | undefined | V2EventCalendar) {
    if (!calendar) return false;

    const { call } = calendar;

    return NO_CALL_STATUSES.has(call.status ?? "") || (call.date === null && call.at === null);
}

/** The event status badge (`calendar.status`); nothing for an event without the field (an older API). */
export function CalendarStatusBadge({ calendar }: { calendar: null | undefined | V2EventCalendar }) {
    if (!calendar?.status) return null;

    return <Badge title="Event status (calendar)" variant="outline">{CALENDAR_STATUS_LABELS[calendar.status]}</Badge>;
}

/**
 * ONE status badge per calendar row (`callBadgeStatus`): the capture's outcome once there is one ("Live", "Processing",
 * "Published", "Replay", "Awaiting replay", "Missed", "No call", "Expired", …), else the call's date status; date, capture,
 * run kind and event status in its tooltip.
 */
export function CalendarRowStatus({ event }: { event: Pick<V2Event, "awaiting_replay" | "calendar" | "capture_mode" | "capture_status" | "date_status" | "expired_reason" | "scheduled_at"> }) {
    const eventStatus = event.calendar?.status ? CALENDAR_STATUS_LABELS[event.calendar.status] : null;

    return <CallStatusTag status={callBadgeStatus(event)} title={callStatusDetail(event, eventStatus)} />;
}

/** The call's day (viewer's timezone; a date-only call its stated day). A report-only event keeps its day too. */
export function CalendarDayCell({ event }: { event: V2Event }) {
    return <CallDay event={event} />;
}

/**
 * The call's start time in the viewer's timezone with its time quality and source type ("first-party time · via wire"),
 * or "No call" for a report-only event (never a time taken from the release). The company's own zone is not shown:
 * every time on the page is the viewer's.
 */
export function CalendarTimeCell({ event }: { event: V2Event }) {
    const { calendar } = event;

    if (hasNoCall(calendar)) {
        return (
            <div className="flex flex-col">
                <span className="text-muted-foreground">No call</span>
                {calendar?.call.status && <span className="text-muted-foreground text-xs">{calendar.call.status.replaceAll("_", " ")}</span>}
            </div>
        );
    }

    const call = calendar?.call;

    // A date-only call already reads "Time TBA": "date only" would repeat it.
    const quality = call?.time_quality && call.time_quality !== "date_only" ? CALL_TIME_QUALITY_LABELS[call.time_quality] : null;

    const meta = [quality, call?.source?.type ? `via ${call.source.type}` : null].filter(Boolean).join(" · ");

    return (
        <div className="flex flex-col">
            <CallClock event={event} />
            {meta && <span className={CELL_META_CLASS}>{meta}</span>}
        </div>
    );
}
