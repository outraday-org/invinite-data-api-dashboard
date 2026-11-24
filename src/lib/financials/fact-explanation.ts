/**
 * "Explain this number" (backend tasks/data-api-dashboard O7 group 4): `GET /v1/facts/{fact_id}` → a view model. The
 * spec types `rule`, `operands[]` and `source_facts[]` as free JSON, so every field is read defensively (a missing or
 * differently typed field is null, never a throw).
 */
import type { JsonValue, V2FactPlace, V2FactResponse } from "@/lib/api/types";

import { formatDay } from "@/lib/format";
import { formatMetricId } from "@/lib/utils";

import type { ValueRef } from "./value-ref";

import { refMonths, refOfFactId, refPeriodText } from "./value-ref";

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

const DAY = /^\d{4}-\d{2}-\d{2}/u;

/** A stated day ("2026-09-26T00:00:00" → "Sep 26, 2026"); anything else (`-`, absent) = null. */
const day = (value: JsonValue | undefined) => {
    const stated = text(value)?.slice(0, 10) ?? null;

    return stated && DAY.test(stated) ? formatDay(stated) : null;
};

/** A fact's period in words: "Sep 28, 2025 – Sep 26, 2026" (duration) or "Sep 26, 2026" (instant). */
function periodText(fact: JsonObject): null | string {
    const start = day(fact.start_date);

    const end = day(fact.end_date);

    if (start && end) return `${start} – ${end}`;

    return day(fact.instant_date) ?? end;
}

/**
 * A raw fact id in words: `320193|RevenueFromContractWithCustomerExcludingAssessedTax|2025-09-28T00:00:00|2026-09-26T00:00:00|-|-`
 * (cik | concept | start | end | …) → "RevenueFromContractWithCustomerExcludingAssessedTax · Sep 28, 2025 – Sep 26, 2026";
 * null for anything of another shape.
 */
export function factIdText(id: string): null | string {
    const parts = id.split("|");

    if (parts.length < 4) return null;

    const [cik, concept, start, end] = parts;

    if (!/^\d+$/u.test(cik) || !concept) return null;

    const period = periodText({ end_date: end, start_date: start });

    return period ? `${concept} · ${period}` : concept;
}

/** A raw fact id inside a formula (no spaces; `|`-separated, led by the CIK). */
const FACT_ID_IN_FORMULA = /\b\d+\|[A-Za-z][\w.:-]*\|[^\s|]*\|[^\s|]*(?:\|[^\s|]*)*/gu;

/** A formula with each raw fact id in words ("… · Sep 28, 2025 – Sep 26, 2026"); other text kept as stated. */
export function readableFormula(formula: string): string {
    return formula.replace(FACT_ID_IN_FORMULA, id => factIdText(id) ?? id);
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

/**
 * One operand: its label, how many operands it nests, its value as weighted in the formula (`value`, a subtracted one
 * negative) and as stored (`stored`), and the filed value it names (`ref`, a raw fact id; null = a metric).
 */
export type FactOperandModel = {
    concept: null | string;
    label: string;
    months: null | number;
    nested: number;
    period: null | string;
    ref: null | ValueRef;
    stored: null | number;
    value: null | number;
};

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

    // A derived fact's operands name a raw fact by `id` (cik | concept | start | end | …) and carry
    // `weighted_value` / `stored_value` (live answer 2026-11-22, F036).
    const id = text(object.id);

    const label = metricId
        ? formatMetricId(metricId) || metricId
        : (text(object.concept) ?? text(object.label) ?? (id ? factIdText(id) ?? id : null) ?? "Operand");

    const nested = Object.values(object).find(Array.isArray);

    const ref = id ? refOfFactId(id) : null;

    const value = numeric(object.value) ?? numeric(object.weighted_value) ?? numeric(object.stored_value);

    return {
        concept: ref?.concept ?? text(object.concept) ?? (metricId ? formatMetricId(metricId) || metricId : null),
        label,
        months: ref ? refMonths(ref) : null,
        nested: Array.isArray(nested) ? nested.length : 0,
        period: ref ? refPeriodText(ref) : null,
        ref,
        stored: numeric(object.stored_value) ?? numeric(object.value) ?? value,
        value,
    };
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
        // A derived source fact states its value under `derived` (the enriched fact it rests on).
        value: numeric(raw.value) ?? numeric(object.value) ?? (isObject(object.derived) ? numeric(object.derived.value) : null),
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
