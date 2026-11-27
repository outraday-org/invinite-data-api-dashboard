/**
 * "Explain this number" for an as-reported value. The as-reported detailed view carries no fact id (`/v1/facts/{id}` is
 * the standardized lineage), but every value states its own derivation: `derived` + `formula` (the readable formula and
 * its members) for a value Invinite computed (Q4 = FY − Q1 − Q2 − Q3, TTM, YTD), `accession` + `html_tag_id` (the
 * inline-XBRL element) for a value the company filed. This model reads that fact, no request.
 */
import type { V2AsReportedDetailedFact, V2AsReportedDetailedMemberFact, V2AsReportedPresentationNode } from "@/lib/api/types";

import { formatDay } from "@/lib/format";
import { formatMetricId } from "@/lib/utils";

import type { FormulaTerm } from "./formula-terms";
import type { ValueRef } from "./value-ref";

import { readableFormula } from "./fact-explanation";
import { formulaTerms } from "./formula-terms";
import { localConcept, refMonths, refOfMember } from "./value-ref";

/**
 * One operand of a derived value: what it is, the period it covers (and its length in months), its value and the
 * filed value it names (`ref`: its filing is looked up by it; null = a standardized member, no filing).
 */
export type AsReportedMemberModel = { label: string; months: null | number; period: null | string; ref: null | ValueRef; splitFactor: boolean; value: number };

export type AsReportedExplanationModel = {
    /** The filing the value comes from (a derived value: the filing of the period it completes). */
    accession: null | string;
    /** The company's caption ("Total net sales"). */
    caption: string;
    /** The XBRL concept (the line's id). */
    concept: string;
    derived: boolean;
    dimensions: ValueRef["dimensions"];
    /** The formula with each raw fact id in words; null = the value is reported as filed. */
    formula: null | string;
    /** The formula as terms over `members` (operators, parentheses, operands matched to their member). */
    formulaTerms: Array<FormulaTerm>;
    /** The inline-XBRL element id of the value in the filed HTML; null = none stated (always null for a derived value). */
    htmlTagId: null | string;
    /** The taxonomy's standard label, when it differs from the caption. */
    label: null | string;
    members: Array<AsReportedMemberModel>;
    /** The members name more than one concept: each chip names its own. */
    mixedConcepts: boolean;
    /** A restated value: the figure / caption / filing that first reported it. */
    original: null | { accession: null | string; filedOn: null | string; label: null | string; value: null | number };
    /** A per-share or share-count value on today's split basis: the filed figure and the factor applied. */
    split: null | { factor: number; filed: null | number };
    value: number;
};

const day = (value: null | string | undefined) => (value && /^\d{4}-\d{2}-\d{2}/u.test(value) ? formatDay(value.slice(0, 10)) : null);

type Member = NonNullable<(V2AsReportedDetailedFact | V2AsReportedDetailedMemberFact)["formula"]>["members"][number];

export type AsReportedExplanationFact = (V2AsReportedDetailedFact | V2AsReportedDetailedMemberFact | V2AsReportedPresentationNode) & { value: number };

function memberPeriod(member: Member): null | string {
    const start = day(member.start_date);

    const end = day(member.end_date);

    if (start && end) return `${start} – ${end}`;

    return day(member.instant_date) ?? end;
}

function memberLabel(member: Member) {
    if (member.type === "split_factor") {
        const dates = member.split_execution_dates?.map(day).filter(Boolean).join(", ");

        return dates ? `Split factor · ${dates}` : "Split factor";
    }

    return member.concept ?? (member.metric_id ? formatMetricId(member.metric_id) || member.metric_id : "Operand");
}

export function asReportedExplanation(concept: string, fact: AsReportedExplanationFact): AsReportedExplanationModel {
    const caption = fact.company_label ?? fact.label ?? concept;

    const restated = "original_value" in fact && (fact.original_value !== null || fact.original_label !== null || fact.original_accession !== null);

    const formula = "formula" in fact ? fact.formula : null;

    const isMember = "dimensions" in fact && Boolean(fact.dimensions?.length);

    const members = (formula?.members ?? []).map((member) => {
        const ref = member.type === "reported" ? refOfMember(member, isMember) : null;

        return { label: memberLabel(member), months: ref ? refMonths(ref) : null, period: memberPeriod(member), ref, splitFactor: member.type === "split_factor", value: member.value };
    });

    const formulaStr = formula?.formula_str ?? null;

    return {
        accession: fact.accession ?? null,
        caption,
        concept,
        derived: fact.derived ?? false,
        dimensions: "dimensions" in fact ? fact.dimensions ?? null : null,
        formula: formulaStr ? readableFormula(formulaStr) : null,
        formulaTerms: formulaStr ? formulaTerms(formulaStr, members.map(member => member.ref), isMember) : [],
        htmlTagId: fact.html_tag_id ?? null,
        label: fact.label && fact.label !== caption ? fact.label : null,
        members,
        mixedConcepts: new Set(members.map(member => (member.ref ? localConcept(member.ref.concept) : member.label))).size > 1,
        original: restated
            ? { accession: fact.original_accession, filedOn: day(fact.original_filing_date), label: fact.original_label, value: fact.original_value }
            : null,
        split: "split_factor" in fact && fact.split_factor != null ? { factor: fact.split_factor, filed: fact.value_as_reported ?? null } : null,
        value: fact.value,
    };
}
