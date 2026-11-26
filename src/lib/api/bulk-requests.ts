import type { createApiClient } from "./client.server";
import type { BulkDownload, BulkExport, BulkExportsResponse, BulkFileDataset, BulkFileFormat, BulkFileKind, BulkFilesResponse, CreateBulkExportRequest } from "./types";

import { throwApiError } from "./errors";
import { v2Query } from "./v2";

/**
 * The six SEC bulk data requests of the dashboard (Data API 12.2, backend tasks/sec-bulk-downloads task 8), one function
 * per operation on a given typed client (`server-functions-bulk.ts` passes `createApiClient(apiKey)`, the tests a
 * client over a mocked `fetch`). Every one is Enterprise and costs 0 credits; the two downloads count against the
 * account's daily download cap and answer a short-lived signed `url` (`Cache-Control: no-store`): they run only on a
 * click (`BulkDownloadButton` through `useApiMutation`), never on render, and their answer is never cached.
 */

type ApiClient = ReturnType<typeof createApiClient>;

/** The filters of `GET /v1/bulk/files`; unset = not sent. */
export type BulkFilesQuery = {
    cursor?: string;
    dataset?: BulkFileDataset;
    format?: BulkFileFormat;
    /** true = also the files a newer file of the same release replaced. */
    includeSuperseded?: boolean;
    kind?: BulkFileKind;
    limit?: number;
    /** `released_at.gte` (day). */
    releasedFrom?: string;
    /** `released_at.lte` (day). */
    releasedTo?: string;
};

/** `GET /v1/bulk/files` (newest release day first). */
export async function listBulkFilesRequest(client: ApiClient, query: BulkFilesQuery): Promise<BulkFilesResponse> {
    const { data, error, response } = await client.GET("/v1/bulk/files", {
        params: {
            query: v2Query({
                "cursor": query.cursor,
                "dataset": query.dataset,
                "format": query.format,
                "include_superseded": query.includeSuperseded || undefined,
                "kind": query.kind,
                "limit": query.limit,
                "released_at.gte": query.releasedFrom,
                "released_at.lte": query.releasedTo,
            }),
        },
    });

    if (error) throwApiError(error, response);

    return data;
}

/** `GET /v1/bulk/files/{file_id}/download`: a URL valid 15 minutes (one count against the daily download cap). */
export async function getBulkFileDownloadRequest(client: ApiClient, fileId: string): Promise<BulkDownload> {
    const { data, error, response } = await client.GET("/v1/bulk/files/{file_id}/download", { params: { path: { file_id: fileId } } });

    if (error) throwApiError(error, response);

    return data;
}

/** `GET /v1/bulk/exports` (the account's exports, newest first). */
export async function listBulkExportsRequest(client: ApiClient, query: { cursor?: string; limit?: number }): Promise<BulkExportsResponse> {
    const { data, error, response } = await client.GET("/v1/bulk/exports", { params: { query: v2Query(query) } });

    if (error) throwApiError(error, response);

    return data;
}

/** `GET /v1/bulk/exports/{export_id}`. */
export async function getBulkExportRequest(client: ApiClient, exportId: string): Promise<BulkExport> {
    const { data, error, response } = await client.GET("/v1/bulk/exports/{export_id}", { params: { path: { export_id: exportId } } });

    if (error) throwApiError(error, response);

    return data;
}

/**
 * `POST /v1/bulk/exports` (202 = a new export, 200 = the replay of an earlier request with the same key).
 * `idempotencyKey` = one key per form submission (the API replays the first answer for 24 h; 409 while it runs).
 */
export async function createBulkExportRequest(client: ApiClient, input: { body: CreateBulkExportRequest; idempotencyKey?: string }): Promise<BulkExport> {
    const { body, idempotencyKey } = input;

    const { data, error, response } = await client.POST("/v1/bulk/exports", {
        body,
        params: { header: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined },
    });

    if (error) throwApiError(error, response);

    return data;
}

/** `GET /v1/bulk/exports/{export_id}/download` (409 while not ready, 404 once expired; one count against the daily cap). */
export async function getBulkExportDownloadRequest(client: ApiClient, exportId: string): Promise<BulkDownload> {
    const { data, error, response } = await client.GET("/v1/bulk/exports/{export_id}/download", { params: { path: { export_id: exportId } } });

    if (error) throwApiError(error, response);

    return data;
}
