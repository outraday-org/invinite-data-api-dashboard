import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { BulkDownload, BulkExport, BulkExportsResponse, BulkFilesResponse } from "./types";

import {
    createBulkExportRequest,
    getBulkExportDownloadRequest,
    getBulkExportRequest,
    getBulkFileDownloadRequest,
    listBulkExportsRequest,
    listBulkFilesRequest,
} from "./bulk-requests";
import { createApiClient } from "./client.server";
import { apiKeySchema, pageInput } from "./server-schemas";

/**
 * The SEC bulk data server functions (Data API 12.2, backend tasks/sec-bulk-downloads task 8), beside the alert ones:
 * every one is `POST` (the key travels in the RPC body, never a URL: `no-direct-api-calls.test.ts`), only the API
 * request inside is a GET or a POST (`bulk-requests.ts`). Inputs are checked with zod against the contract's bounds.
 */

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

/** A bulk file's id (`bf_` + ULID). */
const fileIdSchema = z.string().regex(new RegExp(`^bf_${ULID}$`));

/** A company export's id (`bx_` + ULID). */
const exportIdSchema = z.string().regex(new RegExp(`^bx_${ULID}$`));

const createBodySchema = z.object({
    company: z.array(z.string().trim().min(1).max(20)).max(50).optional(),
    dataset: z.enum(["f13", "f345", "formd", "nport"]),
    date_field: z.enum(["filed_date", "period_of_report", "transaction_date", "first_sale_date", "report_date"]).optional(),
    filer: z.array(z.string().regex(/^\d{1,10}$/)).max(50).optional(),
    format: z.enum(["csv_gz", "parquet"]).optional(),
    from: z.iso.date(),
    to: z.iso.date(),
});

export const getBulkFiles = createServerFn({ method: "POST" })
    .inputValidator(z.object({
        apiKey: apiKeySchema,
        dataset: z.enum(["f13", "f345", "formd", "fsn", "icsc", "ncen", "nport", "rr"]).optional(),
        format: z.enum(["zip", "csv", "csv_gz", "parquet"]).optional(),
        includeSuperseded: z.boolean().optional(),
        kind: z.enum(["raw", "parsed"]).optional(),
        releasedFrom: z.iso.date().optional(),
        releasedTo: z.iso.date().optional(),
        ...pageInput,
    }))
    .handler(({ data }): Promise<BulkFilesResponse> => {
        const { apiKey, ...query } = data;

        return listBulkFilesRequest(createApiClient(apiKey), query);
    });

export const getBulkFileDownload = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, fileId: fileIdSchema }))
    .handler(({ data }): Promise<BulkDownload> => getBulkFileDownloadRequest(createApiClient(data.apiKey), data.fileId));

export const getBulkExports = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, ...pageInput }))
    .handler(({ data }): Promise<BulkExportsResponse> => listBulkExportsRequest(createApiClient(data.apiKey), { cursor: data.cursor, limit: data.limit }));

export const getBulkExport = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, exportId: exportIdSchema }))
    .handler(({ data }): Promise<BulkExport> => getBulkExportRequest(createApiClient(data.apiKey), data.exportId));

export const createBulkExport = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, body: createBodySchema, idempotencyKey: z.string().min(1).max(255).optional() }))
    .handler(({ data }): Promise<BulkExport> => createBulkExportRequest(createApiClient(data.apiKey), {
        body: data.body,
        idempotencyKey: data.idempotencyKey,
    }));

export const getBulkExportDownload = createServerFn({ method: "POST" })
    .inputValidator(z.object({ apiKey: apiKeySchema, exportId: exportIdSchema }))
    .handler(({ data }): Promise<BulkDownload> => getBulkExportDownloadRequest(createApiClient(data.apiKey), data.exportId));
