import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
    env: { INVINITE_DATA_API_KEY: "secret-key", INVINITE_DATA_API_URL: "https://api.test" },
}));

const { fetchApiStatus, fetchEarningsCallsStatus, fetchLicensing } = await import("./public-fetchers.server");

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

describe("public status fetchers", () => {
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

    it("fetches /status once for two calls within 300 s, without an Authorization header", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(json({ generated_at: "x" })));

        await fetchApiStatus(30);

        vi.setSystemTime(new Date("2026-10-10T08:04:59Z"));

        await expect(fetchApiStatus(30)).resolves.toEqual({ generated_at: "x" });

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const request = requestAt(0);

        expect(request.url).toBe("https://api.test/status?days=30");

        expect(request.headers.get("Authorization")).toBeNull();
    });

    it("refetches after 300 s", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(json({ generated_at: "x" })));

        await fetchApiStatus(7);

        vi.setSystemTime(new Date("2026-10-10T08:05:00Z"));

        await fetchApiStatus(7);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("memoises /status/earnings-calls per days and vendor, key-less", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(json({ days: [] })));

        await fetchEarningsCallsStatus({ days: 30, vendor: "notified" });

        await fetchEarningsCallsStatus({ days: 30, vendor: "notified" });

        await fetchEarningsCallsStatus({ days: 30, vendor: "all" });

        expect(fetchMock).toHaveBeenCalledTimes(2);

        expect(requestAt(0).url).toBe("https://api.test/status/earnings-calls?days=30&vendor=notified");

        expect(requestAt(0).headers.get("Authorization")).toBeNull();
    });

    it("throws a 503 status_unavailable as ApiRequestError and does not cache it", async () => {
        fetchMock
            .mockImplementationOnce(() => Promise.resolve(json({ error: "status_unavailable", message: "off" }, 503)))
            .mockImplementationOnce(() => Promise.resolve(json({ days: [] })));

        const failure = await fetchEarningsCallsStatus({ days: 7 }).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(ApiRequestError);

        expect(failure).toMatchObject({ code: "status_unavailable", status: 503 });

        await expect(fetchEarningsCallsStatus({ days: 7 })).resolves.toEqual({ days: [] });

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("fetches /status/licensing once within 300 s, without an Authorization header", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(json({ policy_version: "1" })));

        await fetchLicensing();

        await fetchLicensing();

        expect(fetchMock).toHaveBeenCalledTimes(1);

        expect(requestAt(0).url).toBe("https://api.test/status/licensing");

        expect(requestAt(0).headers.get("Authorization")).toBeNull();
    });
});
