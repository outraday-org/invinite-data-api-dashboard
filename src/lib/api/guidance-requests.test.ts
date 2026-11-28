import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../env", () => ({ env: { INVINITE_DATA_API_URL: "https://api.example.test" } }));

vi.mock("./client.server", () => ({ createApiClient: () => ({ GET: mocks.get }) }));

vi.mock("@tanstack/react-start", () => {
    const builder = (validator?: { parse: (data: unknown) => unknown }) => ({
        handler: (handler: (request: { data: unknown }) => unknown) => (request: { data: unknown }) => handler({ data: validator ? validator.parse(request.data) : request.data }),
        inputValidator: (next: { parse: (data: unknown) => unknown }) => builder(next),
    });

    return { createServerFn: () => builder() };
});

const { getV2Guidance } = await import("./server-functions");

describe("Guidance request compatibility", () => {
    it.each([{ company: "AAPL" }, { event: "9655a5db-8968-40be-8c79-7cd1a8aed8e9" }])("uses the default served population while preserving scope and evidence", async (scope) => {
        const evidence = { confidence: 0.81, cross_validated: false, source_url: "https://issuer.example/release", sources: [] };

        const response = { data: [evidence], has_more: false, meta: {}, next_cursor: null };

        mocks.get.mockResolvedValue({ data: response, error: undefined, response: new Response() });

        const result = await getV2Guidance({ data: { apiKey: "test-key", ...scope, basis: "gaap", cursor: "cursor-1", limit: 20, metric: "revenue", periodKind: "quarter", sort: "-conference_date" } });

        expect(mocks.get).toHaveBeenLastCalledWith("/v1/guidance", { params: { query: { ...scope, basis: "gaap", cursor: "cursor-1", limit: 20, metric: "revenue", period_kind: "quarter", sort: "-conference_date" } } });

        expect(result).toBe(response);

        expect(result.data[0]).toEqual(evidence);
    });
});
