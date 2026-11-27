import { describe, expect, it } from "vitest";

import { asReportedExplanation } from "./as-reported-explanation";
import { formulaTerms } from "./formula-terms";
import { AAPL_MEMBER_DETAILED, SYNTHETIC_Q4_MEMBER_DETAILED, SYNTHETIC_TWO_AXIS_MEMBER_DETAILED } from "./member-fixtures";
import { V2_AS_REPORTED_ANNUAL_LOOKUP, V2_AS_REPORTED_Q4 } from "./v2-fixtures";
import { findValueSource, refMonths, refOfFactId, refOfMember, refPeriodText, valueLookupOf } from "./value-ref";

const REVENUE = "RevenueFromContractWithCustomerExcludingAssessedTax";

const fy = { concept: REVENUE, dimensions: null, end: "2026-09-26", instant: null, start: "2025-09-28" };

const q3 = { concept: REVENUE, dimensions: null, end: "2026-06-27", instant: null, start: "2026-03-29" };

describe("value references", () => {
    it("reads a raw fact id and a formula member; an id without a start is an instant", () => {
        expect(refOfFactId(`320193|${REVENUE}|2025-09-28T00:00:00|2026-09-26T00:00:00|-|-`)).toMatchObject(fy);

        expect(refOfFactId("320193|Assets|-|2026-09-26T00:00:00|-|-")).toMatchObject({ concept: "Assets", dimensions: null, end: null, instant: "2026-09-26", start: null });

        expect(refOfFactId("is_revenue_q1")).toBeNull();

        expect(refOfMember({ concept: REVENUE, end_date: "2026-06-27", start_date: "2026-03-29" })).toEqual(q3);

        expect(refOfMember({ concept: null })).toBeNull();

        expect(refPeriodText(fy)).toBe("Sep 28, 2025 – Sep 26, 2026");

        expect([refMonths(fy), refMonths(q3)]).toEqual([12, 3]);
    });

    it("finds a member's filing and element in the loaded rows (any taxonomy prefix), a computed one without element", () => {
        expect(findValueSource(V2_AS_REPORTED_Q4.data, q3)).toEqual({ accession: "0000320193-26-000020", elementId: "f-56" });

        expect(findValueSource(V2_AS_REPORTED_Q4.data, { ...q3, concept: `us-gaap:${REVENUE}` })).toEqual({ accession: "0000320193-26-000020", elementId: "f-56" });

        expect(findValueSource(V2_AS_REPORTED_Q4.data, { concept: REVENUE, dimensions: null, end: "2026-09-26", instant: null, start: "2026-06-28" })).toEqual({ accession: "0000320193-26-000026", elementId: null });

        expect(findValueSource(V2_AS_REPORTED_Q4.data, fy)).toBeNull();

        expect(findValueSource(V2_AS_REPORTED_ANNUAL_LOOKUP.data, fy)).toEqual({ accession: "0000320193-26-000026", elementId: "f-210" });
    });

    it("asks the period type of the member's length over the fiscal years around its end", () => {
        expect(valueLookupOf(fy)).toEqual({ fiscalYearGte: 2025, fiscalYearLte: 2027, period: "annual" });

        expect(valueLookupOf(q3)?.period).toBe("quarterly");

        expect(valueLookupOf({ concept: REVENUE, dimensions: null, end: "2026-06-27", instant: null, start: "2025-09-28" })?.period).toBe("ytd");

        expect(valueLookupOf({ concept: "Assets", dimensions: null, end: null, instant: "2026-06-27", start: null })?.period).toBe("quarterly");
    });
});

describe("formulaTerms", () => {
    it("matches raw fact ids to their members by concept and period, operators in print", () => {
        const formula = V2_AS_REPORTED_Q4.data[0].statements.income_statement!.facts[`us-gaap:${REVENUE}`].formula!;

        const members = formula.members.map(member => refOfMember(member)).reverse();

        const terms = formulaTerms(formula.formula_str, members);

        expect(terms.map(term => (term.kind === "operand" ? term.member : term.text))).toEqual([3, "−", 2, "−", 1, "−", 0]);
    });

    it("operands that are no fact ids match by position when the counts agree; parentheses split off", () => {
        expect(formulaTerms("FY - Q1", [fy, q3]).map(term => (term.kind === "operand" ? term.member : term.text))).toEqual([0, "−", 1]);

        expect(formulaTerms("(a + b) * c", []).map(term => (term.kind === "operand" ? term.text : term.text))).toEqual(["(", "a", "+", "b", ")", "×", "c"]);

        expect(formulaTerms("FY - Q1 - Q2", [fy]).filter(term => term.kind === "operand").every(term => term.member === null)).toBe(true);
    });
});

