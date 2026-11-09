/**
 * Pure view models of the v2 Financials + Metrics groups (backend tasks/data-api-v2 task 5): one API row per fiscal
 * period (segments: per fact) → table columns (periods, newest first) × rows (metrics / concepts / segments).
 */
import type {
    StatementType,
    V2AsReportedDetailedFact,
    V2AsReportedFacts,
    V2AsReportedPresentationNode,
    V2FilingSource,
    V2Segment,
    V2StandardizedDetailedFact,
    V2StandardizedPresentationNode,
    V2StatementPeriod,
} from "@/lib/api/types";

import { V2_STATEMENT_KEYS } from "@/lib/api/v2";
import { formatMetricId } from "@/lib/utils";

/** The fiscal coordinates every v2 period row carries. */
export type PeriodCoordinates = { fiscal_quarter: number; fiscal_year: number; period: string };

/**
 * A period's column label: "2026" for an annual row (v2 annual rows carry `fiscal_quarter` 4), "Q2 2026" for a
 * quarterly / YTD / TTM row.
 */
export function periodLabel(row: PeriodCoordinates) {
    return row.period === "annual" || !row.fiscal_quarter ? `${row.fiscal_year}` : `Q${row.fiscal_quarter} ${row.fiscal_year}`;
}

/** The distinct period labels of the rows, in the API's order (newest first). */
export function periodLabels(rows: ReadonlyArray<PeriodCoordinates>) {
    return [...new Set(rows.map(periodLabel))];
}

/**
 * The rows without the last period while more pages exist: a list of several rows per period (growth bases, CAGR
 * horizons, segment facts) may end mid-period, and a half-loaded column would read as missing values. A page that
 * holds a single period keeps it.
 */
export function completePeriodsOnly<TRow extends PeriodCoordinates>(rows: ReadonlyArray<TRow>, hasMore: boolean): Array<TRow> {
    const labels = periodLabels(rows);

    if (!hasMore || labels.length < 2) return [...rows];

    const last = labels.at(-1);

    return rows.filter(row => periodLabel(row) !== last);
}

/** The filing a period was rendered from, in words (the column header's tooltip). */
export function filingSourceText(source: V2FilingSource) {
    const filed = source.filed_at.slice(0, 10);

    return `${source.form} filed ${filed} · ${source.accession}${source.restated ? " · restated by a later filing" : ""}`;
}

/** One cell of a flat statement table. */
export type StatementCell = {
    accession?: null | string;
    /** Invinite computed the value (a Q4, TTM or YTD derivation); false / absent = the company reported it. */
    derived?: boolean;
    formula?: null | string;
    unit?: null | string;
    value: number;
};

/** One line of a flat statement table (summary / detailed views). */
export type StatementLine = {
    id: string;
    label: string;
    /** The concept / metric id when the label is a caption. */
    title?: string;
    values: Array<StatementCell | undefined>;
};

export type StatementColumn = { label: string; title: string };

type FlatFact = number | V2AsReportedDetailedFact | V2AsReportedFacts[string] | V2StandardizedDetailedFact;

const isDetailedAsReported = (fact: FlatFact): fact is V2AsReportedDetailedFact => typeof fact === "object" && "company_label" in fact;

const isDetailedStandardized = (fact: FlatFact): fact is V2StandardizedDetailedFact => typeof fact === "object" && "fact_id" in fact;

/** A fact of a summary / detailed statement: a number, or an object with a numeric `value` (anything else is skipped). */
const isFlatFact = (fact: unknown): fact is FlatFact =>
    typeof fact === "number"
    || (typeof fact === "object" && fact !== null && typeof (fact as { value?: unknown }).value === "number");

function toCell(fact: FlatFact): StatementCell {
    if (typeof fact === "number") return { value: fact };

    if (isDetailedStandardized(fact)) {
        return { accession: fact.accession, formula: fact.formula?.formula_str ?? null, unit: fact.unit, value: fact.value };
    }

    if (isDetailedAsReported(fact)) {
        return { accession: fact.accession, derived: fact.derived, formula: fact.formula?.formula_str ?? null, value: fact.value };
    }

    return { derived: fact.derived, value: fact.value };
}

/** A line's label: a standardized metric in words, an as-reported concept by the company's caption, else its label. */
function lineLabel(id: string, fact: FlatFact, standardized: boolean) {
    if (standardized) return formatMetricId(id) || id;

    if (isDetailedAsReported(fact)) return fact.company_label ?? fact.label ?? id;

    return id;
}

