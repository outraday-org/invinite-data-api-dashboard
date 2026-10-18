import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
    env: { INVINITE_DATA_API_KEY: "secret-key", INVINITE_DATA_API_URL: "https://api.test" },
}));

const { fetchLicensing } = await import("./public-fetchers.server");

const { ApiRequestError } = await import("./errors");

const fetchMock = vi.fn<(input: Request) => Promise<Response>>();

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status });
}

function requestAt(call: number) {
    const request = fetchMock.mock.calls[call]?.[0];

    if (!(request instanceof Request)) throw new Error(`fetch call ${call} got no Request`);

    return request;
}

describe("public licensing fetcher", () => {
    beforeEach(() => {
        fetchMock.mockReset();

        vi.stubGlobal("fetch", fetchMock);

        vi.useFakeTimers({ toFake: ["Date"] });

        vi.setSystemTime(new Date("2026-10-10T08:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();

        vi.unstubAllGlobals();
    });

    it("fetches /status/licensing once within 300 s, without an Authorization header", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(json({ policy_version: "1" })));

        await fetchLicensing();

        await fetchLicensing();

        expect(fetchMock).toHaveBeenCalledTimes(1);

        expect(requestAt(0).url).toBe("https://api.test/status/licensing");

        expect(requestAt(0).headers.get("Authorization")).toBeNull();
    });

    it("throws a 503 status_unavailable as ApiRequestError and does not cache it", async () => {
        // Past the previous test's 300-s memo entry.
        vi.setSystemTime(new Date("2026-10-10T09:00:00Z"));

        fetchMock
            .mockImplementationOnce(() => Promise.resolve(json({ error: "status_unavailable", message: "off" }, 503)))
            .mockImplementationOnce(() => Promise.resolve(json({ policy_version: "1" })));

        const failure = await fetchLicensing().catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(ApiRequestError);

        expect(failure).toMatchObject({ code: "status_unavailable", status: 503 });

        await expect(fetchLicensing()).resolves.toEqual({ policy_version: "1" });

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
