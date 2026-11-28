/**
 * Pure view models of the v2 Financials + Metrics groups (backend tasks/data-api-v2 task 5): one API row per fiscal
 * period (segments: per fact) → table columns (periods, newest first) × rows (metrics / concepts / segments).
 */
import type {
    StatementType,
    V2AsReportedDetailedFact,
    V2AsReportedDetailedMemberFact,
    V2AsReportedFacts,
    V2AsReportedMemberFact,
    V2FilingSource,
    V2Segment,
    V2StandardizedDetailedFact,
    V2StatementPeriod,
} from "@/lib/api/types";

import { V2_STATEMENT_KEYS } from "@/lib/api/v2";
import { formatDay } from "@/lib/format";
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
    // The day as the "From filing" picker names it (`formatDay`: the viewer's day of the instant), never its UTC slice.
    const filed = formatDay(source.filed_at);

    return [
        `${source.form} filed ${filed} · ${source.accession}`,
        source.restated ? "restated by a later filing" : null,
        source.is_preliminary ? "preliminary: earnings release figures before the 10-Q / 10-K" : null,
    ].filter(Boolean).join(" · ");
}

/** One cell of a flat statement table. */
export type StatementCell = {
    accession?: null | string;
    /** Invinite computed the value (a Q4, TTM or YTD derivation); false / absent = the company reported it. */
    derived?: boolean;
    /** The standardized fact's id (the standardized detailed view only): "Explain this number" asks `/v1/facts/{id}`. */
    factId?: string;
    formula?: null | string;
    /** The value's inline-XBRL element in its filing (the detailed views; null = a computed value or none stated). */
    htmlTagId?: null | string;
    /** The as-reported detailed fact (its own formula, filing and element): "Explain this number" reads it, no request. */
    reported?: NumericDetailedFact;
    unit?: null | string;
    value: number;
};

/** One line of a flat statement table (summary / detailed views). */
export type StatementLine = {
    concept?: string;
    dimensions?: V2AsReportedMemberFact["dimensions"];
    id: string;
    label: string;
    /** The concept / metric id when the label is a caption. */
    title?: string;
    values: Array<StatementCell | undefined>;
};

export type StatementColumn = {
    label: string;
    /** First day of the period (null for an instant / not stated): the "Filed values" request's `period_start`. */
    periodStart?: null | string;
    /** Last day of the period: the "Filed values" request's `period_end`. */
    periodEnd?: string;
    /** `source.is_preliminary`: the period's values come from the earnings release before the 10-Q / 10-K. */
    preliminary?: boolean;
    title: string;
};

type NumericDetailedFact = V2AsReportedDetailedFact | (V2AsReportedDetailedMemberFact & { value: number });
type FlatFact = number | NumericDetailedFact | V2AsReportedFacts[string] | V2StandardizedDetailedFact;

const isDetailedAsReported = (fact: FlatFact): fact is NumericDetailedFact => typeof fact === "object" && "company_label" in fact;

const isDetailedStandardized = (fact: FlatFact): fact is V2StandardizedDetailedFact => typeof fact === "object" && "fact_id" in fact;

/** A fact of a summary / detailed statement: a number, or an object with a numeric `value` (anything else is skipped). */
const isFlatFact = (fact: unknown): fact is FlatFact =>
    typeof fact === "number"
    || (typeof fact === "object" && fact !== null && "value" in fact && typeof fact.value === "number");