/** The facts of one statement of a period row, as the operation answered them. */
export function statementFacts(row: V2StatementPeriod, statement: StatementType): unknown {
    const statements: Partial<Record<string, { facts: unknown }>> = row.statements;

    return statements[V2_STATEMENT_KEYS[statement]]?.facts;
}

/** The period columns of a statement page (label + the filing it was rendered from). */
export function statementColumns(rows: ReadonlyArray<V2StatementPeriod>): Array<StatementColumn> {
    return rows.map(row => ({ label: periodLabel(row), title: filingSourceText(row.source) }));
}

/**
 * The flat table of a summary / detailed statement page: one line per metric (standardized) or concept (as
 * reported), in the order the newest period states them, older-only lines appended; one cell per period.
 */
export function statementLines(
    rows: ReadonlyArray<V2StatementPeriod>,
    statement: StatementType,
    standardized: boolean,
): Array<StatementLine> {
    const lines = new Map<string, StatementLine>();

    rows.forEach((row, index) => {
        const facts = statementFacts(row, statement);

        if (!facts || typeof facts !== "object" || Array.isArray(facts)) return;

        for (const [id, fact] of Object.entries(facts)) {
            if (!isFlatFact(fact)) continue;

            let line = lines.get(id);

            if (!line) {
                const label = lineLabel(id, fact, standardized);

                line = { id, label, title: label === id ? undefined : id, values: rows.map(() => undefined) };

                lines.set(id, line);
            }

            line.values[index] = toCell(fact);
        }
    });

    return [...lines.values()];
}

/** The presentation trees of a statement page, one column per period (empty tree = the statement is absent). */
export function presentationPeriods(rows: ReadonlyArray<V2StatementPeriod>, statement: StatementType) {
    return rows.map((row) => {
        const facts = statementFacts(row, statement);

        return {
            facts: (Array.isArray(facts) ? facts : []) as Array<V2AsReportedPresentationNode> | Array<V2StandardizedPresentationNode>,
            label: periodLabel(row),
            title: filingSourceText(row.source),
        };
    });
}

/** Whether a loaded period states the statement at all (an empty page of a statement reads as "no data"). */
export function hasStatement(rows: ReadonlyArray<V2StatementPeriod>, statement: StatementType) {
    return rows.some((row) => {
        const facts = statementFacts(row, statement);

        return Array.isArray(facts) ? facts.length > 0 : Boolean(facts) && Object.keys(facts as object).length > 0;
    });
}

/** One line of a segments table. */
export type SegmentLine = {
    /** The axis / member pairs in words ("Product · IPhone"). */
    details: string;
    key: string;
    metricId: string;
    segmentId: string;
    values: Record<string, number | undefined>;
};

/** An XBRL QName without its namespace and `Member` / `Axis` suffix, camel case split ("aapl:IPhoneMember" → "IPhone"). */
export function xbrlNameText(name: string) {
    return name
        .replace(/^[^:]+:/u, "")
        .replace(/(SegmentMember|Member|Axis)$/u, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim();
}

/** The segment's dimensions in words: the members, joined ("Americas · IPhone"); none = "". */
export function dimensionsText(dimensions: V2Segment["dimensions"]) {
    return dimensions.map(d => xbrlNameText(d.member)).filter(Boolean).join(" · ");
}

/**
 * The segments table: one line per metric × segment × dimensions, one value per period label (equal keys of a period
 * add up, as v1's table did).
 */
export function segmentLines(segments: ReadonlyArray<V2Segment>): Array<SegmentLine> {
    const lines = new Map<string, SegmentLine>();

    for (const segment of segments) {
        const dims = segment.dimensions.map(d => `${d.axis}=${d.member}`).join("|");

        const key = [segment.metric_id, segment.segment_id, dims].join("::");

        let line = lines.get(key);

        if (!line) {
            line = { details: dimensionsText(segment.dimensions), key, metricId: segment.metric_id, segmentId: segment.segment_id, values: {} };

            lines.set(key, line);
        }

        const label = periodLabel(segment);

        line.values[label] = (line.values[label] ?? 0) + segment.value;
    }

    return [...lines.values()].sort((a, b) =>
        a.metricId.localeCompare(b.metricId) || a.segmentId.localeCompare(b.segmentId) || a.details.localeCompare(b.details));
}
