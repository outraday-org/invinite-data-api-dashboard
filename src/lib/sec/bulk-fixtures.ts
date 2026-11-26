import type { BulkDownload, BulkExport, BulkExportsResponse, BulkFile, BulkFilesResponse } from "@/lib/api/types";

/**
 * Bulk data fixtures (tests only), shaped like the Data API 12.2 spec's examples (`BulkFile`, `BulkExport`,
 * `BulkDownload` of `openapi.json`): a parsed f13 file, a superseded parsed file, the bare-CSV `icsc` raw file; a queued
 * N-PORT filer export, a ready f13 export cut by the Postgres window, an expired and a failed one; a download answer.
 */

export const BULK_FILE_PARSED: BulkFile = {
    bytes: 48_213_377,
    content_type: "application/gzip",
    coverage_end: "2026-09-30",
    coverage_start: "2026-07-01",
    dataset: "f13",
    file_id: "bf_01JDXQ8M6V3S2T4N5P7R9K0W1Y",
    filename: "sec-f13-2026q3.csv.gz",
    format: "csv_gz",
    kind: "parsed",
    period_key: "2026q3",
    released_at: "2026-10-15",
    row_count: 3_184_212,
    schema_version: "f13.v1",
    sha256: "9f2c4e8a1b7d3f6e0a5c9b2d8e4f7a1c3b6d9e2f5a8c1b4d7e0f3a6c9b2e5d8f",
    superseded_by: null,
};

export const BULK_FILE_SUPERSEDED: BulkFile = {
    ...BULK_FILE_PARSED,
    file_id: "bf_01JDXQ8M6V3S2T4N5P7R9K0W1Z",
    row_count: 3_184_001,
    sha256: "1f2c4e8a1b7d3f6e0a5c9b2d8e4f7a1c3b6d9e2f5a8c1b4d7e0f3a6c9b2e5d8f",
    superseded_by: BULK_FILE_PARSED.file_id,
};

export const BULK_FILE_RAW_CSV: BulkFile = {
    bytes: 2_048_111,
    content_type: "text/csv",
    coverage_end: null,
    coverage_start: null,
    dataset: "icsc",
    file_id: "bf_01JDXQ8M6V3S2T4N5P7R9K0W20",
    filename: "sec-icsc-2026.csv",
    format: "csv",
    kind: "raw",
    period_key: "2026",
    released_at: "2026-11-02",
    row_count: null,
    schema_version: null,
    sha256: "2f2c4e8a1b7d3f6e0a5c9b2d8e4f7a1c3b6d9e2f5a8c1b4d7e0f3a6c9b2e5d8f",
    superseded_by: null,
};

export const BULK_FILES_PAGE: BulkFilesResponse = {
    data: [BULK_FILE_RAW_CSV, BULK_FILE_PARSED],
    has_more: true,
    meta: {},
    next_cursor: "c_files_2",
};

const EXPORT_BASE: BulkExport = {
    bytes: null,
    company_ciks: [],
    coverage: null,
    created_at: "2026-11-26T16:05:00Z",
    dataset: "f13",
    date_field: "filed_date",
    error_code: null,
    expires_at: null,
    export_id: "bx_01JDXR2A4B6C8D0E2F4G6H8J0K",
    filename: null,
    filer_ciks: [],
    finished_at: null,
    format: "csv_gz",
    from: "2026-01-01",
    row_count: null,
    schema_version: null,
    sha256: null,
    started_at: null,
    status: "queued",
    to: "2026-06-30",
};

export const BULK_EXPORT_QUEUED: BulkExport = {
    ...EXPORT_BASE,
    dataset: "nport",
    date_field: "report_date",
    export_id: "bx_01JDXR2A4B6C8D0E2F4G6H8J0M",
    filer_ciks: ["0000036405"],
};

export const BULK_EXPORT_READY: BulkExport = {
    ...EXPORT_BASE,
    bytes: 1_830_417,
    company_ciks: ["0000320193"],
    coverage: { from: "2026-03-01", reason: "before_postgres_window", releases: ["2026q1", "2026q2"], scope: null, through: "2026-06-30" },
    created_at: "2026-11-26T15:58:02Z",
    date_field: "period_of_report",
    expires_at: "2099-12-03T16:01:44Z",
    filename: "sec-f13-export-2026-01-01-2026-06-30.csv.gz",
    finished_at: "2026-11-26T16:01:44Z",
    row_count: 20_517,
    schema_version: "f13.v1",
    sha256: "4b7e1d9c2a5f8e3b6d0c4a7f1e9b2d5c8a3f6e1b4d7c0a9e2f5b8d1c4a7e3f6b",
    started_at: "2026-11-26T15:58:10Z",
    status: "ready",
};

export const BULK_EXPORT_READY_NPORT: BulkExport = {
    ...BULK_EXPORT_READY,
    coverage: { from: "2026-01-01", reason: null, releases: ["2026q1"], scope: "listed_funds_full_unlisted_funds_holders_only", through: "2026-06-30" },
    dataset: "nport",
    date_field: "report_date",
    export_id: "bx_01JDXR2A4B6C8D0E2F4G6H8J0P",
    filename: "sec-nport-export-2026-01-01-2026-06-30.csv.gz",
    schema_version: "nport.v1",
};

export const BULK_EXPORT_EXPIRED: BulkExport = {
    ...BULK_EXPORT_READY,
    expires_at: "2026-11-01T00:00:00Z",
    export_id: "bx_01JDXR2A4B6C8D0E2F4G6H8J0Q",
    status: "expired",
};

export const BULK_EXPORT_FAILED: BulkExport = {
    ...EXPORT_BASE,
    company_ciks: ["0000789019"],
    error_code: "scratch_full",
    export_id: "bx_01JDXR2A4B6C8D0E2F4G6H8J0R",
    finished_at: "2026-11-26T16:03:00Z",
    started_at: "2026-11-26T16:02:00Z",
    status: "failed",
};

export const bulkExportsPage = (rows: Array<BulkExport>): BulkExportsResponse => ({ data: rows, has_more: false, meta: {}, next_cursor: null });

/** A download answer: `url` is the signed link the page must never keep. */
export const BULK_SIGNED_URL = "https://storage.example.com/bulk/sec-f13-2026q3.csv.gz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=fixture-signature";

export const bulkDownload = (): BulkDownload => ({
    bytes: 48_213_377,
    content_type: "application/gzip",
    expires_at: "2026-11-26T16:15:00Z",
    filename: "sec-f13-2026q3.csv.gz",
    sha256: "9f2c4e8a1b7d3f6e0a5c9b2d8e4f7a1c3b6d9e2f5a8c1b4d7e0f3a6c9b2e5d8f",
    url: BULK_SIGNED_URL,
});
