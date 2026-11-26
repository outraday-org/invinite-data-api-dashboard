import { afterEach, describe, expect, it, vi } from "vitest";

import { BULK_EXPORT_QUEUED, BULK_FILES_PAGE, bulkDownload, bulkExportsPage } from "../sec/bulk-fixtures";
import { ApiRequestError } from "./errors";

const env = vi.hoisted(() => ({ INVINITE_DATA_API_KEY: undefined as string | undefined, INVINITE_DATA_API_URL: "https://api.test" }));

vi.mock("../env", () => ({ env }));

const { createApiClient } = await import("./client.server");

const requests = await import("./bulk-requests");

type Sent = { body: string; headers: Headers; method: string; url: string };

/** A mocked `fetch` answering `answer` and keeping what was sent. */
function mockFetch(answer: () => Response) {
    const sent: Array<Sent> = [];

    vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
        sent.push({ body: await request.clone().text(), headers: request.headers, method: request.method, url: request.url });

        return answer();
    }));

    return sent;
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "X-Request-Id": "req_1" }, status });

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the bulk requests (Data API 12.2)", () => {
    it("listBulkFiles sends the contract's parameter names; unset filters and a false include_superseded are left out", async () => {
        const sent = mockFetch(json(BULK_FILES_PAGE));

        await requests.listBulkFilesRequest(createApiClient("k"), { cursor: "c1", dataset: "f13", format: "parquet", includeSuperseded: true, kind: "parsed", limit: 100, releasedFrom: "2026-01-01", releasedTo: "2026-06-30" });

        const url = new URL(sent[0].url);

        expect(sent[0].method).toBe("GET");

        expect(url.pathname).toBe("/v1/bulk/files");

        expect(Object.fromEntries(url.searchParams)).toEqual({
            "cursor": "c1",
            "dataset": "f13",
            "format": "parquet",
            "include_superseded": "true",
            "kind": "parsed",
            "limit": "100",
            "released_at.gte": "2026-01-01",
            "released_at.lte": "2026-06-30",
        });

        const bare = mockFetch(json(BULK_FILES_PAGE));

        await requests.listBulkFilesRequest(createApiClient("k"), { includeSuperseded: false });

        expect(bare[0].url).toBe("https://api.test/v1/bulk/files");
    });

    it("the two downloads are GETs of their paths and answer the signed URL", async () => {
        const sent = mockFetch(json(bulkDownload()));

        expect((await requests.getBulkFileDownloadRequest(createApiClient("k"), "bf_01JDXQ8M6V3S2T4N5P7R9K0W1Y")).url).toContain("X-Amz-Signature");

        mockFetch(json(bulkDownload()));

        const later = mockFetch(json(bulkDownload()));

        await requests.getBulkExportDownloadRequest(createApiClient("k"), "bx_01JDXR2A4B6C8D0E2F4G6H8J0K");

        expect(sent[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/bulk/files/bf_01JDXQ8M6V3S2T4N5P7R9K0W1Y/download" });

        expect(later[0]).toMatchObject({ method: "GET", url: "https://api.test/v1/bulk/exports/bx_01JDXR2A4B6C8D0E2F4G6H8J0K/download" });
    });

    it("list and get exports; create is a POST with its body and the Idempotency-Key header", async () => {
        const list = mockFetch(json(bulkExportsPage([BULK_EXPORT_QUEUED])));

        await requests.listBulkExportsRequest(createApiClient("k"), { limit: 100 });

        expect(list[0].url).toBe("https://api.test/v1/bulk/exports?limit=100");

        const one = mockFetch(json(BULK_EXPORT_QUEUED));

        await requests.getBulkExportRequest(createApiClient("k"), BULK_EXPORT_QUEUED.export_id);

        expect(one[0].url).toBe(`https://api.test/v1/bulk/exports/${BULK_EXPORT_QUEUED.export_id}`);

        const created = mockFetch(json(BULK_EXPORT_QUEUED, 202));

        const body = { company: ["AAPL"], dataset: "f13" as const, from: "2026-01-01", to: "2026-06-30" };

        expect(await requests.createBulkExportRequest(createApiClient("k"), { body, idempotencyKey: "key-1" })).toEqual(BULK_EXPORT_QUEUED);

        expect(created[0]).toMatchObject({ method: "POST", url: "https://api.test/v1/bulk/exports" });

        expect(created[0].headers.get("Idempotency-Key")).toBe("key-1");

        expect(JSON.parse(created[0].body)).toEqual(body);
    });

    it("a refusal is an ApiRequestError with the problem's param", async () => {
        mockFetch(json({ code: "invalid_parameter", detail: "company[0]: SPY is a fund", docs_url: "", param: "company[0]", request_id: "req_9", status: 400, title: "Bad Request", type: "about:blank" }, 400));

        const error = await requests.createBulkExportRequest(createApiClient("k"), { body: { company: ["SPY"], dataset: "f13", from: "2026-01-01", to: "2026-06-30" } }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiRequestError);

        expect(error).toMatchObject({ body: { param: "company[0]" }, code: "invalid_parameter", status: 400 });
    });
});
