// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CALENDAR_EVENT } from "./calendar-fixtures";
import { availabilityInterval, AVAILABILITY_WINDOW_MS, useEventAvailability } from "./event-availability";
import { liveMembership } from "./live-membership";

const event = { ...CALENDAR_EVENT, has_transcript: false };
const options = { error: null, nowMs: 1_000_000, untilMs: 1_600_000, visible: true };

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(options.nowMs);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

describe("bounded event availability", () => {
    it("polls a visible missing transcript at 30 seconds, stopping on publication/deadline/hidden/denied", () => {
        expect(availabilityInterval(event, options)).toBe(30_000);
        expect(availabilityInterval({ ...event, has_transcript: true }, options)).toBe(false);
        expect(availabilityInterval(event, { ...options, nowMs: options.untilMs })).toBe(false);
        expect(availabilityInterval(event, { ...options, visible: false })).toBe(false);
        for (const status of [401, 403, 404]) expect(availabilityInterval(event, { ...options, error: { status } })).toBe(false);
    });

    it.each(["cancelled", "postponed", "no_call", "not_expected", "not_covered"])("does not poll terminal %s call outcomes", status => {
        const calendar = { ...event.calendar!, call: { ...event.calendar!.call, status } };
        expect(availabilityInterval({ ...event, calendar }, options)).toBe(false);
    });

    it("keeps a fixed ten-minute budget across rerenders/visibility and starts a new budget only explicitly", () => {
        const { rerender, result, unmount } = renderHook(({ id }) => useEventAvailability(id), { initialProps: { id: "a" } });
        const deadline = result.current.untilMs;
        act(() => vi.advanceTimersByTime(30_000));
        rerender({ id: "a" });
        expect(result.current.untilMs).toBe(deadline);
        act(() => {
            Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(result.current.visible).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
        act(() => vi.advanceTimersByTime(AVAILABILITY_WINDOW_MS));
        act(() => {
            Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
            document.dispatchEvent(new Event("visibilitychange"));
            vi.advanceTimersByTime(0);
        });
        act(() => vi.advanceTimersByTime(0));
        expect(result.current.active).toBe(false);
        act(() => result.current.restart());
        expect(result.current.active).toBe(true);
        expect(result.current.untilMs).toBeGreaterThan(deadline);
        rerender({ id: "b" });
        expect(result.current.active).toBe(true);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("authoritative membership", () => {
    const page = { data: [CALENDAR_EVENT], has_more: false, meta: {}, next_cursor: null };
    const observation = { data: page, error: null, fetching: false, fresh: true, success: true };
    it("accepts a positive partial page, but only a complete successful fresh negative proves absence", () => {
        expect(liveMembership(CALENDAR_EVENT.event_id, { ...observation, data: { ...page, has_more: true } }).present).toBe(true);
        expect(liveMembership("absent", observation)).toEqual({ complete: true, present: false, verified: true });
        expect(liveMembership("absent", { ...observation, data: { ...page, has_more: true } }).complete).toBe(false);
        expect(liveMembership("absent", { ...observation, fetching: true }).complete).toBe(false);
        for (const override of [{ fresh: false }, { error: new Error("offline") }, { success: false }]) {
            expect(liveMembership("absent", { ...observation, ...override }).complete).toBe(false);
        }
    });
});
