import { createSerializationAdapter } from "@tanstack/react-router";
import { createStart } from "@tanstack/react-start";

import type { ApiErrorBody } from "@/lib/api/errors";

import { ApiRequestError } from "@/lib/api/errors";
import { apiRequestsMiddleware } from "@/lib/api/request-middleware";

/**
 * An `ApiRequestError` crosses the server-function boundary whole (status, code, body, request id). The default error
 * plugin keeps only the `message`, so without this adapter every status-aware state (401 key gate, 404 "not known",
 * 403 plan gate, 503 unavailable) arrived as a plain error.
 */
export const apiRequestErrorAdapter = createSerializationAdapter({
    fromSerializable: (value: { body: ApiErrorBody; status: number }) => new ApiRequestError(value.status, value.body),
    key: "invinite-api-request-error",
    test: (value): value is ApiRequestError => value instanceof ApiRequestError,
    toSerializable: error => ({ body: error.body, status: error.status }),
});

export const startInstance = createStart(() => ({
    // The API inspector: every server function reports the Data API requests it made (`request-middleware.ts`).
    functionMiddleware: [apiRequestsMiddleware],
    serializationAdapters: [apiRequestErrorAdapter],
}));
