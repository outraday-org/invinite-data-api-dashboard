import { describe, expect, it } from "vitest";

import { ApiRequestError, errorDescription, fromSerialized, isTierError, rethrowApiError, throwApiError } from "./errors";

describe("ApiRequestError", () => {
    it("survives a JSON round trip through fromSerialized", () => {
        const original = new ApiRequestError(503, { error: "media_unavailable", message: "Media is temporarily unavailable" });

        const revived = fromSerialized(JSON.parse(JSON.stringify(original)));

        expect(revived).toBeInstanceOf(ApiRequestError);

        expect(revived?.status).toBe(503);

        expect(revived?.code).toBe("media_unavailable");

        expect(revived?.message).toBe("Media is temporarily unavailable");
    });

    it("revives the plain Error a server function rethrows on the client", () => {
        const revived = Object.assign(new Error("PRO plan required"), { code: "Forbidden", status: 403 });

        const error = fromSerialized(revived);

        expect(error?.status).toBe(403);

        expect(error?.message).toBe("PRO plan required");

        expect(isTierError(error)).toBe(true);
    });

    it("returns null for anything that is not an API error", () => {
        expect(fromSerialized(new Error("network"))).toBeNull();

        expect(fromSerialized({ error: "not_found", message: "x" })).toBeNull();

        expect(fromSerialized(null)).toBeNull();
    });

    it("throwApiError keeps the status and falls back without a body", () => {
        expect(() => throwApiError(undefined, new Response(null, { status: 502 }))).toThrow(ApiRequestError);

        try {
            throwApiError({ error: "search_disabled", message: "off" }, new Response(null, { status: 503 }));
        }
        catch (error) {
            expect((error as ApiRequestError).code).toBe("search_disabled");

            expect((error as ApiRequestError).status).toBe(503);
        }
    });

    it("rethrowApiError passes non-API errors through unchanged", () => {
        const network = new Error("fetch failed");

        expect(() => rethrowApiError(network)).toThrow(network);
    });
});

const PROBLEM = {
    code: "not_covered",
    detail: "Company ZZZZ is not covered",
    docs_url: "https://data.invinite.com/docs/errors#not_covered",
    request_id: "req_01HXYZ",
    status: 404,
    title: "Not covered",
    type: "https://data.invinite.com/docs/errors#not_covered",
};

function thrownBy(body: unknown, status: number) {
    try {
        throwApiError(body, new Response(null, { status }));
    }
    catch (error) {
        return error as ApiRequestError;
    }

    throw new Error("throwApiError did not throw");
}

describe("problem+json (v2)", () => {
    it("reads code, detail, param and request_id of a problem body", () => {
        const error = thrownBy({ ...PROBLEM, code: "unknown_parameter", detail: "Unknown parameter: offset", param: "offset", status: 400 }, 400);

        expect(error.status).toBe(400);

        expect(error.code).toBe("unknown_parameter");

        expect(error.message).toBe("Unknown parameter: offset");

        expect(error.body.param).toBe("offset");

        expect(error.requestId).toBe("req_01HXYZ");

        expect(error.reason).toBeNull();
    });

    it("keeps a v1 body unchanged (no request id)", () => {
        const error = thrownBy({ code: "scope_excluded", error: "excluded", message: "x" }, 403);

        expect(error.code).toBe("excluded");

        expect(error.reason).toBe("scope_excluded");

        expect(error.requestId).toBeNull();
    });

    it("the request id survives the server-function serialisation", () => {
        const original = thrownBy(PROBLEM, 404);

        const revived = fromSerialized(JSON.parse(JSON.stringify(original)));

        expect(revived).toBeInstanceOf(ApiRequestError);

        expect(revived?.code).toBe("not_covered");

        expect(revived?.message).toBe("Company ZZZZ is not covered");

        expect(revived?.requestId).toBe("req_01HXYZ");

        expect(errorDescription(revived as ApiRequestError)).toBe("Company ZZZZ is not covered (not_covered, request req_01HXYZ)");
    });

    it("keeps every parameter problem of errors[] across the serialisation", () => {
        const original = thrownBy({
            ...PROBLEM,
            code: "invalid_parameter",
            detail: "2 parameter problems",
            errors: [
                { code: "invalid_parameter", detail: "limit: must be at most 200.", param: "limit" },
                { code: "unknown_parameter", detail: "Unknown parameter: offset", param: "offset" },
                { code: 7 },
            ],
            status: 400,
        }, 400);

        const revived = fromSerialized(JSON.parse(JSON.stringify(original)));

        expect(revived?.body.errors).toEqual([
            { code: "invalid_parameter", detail: "limit: must be at most 200.", param: "limit" },
            { code: "unknown_parameter", detail: "Unknown parameter: offset", param: "offset" },
        ]);
    });

    it("recognises the v2 plan gate (403 plan_required), not any other 403", () => {
        expect(isTierError(thrownBy({ ...PROBLEM, code: "plan_required", status: 403 }, 403))).toBe(true);

        expect(isTierError(thrownBy({ ...PROBLEM, code: "excluded", status: 403 }, 403))).toBe(false);
    });

    it("errorDescription is the plain message without a request id", () => {
        expect(errorDescription(new Error("fetch failed"))).toBe("fetch failed");
    });
});
