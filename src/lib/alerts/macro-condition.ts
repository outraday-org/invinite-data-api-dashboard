import type { MacroFamily } from "@/lib/api/macro";

import { MACRO_ALERT_SERIES } from "@/lib/api/operations.gen";
import { isRecord } from "@/lib/guards";

export type MacroSeriesId = keyof typeof MACRO_ALERT_SERIES;
export { MACRO_FAMILIES, type MacroFamily } from "@/lib/api/macro";
export const MACRO_EVENTS = ["macro.released", "macro.revised"] as const;
export const MACRO_OPERATOR_LABELS = { gt: "Above", gte: "At least", lt: "Below", lte: "At most" } as const;
export const MACRO_METRIC_LABELS: Record<string, string> = { change_1m_pct: "Monthly change", change_12m_pct: "Yearly change", change_prior: "Change from prior period",
    change_year: "Change from prior year", change_year_pct: "Yearly percentage change", value: "Value" };
export const familyLabels: Record<MacroFamily, string> = { gdp: "GDP and income", inflation: "Inflation", labor: "Labor market", yield_curve: "Treasury yields" };
export const isMacroSeries = (id: unknown): id is MacroSeriesId => typeof id === "string" && Object.hasOwn(MACRO_ALERT_SERIES, id);
export const thresholdFields = (id: MacroSeriesId): Record<string, string> => MACRO_ALERT_SERIES[id].threshold_fields;

export function readMacroThreshold(raw: unknown) {
    if (typeof raw !== "string" || !raw) return null;

    try {
        const value: unknown = JSON.parse(raw);

        if (isRecord(value) && isMacroSeries(value.series_id) && typeof value.field === "string" && typeof value.operator === "string") {
            return { field: value.field, operator: value.operator, series_id: value.series_id, value: String(value.value ?? "") };
        }
    }
    catch { /* The field validator reports malformed input on submit. */ }

    return null;
}

export function describeMacroThreshold(raw: unknown): null | string {
    const threshold = readMacroThreshold(typeof raw === "string" ? raw : JSON.stringify(raw));

    if (!threshold) return null;

    const op = Object.hasOwn(MACRO_OPERATOR_LABELS, threshold.operator) ? MACRO_OPERATOR_LABELS[threshold.operator as keyof typeof MACRO_OPERATOR_LABELS].toLowerCase() : threshold.operator;

    return `${MACRO_ALERT_SERIES[threshold.series_id].label} · ${MACRO_METRIC_LABELS[threshold.field]} ${op} ${threshold.value} ${thresholdFields(threshold.series_id)[threshold.field]}`;
}
