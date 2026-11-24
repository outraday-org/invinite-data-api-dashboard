import { describe, expect, it } from "vitest";

import { formulaTerms } from "./formula-terms";
import { V2_AS_REPORTED_ANNUAL_LOOKUP, V2_AS_REPORTED_Q4 } from "./v2-fixtures";
import { findValueSource, refMonths, refOfFactId, refOfMember, refPeriodText, valueLookupOf } from "./value-ref";

const REVENUE = "RevenueFromContractWithCustomerExcludingAssessedTax";

const fy = { concept: REVENUE, end: "2026-09-26", instant: null, start: "2025-09-28" };

const q3 = { concept: REVENUE, end: "2026-06-27", instant: null, start: "2026-03-29" };

describe("value references", () => {
    it("reads a raw fact id and a formula member; an id without a start is an instant", () => {
        expect(refOfFactId(`320193|${REVENUE}|2025-09-28T00:00:00|2026-09-26T00:00:00|-|-`)).toEqual(fy);

        expect(refOfFactId("320193|Assets|-|2026-09-26T00:00:00|-|-")).toEqual({ concept: "Assets", end: null, instant: "2026-09-26", start: null });

        expect(refOfFactId("is_revenue_q1")).toBeNull();

        expect(refOfMember({ concept: REVENUE, end_date: "2026-06-27", start_date: "2026-03-29" })).toEqual(q3);

        expect(refOfMember({ concept: null })).toBeNull();

        expect(refPeriodText(fy)).toBe("Sep 28, 2025 – Sep 26, 2026");

        expect([refMonths(fy), refMonths(q3)]).toEqual([12, 3]);
    });

    it("finds a member's filing and element in the loaded rows (any taxonomy prefix), a computed one without element", () => {
        expect(findValueSource(V2_AS_REPORTED_Q4.data, q3)).toEqual({ accession: "0000320193-26-000020", elementId: "f-56" });

        expect(findValueSource(V2_AS_REPORTED_Q4.data, { ...q3, concept: `us-gaap:${REVENUE}` })).toEqual({ accession: "0000320193-26-000020", elementId: "f-56" });

        expect(findValueSource(V2_AS_REPORTED_Q4.data, { concept: REVENUE, end: "2026-09-26", instant: null, start: "2026-06-28" })).toEqual({ accession: "0000320193-26-000026", elementId: null });

        expect(findValueSource(V2_AS_REPORTED_Q4.data, fy)).toBeNull();

        expect(findValueSource(V2_AS_REPORTED_ANNUAL_LOOKUP.data, fy)).toEqual({ accession: "0000320193-26-000026", elementId: "f-210" });
    });

    it("asks the period type of the member's length over the fiscal years around its end", () => {
        expect(valueLookupOf(fy)).toEqual({ fiscalYearGte: 2025, fiscalYearLte: 2027, period: "annual" });

        expect(valueLookupOf(q3)?.period).toBe("quarterly");

        expect(valueLookupOf({ concept: REVENUE, end: "2026-06-27", instant: null, start: "2025-09-28" })?.period).toBe("ytd");

        expect(valueLookupOf({ concept: "Assets", end: null, instant: "2026-06-27", start: null })?.period).toBe("quarterly");
    });
});

describe("formulaTerms", () => {
    it("matches raw fact ids to their members by concept and period, operators in print", () => {
        const formula = V2_AS_REPORTED_Q4.data[0].statements.income_statement!.facts[`us-gaap:${REVENUE}`].formula!;

        const members = formula.members.map(refOfMember).reverse();

        const terms = formulaTerms(formula.formula_str, members);

        expect(terms.map(term => (term.kind === "operand" ? term.member : term.text))).toEqual([3, "−", 2, "−", 1, "−", 0]);
    });

    it("operands that are no fact ids match by position when the counts agree; parentheses split off", () => {
        expect(formulaTerms("FY - Q1", [fy, q3]).map(term => (term.kind === "operand" ? term.member : term.text))).toEqual([0, "−", 1]);

        expect(formulaTerms("(a + b) * c", []).map(term => (term.kind === "operand" ? term.text : term.text))).toEqual(["(", "a", "+", "b", ")", "×", "c"]);

        expect(formulaTerms("FY - Q1 - Q2", [fy]).filter(term => term.kind === "operand").every(term => term.member === null)).toBe(true);
    });
});
