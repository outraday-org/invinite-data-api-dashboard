import { describe, expect, it } from "vitest";

import {
    formatKpiValue,
    formatNonGaapValue,
    formatSignedNonGaap,
    formatYoyChange,
    kpiSeriesGroups,
    kpiSeriesSegments,
    reconciliationState,
    sourceCellText,
} from "./extraction";
import { KPI_SERIES_POINTS } from "./extraction-fixtures";

describe("non-GAAP formatting", () => {
    it("writes each unit", () => {
        expect(formatNonGaapValue(1.64, "per_share", "USD")).toBe("$1.64");

        expect(formatNonGaapValue(31_300_000_000, "USD", null)).toBe("$31.3B");

        expect(formatNonGaapValue(12.5, "pct", null)).toBe("12.5%");

        expect(formatNonGaapValue(1.25, "ratio", null)).toBe("1.25x");

        expect(formatNonGaapValue(null, "USD", "USD")).toBe("—");
    });

    it("signs an adjustment as printed", () => {
        expect(formatSignedNonGaap(0.12, "per_share", "USD")).toBe("+$0.12");

        expect(formatSignedNonGaap(-0.03, "per_share", "USD")).toBe("-$0.03");
    });

    it("names the reconciliation state and the release cell (1-based)", () => {
        expect(reconciliationState(true)).toBe("reconciled");

        expect(reconciliationState(false)).toBe("gap");

        expect(reconciliationState(null)).toBe("none");

        expect(sourceCellText({ col: 1, row: 6, table: 2 })).toBe("Table 3, row 7, column 2");
    });
});

describe("KPI series", () => {
    it("formats the catalog units and the YoY change (points for pct)", () => {
        expect(formatKpiValue(86.1, "pct")).toBe("86.1%");

        expect(formatKpiValue(12.3, "cents")).toBe("12.3¢");

        expect(formatKpiValue(145.2, "usd_per_unit")).toBe("$145.20");

        expect(formatYoyChange(0.8, "pct")).toBe("+0.8 pts");

        expect(formatYoyChange(-3.4, "count")).toBe("-3.4%");

        expect(formatYoyChange(null, "pct")).toBe("—");
    });

    it("groups the company-wide points per KPI, oldest first, plotting the most common period kind", () => {
        const groups = kpiSeriesGroups(KPI_SERIES_POINTS);

        expect(groups.map(group => group.kpiKey)).toEqual(["available_seat_miles", "load_factor"]);

        const load = groups[1];

        // The Domestic point is a segment: not company-wide.
        expect(load.points.map(point => point.id)).toEqual(["k3", "k2", "k1"]);

        expect(load.plottedKind).toBe("quarter");
    });

    it("keeps one segment's points and lists the segments", () => {
        expect(kpiSeriesSegments(KPI_SERIES_POINTS)).toEqual(["Domestic"]);

        expect(kpiSeriesGroups(KPI_SERIES_POINTS, "Domestic").map(group => group.points.map(point => point.id))).toEqual([["k4"]]);
    });
});
