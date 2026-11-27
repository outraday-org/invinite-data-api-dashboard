import { describe, expect, it } from "vitest";

import type { V2AsReportedPresentationNode } from "@/lib/api/types";

import { AAPL_MEMBER_PRESENTATION, SYNTHETIC_Q4_MEMBER_PRESENTATION } from "@/lib/financials/member-fixtures";

import { reportedTreeRows } from "./reported-tree";

const [sales, cost] = AAPL_MEMBER_PRESENTATION.data[0].statements.income_statement?.facts ?? [];

const [products, services, total] = sales.children ?? [];

const period = (label: string, facts: Array<V2AsReportedPresentationNode>) => ({ facts, label });

describe("reported presentation alignment", () => {
    it("keeps filed group order and aligns values by the complete member key", () => {
        const olderOnly = { ...services, company_label: "Support", key: `${services.key}Legacy`, value: 0 };

        const rows = reportedTreeRows([
            period("Q3", [{ ...sales, children: [products, services, total] }, cost]),
            period("Q2", [{ ...sales, children: [{ ...products, value: 10 }, olderOnly, { ...total, value: 15 }] }]),
        ]);

        expect(rows.map(row => row.label)).toEqual([
            "Net sales", "Products", "Services", "Support", "Total net sales", "Cost of sales", "Products", "Services", "Total cost of sales",
        ]);

        expect(rows[1].values).toEqual({ Q2: 10, Q3: 78_678_000_000 });

        expect(rows[2].values).toEqual({ Q2: undefined, Q3: 30_739_000_000 });

        expect(rows[3]).toMatchObject({ preserve: true, values: { Q2: 0, Q3: undefined } });

        expect(rows[4].values).toEqual({ Q2: 15, Q3: 109_417_000_000 });

        expect(rows[0].nodes?.size).toBe(0);
    });

    it("places a group introduced by an older period around only its matching parent occurrence", () => {
        const a = { children: [total], concept: "first", depth: 0, key: "first", label: "First" };

        const b = { children: [{ ...total, value: 2 }], concept: "second", depth: 0, key: "second", label: "Second" };

        const rows = reportedTreeRows([
            period("Q3", [a, b]),
            period("Q2", [{ ...a, children: [{ ...total, value: 3 }] }, { ...b, children: [sales] }]),
        ]);

        const totals = rows.filter(row => row.metricId === total.key);

        expect(totals.map(row => row.values)).toEqual([{ Q2: 3, Q3: 109_417_000_000 }, { Q2: 109_417_000_000, Q3: 2 }]);

        expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);

        expect(new Set(rows.map(row => row.chartId)).size).toBe(rows.length);

        expect(rows.find(row => row.id === totals[0].parentId)?.metricId).toBe("first");

        expect(rows.find(row => row.id === totals[1].parentId)?.metricId).toBe(sales.key);

        expect(totals[0].chartId).toBe(total.key);

        expect(totals[1].chartId).toMatch(/^path:/);
    });

    it("keeps a leading total and renders a member-only group without making up a total", () => {
        const leading = SYNTHETIC_Q4_MEMBER_PRESENTATION.data[0].statements.income_statement?.facts ?? [];

        const rows = reportedTreeRows([period("Q4", [...leading, { ...sales, children: [products] }])]);

        expect(rows.map(row => [row.label, row.isTotal, row.depth])).toEqual([
            ["Total revenue", true, 0], ["Products", false, 1], ["Net sales", false, 0], ["Products", false, 1],
        ]);
    });

    it("keeps newer consolidated rows when they never had members", () => {
        const unrelated = { ...total, concept: "unrelated", key: "unrelated", label: "Unrelated" };

        const rows = reportedTreeRows([period("Q3", [unrelated, total]), period("Q2", [sales])]);

        expect(rows.map(row => row.metricId)).toEqual([unrelated.key, sales.key, products.key, services.key, total.key]);

        expect(rows[4].values).toEqual({ Q2: 109_417_000_000, Q3: 109_417_000_000 });
    });
});

