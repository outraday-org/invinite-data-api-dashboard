// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EarningsCalendarSemantics, EarningsEvent } from "@/lib/api/types";

import { CALENDAR_EVENT, CALENDAR_EVENT_EXPIRED_CALL } from "@/lib/sec/sec-fixtures";
import { validateCalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";
import {
    CalendarCallCell,
    CalendarReportCell,
    CalendarStatusBadge,
    hasNoCall,
} from "@/routes/$ticker/earnings-calls/-components/calendar-semantics";

afterEach(cleanup);

const REPORT_ONLY_CALENDAR: EarningsCalendarSemantics = {
    call: { at: null, date: null, date_basis: "none", source: null, status: "no_call", time_quality: "none" },
    fiscal_period_quality: "stated",
    report: { date: "2026-11-05", quality: "filing_acceptance", source: { accepted_at: "2026-11-05T11:01:59.000Z", accession: "0001193125-26-448358", form: "6-K" }, time_kind: "bmo" },
    status: "reported",
    warnings: [],
};

const REPORT_ONLY: EarningsEvent = { ...CALENDAR_EVENT, calendar: REPORT_ONLY_CALENDAR };

describe("calendar semantics", () => {
    it("live event: report day + BMO + filing, call time with its quality / source / zone, event status", () => {
        render(
            <>
                <CalendarReportCell calendar={CALENDAR_EVENT.calendar} />
                <CalendarCallCell event={CALENDAR_EVENT} />
                <CalendarStatusBadge calendar={CALENDAR_EVENT.calendar} />
            </>,
        );

        expect(screen.getByText("2026-11-05")).toBeInTheDocument();

        expect(screen.getByText("Before open · from the filing's acceptance")).toBeInTheDocument();

        expect(screen.getByText("6-K · 0001193125-26-448358")).toBeInTheDocument();

        expect(screen.getByText("first-party time · via wire · America/New_York")).toBeInTheDocument();

        expect(screen.getByText("Reported")).toBeInTheDocument();
    });

    it("a report without a call renders 'No call' (no time taken from the release) and its report", () => {
        expect(hasNoCall(REPORT_ONLY.calendar)).toBe(true);

        render(
            <>
                <CalendarCallCell event={REPORT_ONLY} />
                <CalendarReportCell calendar={REPORT_ONLY.calendar} />
            </>,
        );

        expect(screen.getByText("No call")).toBeInTheDocument();

        expect(screen.getByText("no call")).toBeInTheDocument();

        expect(screen.getByText("2026-11-05")).toBeInTheDocument();
    });

    it("an expired date-only call keeps its date with 'date only' quality", () => {
        expect(hasNoCall(CALENDAR_EVENT_EXPIRED_CALL.calendar)).toBe(false);

        render(<CalendarCallCell event={CALENDAR_EVENT_EXPIRED_CALL} />);

        expect(screen.getAllByText(/date only/).length).toBeGreaterThan(0);
    });

    it("no report yet → a dash", () => {
        render(<CalendarReportCell calendar={{ ...REPORT_ONLY_CALENDAR, report: { date: null, quality: "none", source: null, time_kind: null } }} />);

        expect(screen.getByText("—")).toBeInTheDocument();
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
            status: undefined,
            to: undefined,
        });
    });

    it("accepts date_kind and calendar_status; invalid values fall back to none", () => {
        expect(validateCalendarSearch({ calendarStatus: "reported", dateKind: "report" })).toMatchObject({ calendarStatus: "reported", dateKind: "report" });

        expect(validateCalendarSearch({ calendarStatus: "held", dateKind: "fiscal" })).toMatchObject({ calendarStatus: undefined, dateKind: undefined });
    });
});
