import type { V2KpiMention } from "@/lib/api/types";

/** One plotted mention: call day (the x axis), its value in base units, and what was said. */
export type KpiHistoryPoint = {
    day: string;
    eventId: string;
    period: null | string;
    value: number;
    valueText: string;
};

/** What the KPI history chart plots: the mentions of the most common unit, oldest call first. */
export type KpiHistorySeries = {
    /** Mentions left out of the chart: another unit, or no value / no call date (they stay in the table). */
    omitted: number;
    points: Array<KpiHistoryPoint>;
    unit: null | string;
};

/**
 * The chart of a KPI history (pure). A call can state a metric several times (other periods, the press release and
 * the call, a segment and a total), so every mention is a point — nothing is picked or summed. Units are never mixed:
 * the most common unit (first seen on a tie) is plotted.
 */
export function kpiHistorySeries(mentions: ReadonlyArray<V2KpiMention>): KpiHistorySeries {
    const plottable = mentions.filter(mention => mention.value !== null && mention.conference_date !== null);

    const counts = new Map<null | string, number>();

    for (const mention of plottable) counts.set(mention.unit, (counts.get(mention.unit) ?? 0) + 1);

    let unit: null | string = null;

    let best = 0;

    for (const [candidate, count] of counts) {
        if (count > best) {
            unit = candidate;

            best = count;
        }
    }

    const points = plottable
        .filter(mention => mention.unit === unit)
        .map(mention => ({
            day: mention.conference_date ?? "",
            eventId: mention.event_id,
            period: mention.period_label,
            value: mention.value ?? 0,
            valueText: mention.value_text,
        }))
        .sort((a, b) => a.day.localeCompare(b.day));

    return { omitted: mentions.length - points.length, points, unit };
}

/** The calls a history spans (distinct event ids). */
export const kpiHistoryCallCount = (mentions: ReadonlyArray<V2KpiMention>) => new Set(mentions.map(mention => mention.event_id)).size;
