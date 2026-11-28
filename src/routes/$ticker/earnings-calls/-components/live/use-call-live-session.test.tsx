// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useV2LiveEvents } from "@/lib/api/queries";
import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { useCallLiveSession } from "./use-call-live-session";

const mocks = vi.hoisted(() => ({
    result: {
        data: { data: [] as Array<{ event_id: string }>, has_more: false, next_cursor: null as null | string },
        dataUpdatedAt: 1_000_000,
        error: null as Error | null,
        fetchStatus: "idle",
        isPlaceholderData: false,
        isSuccess: true,
    },
}));

vi.mock("@/lib/api/queries", () => ({ useV2LiveEvents: vi.fn(() => mocks.result) }));

const event = { ...CALENDAR_EVENT, has_audio: false, has_transcript: false };

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    mocks.result = {
        data: { data: [], has_more: false, next_cursor: null }, dataUpdatedAt: Date.now(), error: null,
        fetchStatus: "idle", isPlaceholderData: false, isSuccess: true,
    };
    useApiKeyStore.setState({ apiKey: "key", apiKeyUpdatedAt: 1, hasHydrated: true });
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe("public call live session", () => {
    it("never turns scheduled/started or old replay metadata into live membership", () => {
        const oldReplay = { ...event, capture_status: "capturing", capture_mode: "replay", started_at: event.scheduled_at };
        const { result } = renderHook(() => useCallLiveSession(oldReplay));
        expect(result.current.sawLive).toBe(false);
        expect(result.current.isLive).toBe(false);
        expect(result.current.ended).toBe(false);
        expect(useV2LiveEvents).toHaveBeenLastCalledWith(true, event.cik);
    });

    it("admits positive partial membership but does not end on a truncated, failed, stale or cached negative page", () => {
        mocks.result.data = { data: [{ event_id: event.event_id }], has_more: true, next_cursor: "more" };
        const { rerender, result } = renderHook(() => useCallLiveSession(event));
        expect(result.current.sawLive).toBe(true);
        expect(result.current.isLive).toBe(true);
        act(() => vi.advanceTimersByTime(1_000));
        mocks.result.data = { data: [], has_more: true, next_cursor: "more" };
        mocks.result.dataUpdatedAt = Date.now();
        rerender();
        expect(result.current.ended).toBe(false);
        mocks.result.error = new Error("offline with cached data");
        mocks.result.data = { data: [], has_more: false, next_cursor: null };
        rerender();
        expect(result.current.ended).toBe(false);
        act(() => vi.advanceTimersByTime(31_000));
        mocks.result.error = null;
        rerender();
        expect(result.current.ended).toBe(false);
        expect(result.current.isLive).toBe(false);
        mocks.result.dataUpdatedAt = 999_999;
        rerender();
        expect(result.current.ended).toBe(false);
        mocks.result.dataUpdatedAt = Date.now();
        rerender();
        expect(result.current.ended).toBe(true);
    });

    it("keeps an active valid transport through a failed list refresh and accepts explicit media completion", () => {
        mocks.result.data.data = [{ event_id: event.event_id }];
        const refresh = vi.fn();
        const { rerender, result } = renderHook(() => useCallLiveSession(event, { onAvailabilityChange: refresh }));
        act(() => result.current.reportActive?.(true));
        mocks.result.error = new Error("offline");
        act(() => vi.advanceTimersByTime(31_000));
        rerender();
        expect(result.current.isLive).toBe(true);
        expect(result.current.ended).toBe(false);
        act(() => result.current.reportEnded?.());
        expect(result.current.isLive).toBe(false);
        expect(result.current.ended).toBe(true);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("resets observed sessions on event and authorization changes", () => {
        mocks.result.data.data = [{ event_id: event.event_id }];
        const { rerender, result } = renderHook(({ current }) => useCallLiveSession(current), { initialProps: { current: event } });
        expect(result.current.sawLive).toBe(true);
        rerender({ current: { ...event, event_id: "another-event", cik: "0000000010" } });
        expect(result.current.sawLive).toBe(false);
        expect(result.current.ended).toBe(false);
        expect(useV2LiveEvents).toHaveBeenLastCalledWith(true, "0000000010");
        mocks.result.data.data = [{ event_id: "another-event" }];
        act(() => vi.advanceTimersByTime(1_000));
        mocks.result.dataUpdatedAt = Date.now();
        rerender({ current: { ...event, event_id: "another-event", cik: "0000000010" } });
        expect(result.current.sawLive).toBe(true);
        mocks.result.data.data = [];
        act(() => useApiKeyStore.setState({ apiKey: null, apiKeyUpdatedAt: 2 }));
        expect(result.current.sawLive).toBe(false);
        expect(result.current.ended).toBe(false);
    });
});
