import { describe, expect, it } from "vitest";

import type { CompanyFiscalPeriod, SecFilingRow } from "@/lib/api/types";

import { fiscalPeriodIndex, formsMissingFromFacet, formTypesOfFacet, primaryDocumentOf, toFilingListRow } from "./parity";
import { SEC_FILINGS, SEC_MANIFEST } from "./sec-fixtures";
import { toManifestDocuments } from "./source";

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

// Live `/v1/company/fiscal-periods?identifier=AAPL` periods (2026-11-06).
const AAPL_PERIODS: Array<CompanyFiscalPeriod> = [
    { calendar_quarter: 3, calendar_year: 2026, fiscal_quarter: 4, fiscal_year: 2026, period_end: "2026-09-26" },
    { calendar_quarter: 2, calendar_year: 2026, fiscal_quarter: 3, fiscal_year: 2026, period_end: "2026-06-27" },
];

const periods = fiscalPeriodIndex(AAPL_PERIODS);

const rowOf = (accession: string) => SEC_FILINGS.filings!.find(row => row.accession === accession)!;

describe("$ticker/filings rows from /v1/sec/filings", () => {
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
        const prospectus = SEC_FILINGS.filings!.find(row => row.form === "424B2")!;

        expect(toFilingListRow(prospectus, periods)).toMatchObject({ fiscalQuarter: null, fiscalYear: null, formType: "424B2", periodEnd: null });
    });

    it("a report date the fiscal periods do not list keeps its period end, without a fiscal quarter", () => {
        const row: SecFilingRow = { ...rowOf(LEGACY_10K.accession_number), report_date: "1999-12-31" };

        expect(toFilingListRow(row, periods)).toMatchObject({ fiscalQuarter: null, periodEnd: "1999-12-31" });
    });

    it("a row without accession / form / filing date is not listed", () => {
        expect(toFilingListRow({ ...rowOf(LEGACY_10K.accession_number), accession: "" }, periods)).toBeNull();
    });

    it("the same filer (ticker identity) and a cursor instead of an offset", () => {
        expect(SEC_FILINGS.filer).toMatchObject({ cik: "320193", stated_tickers: ["AAPL"] });

        expect(SEC_FILINGS.next_cursor).toBeTruthy();
    });
});

describe("form-type picker = form_facet", () => {
    it("lists the facet's forms; the legacy form set ⊆ form_facet[].form", () => {
        expect(formTypesOfFacet(SEC_FILINGS.form_facet)).toEqual(expect.arrayContaining(LEGACY_FORMS));

        expect(formsMissingFromFacet(LEGACY_FORMS, SEC_FILINGS.form_facet ?? [])).toEqual([]);
    });

    it("names a form the facet lacks; no facet = no options", () => {
        expect(formsMissingFromFacet(["10-K", "S-1"], SEC_FILINGS.form_facet ?? [])).toEqual(["S-1"]);

        expect(formTypesOfFacet(undefined)).toEqual([]);
    });
});

describe("HTML view = the manifest's primary document", () => {
    it("role primary wins; else the filename the filings row names", () => {
        const documents = toManifestDocuments(SEC_MANIFEST.documents);

        expect(primaryDocumentOf(documents, null)?.filename).toBe("aapl-20261102.htm");

        const withoutRoles = documents.map(doc => ({ ...doc, role: null }));

        expect(primaryDocumentOf(withoutRoles, "a8-kex991q4202609262026.htm")?.filename).toBe("a8-kex991q4202609262026.htm");

        expect(primaryDocumentOf(withoutRoles, null)).toBeNull();
    });
});
