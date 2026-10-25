import { describe, expect, it } from "vitest";

import {
    calendarDefaultWindow,
    calendarWindow,
    dateStatusVariant,
    eventLabel,
    formatBytes,
    formatCallTime,
    formatFiscalPeriod,
    formatInstant,
    formatMs,
    formatStartedAgo,
    isCallToday,
    isUpcoming,
    orderedWindow,
} from "./format";

describe("formatCallTime", () => {
    it("shows date, time and the generic zone of a timed call", () => {
        const value = formatCallTime({
            call_time_source: "wire",
            scheduled_at: "2026-10-29T20:30:00.000Z",
            tz: "America/New_York",
        });

        expect(value).toBe("Oct 29, 2026 · 4:30 PM ET");
    });

    it("shows a date-only event's UTC calendar date, never the previous day in tz", () => {
        const value = formatCallTime({
            call_time_source: null,
            scheduled_at: "2026-10-21T00:00:00Z",
            tz: "America/Los_Angeles",
        });

        expect(value).toBe("Oct 21, 2026");
    });
});

describe("formatFiscalPeriod", () => {
    it("formats quarter and year", () => {
        expect(formatFiscalPeriod({ fiscal_quarter: 3, fiscal_year: 2026 })).toBe("Q3 FY2026");

        expect(formatFiscalPeriod({ fiscal_quarter: null, fiscal_year: 2026 })).toBe("FY2026");

        expect(formatFiscalPeriod({ fiscal_quarter: 2, fiscal_year: null })).toBe("—");
    });
});

describe("dateStatusVariant", () => {
    it("maps every status to a badge variant", () => {
        expect(dateStatusVariant("confirmed")).toBe("default");

        expect(dateStatusVariant("unconfirmed")).toBe("secondary");

        expect(dateStatusVariant("estimated")).toBe("outline");

        expect(dateStatusVariant("postponed")).toBe("destructive");

        expect(dateStatusVariant("cancelled")).toBe("destructive");
    });
});

describe("formatMs", () => {
    it("formats m:ss and h:mm:ss like the admin console's formatClock", () => {
        expect(formatMs(0)).toBe("0:00");

        expect(formatMs(65_400)).toBe("1:05");

        expect(formatMs(3_723_000)).toBe("1:02:03");

        expect(formatMs(-5_000)).toBe("0:00");

        expect(formatMs(Number.NaN)).toBe("0:00");
    });
});

describe("isUpcoming", () => {
    const now = new Date("2026-10-10T18:00:00.000Z"); // 2:00 PM New York

    it("compares a timed call's start with now", () => {
        const base = { call_time_source: "wire", tz: "America/New_York" };

        expect(isUpcoming({ ...base, scheduled_at: "2026-10-10T20:30:00.000Z" }, now)).toBe(true);

        expect(isUpcoming({ ...base, scheduled_at: "2026-10-10T12:30:00.000Z" }, now)).toBe(false);
    });

    it("reads a date-only row (00:00Z of its date) on its UTC date, compared with today in tz", () => {
        // 2026-10-10T00:00Z = the Oct 10 event, which is today in New York: still upcoming.
        const dateOnly = { call_time_source: null, scheduled_at: "2026-10-10T00:00:00.000Z", tz: "America/New_York" };

        expect(isUpcoming(dateOnly, now)).toBe(true);

        expect(formatCallTime(dateOnly)).toBe("Oct 10, 2026");

        expect(isUpcoming({ ...dateOnly, scheduled_at: "2026-10-11T00:00:00.000Z" }, now)).toBe(true);

        expect(isUpcoming({ ...dateOnly, scheduled_at: "2026-10-09T00:00:00.000Z" }, now)).toBe(false);
    });
});

describe("isCallToday", () => {
    const now = new Date("2026-10-21T18:00:00.000Z"); // Oct 21 in every US zone

    it("is true for a date-only event on its UTC date in every US zone", () => {
        for (const tz of ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Pacific/Honolulu"]) {
            const dateOnly = { call_time_source: null, scheduled_at: "2026-10-21T00:00:00Z", tz };

            expect(isCallToday(dateOnly, now)).toBe(true);

            expect(isCallToday({ ...dateOnly, scheduled_at: "2026-10-20T00:00:00Z" }, now)).toBe(false);
        }
    });

    it("reads a timed call's date in tz", () => {
        // 2026-10-22T05:00Z = 10:00 PM Oct 21 in Los Angeles, 1:00 AM Oct 22 in New York.
        const timed = { call_time_source: "wire", scheduled_at: "2026-10-22T05:00:00.000Z", tz: "America/Los_Angeles" };

        expect(isCallToday(timed, now)).toBe(true);

        expect(isCallToday({ ...timed, tz: "America/New_York" }, now)).toBe(false);
    });
});

