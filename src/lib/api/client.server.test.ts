import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestMeta } from "./request-meta";

const env = vi.hoisted(() => ({ INVINITE_DATA_API_KEY: undefined as string | undefined, INVINITE_DATA_API_URL: "https://api.test" }));

vi.mock("../env", () => ({ env }));

const { createApiClient, MISSING_API_KEY_CODE, recordApiRequests } = await import("./client.server");

afterEach(() => {
    vi.unstubAllGlobals();

    env.INVINITE_DATA_API_KEY = undefined;
});

describe("createApiClient", () => {
    it("sends the bearer key of the caller", async () => {
        const fetchMock = vi.fn((_request: Request) => Promise.resolve(new Response("{}", { headers: { "Content-Type": "application/json" }, status: 200 })));

        vi.stubGlobal("fetch", fetchMock);

        await createApiClient("k").GET("/v1/me");

        expect(fetchMock).toHaveBeenCalledTimes(1);

        expect(fetchMock.mock.calls[0][0].headers.get("Authorization")).toBe("Bearer k");
    });

    it("falls back to the server key", async () => {
        env.INVINITE_DATA_API_KEY = "server-key";

        const fetchMock = vi.fn((_request: Request) => Promise.resolve(new Response("{}", { headers: { "Content-Type": "application/json" }, status: 200 })));

        vi.stubGlobal("fetch", fetchMock);

        await createApiClient().GET("/v1/me");

        expect(fetchMock.mock.calls[0][0].headers.get("Authorization")).toBe("Bearer server-key");
    });

    it("without any key: a typed 401 problem and no network call (never `Bearer undefined`)", async () => {
        const fetchMock = vi.fn();

        vi.stubGlobal("fetch", fetchMock);

        const { error, response } = await createApiClient("  ").GET("/v1/me");

        expect(fetchMock).not.toHaveBeenCalled();

        expect(response.status).toBe(401);

        expect(error).toMatchObject({ code: MISSING_API_KEY_CODE, status: 401 });
    });
});

describe("recordApiRequests (the API inspector's recorder)", () => {
    const answer = (requestId: string) => new Response("{}", {
        headers: { "Content-Type": "application/json", "X-Credits-Charged": "1", "X-Request-Id": requestId },
        status: 200,
    });

    it("keeps concurrent server function calls apart: each list holds only its own requests, never the key", async () => {
        // Answers arrive out of order: B's request is answered before A's.
        let releaseA: () => void = () => {};

        const gateA = new Promise<void>((resolve) => {
            releaseA = resolve;
        });

        vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
            const symbol = new URL(request.url).pathname.split("/").at(-1) ?? "";

            if (symbol === "AAPL") await gateA;

            return answer(`req_${symbol}`);
        }));

        const listA: Array<RequestMeta> = [];

        const listB: Array<RequestMeta> = [];

        const callA = recordApiRequests(listA, () => createApiClient("key-of-user-a").GET("/v1/instruments/{symbol}", { params: { path: { symbol: "AAPL" } } }));

        const callB = recordApiRequests(listB, async () => {
            await createApiClient("key-of-user-b").GET("/v1/instruments/{symbol}", { params: { path: { symbol: "MSFT" } } });

            releaseA();

            await createApiClient("key-of-user-b").GET("/v1/instruments/{symbol}", { params: { path: { symbol: "NVDA" } } });
        });

        await Promise.all([callA, callB]);

        expect(listA.map(entry => entry.path)).toEqual(["/v1/instruments/AAPL"]);

        expect(listB.map(entry => entry.path)).toEqual(["/v1/instruments/MSFT", "/v1/instruments/NVDA"]);

        expect(listA[0]).toMatchObject({ credits: 1, operationId: "getInstrument", requestId: "req_AAPL", status: 200 });

        expect(JSON.stringify([listA, listB])).not.toMatch(/key-of-user|Bearer/);
    });

    it("records nothing outside a server function call", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(answer("req_x"))));

        const list: Array<RequestMeta> = [];

        await createApiClient("k").GET("/v1/me");

        await recordApiRequests(list, () => Promise.resolve());

        expect(list).toEqual([]);
    });
});
