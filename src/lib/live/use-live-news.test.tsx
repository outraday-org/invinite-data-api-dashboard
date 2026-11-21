// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { newsroomItem } from "@/lib/news/news-fixtures";

import { useLiveNews } from "./use-live-news";
import { NEWS_LIVE_CHANNEL } from "./ws-frames";

/** A socket the test drives: `open`, `message`, `close` by hand; `sent` keeps the client frames. */
class FakeSocket {
    static all: Array<FakeSocket> = [];

    static readonly OPEN = 1;

    static get last() {
        return FakeSocket.all.at(-1)!;
    }

    closedWith: null | number = null;

    listeners = new Map<string, Array<(event: unknown) => void>>();

    readyState = 0;

    sent: Array<Record<string, unknown>> = [];

    constructor(public url: string) {
        FakeSocket.all.push(this);
    }

    addEventListener(type: string, listener: (event: unknown) => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }

    close(code: number) {
        this.closedWith = code;

        this.readyState = 3;
    }

    emit(type: string, event: unknown = {}) {
        if (type === "open") this.readyState = 1;

        for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    frame(frame: object) {
        this.emit("message", { data: JSON.stringify({ channel: NEWS_LIVE_CHANNEL, ...frame }) });
    }

    send(text: string) {
        this.sent.push(JSON.parse(text) as Record<string, unknown>);
    }
}

const SUBSCRIBED = { filters: { ciks: [], earnings_only: false, kinds: [], sources: [], tickers: ["AAPL"] }, type: "subscribed" };

beforeEach(() => {
    FakeSocket.all = [];

    vi.useFakeTimers();

    vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
    vi.useRealTimers();

    vi.unstubAllGlobals();
});

type Input = Parameters<typeof useLiveNews>[0];

const input = (overrides: Partial<Input> = {}): Input => ({
    apiKey: "k",
    apiKeyUpdatedAt: 1,
    baseUrl: "https://api.example.com",
    enabled: true,
    filters: { tickers: ["AAPL"] },
    onStop: vi.fn(),
    ...overrides,
});

describe("useLiveNews", () => {
    it("subscribes on open, reads live once subscribed and keeps news_item frames newest first, once each", () => {
        const { result } = renderHook(props => useLiveNews(props), { initialProps: input() });

        act(() => FakeSocket.last.emit("open"));

        expect(FakeSocket.last.sent).toEqual([{ channel: NEWS_LIVE_CHANNEL, tickers: ["AAPL"], type: "subscribe" }]);

        expect(result.current.mode).toBe("connecting");

        act(() => FakeSocket.last.frame(SUBSCRIBED));

        expect(result.current.mode).toBe("live");

        act(() => {
            FakeSocket.last.frame({ item: newsroomItem({ id: "n1" }), type: "news_item" });

            FakeSocket.last.frame({ item: newsroomItem({ id: "n2" }), type: "news_item" });

            FakeSocket.last.frame({ item: newsroomItem({ id: "n1" }), type: "news_item" });
        });

        expect(result.current.items.map(item => item.id)).toEqual(["n2", "n1"]);
    });

    it("a dropped socket reconnects after 1 s and the next subscribed calls onResubscribed", () => {
        const onResubscribed = vi.fn();

        const { result } = renderHook(props => useLiveNews(props), { initialProps: input({ onResubscribed }) });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame(SUBSCRIBED);

            FakeSocket.last.emit("close", { code: 1006 });
        });

        expect(result.current.mode).toBe("retrying");

        act(() => vi.advanceTimersByTime(999));

        expect(FakeSocket.all).toHaveLength(1);

        act(() => vi.advanceTimersByTime(1));

        expect(FakeSocket.all).toHaveLength(2);

        expect(onResubscribed).not.toHaveBeenCalled();

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame(SUBSCRIBED);
        });

        expect(onResubscribed).toHaveBeenCalledTimes(1);

        expect(result.current.mode).toBe("live");
    });

    it("close 4029 and forbidden_tier stop without a reconnect; the stop unsubscribes and closes", () => {
        const onStop = vi.fn();

        renderHook(props => useLiveNews(props), { initialProps: input({ onStop }) });

        act(() => FakeSocket.last.emit("close", { code: 4029 }));

        expect(onStop).toHaveBeenCalledWith({ kind: "limit", message: "Live feed unavailable: connection limit" });

        act(() => vi.advanceTimersByTime(60_000));

        expect(FakeSocket.all).toHaveLength(1);

        const second = vi.fn();

        renderHook(props => useLiveNews(props), { initialProps: input({ onStop: second }) });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame({ code: "forbidden_tier", message: "STANDARD", type: "error" });
        });

        expect(second).toHaveBeenCalledWith(expect.objectContaining({ kind: "plan" }));

        expect(FakeSocket.last.sent.at(-1)).toEqual({ channel: NEWS_LIVE_CHANNEL, type: "unsubscribe" });

        expect(FakeSocket.last.closedWith).toBe(1000);
    });

    it("unavailable re-subscribes after 10 s on the same socket", () => {
        const { result } = renderHook(props => useLiveNews(props), { initialProps: input() });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame({ code: "unavailable", message: "later", type: "error" });
        });

        expect(result.current.mode).toBe("retrying");

        act(() => vi.advanceTimersByTime(10_000));

        expect(FakeSocket.all).toHaveLength(1);

        expect(FakeSocket.last.sent.filter(frame => frame.type === "subscribe")).toHaveLength(2);
    });

    it("gives up after 10 reconnects with an error stop", () => {
        const onStop = vi.fn();

        renderHook(props => useLiveNews(props), { initialProps: input({ onStop }) });

        for (let attempt = 0; attempt < 10; attempt += 1) {
            act(() => FakeSocket.last.emit("close", { code: 1006 }));

            act(() => vi.advanceTimersByTime(30_000));
        }

        expect(FakeSocket.all).toHaveLength(11);

        expect(onStop).not.toHaveBeenCalled();

        act(() => FakeSocket.last.emit("close", { code: 1006 }));

        expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ kind: "error" }));

        act(() => vi.advanceTimersByTime(60_000));

        expect(FakeSocket.all).toHaveLength(11);
    });

    it("unmount unsubscribes and closes; a disabled hook opens nothing", () => {
        const { unmount } = renderHook(props => useLiveNews(props), { initialProps: input() });

        act(() => FakeSocket.last.emit("open"));

        const socket = FakeSocket.last;

        unmount();

        expect(socket.sent.at(-1)).toEqual({ channel: NEWS_LIVE_CHANNEL, type: "unsubscribe" });

        expect(socket.closedWith).toBe(1000);

        renderHook(props => useLiveNews(props), { initialProps: input({ enabled: false }) });

        expect(FakeSocket.all).toHaveLength(1);
    });
});
