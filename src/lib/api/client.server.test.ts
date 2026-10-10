import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("openapi-fetch", () => ({ default: createClientMock }));

vi.mock("../env", () => ({
    env: { INVINITE_DATA_API_KEY: undefined, INVINITE_DATA_API_URL: "https://api.test" },
}));

const { createApiClient, createPublicApiClient } = await import("./client.server");

describe("createPublicApiClient", () => {
    beforeEach(() => {
        createClientMock.mockClear();
    });

    it("builds a client without any Authorization header", () => {
        createPublicApiClient();

        expect(createClientMock).toHaveBeenCalledWith({ baseUrl: "https://api.test" });
    });

    it("differs from createApiClient, which always sends the bearer key", () => {
        createApiClient("k");

        expect(createClientMock).toHaveBeenCalledWith({
            baseUrl: "https://api.test",
            headers: { Authorization: "Bearer k" },
        });
    });
});
