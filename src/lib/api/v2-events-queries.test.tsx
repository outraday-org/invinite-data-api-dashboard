// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoricalSlideSelection } from "@/routes/$ticker/earnings-calls/-components/slide-history";

import { availabilityInterval, useEventAvailability } from "@/lib/earnings/event-availability";
import { AAPL_Q4_EVENT } from "@/lib/earnings/o7-earnings-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { HistorySlides, VerifiedHistoricalSlides } from "@/routes/$ticker/earnings-calls/-components/slide-history";

import type { ApiRequestError } from "./errors";

import { useV2Event, useV2EventsInfinite, useV2GuidanceInfinite, useV2InvestorDocument, useV2LiveAudio, useV2LiveEvents, useV2QaInfinite, useV2Slides } from "./queries";
import { getV2Event, getV2Events, getV2Guidance, getV2InvestorDocument, getV2LiveAudio, getV2Qa, getV2Slides } from "./server-functions";

vi.mock("./server-functions", () => ({
    getV2Event: vi.fn(),
    getV2Events: vi.fn(),
    getV2Guidance: vi.fn(),
    getV2InvestorDocument: vi.fn(),
    getV2LiveAudio: vi.fn(),
    getV2Qa: vi.fn(),
    getV2Slides: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const EVENT_ID = "22056489-0000-4000-8000-000000000001";

describe("public live reads and bounded detail polling", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    });

    afterEach(() => {
        vi.useRealTimers();
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    });

    function stableWrapper() {
        const client = new QueryClient({ defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY, retry: false } } });
        return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const wire = { ...AAPL_Q4_EVENT, capture_status: "captured", event_id: EVENT_ID, has_transcript: false };

    function useDetail() {
        const availability = useEventAvailability(EVENT_ID);
        const query = useV2Event(EVENT_ID, {
            active: availability.active,
            refetchInterval: (event, error) => availabilityInterval(event, {
                error, nowMs: Date.now(), untilMs: availability.untilMs, visible: availability.visible,
            }),
            visible: availability.visible,
        });
        return { availability, query };
    }

    it("scopes detail live membership by issuer and shares a query without inspecting capture fields", async () => {
        const page = { data: [wire], has_more: true, meta: {}, next_cursor: "more" };
        vi.mocked(getV2Events).mockResolvedValue(page);
        const { result, unmount } = renderHook(() => useV2LiveEvents(true, "0000320193"), { wrapper: stableWrapper() });
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(result.current.data).toEqual(page);
        expect(getV2Events).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", company: "0000320193", limit: 200, status: ["live"], type: "all" } });
        unmount();
    });

    it("ordinary cached/member reads create no row polling even when the old response says captured", async () => {
        vi.mocked(getV2Event).mockResolvedValue(wire);
        const { unmount } = renderHook(() => { useV2Event(EVENT_ID); useV2Event(EVENT_ID); }, { wrapper: stableWrapper() });
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(getV2Event).toHaveBeenCalledTimes(1);
        await act(() => vi.advanceTimersByTimeAsync(20 * 60_000));
        expect(getV2Event).toHaveBeenCalledTimes(1);
        unmount();
    });

    it("polls every thirty seconds within a fixed ten minutes and only manual refresh restarts it", async () => {
        vi.mocked(getV2Event).mockResolvedValue(wire);
        const { result, unmount } = renderHook(useDetail, { wrapper: stableWrapper() });
        await act(() => vi.advanceTimersByTimeAsync(1));
        for (let tick = 0; tick < 21; tick += 1) await act(() => vi.advanceTimersByTimeAsync(30_000));
        expect(result.current.availability.active).toBe(false);
        expect(getV2Event).toHaveBeenCalledTimes(20);
        act(() => {
            window.dispatchEvent(new Event("focus"));
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await act(() => vi.advanceTimersByTimeAsync(60_000));
        expect(getV2Event).toHaveBeenCalledTimes(20);
        await act(async () => { result.current.availability.restart(); await result.current.query.refetch(); });
        expect(getV2Event).toHaveBeenCalledTimes(21);
        unmount();
    });

    it("stops on publication and on a denied response, with no hidden or unmounted requests", async () => {
        vi.mocked(getV2Event).mockResolvedValue(wire);
        const { result, unmount } = renderHook(useDetail, { wrapper: stableWrapper() });
        await act(() => vi.advanceTimersByTimeAsync(1));
        vi.mocked(getV2Event).mockResolvedValue({ ...wire, has_transcript: true });
        await act(() => vi.advanceTimersByTimeAsync(30_000));
        expect(result.current.query.data?.has_transcript).toBe(true);
        await act(() => vi.advanceTimersByTimeAsync(60_000));
        expect(getV2Event).toHaveBeenCalledTimes(2);
        vi.mocked(getV2Event).mockRejectedValue(problem(403, "plan_required", "Upgrade"));
        await act(async () => { await result.current.query.refetch(); });
        await act(() => vi.advanceTimersByTimeAsync(60_000));
        expect(getV2Event).toHaveBeenCalledTimes(3);
        act(() => {
            Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await act(() => vi.advanceTimersByTimeAsync(60_000));
        expect(getV2Event).toHaveBeenCalledTimes(3);
        unmount();
        await act(() => vi.advanceTimersByTimeAsync(60_000));
        expect(getV2Event).toHaveBeenCalledTimes(3);
    });
});

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

    vi.mocked(getV2Slides).mockReset();

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

    it("pages the Q&A by cursor with its scores; a 404 (no transcript) is a quiet page state", async () => {
        vi.mocked(getV2Qa)
            .mockResolvedValueOnce({ data: [], has_more: true, meta: { coverage: { state: "complete" } }, next_cursor: "q2" })
            .mockResolvedValueOnce({ data: [], has_more: false, meta: { coverage: { state: "complete" } }, next_cursor: null });

        const { result } = renderHook(() => useV2QaInfinite({ eventId: EVENT_ID, limit: 50 }), { wrapper });

        await waitFor(() => expect(result.current.hasNextPage).toBe(true));

        await act(() => result.current.fetchNextPage());

        expect(getV2Qa).toHaveBeenLastCalledWith({ data: { apiKey: "test-key", cursor: "q2", eventId: EVENT_ID, include: "scores", limit: 50 } });

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

describe("slide cache retention", () => {
    it("revalidates a selected comparison after actual same-key historical refetches", async () => {
        const current = { image_url: "https://example.com/current.webp", markdown: "# Revenue", page: 3, title: "Revenue" };

        const prior = { ...current, image_url: "https://example.com/prior.webp", page: 12 };

        const response = { deck: null, event: { cik: "123", conference_date: "2023-11-21", event_id: EVENT_ID, symbol: "TEST" }, slides: [prior] };

        vi.mocked(getV2Slides).mockResolvedValue(response);

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        const view = render(
            <QueryClientProvider client={client}>
                <VerifiedHistoricalSlides currentSlide={current} currentSlides={[current]} selection={{ eventId: EVENT_ID, label: "Prior", slide: prior, slides: [prior] }}>
                    {fresh => <img alt="Verified comparison" src={fresh.slides[0].image_url} />}
                </VerifiedHistoricalSlides>
            </QueryClientProvider>,
        );

        await waitFor(() => expect(screen.getByAltText("Verified comparison")).toHaveAttribute("src", prior.image_url));

        vi.mocked(getV2Slides).mockResolvedValue({ ...response, slides: [] });

        await act(() => client.invalidateQueries({ queryKey: ["v2", "slides", EVENT_ID] }));

        await waitFor(() => expect(screen.queryByAltText("Verified comparison")).toBeNull());

        vi.mocked(getV2Slides).mockResolvedValue({ ...response, slides: [{ ...prior, markdown: "Revenue\n#### **Q4 FY24 Outlook**" }] });

        await act(() => client.invalidateQueries({ queryKey: ["v2", "slides", EVENT_ID] }));

        await waitFor(() => expect(screen.getByText("The slide headings do not support this comparison.")).toBeInTheDocument());

        vi.mocked(getV2Slides).mockResolvedValue({ ...response, slides: [{ ...prior, image_url: "https://example.com/fresh.webp" }] });

        await act(() => client.invalidateQueries({ queryKey: ["v2", "slides", EVENT_ID] }));

        await waitFor(() => expect(screen.getByAltText("Verified comparison")).toHaveAttribute("src", "https://example.com/fresh.webp"));

        expect(getV2Slides).toHaveBeenCalledTimes(4);

        view.unmount();

        client.clear();
    });

    it("bounds cold reads, pages the event list only explicitly and reuses warm historical decks", async () => {
        const current = { ...AAPL_Q4_EVENT, fiscal_quarter: 4, fiscal_year: 2027, scheduled_at: "2026-11-20T20:00:00Z" };

        const events = Array.from({ length: 5 }, (_, index) => ({ ...current, event_id: `history-${index}`, fiscal_year: 2026 - index, has_slides: true, scheduled_at: `${2025 - index}-11-20T20:00:00Z` }));

        const slide = { image_url: "https://example.com/revenue.webp", markdown: "# Revenue\nGuidance is discussed in body text.", page: 3, title: "Revenue" };

        const data = { deck: null, event: { cik: "123", conference_date: "2026-11-01", event_id: EVENT_ID, symbol: "TEST" }, slides: [slide] };

        vi.mocked(getV2Events)
            .mockResolvedValueOnce({ data: events.slice(0, 2), has_more: true, meta: {}, next_cursor: "older" })
            .mockResolvedValue({ data: events.slice(2), has_more: false, meta: {}, next_cursor: null });

        vi.mocked(getV2Slides).mockResolvedValue(data);

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        function View({ page = 3 }: { page?: number }) {
            useV2Slides({ eventId: EVENT_ID, include: ["markdown", "timeline"] });

            const [selection, setSelection] = useState<HistoricalSlideSelection | null>(null);

            return (
                <>
                    <HistorySlides currentSlide={{ ...slide, page }} currentSlides={[{ ...slide, page }]} event={current} onSelect={setSelection} />
                    {selection && <VerifiedHistoricalSlides currentSlide={{ ...slide, page }} currentSlides={[{ ...slide, page }]} selection={selection}>{() => <span>Verified comparison</span>}</VerifiedHistoricalSlides>}
                </>
            );
        }

        const mount = (page = 3) => <QueryClientProvider client={client}><View page={page} /></QueryClientProvider>;

        const view = render(mount());

        await waitFor(() => expect(getV2Slides).toHaveBeenCalledTimes(1));

        expect(getV2Events).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        await waitFor(() => expect(screen.getAllByRole("button", { name: /^Compare/ })).toHaveLength(2));

        expect(getV2Events).toHaveBeenCalledTimes(1);

        expect(getV2Slides).toHaveBeenCalledTimes(3);

        fireEvent.click(screen.getByRole("button", { name: "Load more calls" }));

        await waitFor(() => expect(screen.getAllByRole("button", { name: /^Compare/ })).toHaveLength(4));

        expect(getV2Events).toHaveBeenCalledTimes(2);

        expect(getV2Slides).toHaveBeenCalledTimes(5);

        expect(vi.mocked(getV2Slides).mock.calls.slice(1).every(([args]) => args.data.include?.join() === "markdown")).toBe(true);

        fireEvent.click(screen.getAllByRole("button", { name: /^Compare/ })[0]);

        expect(screen.getByText("Verified comparison")).toBeInTheDocument();

        expect(getV2Slides).toHaveBeenCalledTimes(5);

        view.rerender(mount(9));

        expect(getV2Slides).toHaveBeenCalledTimes(5);

        view.unmount();

        const warm = render(mount());

        fireEvent.click(screen.getByRole("button", { name: "Find historical slides" }));

        await waitFor(() => expect(screen.getAllByRole("button", { name: /^Compare/ })).toHaveLength(4));

        expect(getV2Events).toHaveBeenCalledTimes(2);

        expect(getV2Slides).toHaveBeenCalledTimes(5);

        warm.unmount();

        client.clear();
    });

    it("separates markdown/page variants and key context without reusing another account's deck", async () => {
        const data = { deck: null, event: { cik: "123", conference_date: "2026-11-01", event_id: EVENT_ID, symbol: "TEST" }, slides: [] };

        vi.mocked(getV2Slides).mockResolvedValue(data);

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        const cachedWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

        const view = renderHook(({ include, pages }: { include?: Array<"markdown">; pages?: string }) => useV2Slides({ eventId: EVENT_ID, include, pages }), { initialProps: {} as { include?: Array<"markdown">; pages?: string }, wrapper: cachedWrapper });

        await waitFor(() => expect(view.result.current.data).toEqual(data));

        view.rerender({ include: ["markdown"] });

        await waitFor(() => expect(getV2Slides).toHaveBeenCalledTimes(2));

        view.rerender({ include: ["markdown"], pages: "1-3" });

        await waitFor(() => expect(getV2Slides).toHaveBeenCalledTimes(3));

        act(() => useApiKeyStore.setState({ apiKey: "another-test-key", apiKeyUpdatedAt: 999 }));

        await waitFor(() => expect(getV2Slides).toHaveBeenCalledTimes(4));

        expect(getV2Slides).toHaveBeenLastCalledWith({ data: { apiKey: "another-test-key", eventId: EVENT_ID, include: ["markdown"], pages: "1-3" } });

        view.unmount();

        client.clear();
    });

    it("reopens a still-fresh deck after six minutes away without another request", async () => {
        const data = { deck: null, event: { cik: "123", conference_date: "2026-11-01", event_id: EVENT_ID, symbol: "TEST" }, slides: [] };

        vi.mocked(getV2Slides).mockResolvedValue(data);

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        const cachedWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

        const input = { eventId: EVENT_ID };

        const first = renderHook(() => useV2Slides(input), { wrapper: cachedWrapper });

        await waitFor(() => expect(first.result.current.data).toEqual(data));

        vi.useFakeTimers();

        try {
            first.unmount();

            await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

            const reopened = renderHook(() => useV2Slides(input), { wrapper: cachedWrapper });

            expect(reopened.result.current.data).toEqual(data);

            expect(reopened.result.current.isFetching).toBe(false);

            expect(getV2Slides).toHaveBeenCalledTimes(1);

            reopened.unmount();
        }
        finally {
            client.clear();

            vi.useRealTimers();
        }
    });
});
