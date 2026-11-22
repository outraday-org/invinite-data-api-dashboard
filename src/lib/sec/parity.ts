/**
 * The `$ticker/filings` list on `/v1/filings` (backend tasks/data-api-v2 task 6, served under `/v1` since task 12):
 * - a row: `accession`→accession number, `form`→form type, `filing_date`, `report_date`→period end;
 * - fiscal / calendar year + quarter: the `/v1/fiscal-periods` period whose `period_end` = `report_date`;
 * - the form-type picker: `meta.form_facet[].form`;
 * - the HTML view: the primary document's public `source_url` of `/v1/filings/{accession}?expand=documents`, loaded
 *   when a row is opened.
 */
import type { CompanyFiscalPeriod, V2Filing, V2FormFacet } from "@/lib/api/types";
import type { V2FilingDocumentView } from "@/lib/sec/source";

import { formatDay } from "@/lib/format";

export type FilingListRow = {
    accessionNumber: string;
    calendarQuarter: null | number;
    calendarYear: null | number;
    /** The EDGAR index page: an outbound link only. */
    edgarIndexUrl: null | string;
    filingDate: string;
    fiscalQuarter: null | number;
    fiscalYear: null | number;
    formType: string;
    /** 8-K items (`2.02`, `9.01`); empty for other forms. */
    items: ReadonlyArray<string>;
    /** Arrived over the live stream since the page opened (not on a loaded page). */
    live?: boolean;
    /** `report_date`; null = the filing states no period (never a made-up one). */
    periodEnd: null | string;
    /** The primary document's filename as the filings list states it (null = not stated yet). */
    primaryDocument: null | string;
};

/** The company's fiscal periods by `period_end` (YYYY-MM-DD). */
export function fiscalPeriodIndex(periods: ReadonlyArray<CompanyFiscalPeriod>): ReadonlyMap<string, CompanyFiscalPeriod> {
    return new Map(periods.map(period => [period.period_end.slice(0, 10), period]));
}

/** One `/v1/filings` row as the list shows it; null = not listable (no accession / form / filing date). */
export function toFilingListRow(row: V2Filing, periods: ReadonlyMap<string, CompanyFiscalPeriod>): FilingListRow | null {
    if (!row.accession || !row.form || !row.filing_date) return null;

    const periodEnd = row.report_date ? row.report_date.slice(0, 10) : null;

    const period = periodEnd ? periods.get(periodEnd) : undefined;

    return {
        accessionNumber: row.accession,
        calendarQuarter: period?.calendar_quarter ?? null,
        calendarYear: period?.calendar_year ?? null,
        edgarIndexUrl: row.edgar_index_url.startsWith("https://www.sec.gov/") ? row.edgar_index_url : null,
        filingDate: row.filing_date.slice(0, 10),
        fiscalQuarter: period?.fiscal_quarter ?? null,
        fiscalYear: period?.fiscal_year ?? null,
        formType: row.form,
        items: row.items,
        periodEnd,
        primaryDocument: row.primary_document ?? null,
    };
}

/** "31 10-K filings, newest filed Nov 3, 2026" (one form) or "Newest filing Nov 19, 2026" (the whole facet); null = unknown. */
export function facetSummary(facet: ReadonlyArray<V2FormFacet> | undefined, form: null | string): null | string {
    const entries = facet ?? [];

    if (form) {
        const entry = entries.find(candidate => candidate.form === form);

        if (!entry) return null;

        const count = `${entry.count} ${entry.form} filing${entry.count === 1 ? "" : "s"}`;

        return entry.newest_filing_date ? `${count}, newest filed ${formatDay(entry.newest_filing_date)}` : count;
    }

    const newest = entries.map(entry => entry.newest_filing_date ?? "").filter(Boolean).sort().at(-1);

    return newest ? `Newest filing ${formatDay(newest)}` : null;
}

/** The form-type picker's options: `meta.form_facet[].form`, in the facet's order. */
export function formTypesOfFacet(facet: ReadonlyArray<V2FormFacet> | undefined): Array<string> {
    return (facet ?? []).flatMap(entry => (entry.form ? [entry.form] : []));
}

/** The forms of `forms` the facet lacks (empty = `forms` ⊆ `form_facet[].form`). */
export function formsMissingFromFacet(forms: ReadonlyArray<string>, facet: ReadonlyArray<V2FormFacet>) {
    const present = new Set(formTypesOfFacet(facet));

    return forms.filter(form => !present.has(form));
}

/**
 * The filing's primary document: the filename the filings row names, else the document whose EDGAR type is the
 * filing's form (v2 documents carry no role).
 */
export function primaryDocumentOf(documents: ReadonlyArray<V2FilingDocumentView>, primaryFilename: null | string, form: null | string = null) {
    return (primaryFilename ? documents.find(doc => doc.filename === primaryFilename) : undefined)
        ?? (form ? documents.find(doc => doc.type === form) : undefined)
        ?? null;
}
