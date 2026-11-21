import { createMiddleware } from "@tanstack/react-start";

import type { RequestMeta } from "./request-meta";

import { fileRequests } from "./request-meta";

/**
 * The global function middleware (`src/start.ts`) behind the API inspector: on the server each server function runs
 * inside `recordApiRequests` and the Data API requests it made travel back as the server's send context; in the
 * browser they are filed under the returned answer (or the thrown error), where `useViewRequests` finds them through
 * the query cache. No hook or server function registers anything itself.
 */
export const apiRequestsMiddleware = createMiddleware({ type: "function" })
    .client(async ({ next }) => {
        const outcome = await next();

        // The runtime result carries `result` / `error` beside the context; the server's send context arrives as `context`.
        const { context, error, result } = outcome as unknown as { context?: { apiRequests?: unknown }; error?: unknown; result?: unknown };

        fileRequests(result, context?.apiRequests);

        fileRequests(error, context?.apiRequests);

        return outcome;
    })
    .server(async ({ next }) => {
        // Dynamic: `node:async_hooks` must never reach the browser bundle (the server body is stripped there).
        const { recordApiRequests } = await import("./client.server");

        const apiRequests: Array<RequestMeta> = [];

        // The list is filled while the handler runs and serialized after it returned (same array reference).
        return recordApiRequests(apiRequests, () => next({ sendContext: { apiRequests } }));
    });
