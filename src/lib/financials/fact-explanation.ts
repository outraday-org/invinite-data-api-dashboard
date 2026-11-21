/**
 * "Explain this number" (backend tasks/data-api-dashboard O7 group 4): `GET /v1/facts/{fact_id}` → a view model. The
 * spec types `rule`, `operands[]` and `source_facts[]` as free JSON, so every field is read defensively (a missing or
 * differently typed field is null, never a throw).
 */
import type { JsonValue, V2FactPlace, V2FactResponse } from "@/lib/api/types";

import { formatMetricId } from "@/lib/utils";

type JsonObject = { [key: string]: JsonValue };

const isObject = (value: JsonValue | undefined): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

/** A field the free JSON may leave out or set to null. */
const isAbsent = (value: JsonValue | undefined): value is null | undefined => value === undefined || value === null;

const text = (value: JsonValue | undefined): null | string => (typeof value === "string" && value.trim() ? value : null);

/** A number, or a numeric string (the raw XBRL value is a string: "478834000000"). */
const numeric = (value: JsonValue | undefined): null | number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;

    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);

    return null;
};

const day = (value: JsonValue | undefined) => text(value)?.slice(0, 10) ?? null;

/** A fact's period in words: "2025-09-28 – 2026-09-26" (duration) or "2026-09-26" (instant). */
function periodText(fact: JsonObject): null | string {
    const start = day(fact.start_date);

    const end = day(fact.end_date);

    if (start && end) return `${start} – ${end}`;

    return day(fact.instant_date) ?? end;
}

/** A segment / dimension object in words ("srt:ProductOrServiceAxis = aapl:IPhoneMember"); none = null. */
function segmentText(value: JsonValue | undefined): null | string {
    if (!isObject(value)) return null;

    const parts = Object.entries(value).map(([axis, member]) => `${axis} = ${typeof member === "string" ? member : JSON.stringify(member)}`);

    return parts.length > 0 ? parts.join(" · ") : null;
}

export type FactRuleModel = {
    /** "us_gaap:RevenueFromContractWithCustomerExcludingAssessedTax" (the concept the rule takes). */
    alias: null | string;
    /** The rule's formula text when it computes the value. */
    formula: null | string;
    /** alias / formula / … */
    kind: null | string;
    notes: null | string;
    ruleId: null | string;
    statement: null | string;
};

export type FactOperandModel = { label: string; nested: number; value: null | number };

export type FactSourceModel = {
    accession: null | string;
    /** The inline-XBRL element id in that filing. */
    anchor: null | string;
    basis: null | string;
    concept: string;
    period: null | string;
    segment: null | string;
    value: null | number;
};

export type FactExplanationModel = {
    factId: string;
    metricName: string;
    operands: Array<FactOperandModel>;
    rule: FactRuleModel;
    sources: Array<FactSourceModel>;
    unit: null | string;
    value: number;
};

function ruleModel(rule: JsonValue | undefined): FactRuleModel {
    const object = isObject(rule) ? rule : {};

    const taxonomy = text(object.declared_taxonomy);

    const alias = text(object.declared_alias);

    const definition = object.formula_definition;

    return {
        alias: alias ? (taxonomy ? `${taxonomy}:${alias}` : alias) : null,
        formula: text(definition) ?? (isAbsent(definition) ? null : JSON.stringify(definition)),
        kind: text(object.kind),
        notes: text(object.notes),
        ruleId: text(object.rule_id),
        statement: text(object.statement),
    };
}

function operandModel(operand: JsonValue): FactOperandModel {
    const object = isObject(operand) ? operand : {};

    const metricId = text(object.metric_id);

    const label = metricId ? formatMetricId(metricId) || metricId : (text(object.concept) ?? text(object.label) ?? "Operand");

    const nested = Object.values(object).find(Array.isArray);

    return { label, nested: Array.isArray(nested) ? nested.length : 0, value: numeric(object.value) };
}

function sourceModel(source: JsonValue): FactSourceModel {
    const object = isObject(source) ? source : {};

    const raw = isObject(object.raw) ? object.raw : {};

    return {
        accession: text(object.accession) ?? text(raw.accession),
        anchor: text(object.annotated_anchor) ?? text(raw.annotated_anchor),
        basis: text(object.basis),
        concept: text(object.concept) ?? text(raw.concept) ?? "—",
        period: periodText(raw),
        segment: segmentText(object.segment),
        value: numeric(raw.value) ?? numeric(object.value),
    };
}

/** The explanation of one standardized fact, ready to render. */
export function factExplanationModel(data: V2FactResponse): FactExplanationModel {
    const rule = ruleModel(data.rule);

    const ruleName = isObject(data.rule) ? text(data.rule.metric_name) : null;

    return {
        factId: data.fact_id,
        metricName: ruleName ?? (formatMetricId(data.metric_id) || data.metric_id),
        operands: data.operands.map(operandModel),
        rule,
        sources: data.source_facts.map(sourceModel),
        unit: data.unit,
        value: data.value,
    };
}

/** One "Show in filing" target: a document version and the block holding the value. */
export type FactPlaceTarget = { blockId: string; label: string; versionId: string };

/**
 * The places a reader can open: `placed` rows with a block, one per document version × block, in the API's order
 * ("Table row 7, column 4" when the cell is known).
 */
export function factPlaceTargets(places: ReadonlyArray<V2FactPlace>): Array<FactPlaceTarget> {
    const seen = new Set<string>();

    const targets: Array<FactPlaceTarget> = [];

    for (const place of places) {
        if (place.status !== "placed" || !place.block_id) continue;

        const key = `${place.document_version}:${place.block_id}`;

        if (seen.has(key)) continue;

        seen.add(key);

        const cell = place.table_row !== null && place.table_col !== null ? `Table row ${place.table_row + 1}, column ${place.table_col + 1}` : null;

        targets.push({ blockId: place.block_id, label: cell ?? (place.page !== null ? `Page ${place.page}` : `Block ${place.block_id}`), versionId: place.document_version });
    }

    return targets;
}
