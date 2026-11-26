import type { V2GuidanceQualifier, V2KpiSeriesPoint, V2NonGaapMetric } from "@/lib/api/types";

import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { formatNumberEnCompact } from "@/lib/utils";

import { formatDecimal } from "./labels";

/**
 * The earnings extraction of Data API 12.1 (pure): the reported non-GAAP figures (`/v1/non-gaap`), the KPI series
 * (`/v1/kpi-series`) and the qualifier of a guidance item without a number. Every value is served as printed: nothing
 * here corrects, sums or picks a number.
 */

const plain = (value: number) => (Math.abs(value) >= 1000 ? formatNumberEnCompact(value) : formatDecimal(value));

/**
 * A non-GAAP figure (or an adjustment line) in its unit: `USD` → "$1.2B", `per_share` → "$2.05", `pct` → "12.5%",
 * `ratio` → "1.25x", `count` / none → the number (the currency code first when one is given).
 */
export function formatNonGaapValue(value: null | number, unit: NonNullable<V2NonGaapMetric["unit"]> | null, currency: null | string): string {
    if (value === null || !Number.isFinite(value)) return "—";

    switch (unit) {
        case "count":
            return plain(value);
        case "pct":
            return `${formatDecimal(value)}%`;
        case "per_share":
            return formatMoney(value, { currency: currency ?? "USD" });
        case "ratio":
            return `${formatDecimal(value)}x`;
        case "USD":
            return formatMoneyCompact(value, currency ?? "USD");
        default:
            return currency ? `${currency} ${plain(value)}` : plain(value);
    }
}

/** An adjustment line signed as printed: "+$1.2M", "-$300K", "$0". */
export function formatSignedNonGaap(value: number, unit: NonNullable<V2NonGaapMetric["unit"]> | null, currency: null | string): string {
    const text = formatNonGaapValue(value, unit, currency);

    return value > 0 ? `+${text}` : text;
}

export type ReconciliationState = "gap" | "none" | "reconciled";

/** `reconciled` in words: true = adds up, false = does not add up (served as printed), null = nothing to check. */
export function reconciliationState(reconciled: boolean | null): ReconciliationState {
    if (reconciled === null) return "none";

    return reconciled ? "reconciled" : "gap";
}

export const RECONCILIATION_LABELS: Record<ReconciliationState, { className: string; label: string; title: string }> = {
    gap: {
        className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        label: "Does not add up",
        title: "The GAAP figure plus the adjustments does not give the reported figure within its rounding; served as printed, never corrected.",
    },
    none: {
        className: "border-border text-muted-foreground",
        label: "Nothing to check",
        title: "The release prints no reconciliation for this figure.",
    },
    reconciled: {
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        label: "Reconciled",
        title: "The GAAP figure plus the adjustments gives the reported figure within its rounding.",
    },
};

/** Period kinds of `/v1/non-gaap`, `/v1/kpi-series` and `/v1/catalog/kpis`. */
export const EXTRACTION_PERIOD_KIND_LABELS: Record<V2KpiSeriesPoint["period_kind"], string> = {
    half: "Half year",
    instant: "Point in time",
    nine_months: "Nine months",
    quarter: "Quarter",
    year: "Year",
};

/** Where a non-GAAP figure was read: "Table 3, row 7, column 2" (the API counts from 0, people from 1). */
export function sourceCellText(source: Pick<V2NonGaapMetric["source"], "col" | "row" | "table">): string {
    return `Table ${source.table + 1}, row ${source.row + 1}, column ${source.col + 1}`;
}

/** A guidance item's `qualifier` (why it has no number) in words. */
export const QUALIFIER_LABELS: Record<V2GuidanceQualifier, string> = {
    directional: "Directional",
    range_unspecified: "Range not stated",
    reaffirmed: "Reaffirmed",
    withdrawn: "Withdrawn",
};

/** The units of the KPI catalog (`usd`, `pct`, `count`, `cents`, `ratio`, `usd_per_unit`) in words; another one as itself. */
const KPI_UNIT_LABELS: Record<string, string> = {
    cents: "Cents",
    count: "Count",
    pct: "Percent",
    ratio: "Ratio",
    usd: "USD",
    usd_per_unit: "USD per unit",
};

