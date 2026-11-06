/**
 * The `$ticker/filings` list on `/v1/sec/*` (backend delivery-integration task 7; the field mapping of task 2's
 * capability-parity table, which replaced the retired legacy filings family):
 * - a row: `accession`→accession number, `form`→form type, `filing_date`, `report_date`→period end;
 * - fiscal / calendar year + quarter: the `/v1/company/fiscal-periods` period whose `period_end` = `report_date`;
 * - the form-type picker: `form_facet[].form`;
 * - the HTML view: the manifest's primary document `source.url` (permanent public URL), loaded when a row is opened.
 */
import type { CompanyFiscalPeriod, SecFilingRow, SecFormFacet } from "@/lib/api/types";
import type { SecManifestDocument } from "@/lib/sec/source";

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

/** One `/v1/sec/filings` row as the list shows it; null = not listable (no accession / form / filing date). */
export function toFilingListRow(row: SecFilingRow, periods: ReadonlyMap<string, CompanyFiscalPeriod>): FilingListRow | null {
    if (!row.accession || !row.form || !row.filing_date) return null;

    const periodEnd = row.report_date ? row.report_date.slice(0, 10) : null;

    const period = periodEnd ? periods.get(periodEnd) : undefined;

    return {
        accessionNumber: row.accession,
        calendarQuarter: period?.calendar_quarter ?? null,
        calendarYear: period?.calendar_year ?? null,
        edgarIndexUrl: row.edgar_index_url?.startsWith("https://www.sec.gov/") ? row.edgar_index_url : null,
        filingDate: row.filing_date,
        fiscalQuarter: period?.fiscal_quarter ?? null,
        fiscalYear: period?.fiscal_year ?? null,
        formType: row.form,
        periodEnd,
        primaryDocument: row.primary_document ?? null,
    };
}

/** The form-type picker's options: `form_facet[].form`, in the facet's order. */
export function formTypesOfFacet(facet: ReadonlyArray<SecFormFacet> | undefined): Array<string> {
    return (facet ?? []).flatMap(entry => (entry.form ? [entry.form] : []));
}

/** The forms of `forms` the facet lacks (empty = `forms` ⊆ `form_facet[].form`). */
export function formsMissingFromFacet(forms: ReadonlyArray<string>, facet: ReadonlyArray<SecFormFacet>) {
    const present = new Set(formTypesOfFacet(facet));

    return forms.filter(form => !present.has(form));
}

/** The filing's primary document of its manifest: role `primary`, else the filename the filings row names. */
export function primaryDocumentOf(documents: ReadonlyArray<SecManifestDocument>, primaryFilename: null | string) {
    return documents.find(doc => doc.role === "primary")
        ?? (primaryFilename ? documents.find(doc => doc.filename === primaryFilename) : undefined)
        ?? null;
}
