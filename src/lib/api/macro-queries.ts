import type { MacroFamily, ScalarFamily } from "./macro";

import { useEarningsInfinite, useEarningsQuery } from "./queries";
import {
    getMacroCatalog,
    getMacroCurves,
    getMacroCurveSnapshot,
    getMacroHistory,
    getMacroSnapshot,
} from "./server-functions-macro";

const defaults = { cancelable: true, errorMessage: null, staleTime: 30_000 } as const;

export function useMacroCatalog(family?: MacroFamily, enabled = true) {
    return useEarningsInfinite({
        ...defaults,
        enabled,
        fetchPage: (cursor, apiKey, signal) =>
            getMacroCatalog({ data: { apiKey, cursor: cursor ?? undefined, family }, signal }),
        queryKey: ["v2", "macro", "catalog", family ?? "all"],
    });
}
export function useMacroSnapshot(family: ScalarFamily, enabled: boolean) {
    return useEarningsInfinite({
        ...defaults,
        enabled,
        fetchPage: (cursor, apiKey, signal) =>
            getMacroSnapshot({ data: { apiKey, cursor: cursor ?? undefined, family }, signal }),
        queryKey: ["v2", "macro", family, "snapshot"],
    });
}
export function useMacroHistory(
    family: ScalarFamily,
    series: string,
    from: string | undefined,
    to: string | undefined,
    enabled: boolean,
) {
    return useEarningsInfinite({
        ...defaults,
        enabled,
        fetchPage: (cursor, apiKey, signal) =>
            getMacroHistory({ data: { apiKey, cursor: cursor ?? undefined, family, from, series, to }, signal }),
        queryKey: ["v2", "macro", family, "history", series, from ?? "", to ?? ""],
    });
}
export function useMacroCurves(from: string | undefined, to: string | undefined, enabled: boolean) {
    return useEarningsInfinite({
        ...defaults,
        enabled,
        fetchPage: (cursor, apiKey, signal) =>
            getMacroCurves({ data: { apiKey, cursor: cursor ?? undefined, from, to }, signal }),
        queryKey: ["v2", "macro", "yield_curve", "history", "", from ?? "", to ?? ""],
    });
}
export function useMacroCurveSnapshot(enabled: boolean) {
    return useEarningsQuery({
        ...defaults,
        enabled,
        load: (apiKey, signal) => getMacroCurveSnapshot({ data: { apiKey }, signal }),
        queryKey: ["v2", "macro", "yield_curve", "snapshot"],
    });
}
