// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type { ApiRequestError } from "./errors";

import { useV2Event, useV2EventsInfinite, useV2GuidanceInfinite, useV2InvestorDocument, useV2LiveAudio, useV2QaInfinite } from "./queries";
import { getV2Event, getV2Events, getV2Guidance, getV2InvestorDocument, getV2LiveAudio, getV2Qa } from "./server-functions";

vi.mock("./server-functions", () => ({
    getV2Event: vi.fn(),
    getV2Events: vi.fn(),
    getV2Guidance: vi.fn(),
    getV2InvestorDocument: vi.fn(),
    getV2LiveAudio: vi.fn(),
    getV2Qa: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const EVENT_ID = "22056489-0000-4000-8000-000000000001";

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** A server function's thrown problem as the client receives it (a plain Error with its own fields). */
function problem(status: number, code: string, detail: string) {
    return Object.assign(new Error(detail), { body: { error: code, message: detail, requestId: "req_1" }, code, status });
}

beforeEach(() => {
    vi.mocked(getV2Event).mockReset();

    vi.mocked(getV2Events).mockReset();

    vi.mocked(getV2Guidance).mockReset();

    vi.mocked(getV2InvestorDocument).mockReset();

    vi.mocked(getV2LiveAudio).mockReset();

    vi.mocked(getV2Qa).mockReset();

    vi.mocked(toast.error).mockReset();

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });
});

describe("useV2EventsInfinite", () => {
    it("pages a company's events by next_cursor with the same filters", async () => {
        vi.mocked(getV2Events)
            .mockResolvedValueOnce({ data: [], has_more: true, meta: {}, next_cursor: "c2" })
            .mockResolvedValueOnce({ data: [], has_more: false, meta: {}, next_cursor: null });

        const input = { company: "NVDA", limit: 40, sort: "-scheduled_at" as const, type: "all" as const };

        const { result } = renderHook(() => useV2EventsInfinite(input), { wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        expect(getV2Events).toHaveBeenLastCalledWith({ data: { ...input, apiKey: "test-key", cursor: undefined } });

        await act(() => result.current.fetchNextPage());

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

        expect(getV2Events).toHaveBeenLastCalledWith({ data: { ...input, apiKey: "test-key", cursor: "c2" } });

        expect(result.current.hasNextPage).toBe(false);
    });

    it("keeps a 404 not_covered quiet (the calls list renders it) and never retries it", async () => {
        vi.mocked(getV2Events).mockRejectedValue(problem(404, "not_covered", "No company answers ZZZZ"));

        const { result } = renderHook(() => useV2EventsInfinite({ company: "ZZZZ", limit: 40 }), { wrapper });

        await waitFor(() => expect(result.current.error).not.toBeNull());

        expect((result.current.error as ApiRequestError).code).toBe("not_covered");

        expect(getV2Events).toHaveBeenCalledTimes(1);

        expect(toast.error).not.toHaveBeenCalled();
    });
});

describe("per-event hooks", () => {
    it("asks the event by id with its calendar and observations; an empty id stays idle", async () => {
        vi.mocked(getV2Event).mockResolvedValue({ event_id: EVENT_ID } as never);

        const idle = renderHook(() => useV2Event(""), { wrapper });

        expect(idle.result.current.fetchStatus).toBe("idle");

        const { result } = renderHook(() => useV2Event(EVENT_ID), { wrapper });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        expect(getV2Event).toHaveBeenCalledTimes(1);

        expect(getV2Event).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", eventId: EVENT_ID, expand: ["calendar", "observations"] } });
    });

    it("pages the Q&A by cursor; a 404 (no transcript) is a quiet page state", async () => {
        vi.mocked(getV2Qa)
            .mockResolvedValueOnce({ data: [], has_more: true, meta: { coverage: { state: "complete" } }, next_cursor: "q2" })
            .mockResolvedValueOnce({ data: [], has_more: false, meta: { coverage: { state: "complete" } }, next_cursor: null });

        const { result } = renderHook(() => useV2QaInfinite({ eventId: EVENT_ID, limit: 50 }), { wrapper });

        await waitFor(() => expect(result.current.hasNextPage).toBe(true));

        await act(() => result.current.fetchNextPage());

        expect(getV2Qa).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", cursor: "q2", eventId: EVENT_ID, limit: 50 } });

        vi.mocked(getV2Qa).mockRejectedValue(problem(404, "not_found", "No transcript for this event"));

        const missing = renderHook(() => useV2QaInfinite({ eventId: "22056489-0000-4000-8000-000000000002", limit: 50 }), { wrapper });

        await waitFor(() => expect(missing.result.current.error).not.toBeNull());

        expect(toast.error).not.toHaveBeenCalled();
    });

    it("asks guidance by event or company (a metric's history), idle without either", async () => {
        vi.mocked(getV2Guidance).mockResolvedValue({ data: [], has_more: false, meta: {}, next_cursor: null });

        const idle = renderHook(() => useV2GuidanceInfinite({ limit: 50 }), { wrapper });

        expect(idle.result.current.fetchStatus).toBe("idle");

        const input = { basis: "gaap" as const, company: "NVDA", limit: 200, metric: "revenue", periodKind: "quarter" as const, sort: "-conference_date" as const };

        const { result } = renderHook(() => useV2GuidanceInfinite(input), { wrapper });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        expect(getV2Guidance).toHaveBeenLastCalledWith({ data: { ...input, apiKey: "test-key", cursor: undefined } });
    });

    it("asks a document's per-page text with expand=pages only when asked", async () => {
        vi.mocked(getV2InvestorDocument).mockResolvedValue({ document_id: "d1", pages: [] } as never);

        const { result } = renderHook(() => useV2InvestorDocument("d1", { pages: true }), { wrapper });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        expect(getV2InvestorDocument).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", documentId: "d1", pages: true } });
    });
});

describe("useV2LiveAudio", () => {
    it("asks /live-audio ONCE per live event view (5 credits): no polling while not_started, no refetch on focus", async () => {
        vi.mocked(getV2LiveAudio).mockResolvedValue({ status: "not_started", url: null } as never);

        const { rerender, result } = renderHook(() => useV2LiveAudio(EVENT_ID), { wrapper });

        await waitFor(() => expect(result.current.data).not.toBeNull());

        act(() => {
            window.dispatchEvent(new Event("focus"));

            window.dispatchEvent(new Event("visibilitychange"));
        });

        rerender();

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(getV2LiveAudio).toHaveBeenCalledTimes(1);

        expect(getV2LiveAudio).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", eventId: EVENT_ID } });
    });

    it("stays idle without an event id (a call without live audio)", () => {
        const { result } = renderHook(() => useV2LiveAudio(""), { wrapper });

        expect(result.current.fetchStatus).toBe("idle");

        expect(getV2LiveAudio).not.toHaveBeenCalled();
    });
});
