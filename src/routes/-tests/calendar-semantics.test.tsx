// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { V2Event, V2EventCalendar } from "@/lib/api/types";

import lifecycle from "@/lib/earnings/lifecycle-fixtures.json";
import { CALENDAR_EVENT, CALENDAR_EVENT_EXPIRED_CALL } from "@/lib/earnings/calendar-fixtures";
import { matchesCalendarSearch, validateCalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";
import {
    CalendarDayCell,
    CalendarRowStatus,
    CalendarStatusBadge,
    CalendarTimeCell,
    hasNoCall,
} from "@/routes/$ticker/earnings-calls/-components/calendar-semantics";
import { callBadgeStatus } from "@/routes/$ticker/earnings-calls/-components/call-status-badge";

afterEach(cleanup);

const REPORT_ONLY_CALENDAR: V2EventCalendar = {
    call: { at: null, date: null, date_basis: "none", source: null, status: "no_call", time_quality: "none" },
    fiscal_period_quality: "stated",
    report: { date: "2026-11-05", quality: "filing_acceptance", source: { accepted_at: "2026-11-05T11:01:59.000Z", accession: "0001193125-26-448358", form: "6-K" }, time_kind: "bmo" },
    status: "reported",
    warnings: [],
};

const REPORT_ONLY: V2Event = { ...CALENDAR_EVENT, calendar: REPORT_ONLY_CALENDAR };

describe("calendar semantics", () => {
    it("a timed call: day and time apart, the time in the viewer's zone with its quality and source (no company zone)", () => {
        render(
            <>
                <CalendarDayCell event={CALENDAR_EVENT} />
                <CalendarTimeCell event={CALENDAR_EVENT} />
                <CalendarStatusBadge calendar={CALENDAR_EVENT.calendar} />
            </>,
        );

        expect(screen.getByText("first-party time · via wire")).toBeInTheDocument();

        expect(screen.queryByText(/America\/New_York/)).toBeNull();

        expect(screen.getByText("Reported")).toBeInTheDocument();
    });

    it("the meta line wraps at a fixed width (a nowrap table cell made the calendar wider than its column: no sticky day headings)", () => {
        render(<CalendarTimeCell event={CALENDAR_EVENT} />);

        expect(screen.getByText("first-party time · via wire")).toHaveClass("whitespace-normal", "max-w-52");
    });

    it("a report without a call renders 'No call' (no time taken from the release)", () => {
        expect(hasNoCall(REPORT_ONLY.calendar)).toBe(true);

        render(<CalendarTimeCell event={REPORT_ONLY} />);

        expect(screen.getByText("No call")).toBeInTheDocument();

        expect(screen.getByText("no call")).toBeInTheDocument();
    });

    it("an expired date-only call keeps its day; its time reads 'Time TBA'", () => {
        expect(hasNoCall(CALENDAR_EVENT_EXPIRED_CALL.calendar)).toBe(false);

        render(
            <>
                <CalendarDayCell event={CALENDAR_EVENT_EXPIRED_CALL} />
                <CalendarTimeCell event={CALENDAR_EVENT_EXPIRED_CALL} />
            </>,
        );

        expect(screen.getByText("Time TBA")).toBeInTheDocument();
    });
});

describe("validateCalendarSearch", () => {
    it("defaults unchanged: no date_kind / calendar_status unless asked", () => {
        expect(validateCalendarSearch({})).toEqual({
            calendarStatus: undefined,
            dateKind: undefined,
            eventType: undefined,
            from: undefined,
            session: undefined,
            to: undefined,
        });
    });

    it("accepts date certainty (v2 `date_kind`) and calendar_status; invalid values (and v1's call / report) fall back to none", () => {
        expect(validateCalendarSearch({ calendarStatus: "reported", dateKind: "estimated" })).toMatchObject({ calendarStatus: "reported", dateKind: "estimated" });

        expect(validateCalendarSearch({ calendarStatus: "held", dateKind: "report" })).toMatchObject({ calendarStatus: undefined, dateKind: undefined });
    });

    it("leaves authoritative live membership to the API and only filters public calendar/session fields", () => {
        const row = { calendar: { status: "confirmed" as const }, session: "amc" as const };
        expect(matchesCalendarSearch(row, { status: "live" })).toBe(true);
    });

    it("filters the loaded rows by session and event status (no `/v1/events` parameter)", () => {
        const row = { calendar: { status: "confirmed" as const }, session: "amc" as const };

        expect(matchesCalendarSearch(row, {})).toBe(true);

        expect(matchesCalendarSearch(row, { calendarStatus: "confirmed", session: "amc" })).toBe(true);

        expect(matchesCalendarSearch(row, { session: "bmo" })).toBe(false);

        expect(matchesCalendarSearch(row, { calendarStatus: "reported" })).toBe(false);

        expect(matchesCalendarSearch({ calendar: null, session: null }, { calendarStatus: "reported" })).toBe(false);
    });
});

describe("public calendar and transcript availability", () => {
    it.each(lifecycle.fixtures)("old/candidate $name share public outcomes without capture details", fixture => {
        const candidate = fixture.candidate as V2Event;
        const current = fixture.current as V2Event;
        expect(callBadgeStatus(candidate, fixture.authoritative_live_member)).toBe(callBadgeStatus(current, fixture.authoritative_live_member));
        render(<CalendarRowStatus event={candidate} live={fixture.authoritative_live_member} />);
        expect(document.body.textContent).not.toMatch(/Awaiting replay|Processing|Armed|Not captured/);
        expect(document.querySelector("[title]")?.getAttribute("title")).not.toMatch(/Capture:|Run:|handed over/);
    });

    it("reports transcript availability independently of a cancelled date", () => {
        expect(callBadgeStatus({ ...CALENDAR_EVENT, date_status: "cancelled", has_transcript: true })).toBe("published");
        expect(callBadgeStatus({ ...CALENDAR_EVENT, calendar: null, has_transcript: false })).toBe(CALENDAR_EVENT.date_status);
        expect(callBadgeStatus({ ...CALENDAR_EVENT, has_transcript: false, calendar: REPORT_ONLY_CALENDAR })).toBe("no_call");
    });
});
