import type { V2DateStatus, V2Event } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { isReplayCapture } from "@/lib/earnings/capture-mode";
import { EXPIRED_REASON_LABELS } from "@/lib/earnings/labels";
import { cn } from "@/lib/utils";

import { LiveDot } from "./live-dot";

/** The `date_status` in words (Title Case). */
export const DATE_STATUS_LABELS: Record<V2DateStatus, string> = {
    cancelled: "Cancelled",
    confirmed: "Confirmed",
    estimated: "Estimated",
    postponed: "Postponed",
    unconfirmed: "Unconfirmed",
};

/**
 * The served `capture_status` values (backend `earnings/src/inhouse/db/schema.ts` `CAPTURE_STATUSES`; the internal
 * `not_started` is served as `no_call`). The spec types it as a plain string, so an unknown value falls back to the
 * date status.
 */
export const CAPTURE_STATUS_LABELS: Record<string, string> = {
    armed: "Armed",
    captured: "Recorded",
    capturing: "Capturing",
    expired: "Expired",
    missed: "Missed",
    no_call: "No call",
    pending: "Pending",
    published: "Published",
    replay_only: "Replay only",
};

/**
 * Every call status a badge shows: the date statuses, plus the capture's states — "Live" (capturing), "Starting"
 * (armed), "Replay" (a replay capture armed / capturing: a recording taken after the call, never live), "Processing"
 * (recorded, transcript not out yet), "Published", "Missed", "No call", "Expired", "Awaiting replay" (a replay-only
 * call after its start, a live capture handed over to a replay — `awaiting_replay` —, or a queued replay attempt) and
 * "Not captured" (still `pending` after its start).
 */
export type CallBadgeStatus
    = | "awaiting_replay"
        | "expired"
        | "live"
        | "missed"
        | "no_call"
        | "not_captured"
        | "processing"
        | "published"
        | "replay"
        | "starting"
        | V2DateStatus;

const CALL_STATUS_LABELS: Record<CallBadgeStatus, string> = {
    ...DATE_STATUS_LABELS,
    awaiting_replay: "Awaiting replay",
    expired: "Expired",
    live: "Live",
    missed: "Missed",
    no_call: "No call",
    not_captured: "Not captured",
    processing: "Processing",
    published: "Published",
    replay: "Replay",
    starting: "Starting",
};

/**
 * One colour per call status, so a row's state reads at a glance (owner, 2026-11-25): Published green, Live red,
 * Confirmed blue, Unconfirmed violet, Estimated amber, Postponed orange, Cancelled grey and struck through; after the
 * start (2026-11-25): Starting light red, Processing teal, Missed / Not captured rose, Awaiting replay indigo, Replay a
 * stronger indigo (no live dot: a replay is never live), No call and Expired grey.
 */
