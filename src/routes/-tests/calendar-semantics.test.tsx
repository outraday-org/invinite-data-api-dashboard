// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { V2Event, V2EventCalendar } from "@/lib/api/types";

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

    it("filters the loaded rows by session and event status (no `/v1/events` parameter)", () => {
        const row = { calendar: { status: "confirmed" as const }, session: "amc" as const };

        expect(matchesCalendarSearch(row, {})).toBe(true);

        expect(matchesCalendarSearch(row, { calendarStatus: "confirmed", session: "amc" })).toBe(true);

        expect(matchesCalendarSearch(row, { session: "bmo" })).toBe(false);

        expect(matchesCalendarSearch(row, { calendarStatus: "reported" })).toBe(false);

        expect(matchesCalendarSearch({ calendar: null, session: null }, { calendarStatus: "reported" })).toBe(false);
    });
});

describe("callBadgeStatus (every capture status shown, not only Live / Published)", () => {
    const START = "2026-11-25T14:00:00.000Z";

    const BEFORE = Date.parse("2026-11-25T13:00:00.000Z");

    const AFTER = Date.parse("2026-11-25T15:30:00.000Z");

    const call = (capture_status: string, date_status: V2Event["date_status"] = "confirmed") =>
        ({ ...CALENDAR_EVENT, capture_status, date_status, scheduled_at: START }) as V2Event;

    it.each([
        ["capturing", "live"],
        ["published", "published"],
        ["captured", "processing"],
        ["missed", "missed"],
        ["no_call", "no_call"],
        ["not_started", "no_call"],
        ["expired", "expired"],
        ["armed", "starting"],
    ] as const)("%s → %s, before and after the start", (capture, expected) => {
        expect(callBadgeStatus(call(capture), BEFORE)).toBe(expected);

        expect(callBadgeStatus(call(capture), AFTER)).toBe(expected);
    });

    it("pending / replay_only keep the date status before the start and say what is missing after it (DSX 2026-11-25)", () => {
        expect(callBadgeStatus(call("pending"), BEFORE)).toBe("confirmed");

        expect(callBadgeStatus(call("pending"), AFTER)).toBe("not_captured");

        expect(callBadgeStatus(call("replay_only", "unconfirmed"), BEFORE)).toBe("unconfirmed");

        expect(callBadgeStatus(call("replay_only"), AFTER)).toBe("awaiting_replay");
    });

    it("a date-only call starts at the end of its day", () => {
        const dateOnly = {
            ...call("pending"),
            calendar: { ...CALENDAR_EVENT.calendar!, call: { ...CALENDAR_EVENT.calendar!.call, time_quality: "date_only" as const } },
        } as V2Event;

        expect(callBadgeStatus(dateOnly, AFTER)).toBe("confirmed");

        expect(callBadgeStatus(dateOnly, AFTER + 24 * 60 * 60 * 1000)).toBe("not_captured");
    });

    it("a cancelled / postponed date wins over a capture that has not happened, never over a recording", () => {
        expect(callBadgeStatus(call("missed", "cancelled"), AFTER)).toBe("cancelled");

        expect(callBadgeStatus(call("pending", "postponed"), AFTER)).toBe("postponed");

        expect(callBadgeStatus(call("published", "cancelled"), AFTER)).toBe("published");
    });

    it("an unknown capture status falls back to the date status", () => {
        expect(callBadgeStatus(call("something_new"), AFTER)).toBe("confirmed");
    });

    it("the calendar row reads 'Missed' for a missed confirmed call, the date status in its tooltip", () => {
        render(<CalendarRowStatus event={{ ...call("missed"), expired_reason: null }} />);

        expect(screen.getByText("Missed")).toHaveAttribute("title", expect.stringContaining("Date: Confirmed · Capture: Missed"));
    });
});