function toCell(fact: FlatFact): StatementCell {
    if (typeof fact === "number") return { value: fact };

    if (isDetailedStandardized(fact)) {
        return { accession: fact.accession, factId: fact.fact_id, formula: fact.formula?.formula_str ?? null, htmlTagId: fact.html_tag_id, unit: fact.unit, value: fact.value };
    }

    if (isDetailedAsReported(fact)) {
        return { accession: fact.accession, derived: fact.derived, formula: fact.formula?.formula_str ?? null, htmlTagId: fact.html_tag_id, reported: fact, value: fact.value };
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
function statementBlock(row: V2StatementPeriod, statement: StatementType) {
    return row.statements[V2_STATEMENT_KEYS[statement]];
}

function statementFacts(row: V2StatementPeriod, statement: StatementType) {
    return statementBlock(row, statement)?.facts;
}

function statementMembers(row: V2StatementPeriod, statement: StatementType) {
    const block = statementBlock(row, statement);

    return block && "member_facts" in block ? block.member_facts : [];
}

/**
 * The period columns of a statement page (label + the filing it was rendered from). A balance-sheet value is an instant
 * (no start): its column carries no `periodStart`, so "Filed values" asks by the period's end alone — a start would
 * match no instant (404 `not_found`). An instant line on another statement (cash at the end of the period) is caught
 * by the server function, which re-asks by the end alone on that 404 (`api/vintages-fallback.ts`).
 */
export function statementColumns(rows: ReadonlyArray<V2StatementPeriod>, statement: StatementType): Array<StatementColumn> {
    const instant = statement === "balance-sheet";

    return rows.map(row => ({
        label: periodLabel(row),
        periodEnd: row.period_end,
        periodStart: instant ? null : row.period_start ?? null,
        preliminary: row.source.is_preliminary,
        title: filingSourceText(row.source),
    }));
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

    const groups = new Map<string, Map<string, StatementLine>>();

    rows.forEach((row, index) => {
        const facts = statementFacts(row, statement);

        if (!standardized) {
            for (const member of statementMembers(row, statement)) {
                let group = groups.get(member.concept);

                if (!group) {
                    group = new Map();

                    groups.set(member.concept, group);
                }

                let line = group.get(member.key);

                if (!line) {
                    line = { concept: member.concept, dimensions: member.dimensions, id: member.key, label: member.company_label ?? dimensionsText(member.dimensions), title: [member.company_label, dimensionsText(member.dimensions)].filter(Boolean).join(" · "), values: rows.map(() => undefined) };

                    group.set(member.key, line);
                }

                if (typeof member.value === "number") {
                    const cell = { derived: member.derived, value: member.value };

                    line.values[index] = "formula" in member ? toCell({ ...member, value: member.value }) : cell;
                }
            }
        }

        if (!facts || Array.isArray(facts)) return;

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

    return [
        ...[...lines.values()].flatMap(line => [...(groups.get(line.id)?.values() ?? []), line]),
        ...[...groups.entries()].flatMap(([concept, group]) => lines.has(concept) ? [] : [...group.values()]),
    ];
}

/** The presentation trees of a statement page, one column per period (empty tree = the statement is absent). */
export function presentationPeriods(rows: ReadonlyArray<V2StatementPeriod>, statement: StatementType, asReported = false) {
    return rows.map((row) => {
        const facts = statementFacts(row, statement);

        return {
            facts: Array.isArray(facts) ? facts : [],
            label: periodLabel(row),
            preliminary: row.source.is_preliminary,
            reportedPeriod: asReported ? row : undefined,
            title: filingSourceText(row.source),
        };
    });
}

/** Whether a loaded period states the statement at all (an empty page of a statement reads as "no data"). */
export function hasStatement(rows: ReadonlyArray<V2StatementPeriod>, statement: StatementType) {
    return rows.some((row) => {
        const facts = statementFacts(row, statement);

        return (Array.isArray(facts) ? facts.length > 0 : Object.keys(facts ?? {}).length > 0) || statementMembers(row, statement).length > 0;
    });
}

/** One line of a segments table. */
export type SegmentLine = {
    currency: null | string;
    /** The axis / member pairs in words ("Product · IPhone"). */
    details: string;
    key: string;
    legacyChartKey: string | undefined;
    metricId: string;
    segmentId: string;
    sourceMember: null | string;
    sourceRows: Record<string, string | undefined>;
    viaLink: boolean;
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
export function dimensionsText(dimensions: ReadonlyArray<V2Segment["dimensions"][number]>) {
    return dimensions.map(d => xbrlNameText(d.member)).filter(Boolean).join(" · ");
}

/** Complete target scope, independent of dimension-array ordering; namespaces remain meaningful off follow mode. */
export function segmentDimensionsKey(dimensions: V2Segment["dimensions"]) {
    return JSON.stringify(dimensions.map(d => [d.axis, d.member]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

/** A followed source row can appear under several targets; a repeated cursor-page row is still only one fact. */
export function segmentFactKey(segment: V2Segment): string {
    const target = segmentDimensionsKey(segment.dimensions);

    if (segment.source_row_id) return JSON.stringify([segment.company.cik, segment.source_row_id, target]);

    return JSON.stringify([
        segment.company.cik, segment.metric_id, segment.segment_id, target, segment.period,
        segment.fiscal_year, segment.fiscal_quarter, segment.period_start, segment.period_end,
        segment.currency ?? null, segment.value,
    ]);
}

/**
 * One line per metric × target scope × source member × currency. Followed merge components never sum or overwrite
 * each other. Repeated page facts are de-duplicated; any remaining same-period identity collision gets its own line.
 */
export function segmentLines(segments: ReadonlyArray<V2Segment>): Array<SegmentLine> {
    const lines = new Map<string, SegmentLine>();

    const seen = new Set<string>();

    for (const segment of segments) {
        const identity = segmentFactKey(segment);

        if (seen.has(identity)) continue;

        seen.add(identity);

        const label = periodLabel(segment);

        const viaLink = segment.via_link === true;

        const sourceMember = viaLink ? segment.source_member ?? null : null;

        const baseKey = JSON.stringify([
            segment.metric_id, segment.segment_id, segmentDimensionsKey(segment.dimensions),
            viaLink, sourceMember, segment.currency ?? null,
        ]);

        const key = lines.get(baseKey)?.values[label] === undefined ? baseKey : JSON.stringify([baseKey, identity]);

        let line = lines.get(key);

        if (!line) {
            const legacyDimensions = segment.dimensions.map(d => `${d.axis}=${d.member}`).join("|");

            line = {
                currency: segment.currency ?? null,
                details: dimensionsText(segment.dimensions),
                key,
                legacyChartKey: viaLink ? undefined : `${segment.metric_id}::${segment.segment_id}::${legacyDimensions}`,
                metricId: segment.metric_id,
                segmentId: segment.segment_id,
                sourceMember,
                sourceRows: {},
                values: {},
                viaLink,
            };

            lines.set(key, line);
        }

        line.values[label] = segment.value;

        line.sourceRows[label] = segment.source_row_id;
    }

    return [...lines.values()].sort((a, b) =>
        a.metricId.localeCompare(b.metricId) || a.segmentId.localeCompare(b.segmentId) || a.details.localeCompare(b.details)
        || Number(a.viaLink) - Number(b.viaLink) || (a.sourceMember ?? "").localeCompare(b.sourceMember ?? "") || a.key.localeCompare(b.key));
}

/** Export the visible table with the full row identity and the unformatted values. */
export function statementExportRows(lines: ReadonlyArray<StatementLine>, columns: ReadonlyArray<StatementColumn>) {
    return lines.map(line => ({
        dimensions: line.dimensions?.map(({ axis, member }) => `${axis}=${member}`).join("; ") ?? "",
        key: line.id,
        label: line.label,
        ...Object.fromEntries(columns.map((column, index) => [column.label, line.values[index]?.value ?? null])),
    }));
}
