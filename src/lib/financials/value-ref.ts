/**
 * A filed value named by its concept and period — a computed value's operand (an as-reported formula member, a
 * standardized fact's raw operand id) — and where the company filed it. A formula member carries no filing: the filing
 * and the value's inline-XBRL element are those of the as-reported detailed fact of the same concept and period, found
 * in the loaded statement rows or, else, in one as-reported detailed request for the period's type around its year.
 */
import type { V2AsReportedDetailedFact, V2AsReportedDetailedResponse, V2StatementPeriod } from "@/lib/api/types";

import { V2_STATEMENT_KEYS } from "@/lib/api/v2";
import { formatDay } from "@/lib/format";

/** A filed value: concept (any taxonomy prefix) and period (`YYYY-MM-DD` days; an instant has only `instant`). */
export type ValueRef = { concept: string; end: null | string; instant: null | string; start: null | string };

/** Where a value was filed: its filing and its element (null = the filing names none: open at the top). */
export type ValueSource = { accession: string; elementId: null | string };

const DAY = /^\d{4}-\d{2}-\d{2}/u;

/** A stated day (`2026-09-26T00:00:00` → `2026-09-26`); anything else (`-`, absent) = null. */
export const dayOf = (value: null | string | undefined) => (value && DAY.test(value) ? value.slice(0, 10) : null);

/** The concept without its taxonomy prefix (`us-gaap:Revenues` and `Revenues` name the same line). */
export const localConcept = (concept: string) => concept.slice(concept.lastIndexOf(":") + 1);

/** A formula member's reference; null for a standardized member (a metric id, no concept). */
export function refOfMember(member: { concept?: null | string; end_date?: null | string; instant_date?: null | string; start_date?: null | string }): null | ValueRef {
    if (!member.concept) return null;

    return { concept: member.concept, end: dayOf(member.end_date), instant: dayOf(member.instant_date), start: dayOf(member.start_date) };
}

/**
 * A raw fact id (`320193|RevenueFromContractWithCustomerExcludingAssessedTax|2025-09-28T00:00:00|2026-09-26T00:00:00|-|-`,
 * cik | concept | start | end | …) as a reference; an id without a start is an instant at its end. null for anything
 * of another shape.
 */
export function refOfFactId(id: string): null | ValueRef {
    const parts = id.split("|");

    if (parts.length < 4) return null;

    const [cik, concept, start, end] = parts;

    if (!/^\d+$/u.test(cik) || !concept || !/^[A-Za-z]/u.test(concept)) return null;

    const startDay = dayOf(start);

    const endDay = dayOf(end);

    return { concept, end: startDay ? endDay : null, instant: startDay ? null : endDay, start: startDay };
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
    const concept = localConcept(ref.concept);

    let fallback: null | ValueSource = null;

    for (const row of rows) {
        if (!("period_start" in row) || !rowMatches(row, ref)) continue;

        const statements: Partial<Record<string, { facts: unknown }>> = row.statements;

        for (const key of Object.values(V2_STATEMENT_KEYS)) {
            const facts = statements[key]?.facts;

            if (!facts || typeof facts !== "object" || Array.isArray(facts)) continue;

            for (const [id, fact] of Object.entries(facts as Record<string, unknown>)) {
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
    const end = ref.end ?? ref.instant;

    if (!end) return null;

    const year = Number(end.slice(0, 4));

    const months = refMonths(ref);

    const period = months === null || months <= 4 ? "quarterly" : months >= 11 ? "annual" : "ytd";

    // A fiscal year is named by the calendar year it ends in or the one before (a January year end): both are asked.
    return { fiscalYearGte: year - 1, fiscalYearLte: year + 1, period };
}
