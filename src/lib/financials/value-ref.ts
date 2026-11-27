/** A filed formula operand and the provenance the API supplies for it. */
import type { V2AsReportedDetailedFact, V2AsReportedDetailedResponse, V2AsReportedMemberFact, V2StatementPeriod } from "@/lib/api/types";

import { V2_STATEMENT_KEYS } from "@/lib/api/v2";
import { formatDay } from "@/lib/format";

/** A filed value: concept (any taxonomy prefix) and period (`YYYY-MM-DD` days; an instant has only `instant`). */
type Dimension = V2AsReportedMemberFact["dimensions"][number];

export type ValueRef = {
    concept: string;
    dimensions: null | ReadonlyArray<Dimension>;
    end: null | string;
    factId?: string;
    instant: null | string;
    /** Defined for member-derived operands: null means the producer could not prove a source. */
    source?: null | ValueSource;
    start: null | string;
};

/** Where a value was filed: its filing and its element (null = the filing names none: open at the top). */
export type ValueSource = { accession: string; elementId: null | string };

const DAY = /^\d{4}-\d{2}-\d{2}/u;

/** A stated day (`2026-09-26T00:00:00` → `2026-09-26`); anything else (`-`, absent) = null. */
export const dayOf = (value: null | string | undefined) => (value && DAY.test(value) ? value.slice(0, 10) : null);

/** The concept without its taxonomy prefix (`us-gaap:Revenues` and `Revenues` name the same line). */
export const localConcept = (concept: string) => concept.slice(concept.lastIndexOf(":") + 1);

/** An undefined result is malformed or includes something other than explicit dimensions. */
function readDimensions(segment: unknown): null | ReadonlyArray<Dimension> | undefined {
    if (segment == null || segment === "-") return null;

    if (typeof segment === "string") {
        try {
            const parsed: unknown = JSON.parse(segment);

            return typeof parsed === "string" ? undefined : readDimensions(parsed);
        }
        catch {
            return undefined;
        }
    }

    if (typeof segment === "object" && "explicitMember" in segment) {
        return "typedMember" in segment ? undefined : readDimensions(segment.explicitMember);
    }

    const entries: ReadonlyArray<unknown> = Array.isArray(segment) ? segment : [segment];

    const dimensions: Array<Dimension> = [];

    for (const entry of entries) {
        if (!entry || typeof entry !== "object") return undefined;

        const axis = "axis" in entry ? entry.axis : "dimension" in entry ? entry.dimension : null;

        const member = "member" in entry ? entry.member : "value" in entry ? entry.value : "$t" in entry ? entry.$t : null;

        if (typeof axis !== "string" || typeof member !== "string" || !axis || !member) return undefined;

        dimensions.push({ axis, member });
    }

    return dimensions.length ? dimensions : null;
}

export function sameDimensions(a: ValueRef["dimensions"], b: ValueRef["dimensions"]) {
    const key = (dims: ValueRef["dimensions"]) => JSON.stringify(dims?.map(({ axis, member }) => JSON.stringify([axis, member])).sort() ?? null);

    return key(a) === key(b);
}

/** Prefer the published dimensions, then the preserved raw segment. Source qualifiers remain part of the identity. */
export function refOfMember(member: {
    accession?: string;
    concept?: null | string;
    dimensions?: unknown;
    end_date?: null | string;
    fact_id?: string;
    html_tag_id?: null | string;
    instant_date?: null | string;
    segment?: unknown;
    start_date?: null | string;
}, requireProof = false): null | ValueRef {
    const raw = member.fact_id ? refOfFactId(member.fact_id) : null;

    const concept = member.concept ?? raw?.concept;

    if (!concept) return null;

    const dimensions = member.dimensions !== undefined
        ? readDimensions(member.dimensions)
        : member.segment != null ? readDimensions(member.segment) : raw?.dimensions ?? null;

    const source = member.accession
        ? { accession: member.accession, elementId: member.html_tag_id ?? null }
        : requireProof || dimensions === undefined ? null : undefined;

    return {
        concept,
        dimensions: dimensions ?? null,
        end: dayOf(member.end_date) ?? raw?.end ?? null,
        factId: member.fact_id,
        instant: dayOf(member.instant_date) ?? raw?.instant ?? null,
        source,
        start: dayOf(member.start_date) ?? raw?.start ?? null,
    };
}

/**
 * A raw fact id (`320193|RevenueFromContractWithCustomerExcludingAssessedTax|2025-09-28T00:00:00|2026-09-26T00:00:00|-|-`,
 * cik | concept | start | end | …) as a reference; an id without a start is an instant at its end. null for anything
 * of another shape.
 */
