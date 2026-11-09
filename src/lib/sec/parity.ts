/**
 * The `$ticker/filings` list on `/v2/filings` (backend tasks/data-api-v2 task 6; before it `/v1/sec/filings`, which
 * replaced the retired legacy filings family in delivery-integration task 7):
 * - a row: `accession`→accession number, `form`→form type, `filing_date`, `report_date`→period end;
 * - fiscal / calendar year + quarter: the `/v1/company/fiscal-periods` period whose `period_end` = `report_date`;
 * - the form-type picker: `meta.form_facet[].form`;
 * - the HTML view: the primary document's public `source_url` of `/v2/filings/{accession}?expand=documents`, loaded
 *   when a row is opened.
 */
import type { CompanyFiscalPeriod, V2Filing, V2FormFacet } from "@/lib/api/types";
import type { V2FilingDocumentView } from "@/lib/sec/source";

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
    /** `report_date`; null = the filing states no period (never a made-up one). */
    periodEnd: null | string;
    /** The primary document's filename as the filings list states it (null = not stated yet). */
    primaryDocument: null | string;
};

/** The company's fiscal periods by `period_end` (YYYY-MM-DD). */
export function fiscalPeriodIndex(periods: ReadonlyArray<CompanyFiscalPeriod>): ReadonlyMap<string, CompanyFiscalPeriod> {
    return new Map(periods.map(period => [period.period_end.slice(0, 10), period]));
}

/** One `/v2/filings` row as the list shows it; null = not listable (no accession / form / filing date). */
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
        periodEnd,
        primaryDocument: row.primary_document ?? null,
    };
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
