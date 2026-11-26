import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ME_PRO } from "@/lib/account-fixtures";
import { ApiRequestError } from "@/lib/api/errors";

import {
    BULK_EXPORT_DATASETS,
    BULK_FILE_DATASETS,
    bulkExportFieldKeyOf,
    bulkFilesQuery,
    bulkPlanGate,
    bulkRefusalText,
    DATE_FIELDS_BY_DATASET,
    emptyBulkExportForm,
    EXPORT_STATUS_INFO,
    exportCoverageNotes,
    FORMATS_BY_KIND,
    isExportDownloadable,
    kindPatch,
    NPORT_EXPORT_SCOPE_TEXT,
    periodText,
    takeDownloadUrl,
    toCreateBulkExportBody,
    withDataset,
} from "./bulk";
import { BULK_EXPORT_EXPIRED, BULK_EXPORT_QUEUED, BULK_EXPORT_READY, BULK_EXPORT_READY_NPORT, BULK_FILE_PARSED, BULK_FILE_RAW_CSV, BULK_SIGNED_URL, bulkDownload } from "./bulk-fixtures";

const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../openapi.json"), "utf8")) as { components: { schemas: Record<string, { properties: Record<string, { enum?: Array<string> }> }> } };

const enumOf = (schema: string, field: string) => spec.components.schemas[schema].properties[field].enum;

describe("the words follow the contract's enums", () => {
    it("data sets, kinds, formats, statuses and date fields", () => {
        expect([...BULK_FILE_DATASETS].sort()).toEqual([...enumOf("BulkFile", "dataset")!].sort());

        expect([...BULK_EXPORT_DATASETS].sort()).toEqual([...enumOf("BulkExport", "dataset")!].sort());

        expect([...FORMATS_BY_KIND.parsed, ...FORMATS_BY_KIND.raw].sort()).toEqual([...enumOf("BulkFile", "format")!].sort());

        expect(Object.keys(EXPORT_STATUS_INFO).sort()).toEqual([...enumOf("BulkExport", "status")!].sort());

        expect([...new Set(Object.values(DATE_FIELDS_BY_DATASET).flat())].sort()).toEqual([...enumOf("BulkExport", "date_field")!].sort());
    });
});

describe("Files filters", () => {
    it("the URL state → the request; a format the kind lacks is not sent; superseded only when true", () => {
        expect(bulkFilesQuery({ dataset: "nport", format: "parquet", from: "2026-01-01", kind: "parsed", superseded: true, to: "2026-03-31" })).toEqual({
            dataset: "nport",
            format: "parquet",
            includeSuperseded: true,
            kind: "parsed",
            releasedFrom: "2026-01-01",
            releasedTo: "2026-03-31",
        });

        expect(bulkFilesQuery({ format: "zip", kind: "parsed" }).format).toBeUndefined();

        expect(bulkFilesQuery({}).includeSuperseded).toBeUndefined();

        // A reversed release range (a typed URL) is sent in order, never as an empty window.
        expect(bulkFilesQuery({ from: "2026-06-30", to: "2026-01-01" })).toMatchObject({ releasedFrom: "2026-01-01", releasedTo: "2026-06-30" });
    });

    it("a changed kind keeps a format only when the kind has it", () => {
        expect(kindPatch({ format: "zip" }, "parsed")).toEqual({ format: undefined, kind: "parsed" });

        expect(kindPatch({ format: "csv" }, "raw")).toEqual({ format: "csv", kind: "raw" });

        expect(kindPatch({ format: "parquet", kind: "parsed" }, undefined)).toEqual({ format: "parquet", kind: undefined });
    });

    it("a file's period: the key and its coverage days, or the key alone", () => {
        expect(periodText(BULK_FILE_PARSED)).toBe("2026q3 · Jul 1, 2026 – Sep 30, 2026");

        expect(periodText(BULK_FILE_RAW_CSV)).toBe("2026");
    });
});

