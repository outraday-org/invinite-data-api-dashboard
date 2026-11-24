/**
 * "Explain this number" for an as-reported value. The as-reported detailed view carries no fact id (`/v1/facts/{id}` is
 * the standardized lineage), but every value states its own derivation: `derived` + `formula` (the readable formula and
 * its members) for a value Invinite computed (Q4 = FY − Q1 − Q2 − Q3, TTM, YTD), `accession` + `html_tag_id` (the
 * inline-XBRL element) for a value the company filed. This model reads that fact, no request.
 */
import type { V2AsReportedDetailedFact } from "@/lib/api/types";

import { formatDay } from "@/lib/format";
import { formatMetricId } from "@/lib/utils";

import { readableFormula } from "./fact-explanation";

/** One operand of a derived value: what it is, the period it covers and its value. */
export type AsReportedMemberModel = { label: string; period: null | string; reported: boolean; value: number };

export type AsReportedExplanationModel = {
    /** The filing the value comes from (a derived value: the filing of the period it completes). */
    accession: null | string;
    /** The company's caption ("Total net sales"). */
    caption: string;
    /** The XBRL concept (the line's id). */
    concept: string;
    derived: boolean;
    /** The formula with each raw fact id in words; null = the value is reported as filed. */
    formula: null | string;
    /** The inline-XBRL element id of the value in the filed HTML; null = none stated (always null for a derived value). */
    htmlTagId: null | string;
    /** The taxonomy's standard label, when it differs from the caption. */
    label: null | string;
    members: Array<AsReportedMemberModel>;
    /** A restated value: the figure / caption / filing that first reported it. */
    original: null | { accession: null | string; filedOn: null | string; label: null | string; value: null | number };
    /** A per-share or share-count value on today's split basis: the filed figure and the factor applied. */
    split: null | { factor: number; filed: null | number };
    value: number;
};

const day = (value: null | string | undefined) => (value && /^\d{4}-\d{2}-\d{2}/u.test(value) ? formatDay(value.slice(0, 10)) : null);

type Member = NonNullable<V2AsReportedDetailedFact["formula"]>["members"][number];

function memberPeriod(member: Member): null | string {
    const start = day(member.start_date);

    const end = day(member.end_date);

    if (start && end) return `${start} – ${end}`;

    return day(member.instant_date) ?? end;
}

const memberLabel = (member: Member) => member.concept ?? (member.metric_id ? formatMetricId(member.metric_id) || member.metric_id : "Operand");

export function asReportedExplanation(concept: string, fact: V2AsReportedDetailedFact): AsReportedExplanationModel {
    const caption = fact.company_label ?? fact.label ?? concept;

    const restated = fact.original_value !== null || fact.original_label !== null || fact.original_accession !== null;

    return {
        accession: fact.accession,
        caption,
        concept,
        derived: fact.derived,
        formula: fact.formula?.formula_str ? readableFormula(fact.formula.formula_str) : null,
        htmlTagId: fact.html_tag_id,
        label: fact.label && fact.label !== caption ? fact.label : null,
        members: (fact.formula?.members ?? []).map(member => ({
            label: memberLabel(member),
            period: memberPeriod(member),
            reported: member.type === "reported",
            value: member.value,
        })),
        original: restated
            ? { accession: fact.original_accession, filedOn: day(fact.original_filing_date), label: fact.original_label, value: fact.original_value }
            : null,
        split: fact.split_factor === null ? null : { factor: fact.split_factor, filed: fact.value_as_reported },
        value: fact.value,
    };
}
