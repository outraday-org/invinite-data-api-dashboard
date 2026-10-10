import type {
    EarningsCallsCoverageDay,
    EarningsCallsKeywordHitDay,
    EarningsCallsStatusDay,
    StatusFamily,
    StatusFamilyDay,
} from "@/lib/api/types";

/** One x-axis point: the day plus one value per series key (null = a gap, never zero). */
export type ChartRow = Record<string, null | number | string> & { day: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every UTC day of the window, oldest first, ending on the UTC day of `generatedAt` and `windowDays`
 * long. The charts' x-axis: a day without a row stays on the axis with `null` values, so a line shows
 * a gap there instead of joining its neighbours. An invalid timestamp yields no days.
 */
export function windowDayList(generatedAt: string, windowDays: number, options?: { endsYesterday?: boolean }): Array<string> {
    const end = Date.parse(generatedAt);

    if (Number.isNaN(end) || windowDays < 1) return [];

    // The earnings rollup is daily (06:15 ET), so its newest day is yesterday: its axis ends there
    // and never shows today as an empty day; the API axis ends today ("today (partial)").
    const endOffset = options?.endsYesterday ? DAY_MS : 0;

    const endDay = Date.UTC(new Date(end).getUTCFullYear(), new Date(end).getUTCMonth(), new Date(end).getUTCDate()) - endOffset;

    return Array.from({ length: windowDays }, (_, index) =>
        new Date(endDay - (windowDays - 1 - index) * DAY_MS).toISOString().slice(0, 10));
}

/** The window's days plus any row day outside it (never drop a measured day), sorted. */
function axisDays(windowDays: ReadonlyArray<string>, rowDays: Iterable<string>) {
    return [...new Set([...rowDays, ...windowDays])].sort();
}

type NumericDayField = "availability" | "p50_ms" | "p95_ms";

/**
 * One row per window day, one column per family; a family without traffic that day gets `null`,
 * which the chart draws as a gap. Availability is scaled to percent.
 */
export function familyDayRows(
    families: ReadonlyArray<StatusFamily>,
    field: NumericDayField,
    windowDays: ReadonlyArray<string>,
): Array<ChartRow> {
    const byFamily = new Map(families.map(family => [
        family.family,
        new Map<string, StatusFamilyDay>(family.days.map(item => [item.day, item])),
    ]));

    const days = axisDays(windowDays, families.flatMap(family => family.days.map(item => item.day)));

    return days.map((day) => {
        const row: ChartRow = { day };

        for (const family of families) {
            const value = byFamily.get(family.family)?.get(day)?.[field] ?? null;

            row[family.family] = value === null ? null : field === "availability" ? value * 100 : value;
        }

        return row;
    });
}

export type EarningsDayPoint = {
    breached: boolean;
    captureSuccessPct: null | number;
    day: string;
    finalLatencyP95S: null | number;
    firstSegmentP95S: null | number;
    /** Speech → keyword hit p50 (s, measured inside the API process); null on a day without hits. */
    keywordHitP50S: null | number;
    /** Speech → keyword hit p95 (s); null on a day without hits or above the histogram's last bucket. */
    keywordHitP95S: null | number;
};

const msToSeconds = (value: null | number) => (value === null ? null : value / 1000);

/**
 * The selected vendor's rows (`all` = the aggregate rows) on the window's days, joined by day with the
 * API-measured keyword-hit latency (not per vendor); a day without a row is all `null`, a day without
 * hits has null keyword values (a gap on the chart, never a zero).
 */
export function earningsDayPoints(
    days: ReadonlyArray<EarningsCallsStatusDay>,
    vendor: string,
    windowDays: ReadonlyArray<string>,
    keywordHitDays: ReadonlyArray<EarningsCallsKeywordHitDay> = [],
): Array<EarningsDayPoint> {
    const byDay = new Map(days.filter(item => item.vendor === vendor).map(item => [item.day, item]));

    const keywordByDay = new Map(keywordHitDays.filter(item => item.hits > 0).map(item => [item.day, item]));

    return axisDays(windowDays, [...byDay.keys(), ...keywordByDay.keys()]).map((day) => {
        const item = byDay.get(day);

        const keyword = keywordByDay.get(day);

        const keywordValues = {
            keywordHitP50S: msToSeconds(keyword?.p50Ms ?? null),
            keywordHitP95S: msToSeconds(keyword?.p95Ms ?? null),
        };

        if (!item) {
            return { breached: false, captureSuccessPct: null, day, finalLatencyP95S: null, firstSegmentP95S: null, ...keywordValues };
        }

        return {
            breached: item.breaches.length > 0,
            captureSuccessPct: item.captureSuccessRate === null ? null : item.captureSuccessRate * 100,
            day,
            finalLatencyP95S: item.finalLatencyP95S,
            firstSegmentP95S: msToSeconds(item.firstSegmentP95Ms),
            ...keywordValues,
        };
    });
}

export type CoverageChartRow = {
    coveredLive: null | number;
    coveredReplay24h: null | number;
    day: string;
    notCovered: null | number;
    total: null | number;
};

/** Coverage counts on the window's days; a day without a row is all `null` (no bar, not a zero bar). */
export function coverageRows(
    coverageDays: ReadonlyArray<EarningsCallsCoverageDay>,
    windowDays: ReadonlyArray<string>,
): Array<CoverageChartRow> {
    const byDay = new Map(coverageDays.map(item => [item.day, item]));

    return axisDays(windowDays, byDay.keys()).map((day) => {
        const item = byDay.get(day);

        return item ?? { coveredLive: null, coveredReplay24h: null, day, notCovered: null, total: null };
    });
}

/** Whether no family measured a single request yet. */
export function hasNoMeasuredRequests(families: ReadonlyArray<StatusFamily>) {
    return families.every(family => family.days.length === 0);
}
