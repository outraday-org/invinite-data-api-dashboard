// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeRequestsOf } from "@/components/api/use-view-requests";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError } from "./errors";
import { endsSubmission, idempotencyKeyFor, useApiMutation, useIdempotencyKey } from "./mutations";
import { fileRequests, REDACTED } from "./request-meta";
import { createAlert, pauseAlert } from "./server-functions-alerts";

vi.mock("./server-functions-alerts", () => ({
    ALERT_BATCH_MAX: 500,
    batchAlerts: vi.fn(),
    createAlert: vi.fn(),
    deleteAlert: vi.fn(),
    pauseAlert: vi.fn(),
    resumeAlert: vi.fn(),
    testAlert: vi.fn(),
    updateAlert: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.mocked(pauseAlert).mockReset();

    vi.mocked(createAlert).mockReset();

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });
});

describe("useApiMutation", () => {
    it("runs the write with the stored key and refetches the listed key prefixes", async () => {
        vi.mocked(pauseAlert).mockResolvedValue({ id: "alt_1" } as never);

        const invalidate = vi.spyOn(client, "invalidateQueries");

        const { result } = renderHook(() => useApiMutation("pauseAlert", { invalidates: [["v2", "alerts"], ["v2", "alert"]] }), { wrapper });

        await act(() => result.current.mutateAsync({ id: "alt_1" }));

        expect(pauseAlert).toHaveBeenCalledWith({ data: { apiKey: "test-key", id: "alt_1" } });

        expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([["v2", "alerts"], ["v2", "alert"]]);
    });

    it("hands the revived ApiRequestError to the caller, never toasts, never retries, invalidates nothing", async () => {
        vi.mocked(pauseAlert).mockRejectedValue({ body: { error: "not_found", message: "No alert" }, code: "not_found", message: "No alert", status: 404 });

        const invalidate = vi.spyOn(client, "invalidateQueries");

        const { result } = renderHook(() => useApiMutation("pauseAlert", { invalidates: [["v2", "alerts"]] }), { wrapper });

        const error = await result.current.mutateAsync({ id: "alt_x" }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiRequestError);

        expect(error).toMatchObject({ code: "not_found", status: 404 });

        expect(pauseAlert).toHaveBeenCalledTimes(1);

        expect(toast.error).not.toHaveBeenCalled();

        expect(invalidate).not.toHaveBeenCalled();
    });
});

describe("Idempotency-Key per submission", () => {
    it("the same body keeps its key, another body gets a new one", () => {
        let n = 0;

        const next = () => `k${++n}`;

        const first = idempotencyKeyFor(null, { a: 1 }, next);

        expect(idempotencyKeyFor(first, { a: 1 }, next).key).toBe("k1");

        expect(idempotencyKeyFor(first, { a: 2 }, next).key).toBe("k2");
    });

    it("an API answer or a success ends the submission; a transport failure keeps the key for the retry", () => {
        expect(endsSubmission(null)).toBe(true);

        expect(endsSubmission(new ApiRequestError(400, { error: "invalid_parameter", message: "x" }))).toBe(true);

        expect(endsSubmission(new TypeError("Failed to fetch"))).toBe(false);
    });

    it("a double-submitted create sends one key twice (the API replays the first answer: one alert)", async () => {
        vi.mocked(createAlert).mockResolvedValue({ id: "alt_1", type: "filing" } as never);

        const { result } = renderHook(() => ({ key: useIdempotencyKey(), mutation: useApiMutation("createAlert", { invalidates: [] }) }), { wrapper });

        const body = { condition: { symbols: ["AAPL"] }, type: "filing" };

        await act(async () => {
            const first = result.current.key.keyFor(body);

            const second = result.current.key.keyFor(body);

            await Promise.all([result.current.mutation.mutateAsync({ body, idempotencyKey: first }), result.current.mutation.mutateAsync({ body, idempotencyKey: second })]);
        });

        const keys = vi.mocked(createAlert).mock.calls.map(([options]) => (options as { data: { idempotencyKey: string } }).data.idempotencyKey);

        expect(keys).toHaveLength(2);

        expect(keys[0]).toBe(keys[1]);

        act(() => result.current.key.settle(null));

        expect(result.current.key.keyFor(body)).not.toBe(keys[0]);
    });
});

describe("the inspector lists writes after they ran", () => {
    it("a settled write with its request; the answer redacted like the body", async () => {
        const answer = { id: "dst_1", secret: "whsec_live" };

        vi.mocked(pauseAlert).mockImplementation(() => {
            fileRequests(answer, [{ body: { id: "alt_1" }, credits: 1, method: "POST", operationId: "pauseAlert", path: "/v1/alerts/alt_1:pause", query: {}, requestId: "req_1", status: 200 }]);

            return Promise.resolve(answer as never);
        });

        const { result } = renderHook(() => useApiMutation("pauseAlert", { invalidates: [] }), { wrapper });

        await act(() => result.current.mutateAsync({ id: "alt_1" }));

        await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.status).toBe("success"));

        const writes = writeRequestsOf(client.getMutationCache().getAll());

        expect(writes).toHaveLength(1);

        expect(writes[0].meta).toMatchObject({ method: "POST", operationId: "pauseAlert", path: "/v1/alerts/alt_1:pause" });

        expect(writes[0].answer).toEqual({ id: "dst_1", secret: REDACTED });
    });
});
