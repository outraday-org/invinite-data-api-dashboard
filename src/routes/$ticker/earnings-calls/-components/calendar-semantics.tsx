import type { EarningsCalendarSemantics, EarningsCalendarStatus, EarningsEvent } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";

import { CallTime } from "./call-time";

/**
 * The per-event `calendar` (2026-11): the report (results release) and the call kept apart, each with its quality and
 * source, plus the event status. A report can exist without a call; a call time is never inferred from the release.
 */

export const CALENDAR_STATUS_LABELS: Record<EarningsCalendarStatus, string> = {
    announced: "Announced",
    cancelled: "Cancelled",
    confirmed: "Confirmed",
    estimated: "Estimated",
    postponed: "Postponed",
    reported: "Reported",
};

type ReportTimeKind = NonNullable<EarningsCalendarSemantics["report"]["time_kind"]>;

export const REPORT_TIME_LABELS: Record<ReportTimeKind, string> = {
    amc: "After close",
    bmo: "Before open",
    exact: "Exact time",
    unknown: "Time unknown",
};

type CallTimeQuality = NonNullable<EarningsCalendarSemantics["call"]["time_quality"]>;

export const CALL_TIME_QUALITY_LABELS: Record<CallTimeQuality, string> = {
    date_only: "date only",
    estimate: "estimated time",
    first_party: "first-party time",
    first_party_low: "first-party time (low confidence)",
    none: "no time",
    provisional: "provisional time",
    vendor: "vendor time",
};

const NO_CALL_STATUSES = new Set(["no_call", "not_expected"]);

/** A report-only event: no call expected, or no call day / start at all. */
export function hasNoCall(calendar: EarningsCalendarSemantics | null | undefined) {
    if (!calendar) return false;

    const { call } = calendar;

    return NO_CALL_STATUSES.has(call.status ?? "") || (call.date === null && call.at === null);
}

/** The event status badge (`calendar.status`); nothing for an event without the field (an older API). */
export function CalendarStatusBadge({ calendar }: { calendar: EarningsCalendarSemantics | null | undefined }) {
    if (!calendar?.status) return null;

    return <Badge title="Event status (calendar)" variant="outline">{CALENDAR_STATUS_LABELS[calendar.status]}</Badge>;
}

/** Report day + time kind + quality + its filing (form · accession); "—" before the results. */
export function CalendarReportCell({ calendar }: { calendar: EarningsCalendarSemantics | null | undefined }) {
    const report = calendar?.report;

    if (!report?.date) return <span className="text-muted-foreground">—</span>;

    const source = report.source;

    return (
        <div className="flex flex-col">
            <span className="tabular-nums whitespace-nowrap">{report.date}</span>
            <span className="text-muted-foreground text-[0.625rem]">
                {[
                    report.time_kind ? REPORT_TIME_LABELS[report.time_kind] : null,
                    report.quality === "filing_acceptance" ? "from the filing's acceptance" : null,
                ].filter(Boolean).join(" · ")}
            </span>
            {source?.accession && (
                <span className="text-muted-foreground text-[0.625rem] tabular-nums">{`${source.form ?? "Filing"} · ${source.accession}`}</span>
            )}
        </div>
    );
}

/**
 * The call column: the existing call time (company zone) with the call's time quality and source type, or "No call"
 * for a report-only event (never a time taken from the release).
 */
export function CalendarCallCell({ event }: { event: EarningsEvent }) {
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
                <span className="text-muted-foreground text-[0.625rem]">
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