const CALL_STATUS_TONE: Record<CallBadgeStatus, string> = {
    awaiting_replay: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    cancelled: "bg-muted text-muted-foreground line-through",
    confirmed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    estimated: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    expired: "bg-muted text-muted-foreground",
    live: "bg-red-500/15 text-red-700 dark:text-red-300",
    missed: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
    no_call: "bg-muted text-muted-foreground",
    not_captured: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
    postponed: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
    processing: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    replay: "bg-indigo-500/25 text-indigo-800 dark:text-indigo-200",
    starting: "bg-red-500/10 text-red-600 dark:text-red-300",
    unconfirmed: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

/** A call without a stated time (date only / none) has started only once its whole day passed. */
const DATE_ONLY_TIME_QUALITIES = new Set(["date_only", "none"]);

const DAY_MS = 24 * 60 * 60 * 1000;

type StatusEvent = Pick<V2Event, "awaiting_replay" | "capture_mode" | "capture_status" | "date_status" | "scheduled_at"> & {
    calendar?: null | { call?: null | { time_quality?: null | string } };
};

/** Whether the call's start (a date-only call: the end of its day) lies before `nowMs`. */
export function callStartPassed(event: StatusEvent, nowMs: number): boolean {
    const startMs = Date.parse(event.scheduled_at);

    if (Number.isNaN(startMs)) return false;

    const dateOnly = DATE_ONLY_TIME_QUALITIES.has(event.calendar?.call?.time_quality ?? "");

    return nowMs >= startMs + (dateOnly ? DAY_MS : 0);
}

/**
 * THE status of a call, one value: a capture outcome wins over the date status (a published or missed call is no longer
 * "Confirmed"); a cancelled / postponed date wins over a capture that has not happened; before the start the date
 * status stands. Without the time rule a `pending` call whose start passed read "Confirmed" (DSX, 2026-11-25).
 *
 * A replay (`capture_mode` "replay", Data API 11.4; backend `earnings/tasks/capture-mode-on-events` task 3) mirrors the
 * live states onto `capture_status`: armed / capturing read "Replay" (never "Live" / "Starting"), a queued attempt
 * (`pending` after the start) and a missed call beside an active replay or handed over by the live probe
 * (`awaiting_replay`) read "Awaiting replay". Published stays Published during an upgrade replay, captured stays
 * Processing. Without both fields (an older API) every status reads as before.
 */
export function callBadgeStatus(event: StatusEvent, nowMs: number = Date.now()): CallBadgeStatus {
    const replay = isReplayCapture(event);

    switch (event.capture_status) {
        case "captured":
            return "processing";
        case "capturing":
            return replay ? "replay" : "live";
        case "published":
            return "published";
        default:
            break;
    }

    if (event.date_status === "cancelled" || event.date_status === "postponed") return event.date_status;

    switch (event.capture_status) {
        case "armed":
            return replay ? "replay" : "starting";
        case "expired":
            return "expired";
        case "missed":
            return event.awaiting_replay === true || replay ? "awaiting_replay" : "missed";
        case "no_call":
        case "not_started":
            return "no_call";
        case "pending":
            if (!callStartPassed(event, nowMs)) return event.date_status;

            return replay ? "awaiting_replay" : "not_captured";
        case "replay_only":
            return callStartPassed(event, nowMs) ? "awaiting_replay" : event.date_status;
        default:
            return event.date_status;
    }
}

/** Whether a badge status comes from the capture (not the date status). */
export function isCaptureBadgeStatus(status: CallBadgeStatus): boolean {
    return !(status in DATE_STATUS_LABELS);
}

/**
 * The badge's tooltip: date status, capture status (raw value in words), the run kind (`capture_mode`: "Run: live" /
 * "Run: replay"), the probe hand-off (`awaiting_replay`) and, for an expired row, why.
 */
export function callStatusDetail(event: Pick<V2Event, "expired_reason"> & StatusEvent, eventStatus?: null | string): string {
    const capture = CAPTURE_STATUS_LABELS[event.capture_status] ?? event.capture_status;

    const run = event.capture_mode ? `Run: ${event.capture_mode}` : null;

    const handOff = event.awaiting_replay === true ? "Live capture handed over to the replay" : null;

    const reason = event.expired_reason ? EXPIRED_REASON_LABELS[event.expired_reason] : null;

    return [`Date: ${DATE_STATUS_LABELS[event.date_status]}`, `Capture: ${capture}`, run, handOff, reason, eventStatus ? `Event: ${eventStatus}` : null]
        .filter(Boolean)
        .join(" · ");
}

/** A call status badge in its own colour; `title` = its tooltip. */
export function CallStatusTag({ status, title }: { status: CallBadgeStatus; title?: string }) {
    return (
        <Badge className={cn("border-transparent", CALL_STATUS_TONE[status])} title={title} variant="outline">
            {status === "live" && <LiveDot className="size-1.5" />}
            {CALL_STATUS_LABELS[status]}
        </Badge>
    );
}

/** The `date_status` badge, plus the capture's state ("Live", "Replay", "Processing", "Missed", …) once it says more than the date. */
export function CallStatusBadge({ event }: { event: Pick<V2Event, "expired_reason"> & StatusEvent }) {
    const status = callBadgeStatus(event);

    const title = callStatusDetail(event);

    return (
        <div className="flex items-center gap-1">
            <CallStatusTag status={event.date_status} title={title} />
            {isCaptureBadgeStatus(status) && <CallStatusTag status={status} title={title} />}
        </div>
    );
}