describe("matching uniquely moved rows", () => {
    const parent = { concept: "Parent", depth: 0, key: "Parent", label: "Parent" };

    const nested = (key: string, children: Array<V2AsReportedPresentationNode>) => ({ ...parent, children, concept: key, key, label: key });

    it.each([true, false])("aligns a uniquely moved consolidated key and preserves its original period node (newest nested: %s)", (newestNested) => {
        const newest = { ...total, html_tag_id: "new-native-cell", value: 12 };

        const older = { ...total, accession: "older-source", html_tag_id: "old-native-cell", value: 11 };

        const rows = reportedTreeRows([
            period("Q3", newestNested ? [nested("Parent", [newest])] : [parent, newest]),
            period("Q2", newestNested ? [parent, older] : [nested("Parent", [older])]),
        ]);

        expect(rows.map(row => row.metricId)).toEqual(["Parent", total.key]);

        expect(rows[1].values).toEqual({ Q2: 11, Q3: 12 });

        expect(rows[1].nodes?.get(1)).toBe(older);

        expect(rows[1].parentId).toBe(newestNested ? rows[0].id : null);
    });

    it.each([true, false])("reconciles an older moved member group beside the current total (newest nested: %s)", (newestNested) => {
        const newest = { ...total, value: 12 };

        const olderTotal = { ...total, html_tag_id: "old-total", value: 11 };

        const older = { ...sales, children: [products, olderTotal] };

        const rows = reportedTreeRows([
            period("Q3", newestNested ? [nested("Parent", [newest])] : [parent, newest]),
            period("Q2", newestNested ? [parent, older] : [nested("MovedParent", [older])]),
        ]);

        expect(rows.map(row => row.metricId)).toEqual(["Parent", sales.key, products.key, total.key]);

        expect(rows[1].parentId).toBe(newestNested ? rows[0].id : null);

        expect(rows[2].values).toEqual({ Q2: products.value, Q3: undefined });

        expect(rows[3].values).toEqual({ Q2: 11, Q3: 12 });

        expect(rows[3].nodes?.get(1)).toBe(olderTotal);
    });

    it("does not carry repeated descendant keys through a uniquely moved ancestor", () => {
        const currentA = { ...total, value: 12 };

        const currentB = { ...total, value: 22 };

        const ancestor = nested("Moved", [nested("A", [currentA]), nested("B", [currentB])]);

        const recent = [nested("Parent", [ancestor])];

        const older = [nested("Moved", [nested("A", [{ ...currentA, value: 11 }]), nested("B", [{ ...currentB, value: 21 }])])];

        const values = reportedTreeRows([period("Q3", recent), period("Q2", older)])
            .filter(row => row.metricId === total.key).map(row => row.values);

        expect(values).toEqual([{ Q2: undefined, Q3: 12 }, { Q2: undefined, Q3: 22 }]);
    });

    it("matches a repeated key only at its exact path and never falls back when either period repeats it", () => {
        const a = { ...total, value: 12 };

        const b = { ...total, value: 22 };

        const rows = reportedTreeRows([
            period("Q3", [nested("A", [a]), nested("B", [b])]),
            period("Q2", [nested("A", [{ ...a, value: 11 }]), nested("C", [{ ...b, value: 21 }])]),
            period("Q1", [nested("C", [{ ...b, value: 20 }])]),
        ]).filter(row => row.metricId === total.key);

        expect(rows.map(row => row.values)).toEqual([{ Q1: undefined, Q2: 11, Q3: 12 }, { Q1: undefined, Q2: undefined, Q3: 22 }]);

        const [unique] = reportedTreeRows([
            period("Q3", [a]),
            period("Q2", [nested("A", [a]), nested("B", [b])]),
        ]);

        expect(unique.values).toEqual({ Q2: undefined, Q3: 12 });
    });
});
