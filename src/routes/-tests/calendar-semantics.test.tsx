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

    it("call status Live drops a replay capture the API lists as live (it reads \"Replay\")", () => {
        const row = { calendar: { status: "confirmed" as const }, session: "amc" as const };

        expect(matchesCalendarSearch({ ...row, capture_mode: "replay" }, { status: "live" })).toBe(false);

        expect(matchesCalendarSearch({ ...row, capture_mode: "live" }, { status: "live" })).toBe(true);

        expect(matchesCalendarSearch(row, { status: "live" })).toBe(true);

        expect(matchesCalendarSearch({ ...row, capture_mode: "replay" }, { status: "ended" })).toBe(true);
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

describe("callBadgeStatus with capture_mode / awaiting_replay (Data API 11.4, backend capture-mode-on-events task 3)", () => {
    const START = "2026-11-25T14:00:00.000Z";

    const BEFORE = Date.parse("2026-11-25T13:00:00.000Z");

    const AFTER = Date.parse("2026-11-25T14:10:00.000Z");

    type Mode = "live" | "replay" | null | undefined;

    const call = (capture_status: string, capture_mode: Mode, awaiting_replay?: boolean, date_status: V2Event["date_status"] = "confirmed") => {
        const event = { ...CALENDAR_EVENT, capture_status, date_status, scheduled_at: START } as V2Event;

        if (capture_mode !== undefined) event.capture_mode = capture_mode;

        if (awaiting_replay !== undefined) event.awaiting_replay = awaiting_replay;

        return event;
    };

    // The rule table of task 3, one row each.
    it.each([
        ["published + an active upgrade replay", call("published", "replay"), "published"],
        ["published, no run", call("published", null, false), "published"],
        ["captured + replay", call("captured", "replay"), "processing"],
        ["captured + live", call("captured", "live"), "processing"],
        ["capturing + replay", call("capturing", "replay"), "replay"],
        ["capturing + live", call("capturing", "live"), "live"],
        ["capturing without the field", call("capturing", undefined), "live"],
        ["armed + replay", call("armed", "replay"), "replay"],
        ["armed + live", call("armed", "live"), "starting"],
        ["expired + replay", call("expired", "replay"), "expired"],
        ["no_call + replay", call("no_call", "replay"), "no_call"],
        ["missed + awaiting_replay", call("missed", null, true), "awaiting_replay"],
        ["missed without hand-off", call("missed", null, false), "missed"],
        ["missed + an active replay", call("missed", "replay", false), "awaiting_replay"],
        ["missed + live run, no hand-off", call("missed", "live", false), "missed"],
        ["pending + replay after the start (a queued attempt)", call("pending", "replay"), "awaiting_replay"],
        ["pending + live after the start", call("pending", "live"), "not_captured"],
        ["replay_only after the start", call("replay_only", null), "awaiting_replay"],
        ["cancelled + missed + awaiting_replay", call("missed", null, true, "cancelled"), "cancelled"],
        ["postponed + armed + replay", call("armed", "replay", false, "postponed"), "postponed"],
        ["cancelled + capturing + replay (a capture beats the date)", call("capturing", "replay", false, "cancelled"), "replay"],
    ] as const)("%s → %s", (_label, event, expected) => {
        expect(callBadgeStatus(event, AFTER)).toBe(expected);
    });

    it("pending + replay before the start keeps the date status", () => {
        expect(callBadgeStatus(call("pending", "replay"), BEFORE)).toBe("confirmed");

        expect(callBadgeStatus(call("pending", "replay", false, "estimated"), BEFORE)).toBe("estimated");
    });

    // The README's life-cycle table of a probe-mode call, in order.
    it.each([
        ["before the start, live run scheduled", call("pending", "live", false), BEFORE, "confirmed"],
        ["probe armed (its 60 s are not mirrored)", call("armed", "live", false), AFTER, "starting"],
        ["probe ended probe:media, no replay run yet", call("missed", null, true), AFTER, "awaiting_replay"],
        ["replay attempt created, waiting", call("pending", "replay", false), AFTER, "awaiting_replay"],
        ["replay armed", call("armed", "replay", false), AFTER, "replay"],
        ["replay capturing", call("capturing", "replay", false), AFTER, "replay"],
        ["replay transcribing", call("captured", "replay", false), AFTER, "processing"],
        ["replay published", call("published", null, false), AFTER, "published"],
        ["replay attempt failed, follow-up not run yet (open decision 1)", call("missed", null, false), AFTER, "missed"],
        ["follow-up queued the next attempt", call("pending", "replay", false), AFTER, "awaiting_replay"],
        ["follow-up escalated (a real miss)", call("missed", null, false), AFTER, "missed"],
        ["recovery from stored audio (live mode)", call("captured", "live", false), AFTER, "processing"],
    ] as const)("life cycle: %s → %s", (_label, event, now, expected) => {
        expect(callBadgeStatus(event, now)).toBe(expected);
    });

    it("an event without both fields reads as before for every status", () => {
        for (const capture of ["armed", "captured", "capturing", "expired", "missed", "no_call", "not_started", "pending", "published", "replay_only", "something_new"]) {
            for (const now of [BEFORE, AFTER]) {
                expect(callBadgeStatus(call(capture, undefined), now)).toBe(callBadgeStatus(call(capture, null, false), now));
            }
        }

        expect(callBadgeStatus(call("capturing", undefined), AFTER)).toBe("live");

        expect(callBadgeStatus(call("missed", undefined), AFTER)).toBe("missed");

        expect(callBadgeStatus(call("pending", undefined), AFTER)).toBe("not_captured");
    });

    it("'Replay' has no live dot; 'Live' keeps it", () => {
        const { container, unmount } = render(<CalendarRowStatus event={{ ...call("capturing", "replay"), expired_reason: null }} />);

        expect(screen.getByText("Replay")).toBeInTheDocument();

        expect(container.querySelector(".animate-pulse")).toBeNull();

        unmount();

        const live = render(<CalendarRowStatus event={{ ...call("capturing", "live"), expired_reason: null }} />);

        expect(screen.getByText("Live")).toBeInTheDocument();

        expect(live.container.querySelector(".animate-pulse")).not.toBeNull();
    });

    it("the tooltip names the run kind and the probe hand-off", () => {
        render(<CalendarRowStatus event={{ ...call("missed", null, true), expired_reason: null }} />);

        expect(screen.getByText("Awaiting replay")).toHaveAttribute("title", expect.stringContaining("Date: Confirmed · Capture: Missed · Live capture handed over to the replay"));

        cleanup();

        render(<CalendarRowStatus event={{ ...call("capturing", "replay"), expired_reason: null }} />);

        expect(screen.getByText("Replay")).toHaveAttribute("title", expect.stringContaining("Capture: Capturing · Run: replay"));

        cleanup();

        render(<CalendarRowStatus event={{ ...call("pending", "live"), expired_reason: null }} />);

        expect(screen.getByText("Not captured")).toHaveAttribute("title", expect.stringContaining("Run: live"));
    });
});
