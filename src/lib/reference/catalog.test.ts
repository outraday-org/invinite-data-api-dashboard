import { describe, expect, it } from "vitest";

import { filterCatalogRows, isCatalogMetricId, mappingRuleView, statementLabel, unitLabel } from "./catalog";
import { V2_MAPPING_RULES, V2_METRIC_CATALOG } from "./reference-fixtures";

const rows = V2_METRIC_CATALOG.data;

const filter = (query: string | undefined) => filterCatalogRows(rows, query, row => row.metric_id, row => [row.name, row.description]).map(row => row.metric_id);

describe("filterCatalogRows", () => {
    it("an id typed exactly (a metric label's catalog link) keeps that row only, not the ids it prefixes", () => {
        expect(filter("is_total_revenue")).toEqual(["is_total_revenue"]);

        expect(filter("IS_TOTAL_REVENUE")).toEqual(["is_total_revenue"]);
    });

    it("otherwise every word must appear in the id or a text, any case", () => {
        expect(filter("drivers REVENUE")).toEqual(["is_total_revenue_growth_drivers"]);

        expect(filter("revenue")).toEqual(["is_total_revenue", "is_total_revenue_growth_drivers", "ratio_gross_margin_pct"]);

        expect(filter("share of revenue")).toEqual(["ratio_gross_margin_pct"]);

        expect(filter("nothing like it")).toEqual([]);
    });

    it("an empty filter keeps every row", () => {
        expect(filter(undefined)).toHaveLength(rows.length);

        expect(filter("  ")).toHaveLength(rows.length);
    });
});

describe("mappingRuleView (the rule's free JSON, read defensively)", () => {
    it("a reported concept with its taxonomy and role, the parent and the sign", () => {
        expect(mappingRuleView(V2_MAPPING_RULES.data[0].rule)).toEqual({
            kind: "Reported concept",
            parent: "bs_total_receivables_current",
            sign: "As reported",
            source: "us_gaap:AccountsNotesAndLoansReceivableNetCurrent (primary)",
        });
    });

    it("a formula", () => {
        expect(mappingRuleView(V2_MAPPING_RULES.data[1].rule)).toMatchObject({ kind: "Formula", source: "bs_common_shareholders_equity + bs_additional_paid_in_capital" });
    });

    it("missing or odd fields never throw; an unknown kind reads as itself", () => {
        expect(mappingRuleView({})).toEqual({ kind: "—", parent: null, sign: null, source: null });

        expect(mappingRuleView({ hierarchy: "flat", kind: "new_kind", required_operands: ["a", 3, "b"] })).toEqual({ kind: "new_kind", parent: null, sign: null, source: "a, b" });
    });
});

describe("labels and the metric id rule", () => {
    it("a derived metric has no statement; units read in words", () => {
        expect(statementLabel(null)).toBe("Derived");

        expect(statementLabel("cash-flow")).toBe("Cash flow");

        expect(unitLabel("usdPerShare")).toBe("USD per share");

        expect(unitLabel("bps")).toBe("bps");

        expect(unitLabel(null)).toBe("—");
    });

    it("the catalog's id families pass; an as-reported concept does not", () => {
        for (const id of ["is_total_revenue", "bs_total_assets", "cfs_free_cash_flow", "ratio_gross_margin_pct", "growth_total_revenue", "cagr_ebitda", "seg_revenue_product"]) {
            expect(isCatalogMetricId(id)).toBe(true);
        }

        for (const id of ["us-gaap:Revenues", "Revenues", "aapl_custom", "", null, undefined]) expect(isCatalogMetricId(id)).toBe(false);
    });
});
