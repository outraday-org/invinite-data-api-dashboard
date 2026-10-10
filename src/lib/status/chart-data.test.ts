import { describe, expect, it } from "vitest";

import type { EarningsCallsStatusDay, StatusFamily } from "@/lib/api/types";

import {
    coverageRows,
    earningsDayPoints,
    familyDayRows,
    hasNoMeasuredRequests,
    windowDayList,
} from "./chart-data";

function family(name: StatusFamily["family"], days: StatusFamily["days"]): StatusFamily {
    return { days, family: name, last_7d: { availability: null, p95_ms: null, requests: 0 } };
}

function day(value: string, p95: null | number, availability: null | number) {
    return { availability, day: value, failures: 0, p50_ms: null, p95_ms: p95, requests: 10 };
}

const WINDOW = ["2026-10-08", "2026-10-09", "2026-10-10"];

describe("windowDayList", () => {
    it("lists every UTC day of the window, ending on the generated day", () => {
        expect(windowDayList("2026-10-10T23:30:00Z", 3)).toEqual(WINDOW);

        expect(windowDayList("2026-03-01T00:10:00Z", 2)).toEqual(["2026-02-28", "2026-03-01"]);
    });

    it("yields no days for an invalid timestamp or window", () => {
        expect(windowDayList("nope", 3)).toEqual([]);

        expect(windowDayList("2026-10-10T00:00:00Z", 0)).toEqual([]);
    });
});

describe("familyDayRows", () => {
    it("puts a null row in the middle of the window for a day without traffic (a gap)", () => {
        const rows = familyDayRows([
            family("company", [day("2026-10-08", 120, 1), day("2026-10-10", 140, 0.99)]),
        ], "p95_ms", WINDOW);

        expect(rows).toEqual([
            { company: 120, day: "2026-10-08" },
            { company: null, day: "2026-10-09" },
            { company: 140, day: "2026-10-10" },
        ]);
    });

    it("fills every family on every window day", () => {
        const rows = familyDayRows([
            family("company", [day("2026-10-08", 120, 1)]),
            family("ipos", [day("2026-10-09", 80, 1)]),
        ], "p95_ms", WINDOW);

        expect(rows).toEqual([
            { company: 120, day: "2026-10-08", ipos: null },
            { company: null, day: "2026-10-09", ipos: 80 },
            { company: null, day: "2026-10-10", ipos: null },
        ]);
    });

    it("scales availability to percent and keeps a measured day outside the window", () => {
        const rows = familyDayRows([family("company", [day("2026-10-07", 1, 0.995)])], "availability", WINDOW);

        expect(rows.map(row => row.day)).toEqual(["2026-10-07", ...WINDOW]);

        expect(rows[0].company).toBeCloseTo(99.5);
    });

    it("detects an API without measured requests", () => {
        expect(hasNoMeasuredRequests([family("company", []), family("ipos", [])])).toBe(true);

        expect(hasNoMeasuredRequests([family("company", [day("2026-10-08", 1, 1)])])).toBe(false);
    });
});

describe("earningsDayPoints", () => {
    const base: EarningsCallsStatusDay = {
        breaches: [],
        callsLive: 9,
        callsTotal: 10,
        captureSuccessRate: 0.9,
        day: "2026-10-08",
        finalLatencyP50S: 100,
        finalLatencyP95S: 200,
        firstSegmentP50Ms: 8000,
        firstSegmentP95Ms: 12000,
        vendor: "all",
    };

    it("keeps the selected vendor's rows in seconds and percent, with a null point for a hole", () => {
        const points = earningsDayPoints([
            { ...base, breaches: ["final"], day: "2026-10-10" },
            base,
            { ...base, day: "2026-10-09", vendor: "notified" },
        ], "all", WINDOW);

        expect(points).toEqual([
            { breached: false, captureSuccessPct: 90, day: "2026-10-08", finalLatencyP95S: 200, firstSegmentP95S: 12, keywordHitP50S: null, keywordHitP95S: null },
            { breached: false, captureSuccessPct: null, day: "2026-10-09", finalLatencyP95S: null, firstSegmentP95S: null, keywordHitP50S: null, keywordHitP95S: null },
            { breached: true, captureSuccessPct: 90, day: "2026-10-10", finalLatencyP95S: 200, firstSegmentP95S: 12, keywordHitP50S: null, keywordHitP95S: null },
        ]);
    });

    it("joins the keyword-hit latency by day in seconds, null (not zero) on a day without hits", () => {
        const points = earningsDayPoints([base, { ...base, day: "2026-10-10" }], "all", WINDOW, [
            { day: "2026-10-08", hits: 12, p50Ms: 800, p95Ms: 1600 },
            { day: "2026-10-09", hits: 0, p50Ms: 0, p95Ms: 0 },
            { day: "2026-10-10", hits: 3, p50Ms: 400, p95Ms: null },
        ]);

        expect(points.map(point => ({ day: point.day, keywordHitP50S: point.keywordHitP50S, keywordHitP95S: point.keywordHitP95S }))).toEqual([
            { day: "2026-10-08", keywordHitP50S: 0.8, keywordHitP95S: 1.6 },
            { day: "2026-10-09", keywordHitP50S: null, keywordHitP95S: null },
            { day: "2026-10-10", keywordHitP50S: 0.4, keywordHitP95S: null },
        ]);

        expect(points[0].firstSegmentP95S).toBe(12);
    });

    it("keeps a keyword-hit day the vendor has no SLO row for (never drop a measured day)", () => {
        const points = earningsDayPoints([], "notified", WINDOW, [{ day: "2026-10-07", hits: 1, p50Ms: 200, p95Ms: 200 }]);

        expect(points.map(point => point.day)).toEqual(["2026-10-07", ...WINDOW]);

        expect(points[0]).toMatchObject({ captureSuccessPct: null, firstSegmentP95S: null, keywordHitP50S: 0.2, keywordHitP95S: 0.2 });
    });
});

describe("coverageRows", () => {
    it("fills a day without coverage with nulls", () => {
        const rows = coverageRows([
            { coveredLive: 4, coveredReplay24h: 1, day: "2026-10-08", notCovered: 0, total: 5 },
            { coveredLive: 3, coveredReplay24h: 0, day: "2026-10-10", notCovered: 1, total: 4 },
        ], WINDOW);

        expect(rows[1]).toEqual({ coveredLive: null, coveredReplay24h: null, day: "2026-10-09", notCovered: null, total: null });

        expect(rows).toHaveLength(3);
    });
});

describe("windowDayList endsYesterday", () => {
    it("ends the earnings axis on the day before the generated day", () => {
        expect(windowDayList("2026-10-10T06:20:11.000Z", 3, { endsYesterday: true })).toEqual([
            "2026-10-07",
            "2026-10-08",
            "2026-10-09",
        ]);
    });
});
