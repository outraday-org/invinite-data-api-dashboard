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

const { getV2Segments, getV2SegmentsDetailed } = await import("./server-functions");

describe("segment server query forwarding", () => {
    it.each(["standard", "detailed"])("%s sends the exact wire parameters without losing them at validation", async (view) => {
        mocks.get.mockClear();

        mocks.get.mockResolvedValue({ data: { data: [], has_more: false, meta: {}, next_cursor: null }, error: undefined, response: new Response() });

        const call = view === "standard" ? getV2Segments : getV2SegmentsDetailed;

        await call({ data: {
            apiKey: "test-key", company: "AAPL", followLinks: true, period: "annual",
            segmentIds: ["seg_operating_income_business_segment", "seg_total_assets_business_segment"],
        } });

        expect(mocks.get).toHaveBeenCalledWith(view === "standard" ? "/v1/segments" : "/v1/segments/detailed", {
            params: { query: expect.objectContaining({
                company: "AAPL", follow_links: true, period: "annual",
                segment_id: "seg_operating_income_business_segment,seg_total_assets_business_segment",
            }) },
        });
    });
});
