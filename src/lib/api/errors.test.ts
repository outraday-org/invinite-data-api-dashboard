import { describe, expect, it } from "vitest";

import { ApiRequestError, fromSerialized, isTierError, rethrowApiError, throwApiError } from "./errors";

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