export function refOfFactId(id: string, includeDimensions = true): null | ValueRef {
    const parts = id.split("|");

    if (parts.length < 4) return null;

    const [cik, concept, start, end, instant, segment] = parts;

    if (!/^\d+$/u.test(cik) || !concept || !/^[A-Za-z]/u.test(concept)) return null;

    const startDay = dayOf(start);

    const endDay = dayOf(end);

    const dimensions = includeDimensions ? readDimensions(segment) : null;

    if (dimensions === undefined) return null;

    return { concept, dimensions, end: startDay ? endDay : null, factId: id, instant: startDay ? null : (includeDimensions ? dayOf(instant) : null) ?? endDay, start: startDay };
}

/** The period in words: "Sep 28, 2025 – Sep 26, 2026" (duration) or "Sep 26, 2026" (instant); null = none stated. */
export function refPeriodText(ref: ValueRef): null | string {
    if (ref.start && ref.end) return `${formatDay(ref.start)} – ${formatDay(ref.end)}`;

    const day = ref.instant ?? ref.end;

    return day ? formatDay(day) : null;
}

const DAY_MS = 86_400_000;

/** The length of a duration in months, rounded ("3 months", "12 months"); null for an instant. */
export function refMonths(ref: ValueRef): null | number {
    if (!ref.start || !ref.end) return null;

    const days = (Date.parse(ref.end) - Date.parse(ref.start)) / DAY_MS + 1;

    return Number.isFinite(days) ? Math.max(1, Math.round(days / 30.44)) : null;
}

const FILED_DAY = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/New_York",
    year: "numeric",
});

/** The source filing observed by the statement cannot postdate the requested New York day. */
export function sourceInScope(source: V2StatementPeriod["source"], scope?: { asOf?: string }) {
    if (!scope?.asOf) return true;

    const filedAt = Date.parse(source.filed_at);

    return Number.isFinite(filedAt) && FILED_DAY.format(filedAt) <= scope.asOf;
}

type DetailedRow = V2AsReportedDetailedResponse["data"][number];

const isDetailedFact = (fact: unknown): fact is V2AsReportedDetailedFact =>
    typeof fact === "object" && fact !== null && "html_tag_id" in fact && "derived" in fact;

function rowMatches(row: { period_end: string; period_start: null | string }, ref: ValueRef) {
    const end = dayOf(row.period_end);

    if (ref.start && ref.end) return dayOf(row.period_start) === ref.start && end === ref.end;

    return end !== null && end === (ref.instant ?? ref.end);
}

/**
 * The filing of a referenced value in as-reported detailed rows (any statement): the filed fact of the same concept and
 * period — a filed one with its element before a computed one, which has none. null = not in these rows.
 */
export function findValueSource(rows: ReadonlyArray<DetailedRow | V2StatementPeriod>, ref: ValueRef): null | ValueSource {
    if (ref.source !== undefined) return ref.source;

    const concept = localConcept(ref.concept);

    let fallback: null | ValueSource = null;

    for (const row of rows) {
        if (!("period_start" in row) || !rowMatches(row, ref)) continue;

        for (const key of Object.values(V2_STATEMENT_KEYS)) {
            const block = row.statements[key];

            if (ref.dimensions) {
                if (!block || !("member_facts" in block)) continue;

                for (const fact of block.member_facts) {
                    if (fact.concept !== ref.concept || !sameDimensions(fact.dimensions, ref.dimensions)
                        || !("accession" in fact) || !fact.accession || fact.derived) continue;

                    const source = { accession: fact.accession, elementId: fact.html_tag_id };

                    if (fallback && (fallback.accession !== source.accession || fallback.elementId !== source.elementId)) return null;

                    fallback = source;
                }

                continue;
            }

            const facts = block?.facts;

            if (!facts || typeof facts !== "object" || Array.isArray(facts)) continue;

            for (const [id, fact] of Object.entries(facts)) {
                if (localConcept(id) !== concept || !isDetailedFact(fact) || !fact.accession) continue;

                if (!fact.derived && fact.html_tag_id) return { accession: fact.accession, elementId: fact.html_tag_id };

                fallback ??= { accession: fact.accession, elementId: null };
            }
        }
    }

    return fallback;
}

/** The as-reported detailed request that holds a referenced value: its period type and the fiscal years around its end. */
export type ValueLookup = { fiscalYearGte: number; fiscalYearLte: number; period: "annual" | "quarterly" | "ytd" };

export function valueLookupOf(ref: ValueRef): null | ValueLookup {
    if (ref.source !== undefined) return null;

    const end = ref.end ?? ref.instant;

    if (!end) return null;

    const year = Number(end.slice(0, 4));

    const months = refMonths(ref);

    const period = months === null || months <= 4 ? "quarterly" : months >= 11 ? "annual" : "ytd";

    // A fiscal year is named by the calendar year it ends in or the one before (a January year end): both are asked.
    return { fiscalYearGte: year - 1, fiscalYearLte: year + 1, period };
}
