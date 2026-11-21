// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIVE_FILING } from "@/lib/sec/filing-detail-fixtures";

import { useLiveFilings } from "./use-live-filings";

/** A socket the test drives: `open`, `message`, `close` by hand. */
class FakeSocket {
    static last: FakeSocket | null = null;

    static readonly OPEN = 1;

    listeners = new Map<string, Array<(event: unknown) => void>>();

    readyState = 0;

    constructor(public url: string) {
        FakeSocket.last = this;
    }

    addEventListener(type: string, listener: (event: unknown) => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }

    close() {
        this.readyState = 3;
    }

    emit(type: string, event: unknown = {}) {
        for (const listener of this.listeners.get(type) ?? []) listener(event);
    }
}

beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const input = (enabled: boolean, onStop = vi.fn()) => ({ apiKey: "k", apiKeyUpdatedAt: 1, baseUrl: "https://api.example.com", enabled, onStop });

describe("useLiveFilings", () => {
    it("collects new_filing frames once open; switched off and on again it starts empty and connecting", () => {
        const { rerender, result } = renderHook(props => useLiveFilings(props), { initialProps: input(true) });

        expect(result.current.mode).toBe("connecting");

        act(() => FakeSocket.last?.emit("open"));

        expect(result.current.mode).toBe("live");

        act(() => FakeSocket.last?.emit("message", { data: JSON.stringify({ filing: LIVE_FILING, type: "new_filing" }) }));

        expect(result.current.filings.map(entry => entry.filing.accession_number)).toEqual([LIVE_FILING.accession_number]);

        rerender(input(false));

        rerender(input(true));

        expect(result.current.mode).toBe("connecting");

        expect(result.current.filings).toEqual([]);
    });

    it("close 4003 (plan) stops without a reconnect", () => {
        const onStop = vi.fn();

        renderHook(props => useLiveFilings(props), { initialProps: input(true, onStop) });

        const socket = FakeSocket.last;

        act(() => socket?.emit("close", { code: 4003 }));

        expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ kind: "plan" }));

        expect(FakeSocket.last).toBe(socket);
    });

    it("a dropped socket reconnects after 1 s, sends nothing, and the reopened socket calls onReconnected", () => {
        vi.useFakeTimers();

        try {
            const onReconnected = vi.fn();

            const { result } = renderHook(props => useLiveFilings(props), { initialProps: { ...input(true), onReconnected } });

            const first = FakeSocket.last;

            act(() => first?.emit("open"));

            expect(onReconnected).not.toHaveBeenCalled();

            act(() => first?.emit("close", { code: 1006 }));

            expect(result.current.mode).toBe("retrying");

            act(() => vi.advanceTimersByTime(1_000));

            expect(FakeSocket.last).not.toBe(first);

            act(() => FakeSocket.last?.emit("open"));

            expect(onReconnected).toHaveBeenCalledTimes(1);

            expect(result.current.mode).toBe("live");
        }
        finally {
            vi.useRealTimers();
        }
    });
});