export const kpiUnitLabel = (unit: string) => KPI_UNIT_LABELS[unit] ?? unit.replaceAll("_", " ");

/** A KPI series value in its catalog unit: "$1.2B", "84.5%", "12.3¢", "1.10x", "$145.20", "2.1M". */
export function formatKpiValue(value: null | number, unit: string): string {
    if (value === null || !Number.isFinite(value)) return "—";

    switch (unit) {
        case "cents":
            return `${formatDecimal(value)}¢`;
        case "count":
            return plain(value);
        case "pct":
            return `${formatDecimal(value)}%`;
        case "ratio":
            return `${formatDecimal(value)}x`;
        case "usd":
            return formatMoneyCompact(value);
        case "usd_per_unit":
            return formatMoney(value);
        default:
            return `${plain(value)} ${unit.replaceAll("_", " ")}`;
    }
}

/** `yoy_change`: points for a `pct` KPI ("+1.2 pts"), percent for any other unit ("-3.4%"); null → "—". */
export function formatYoyChange(change: null | number, unit: string): string {
    if (change === null || !Number.isFinite(change)) return "—";

    const sign = change > 0 ? "+" : "";

    return unit === "pct" ? `${sign}${formatDecimal(change)} pts` : `${sign}${formatDecimal(change)}%`;
}

/** One KPI of the series tab: its points of the shown segment, oldest period first, and the plotted period kind. */
export type KpiSeriesGroup = {
    kpiKey: string;
    label: string;
    /** The period kind the chart plots (the most common one; a quarter and a year never share a line). */
    plottedKind: V2KpiSeriesPoint["period_kind"];
    points: Array<V2KpiSeriesPoint>;
    unit: string;
};

/**
 * The KPI series of a company grouped by `kpi_key` (pure), only the points of `segment` (null = company-wide), oldest
 * period first, groups by label. A KPI can be reported for several period kinds: the chart plots the most common one
 * (the first seen on a tie), the table lists every point.
 */
export function kpiSeriesGroups(points: ReadonlyArray<V2KpiSeriesPoint>, segment: null | string = null): Array<KpiSeriesGroup> {
    const byKey = new Map<string, Array<V2KpiSeriesPoint>>();

    for (const point of points) {
        if (point.segment !== segment) continue;

        const list = byKey.get(point.kpi_key) ?? [];

        list.push(point);

        byKey.set(point.kpi_key, list);
    }

    return [...byKey.entries()]
        .map(([kpiKey, list]) => {
            const counts = new Map<V2KpiSeriesPoint["period_kind"], number>();

            for (const point of list) counts.set(point.period_kind, (counts.get(point.period_kind) ?? 0) + 1);

            let plottedKind = list[0].period_kind;

            for (const [kind, count] of counts) {
                if (count > (counts.get(plottedKind) ?? 0)) plottedKind = kind;
            }

            return {
                kpiKey,
                label: list[0].label,
                plottedKind,
                points: [...list].sort((a, b) => a.period_end.localeCompare(b.period_end)),
                unit: list[0].unit,
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

/** The segments a company's series name (company-wide excluded), sorted. */
export function kpiSeriesSegments(points: ReadonlyArray<V2KpiSeriesPoint>): Array<string> {
    return [...new Set(points.flatMap(point => (point.segment === null ? [] : [point.segment])))].sort((a, b) => a.localeCompare(b));
}

/** Where a KPI series value was read (`origin`). */
export const KPI_SERIES_ORIGIN_LABELS: Record<V2KpiSeriesPoint["origin"], string> = {
    release_table: "Release table",
    release_text: "Release text",
    transcript: "Call",
};

/** `xbrl_check`: the value against the same figure in the company's 10-Q / 10-K. */
export const XBRL_CHECK_LABELS: Record<V2KpiSeriesPoint["xbrl_check"], { className: string; label: string }> = {
    differs: { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400", label: "Differs from filing" },
    matched: { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "Matches filing" },
    none: { className: "border-border text-muted-foreground", label: "Not in XBRL" },
};
