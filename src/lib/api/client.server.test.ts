import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ INVINITE_DATA_API_KEY: undefined as string | undefined, INVINITE_DATA_API_URL: "https://api.test" }));

vi.mock("../env", () => ({ env }));

const { createApiClient, MISSING_API_KEY_CODE } = await import("./client.server");

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