describe("qualified member lineage", () => {
    it("matches a complete qualified, order-independent dimension set and never substitutes a total or another namespace", () => {
        const row = SYNTHETIC_TWO_AXIS_MEMBER_DETAILED.data[0];

        const member = row.statements.income_statement?.member_facts[0];

        if (!member) throw new Error("Missing synthetic two-axis member");

        const ref = {
            concept: member.concept,
            dimensions: [...member.dimensions].reverse(),
            end: row.period_end,
            instant: null,
            start: row.period_start,
        };

        expect(findValueSource([row], ref)).toEqual({ accession: member.accession, elementId: member.html_tag_id });

        expect(findValueSource([row], { ...ref, dimensions: ref.dimensions.slice(0, 1) })).toBeNull();

        expect(findValueSource([row], { ...ref, dimensions: ref.dimensions.map(d => ({ ...d, axis: d.axis.replace(/^.*?:/, "other:") })) })).toBeNull();

        expect(findValueSource([row], { ...ref, end: "2026-01-01" })).toBeNull();
    });

    it("validates and preserves a raw qualifier and links a proved older filing without looking up its alias", () => {
        const fact = SYNTHETIC_Q4_MEMBER_DETAILED.data[0].statements.income_statement?.member_facts[0];

        if (!fact || fact.value === null) throw new Error("Missing computed member fixture");

        const model = asReportedExplanation(fact.concept, { ...fact, value: fact.value });

        const [noNativeId, older, unresolved] = model.members.map(member => member.ref);

        if (!noNativeId || !older || !unresolved) throw new Error("Missing reported source fixtures");

        expect(older.dimensions).toEqual([
            { axis: "alias:ConsolidationItemsAxis", member: "alias:OperatingSegmentsMember" },
            { axis: "alias:Axis", member: "alias:Products" },
        ]);

        expect(findValueSource([], older)).toEqual({ accession: "0000000001-26-000001", elementId: "quarter-cell" });

        expect(findValueSource([], noNativeId)).toEqual({ accession: "0000000001-26-000002", elementId: null });

        expect(findValueSource(AAPL_MEMBER_DETAILED.data, unresolved)).toBeNull();

        expect(valueLookupOf(unresolved)).toBeNull();
    });

    it("matches equal-date formula terms by dimension and keeps split factors independent of filing provenance", () => {
        const axis = [{ axis: "srt:Axis", member: "ext:SameMember" }];

        const otherAxis = [{ axis: "ext:Axis", member: "ext:SameMember" }];

        const left = refOfMember({ concept: "Revenue", dimensions: axis, end_date: "2026-03-31", start_date: "2026-01-01" });

        const right = refOfMember({ concept: "Revenue", dimensions: otherAxis, end_date: "2026-03-31", start_date: "2026-01-01" });

        const raw = (dims: typeof axis) => `1|Revenue|2026-01-01|2026-03-31|-|${JSON.stringify(dims)}|quarterly`;

        const terms = formulaTerms(`${raw(axis)} - ${raw(otherAxis)}`, [right, left], true);

        expect(terms.flatMap(term => term.kind === "operand" ? [term.member] : [])).toEqual([1, 0]);

        const row = SYNTHETIC_Q4_MEMBER_DETAILED.data[0];

        const fact = row.statements.income_statement?.member_facts[0];

        if (!fact || fact.value === null || !fact.formula) throw new Error("Missing computed member fixture");

        const formula = structuredClone(fact.formula);

        formula.members.push({ split_execution_dates: ["2020-08-31"], type: "split_factor", value: 4 });

        const model = asReportedExplanation(fact.concept, { ...fact, formula, value: fact.value });

        expect(model.members.at(-1)).toMatchObject({ label: "Split factor · Aug 31, 2020", ref: null, splitFactor: true, value: 4 });
    });
});
