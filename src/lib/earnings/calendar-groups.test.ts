import { describe, expect, it } from "vitest";

import { calendarPresetWindow, dayHeading, groupEventsByNewYorkDay, isoWeekNumber, presetOf, weekDaysOf } from "./calendar-groups";

const at = (scheduled_at: string, timed = true) => ({ call_time_source: timed ? "wire" as const : null, id: scheduled_at, scheduled_at });

describe("groupEventsByNewYorkDay", () => {
    it("groups by the New York day across the DST change (2026-11-01, EDT → EST)", () => {
        const groups = groupEventsByNewYorkDay([
            // Oct 30, 11:30 PM EDT (UTC−4) — still Oct 30 in New York.
            at("2026-10-31T03:30:00Z"),
            // Nov 1, 8:30 PM EST (UTC−5): the UTC date is already Nov 2.
            at("2026-11-02T01:30:00Z"),
            // Nov 2, 8:30 AM EST.
            at("2026-11-02T13:30:00Z"),
        ]);

        expect(groups.map(group => [group.day, group.events.length])).toEqual([
            ["2026-10-30", 1],
            ["2026-11-01", 1],
            ["2026-11-02", 1],
        ]);
    });

    it("a date-only event stays on its stated day (never shifted into New York's previous evening)", () => {
        const groups = groupEventsByNewYorkDay([at("2026-11-03T00:00:00Z", false), at("2026-11-03T21:00:00Z")]);

        expect(groups).toHaveLength(1);

        expect(groups[0].day).toBe("2026-11-03");

        expect(groups[0].events).toHaveLength(2);
    });

    it("days ascending, the API's order inside a day", () => {
        const groups = groupEventsByNewYorkDay([at("2026-11-05T20:00:00Z"), at("2026-11-04T13:00:00Z"), at("2026-11-05T13:00:00Z")]);

        expect(groups.map(group => group.day)).toEqual(["2026-11-04", "2026-11-05"]);

        expect(groups[1].events.map(event => event.id)).toEqual(["2026-11-05T20:00:00Z", "2026-11-05T13:00:00Z"]);
    });

    it("names a day", () => {
        expect(dayHeading("2026-11-23")).toBe("Mon, Nov 23");
    });
});

describe("calendar presets (New York days)", () => {
    // Wednesday, Nov 18, 2026, 10:00 New York.
    const now = new Date("2026-11-18T15:00:00Z");

    it("today, this week (Mon–Sun), next week", () => {
        expect(calendarPresetWindow("today", now)).toEqual({ from: "2026-11-18", to: "2026-11-18" });

        expect(calendarPresetWindow("this-week", now)).toEqual({ from: "2026-11-16", to: "2026-11-22" });

        expect(calendarPresetWindow("next-week", now)).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    });

    it("a Sunday belongs to the week that started the Monday before", () => {
        expect(calendarPresetWindow("this-week", new Date("2026-11-22T15:00:00Z"))).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    });

    it("recognises a preset window; a hand-picked range is none", () => {
        expect(presetOf({ from: "2026-11-23", to: "2026-11-29" }, now)).toBe("next-week");

        expect(presetOf({ from: "2026-11-17", to: "2026-12-02" }, now)).toBeNull();
    });
});

describe("week helpers", () => {
    it("weekDaysOf: Monday … Sunday around a day", () => {
        expect(weekDaysOf("2026-11-25")).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);

        expect(weekDaysOf("2026-11-29")[0]).toBe("2026-11-23");

        expect(weekDaysOf("2026-11-23")[0]).toBe("2026-11-23");
    });

    it("isoWeekNumber", () => {
        expect(isoWeekNumber("2026-11-25")).toBe(48);

        expect(isoWeekNumber("2026-01-01")).toBe(1);

        expect(isoWeekNumber("2027-01-01")).toBe(53);

        expect(isoWeekNumber("2024-12-30")).toBe(1);
    });
});
