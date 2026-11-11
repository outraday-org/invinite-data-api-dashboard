import { describe, expect, it } from "vitest";

import type { CompanyFiscalPeriod, V2Filing } from "@/lib/api/types";

import { fiscalPeriodIndex, formsMissingFromFacet, formTypesOfFacet, primaryDocumentOf, toFilingListRow } from "./parity";
import { toV2FilingDocuments } from "./source";
import { V2_FILING_10K, V2_FILINGS } from "./v2-fixtures";

// The retired legacy list's row of the same AAPL 10-K (frozen 2026-11-05): what the dashboard showed before task 7.
const LEGACY_10K = {
    accession_number: "0000320193-26-000026",
    calendar_quarter: 3,
    calendar_year: 2026,
    filing_date: "2026-11-03T13:05:15.000Z",
    fiscal_quarter: 4,
    fiscal_year: 2026,
    form_type: "10-K",
    period_end: "2026-09-26",
};

// The legacy form-type list (a subset of AAPL's forms).
const LEGACY_FORMS = ["10-K", "10-Q", "10-K/A"];

// `/v1/fiscal-periods?company=AAPL` rows (the values of the live periods of 2026-11-06).
const AAPL_PERIODS: Array<CompanyFiscalPeriod> = [
    { calendar_quarter: 3, calendar_year: 2026, company: { cik: "0000320193", ticker: "AAPL" }, fiscal_quarter: 4, fiscal_year: 2026, period_end: "2026-09-26" },
    { calendar_quarter: 2, calendar_year: 2026, company: { cik: "0000320193", ticker: "AAPL" }, fiscal_quarter: 3, fiscal_year: 2026, period_end: "2026-06-27" },
];

const periods = fiscalPeriodIndex(AAPL_PERIODS);

const rowOf = (accession: string): V2Filing => V2_FILINGS.data.find(row => row.accession === accession)!;

describe("$ticker/filings rows from /v1/filings", () => {
    it("carries the legacy row's accession, form, filing date, period end and fiscal / calendar quarter", () => {
        const row = toFilingListRow(rowOf(LEGACY_10K.accession_number), periods);

        expect(row).toMatchObject({
            accessionNumber: LEGACY_10K.accession_number,
            calendarQuarter: LEGACY_10K.calendar_quarter,
            calendarYear: LEGACY_10K.calendar_year,
            filingDate: LEGACY_10K.filing_date.slice(0, 10),
            fiscalQuarter: LEGACY_10K.fiscal_quarter,
            fiscalYear: LEGACY_10K.fiscal_year,
            formType: LEGACY_10K.form_type,
            periodEnd: LEGACY_10K.period_end,
            primaryDocument: "aapl-20260926.htm",
        });

        expect(row?.edgarIndexUrl).toMatch(/^https:\/\/www\.sec\.gov\//);
    });

    it("a row without a report date has no period and no fiscal quarter (never a made-up one)", () => {
        const prospectus = V2_FILINGS.data.find(row => row.form === "424B2")!;

        expect(toFilingListRow(prospectus, periods)).toMatchObject({ fiscalQuarter: null, fiscalYear: null, formType: "424B2", periodEnd: null });
    });

    it("a report date the fiscal periods do not list keeps its period end, without a fiscal quarter", () => {
        const row: V2Filing = { ...rowOf(LEGACY_10K.accession_number), report_date: "1999-12-31" };

        expect(toFilingListRow(row, periods)).toMatchObject({ fiscalQuarter: null, periodEnd: "1999-12-31" });
    });

    it("a row without accession / form / filing date is not listed; a non-EDGAR index URL is dropped", () => {
        expect(toFilingListRow({ ...rowOf(LEGACY_10K.accession_number), accession: "" }, periods)).toBeNull();

        expect(toFilingListRow({ ...rowOf(LEGACY_10K.accession_number), edgar_index_url: "https://example.com/x" }, periods)?.edgarIndexUrl).toBeNull();
    });

    it("pages by cursor (no offset)", () => {
        expect(V2_FILINGS.next_cursor).toBeTruthy();
    });
});

describe("form-type picker = meta.form_facet", () => {
    it("lists the facet's forms; the legacy form set ⊆ form_facet[].form", () => {
        expect(formTypesOfFacet(V2_FILINGS.meta.form_facet)).toEqual(expect.arrayContaining(LEGACY_FORMS));

        expect(formsMissingFromFacet(LEGACY_FORMS, V2_FILINGS.meta.form_facet ?? [])).toEqual([]);
    });

    it("names a form the facet lacks; no facet = no options", () => {
        expect(formsMissingFromFacet(["10-K", "S-1"], V2_FILINGS.meta.form_facet ?? [])).toEqual(["S-1"]);

        expect(formTypesOfFacet(undefined)).toEqual([]);
    });
});

describe("HTML view = the filing's primary document", () => {
    const documents = toV2FilingDocuments(V2_FILING_10K.documents);

    it("the filename the filings row names wins; else the document whose EDGAR type is the form", () => {
        expect(primaryDocumentOf(documents, "a10-kexhibit4109262026.htm", "10-K")?.filename).toBe("a10-kexhibit4109262026.htm");

        expect(primaryDocumentOf(documents, null, "10-K")?.filename).toBe("aapl-20260926.htm");

        expect(primaryDocumentOf(documents, "not-listed.htm", "10-K")?.filename).toBe("aapl-20260926.htm");
    });

    it("no filename and no form match = none (never a guess)", () => {
        expect(primaryDocumentOf(documents, null, "8-K")).toBeNull();

        expect(primaryDocumentOf(documents, null)).toBeNull();
    });
});
