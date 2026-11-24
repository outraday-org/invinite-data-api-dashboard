import { z } from "zod";

import { optionalDay, optionalEnum, optionalText, orderedWindow } from "@/lib/url-state";

import type { components } from "./schema";

import { MACRO_ALERT_SERIES } from "./operations.gen";

export type MacroSeries = components["schemas"]["MacroSeries"];
export type MacroReading
    = | components["schemas"]["MacroGdpReading"]
        | components["schemas"]["MacroInflationReading"]
        | components["schemas"]["MacroLaborReading"];
export type MacroCurve = components["schemas"]["TreasuryYieldCurve"];
export type MacroFamily = MacroSeries["family"];
export type ScalarFamily = Exclude<MacroFamily, "yield_curve">;
export const MACRO_FAMILIES = ["inflation", "gdp", "labor", "yield_curve"] as const;

export const MACRO_PAGES = {
    gdp: {
        defaultSeries: "real_gdp_growth",
        description: "US output, income, spending and contributions to real GDP growth.",
        history: "listMacroGdp",
        path: "/us-macro/gdp",
        snapshot: "getMacroGdpSnapshot",
        title: "GDP & income",
    },
    inflation: {
        defaultSeries: "cpi_all_sa",
        description: "US consumer prices from the CPI and PCE price indexes.",
        history: "listMacroInflation",
        path: "/us-macro/inflation",
        snapshot: "getMacroInflationSnapshot",
        title: "Inflation",
    },
    labor: {
        defaultSeries: "payrolls_sa",
        description: "US employment, earnings, job openings and weekly unemployment claims.",
        history: "listMacroLabor",
        path: "/us-macro/labor",
        snapshot: "getMacroLaborSnapshot",
        title: "Labor market",
    },
    yield_curve: {
        defaultSeries: "treasury_par_y10",
        description: "Daily US Treasury par yields across fourteen maturities.",
        history: "listTreasuryYieldCurves",
        path: "/us-macro/yield-curve",
        snapshot: "getTreasuryYieldCurveSnapshot",
        title: "Treasury yield curve",
    },
} as const;

export const TENORS = [
    "m1",
    "m1_5",
    "m2",
    "m3",
    "m4",
    "m6",
    "y1",
    "y2",
    "y3",
    "y5",
    "y7",
    "y10",
    "y20",
    "y30",
] as const;
export type Tenor = (typeof TENORS)[number];

export const macroSearch = z
    .object({
        date: optionalDay(),
        from: optionalDay(),
        series: optionalText(80),
        tenor: optionalEnum(TENORS),
        to: optionalDay(),
        view: optionalEnum(["snapshot", "history"]),
    })
    .transform(orderedWindow);
export type MacroSearch = z.infer<typeof macroSearch>;

/** A link to a specific series or tenor opens its history. A quotation date selects a dated curve. */
export const macroView = (search: MacroSearch): "history" | "snapshot" =>
    search.view ?? ((search.series || search.from || search.to || (search.tenor && !search.date)) ? "history" : "snapshot");

export type MacroId = keyof typeof MACRO_ALERT_SERIES;
export type FamilyId<TFamily extends MacroFamily> = {
    [K in MacroId]: (typeof MACRO_ALERT_SERIES)[K]["family"] extends TFamily ? K : never;
}[MacroId];
export function familyId<TFamily extends MacroFamily>(
    value: string | undefined,
    family: TFamily,
): value is FamilyId<TFamily> {
    return (
        value !== undefined
        && Object.hasOwn(MACRO_ALERT_SERIES, value)
        && MACRO_ALERT_SERIES[value as MacroId].family === family
    );
}
export const tenorLabel = (tenor: Tenor) =>
    tenor.startsWith("m") ? `${tenor.slice(1).replace("_", ".")} mo` : `${tenor.slice(1)} yr`;