describe("company export form", () => {
    const filled = { ...emptyBulkExportForm(), company: ["AAPL"], from: "2026-01-01", to: "2026-06-30" };

    it("builds the body: companies and filer CIKs (digits only, unpadded), the date field and the format", () => {
        expect(toCreateBulkExportBody({ ...filled, dateField: "period_of_report", filer: "0000102909, abc 2012383", format: "parquet" })).toEqual({
            body: { company: ["AAPL"], dataset: "f13", date_field: "period_of_report", filer: ["102909", "2012383"], format: "parquet", from: "2026-01-01", to: "2026-06-30" },
            errors: {},
        });
    });

    it("refuses what the API would: no subject, a reversed or too long range, a filer list without a CIK", () => {
        expect(toCreateBulkExportBody({ ...filled, company: [] }).errors).toEqual({ company: "Pick at least one company or enter a filer CIK." });

        expect(toCreateBulkExportBody({ ...filled, from: "2026-07-01" }).errors).toEqual({ to: "The last day is before the first day." });

        expect(toCreateBulkExportBody({ ...filled, from: "2010-01-01" }).errors).toEqual({ to: "At most 3,660 days." });

        expect(toCreateBulkExportBody({ ...filled, from: "" }).errors).toEqual({ from: "Pick the first day of the range." });

        expect(toCreateBulkExportBody({ ...filled, company: [], filer: "abc" }).errors).toEqual({ filer: "No CIK in this list (digits only)." });

        expect(toCreateBulkExportBody({ ...filled, company: Array.from({ length: 51 }, (_, index) => `C${index}`) }).errors).toEqual({ company: "At most 50 companies." });
    });

    it("Form D takes no filer; a changed data set keeps the date field only when the set has it", () => {
        expect(toCreateBulkExportBody({ ...filled, dataset: "formd", filer: "102909" }).body.filer).toBeUndefined();

        expect(withDataset({ ...filled, dateField: "period_of_report" }, "nport").dateField).toBe("filed_date");

        expect(withDataset({ ...filled, dateField: "filed_date" }, "f345").dateField).toBe("filed_date");
    });

    it("a 400's param names its field: company[3] → company, date_field, else the form's", () => {
        expect(bulkExportFieldKeyOf("company[3]")).toBe("company");

        expect(bulkExportFieldKeyOf("filer[0]")).toBe("filer");

        expect(bulkExportFieldKeyOf("date_field")).toBe("date_field");

        expect(bulkExportFieldKeyOf("Idempotency-Key")).toBeNull();

        expect(bulkExportFieldKeyOf(undefined)).toBeNull();
    });
});

describe("exports", () => {
    it("a download only while ready and not past its expiry; an expired row none", () => {
        expect(isExportDownloadable(BULK_EXPORT_READY)).toBe(true);

        expect(isExportDownloadable(BULK_EXPORT_EXPIRED)).toBe(false);

        expect(isExportDownloadable(BULK_EXPORT_QUEUED)).toBe(false);

        expect(isExportDownloadable({ ...BULK_EXPORT_READY, expires_at: "2026-01-01T00:00:00Z" }, new Date("2026-02-01T00:00:00Z"))).toBe(false);
    });

    it("the coverage sentences: the Postgres window cut and the N-PORT scope", () => {
        expect(exportCoverageNotes(BULK_EXPORT_READY)).toEqual(["Older periods are available as raw SEC zips on the Files tab."]);

        expect(exportCoverageNotes(BULK_EXPORT_READY_NPORT)).toEqual([NPORT_EXPORT_SCOPE_TEXT]);

        expect(exportCoverageNotes(BULK_EXPORT_QUEUED)).toEqual([]);
    });
});

describe("refusals, the download URL and the plan gate", () => {
    it("a daily-cap 429 names the cap and the reset at 00:00 UTC; another refusal says its detail and request id", () => {
        const cap = new ApiRequestError(429, { error: "rate_limited", message: "The daily bulk download limit (500 download URLs per UTC day) is reached", requestId: "req_1" });

        expect(bulkRefusalText(cap, new Date("2026-11-26T19:48:00Z"))).toBe("The daily bulk download limit (500 download URLs per UTC day) is reached. It resets at 00:00 UTC, in 4 h 12 min.");

        const open = new ApiRequestError(429, { error: "rate_limited", message: "The account already has the maximum number of exports queued or running", requestId: "req_2" });

        expect(bulkRefusalText(open)).toBe("The account already has the maximum number of exports queued or running (rate_limited, request req_2)");
    });

    it("takeDownloadUrl moves the signed URL out of the answer object", () => {
        const answer = bulkDownload();

        expect(takeDownloadUrl(answer)).toBe(BULK_SIGNED_URL);

        expect(answer).not.toHaveProperty("url");

        expect(JSON.stringify(answer)).not.toContain("X-Amz-Signature");
    });

    it("checking while /v1/me is unknown, refused for a known plan below Enterprise, allowed otherwise", () => {
        expect(bulkPlanGate({ me: null, state: "checking" }, "listBulkFiles")).toBe("checking");

        expect(bulkPlanGate({ me: ME_PRO, state: "ready" }, "listBulkFiles")).toBe("refused");

        expect(bulkPlanGate({ me: { ...ME_PRO, plan: "enterprise" }, state: "ready" }, "listBulkFiles")).toBe("allowed");

        expect(bulkPlanGate({ me: null, state: "unavailable" }, "listDatasets")).toBe("allowed");
    });
});
