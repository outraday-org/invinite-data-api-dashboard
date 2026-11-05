import { describe, expect, it } from "vitest";

import type { AvailableFormTypesResponse, Filing } from "@/lib/api/types";

import { formsMissingFromFacet, legacyFilingCore, secFilingAsLegacyRow } from "./parity";
import { SEC_FILINGS } from "./sec-fixtures";

// The legacy `getFilings` row of the same AAPL 10-K (`/v1/sec-filings/filings` shape; the dashboard's current call).
const LEGACY_10K: Filing = {
    accession_number: "0000320193-26-000026",
    calendar_quarter: 3,
    calendar_year: 2026,
    cik: "0000320193",
    filing_date: "2026-11-03T13:05:15.000Z",
    fiscal_quarter: 4,
    fiscal_year: 2026,
    form_type: "10-K",
    html_url: "https://storage-prod.invinite.com/filings/0123456789abcdef0123456789abcdef/aapl-20260926.htm",
    period_end: "2026-09-26",
    proposed_symbols: null,
};

// The legacy `getAvailableFormTypes` answer (a subset of AAPL's forms).
const LEGACY_FORMS: AvailableFormTypesResponse = { form_types: ["10-K", "10-Q", "10-K/A"] };

describe("getFilings → /v1/sec/filings", () => {
    it("a /v1/sec/filings row carries the legacy row's accession, form, filing date and period end", () => {
        const sec = SEC_FILINGS.filings?.find(row => row.accession === LEGACY_10K.accession_number);

        expect(sec).toBeDefined();

        expect(secFilingAsLegacyRow(sec!)).toEqual(legacyFilingCore(LEGACY_10K));
    });

    it("a row without a report date maps to period_end null (never a made-up period)", () => {
        const prospectus = SEC_FILINGS.filings?.find(row => row.form === "424B2");

        expect(secFilingAsLegacyRow(prospectus!)).toMatchObject({ form_type: "424B2", period_end: null });
    });

    it("the same filer (ticker identity) and a cursor instead of an offset", () => {
        expect(SEC_FILINGS.filer).toMatchObject({ cik: "320193", stated_tickers: ["AAPL"] });

        expect(SEC_FILINGS.next_cursor).toBeTruthy();
    });
});

describe("getAvailableFormTypes → form_facet", () => {
    it("the legacy form set ⊆ form_facet[].form", () => {
        expect(formsMissingFromFacet(LEGACY_FORMS.form_types, SEC_FILINGS.form_facet ?? [])).toEqual([]);
    });

    it("names a legacy form the facet lacks", () => {
        expect(formsMissingFromFacet(["10-K", "S-1"], SEC_FILINGS.form_facet ?? [])).toEqual(["S-1"]);
    });
});
