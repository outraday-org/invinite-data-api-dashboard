import { describe, expect, it } from "vitest";

import { apiRequestErrorAdapter } from "@/start";

import { ApiRequestError, isUnauthorized } from "./errors";

describe("ApiRequestError across the server-function boundary (src/start.ts)", () => {
    it("keeps the status, code, request id and body (the default error plugin keeps only the message)", () => {
        const error = new ApiRequestError(401, { error: "missing_api_key", message: "No API key is set.", requestId: "req_1" });

        expect(apiRequestErrorAdapter.test(error)).toBe(true);

        expect(apiRequestErrorAdapter.test(new Error("plain"))).toBe(false);

        const revived = apiRequestErrorAdapter.fromSerializable(apiRequestErrorAdapter.toSerializable(error));

        expect(revived).toBeInstanceOf(ApiRequestError);

        expect(revived).toMatchObject({ code: "missing_api_key", message: "No API key is set.", requestId: "req_1", status: 401 });

        expect(isUnauthorized(revived)).toBe(true);
    });
});
