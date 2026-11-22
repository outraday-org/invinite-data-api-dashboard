import type { V2CalendarStatus, V2Event, V2EventCalendar } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { dateStatusVariant } from "@/lib/earnings/format";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DATE_STATUS_LABELS } from "./call-status-badge";
import { CallTime } from "./call-time";
import { LiveDot } from "./live-dot";

/**
 * The per-event `calendar` (2026-11): the report (results release) and the call kept apart, each with its quality and
 * source, plus the event status. A report can exist without a call; a call time is never inferred from the release.
 */

export const CALENDAR_STATUS_LABELS: Record<V2CalendarStatus, string> = {
    announced: "Announced",
    cancelled: "Cancelled",
    confirmed: "Confirmed",
    estimated: "Estimated",
    postponed: "Postponed",
    reported: "Reported",
};

type ReportTimeKind = NonNullable<V2EventCalendar["report"]["time_kind"]>;

export const REPORT_TIME_LABELS: Record<ReportTimeKind, string> = {
    amc: "After close",
    bmo: "Before open",
    exact: "Exact time",
    unknown: "Time unknown",
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
 * The small meta lines under a call time / report day (quality · source · zone, the filing): they wrap at a fixed
 * width, since a table cell does not (`whitespace-nowrap`) — unwrapped they made the calendar wider than its column at
 * every screen width, so its day headings never stuck.
 */
const CELL_META_CLASS = "text-muted-foreground block max-w-52 text-[0.625rem] whitespace-normal";

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
 * ONE status badge per calendar row: "Live" while capturing, else "Published" once the transcript is out, else the
 * call's date status; the other dimensions (date status, event status) in its tooltip.
 */
export function CalendarRowStatus({ event }: { event: Pick<V2Event, "calendar" | "capture_status" | "date_status"> }) {
    const dateLabel = DATE_STATUS_LABELS[event.date_status];

    const eventStatus = event.calendar?.status ? CALENDAR_STATUS_LABELS[event.calendar.status] : null;

    const detail = [`Date: ${dateLabel}`, eventStatus ? `Event: ${eventStatus}` : null].filter(Boolean).join(" · ");

    if (event.capture_status === "capturing") {
        return (
            <Badge title={detail} variant="destructive">
                <LiveDot className="size-1.5" />
                Live
            </Badge>
        );
    }

    if (event.capture_status === "published") return <Badge title={detail} variant="secondary">Published</Badge>;

    return <Badge title={detail} variant={dateStatusVariant(event.date_status)}>{dateLabel}</Badge>;
}

/** Report day + time kind + quality + its filing (form · accession); "—" before the results. */
export function CalendarReportCell({ calendar }: { calendar: null | undefined | V2EventCalendar }) {
    const report = calendar?.report;

    if (!report?.date) return <span className="text-muted-foreground">—</span>;

    const source = report.source;

    return (
        <div className="flex flex-col">
            <span className="tabular-nums whitespace-nowrap">{formatDay(report.date)}</span>
            <span className={CELL_META_CLASS}>
                {[
                    report.time_kind ? REPORT_TIME_LABELS[report.time_kind] : null,
                    report.quality === "filing_acceptance" ? "from the filing's acceptance" : null,
                ].filter(Boolean).join(" · ")}
            </span>
            {source?.accession && (
                <span className={cn(CELL_META_CLASS, "tabular-nums")}>{`${source.form ?? "Filing"} · ${source.accession}`}</span>
            )}
        </div>
    );
}

/**
 * The call column: the call time (viewer's zone) with the call's time quality and source type, or "No call"
 * for a report-only event (never a time taken from the release).
 */
export function CalendarCallCell({ event }: { event: V2Event }) {
    const { calendar } = event;

    if (hasNoCall(calendar)) {
        return (
            <div className="flex flex-col">
                <span className="text-muted-foreground">No call</span>
                {calendar?.call.status && <span className="text-muted-foreground text-[0.625rem]">{calendar.call.status.replaceAll("_", " ")}</span>}
            </div>
        );
    }

    const call = calendar?.call;

    const quality = call?.time_quality ? CALL_TIME_QUALITY_LABELS[call.time_quality] : null;

    const source = call?.source;

    return (
        <div className="flex flex-col">
            <CallTime event={event} />
            {(quality || source?.type) && (
                <span className={CELL_META_CLASS}>
                    {[
                        quality,
                        source?.type ? `via ${source.type}` : null,
                        source?.tz ? `${source.tz}${source.tz_inferred ? " (inferred)" : ""}` : null,
                    ].filter(Boolean).join(" · ")}
                </span>
            )}
        </div>
    );
}
