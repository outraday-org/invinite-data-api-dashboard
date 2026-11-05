/**
 * Capability parity of the legacy dashboard SEC calls with their `/v1/sec/*` replacements (backend
 * delivery-integration task 2's parity table). Task 7 switches `$ticker/filings` from `getFilings` /
 * `getAvailableFormTypes` to `/v1/sec/filings` + `form_facet` through these mappings; until then they prove the
 * replacement carries every field the legacy list shows (`src/lib/sec/parity.test.ts`).
 */
import type { Filing, SecFilingRow, SecFormFacet } from "@/lib/api/types";

/** The legacy row fields `/v1/sec/filings` answers directly (fiscal / calendar periods come from `period_end`). */
export type LegacyFilingCore = Pick<Filing, "accession_number" | "filing_date" | "form_type"> & { period_end: null | string };

/** `accession`→`accession_number`, `form`→`form_type`, `filing_date`, `report_date`→`period_end`; null = not mappable. */
export function secFilingAsLegacyRow(row: SecFilingRow): LegacyFilingCore | null {
    if (!row.accession || !row.form || !row.filing_date) return null;

    return {
        accession_number: row.accession,
        filing_date: row.filing_date,
        form_type: row.form,
        period_end: row.report_date ?? null,
    };
}

/** The legacy row restricted to the fields the replacement carries (the legacy `filing_date` is a timestamp). */
export function legacyFilingCore(filing: Filing): LegacyFilingCore {
    return {
        accession_number: filing.accession_number,
        filing_date: filing.filing_date.slice(0, 10),
        form_type: filing.form_type,
        period_end: filing.period_end ? filing.period_end.slice(0, 10) : null,
    };
}

/** The legacy form types the facet lacks (empty = the legacy set ⊆ `form_facet[].form`). */
export function formsMissingFromFacet(legacyForms: ReadonlyArray<string>, facet: ReadonlyArray<SecFormFacet>) {
    const forms = new Set(facet.flatMap(entry => (entry.form ? [entry.form] : [])));

    return legacyForms.filter(form => !forms.has(form));
}