describe("calendarDefaultWindow", () => {
    it("is yesterday … today + 14 in New York days, across the UTC / New York day boundary", () => {
        // 03:59 UTC on Oct 10 = 11:59 PM Oct 9 in New York (EDT).
        expect(calendarDefaultWindow(new Date("2026-10-10T03:59:00.000Z"))).toEqual({
            from: "2026-10-08",
            to: "2026-10-23",
        });

        expect(calendarDefaultWindow(new Date("2026-10-10T04:00:00.000Z"))).toEqual({
            from: "2026-10-09",
            to: "2026-10-24",
        });
    });

    it("crosses month and year ends", () => {
        expect(calendarDefaultWindow(new Date("2026-12-25T15:00:00.000Z"))).toEqual({
            from: "2026-12-24",
            to: "2027-01-08",
        });
    });
});

describe("calendarWindow / orderedWindow", () => {
    const now = new Date("2026-10-10T15:00:00.000Z");

    it("fills missing days from the default window", () => {
        expect(calendarWindow({}, now)).toEqual({ from: "2026-10-09", to: "2026-10-24" });

        expect(calendarWindow({ from: "2026-10-01" }, now)).toEqual({ from: "2026-10-01", to: "2026-10-24" });
    });

    it("swaps from > to instead of failing", () => {
        expect(orderedWindow({ from: "2026-11-01", to: "2026-10-01" })).toEqual({ from: "2026-10-01", to: "2026-11-01" });

        expect(calendarWindow({ from: "2026-12-01" }, now)).toEqual({ from: "2026-10-24", to: "2026-12-01" });

        expect(orderedWindow({ from: "2026-10-01" })).toEqual({ from: "2026-10-01" });
    });
});

describe("formatStartedAgo", () => {
    const now = new Date("2026-10-10T20:45:00.000Z");

    it("formats minutes and hours", () => {
        expect(formatStartedAgo("2026-10-10T20:33:00.000Z", now)).toBe("started 12 min ago");

        expect(formatStartedAgo("2026-10-10T19:40:00.000Z", now)).toBe("started 1 h 05 min ago");

        expect(formatStartedAgo("2026-10-10T20:46:00.000Z", now)).toBe("started just now");
    });
});

describe("formatBytes", () => {
    it("formats bytes, KB and MB", () => {
        expect(formatBytes(812)).toBe("812 B");

        expect(formatBytes(4300)).toBe("4.2 KB");

        expect(formatBytes(40_000_000)).toBe("38.1 MB");

        expect(formatBytes(null)).toBe("—");
    });
});

describe("formatInstant", () => {
    it("formats a timestamp with its time and an absent one as a dash", () => {
        expect(formatInstant("2026-10-29T20:30:00.000Z")).toMatch(/2026/);

        expect(formatInstant(null)).toBe("—");

        expect(formatInstant(undefined)).toBe("—");
    });
});

describe("eventLabel", () => {
    const base = { event_title: null, event_type: "earnings_call" as const, fiscal_quarter: 3, fiscal_year: 2026 };

    it("labels an earnings call by its fiscal period, never by a title", () => {
        expect(eventLabel(base)).toBe("Q3 FY2026");

        expect(eventLabel({ ...base, event_title: "Q3 call" })).toBe("Q3 FY2026");
    });

    it("labels a non-earnings event by its title, else its fiscal period", () => {
        expect(eventLabel({ ...base, event_title: "Investor Day 2026", event_type: "investor_day" })).toBe("Investor Day 2026");

        expect(eventLabel({ ...base, event_title: "  ", event_type: "conference" })).toBe("Q3 FY2026");

        expect(eventLabel({ ...base, event_type: "agm", fiscal_quarter: null, fiscal_year: null })).toBe("—");
    });
});
