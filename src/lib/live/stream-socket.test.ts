// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StreamSocketOptions } from "./stream-socket";

import { admissionCloses, LINGER_MS, openStreamSocket, resetStreamConnections } from "./stream-socket";

class FakeSocket {
    static all: Array<FakeSocket> = [];

    static readonly OPEN = 1;

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

        if (type === "close") this.readyState = 3;

        for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    send(data: string) {
        this.sent.push(JSON.parse(data) as Record<string, unknown>);
    }
}

const URL = "wss://api.example.com/v1/stream?api_key=k";

const feed = (channel: string, overrides: Partial<StreamSocketOptions> = {}) => ({
    admission: admissionCloses(`no ${channel}`),
    closeFrame: { channel, type: "unsubscribe" },
    onMessage: vi.fn(),
    onOpen: vi.fn(),
    onRetrying: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
});

beforeEach(() => {
    FakeSocket.all = [];

    vi.stubGlobal("WebSocket", FakeSocket);

    vi.useFakeTimers();
});

afterEach(() => {
    resetStreamConnections();

    vi.useRealTimers();

    vi.unstubAllGlobals();
});

describe("openStreamSocket (one socket per tab)", () => {
    it("two feeds share one socket: both hear every frame, each sends on it", () => {
        const news = feed("news");

        const filings = feed("filings");

        const a = openStreamSocket(URL, news);

        openStreamSocket(URL, filings);

        expect(FakeSocket.all).toHaveLength(1);

        FakeSocket.all[0].emit("open");

        expect(news.onOpen).toHaveBeenCalledWith(false);

        expect(filings.onOpen).toHaveBeenCalledWith(false);

        a.send({ channel: "news", type: "subscribe" });

        FakeSocket.all[0].emit("message", { data: "x" });

        expect(news.onMessage).toHaveBeenCalledWith("x");

        expect(filings.onMessage).toHaveBeenCalledWith("x");

        expect(FakeSocket.all[0].sent).toEqual([{ channel: "news", type: "subscribe" }]);
    });

    it("a feed joining an open socket is told it is open after it holds its handle", async () => {
        openStreamSocket(URL, feed("news"));

        FakeSocket.all[0].emit("open");

        const late = feed("alerts");

        const handle = openStreamSocket(URL, { ...late, onOpen: (reopened) => {
            late.onOpen(reopened);

            handle.send({ channel: "alerts", type: "subscribe" });
        } });

        expect(late.onOpen).not.toHaveBeenCalled();

        await Promise.resolve();

        expect(late.onOpen).toHaveBeenCalledWith(false);

        expect(FakeSocket.all).toHaveLength(1);

        expect(FakeSocket.all[0].sent).toEqual([{ channel: "alerts", type: "subscribe" }]);
    });

    it("a stop or dispose of one feed unsubscribes it and keeps the socket for the other", () => {
        const news = feed("news");

        const a = openStreamSocket(URL, news);

        const b = openStreamSocket(URL, feed("alerts"));

        FakeSocket.all[0].emit("open");

        a.stop({ kind: "plan", message: "no news" });

        expect(news.onStop).toHaveBeenCalledWith({ kind: "plan", message: "no news" });

        expect(FakeSocket.all[0].sent).toEqual([{ channel: "news", type: "unsubscribe" }]);

        vi.advanceTimersByTime(LINGER_MS * 2);

        expect(FakeSocket.all[0].closedWith).toBeNull();

        b.dispose();

        expect(FakeSocket.all[0].closedWith).toBeNull();

        vi.advanceTimersByTime(LINGER_MS);

        expect(FakeSocket.all[0].closedWith).toBe(1000);
    });

    it("a page change within the linger reuses the socket (no second connection to count against the limit)", async () => {
        const first = openStreamSocket(URL, feed("news"));

        FakeSocket.all[0].emit("open");

        first.dispose();

        vi.advanceTimersByTime(LINGER_MS - 1);

        const next = feed("filings");

        openStreamSocket(URL, next);

        await Promise.resolve();

        vi.advanceTimersByTime(LINGER_MS * 2);

        expect(FakeSocket.all).toHaveLength(1);

        expect(FakeSocket.all[0].closedWith).toBeNull();

        expect(next.onOpen).toHaveBeenCalledWith(false);
    });

    it("after the linger a new feed opens a new socket", () => {
        openStreamSocket(URL, feed("news")).dispose();

        vi.advanceTimersByTime(LINGER_MS);

        openStreamSocket(URL, feed("news"));

        expect(FakeSocket.all).toHaveLength(2);
    });

    it("an admission close (4029) stops every feed with its own words, then the next feed opens anew", () => {
        const news = feed("news");

        const alerts = feed("alerts");

        openStreamSocket(URL, news);

        openStreamSocket(URL, alerts);

        FakeSocket.all[0].emit("close", { code: 4029 });

        expect(news.onStop).toHaveBeenCalledWith(expect.objectContaining({ kind: "limit" }));

        expect(alerts.onStop).toHaveBeenCalledWith(expect.objectContaining({ kind: "limit" }));

        vi.advanceTimersByTime(60_000);

        expect(FakeSocket.all).toHaveLength(1);

        openStreamSocket(URL, feed("news"));

        expect(FakeSocket.all).toHaveLength(2);
    });

    it("a dropped socket reconnects once for all feeds; each hears `reopened`", () => {
        const news = feed("news");

        const filings = feed("filings");

        openStreamSocket(URL, news);

        openStreamSocket(URL, filings);

        FakeSocket.all[0].emit("open");

        FakeSocket.all[0].emit("close", { code: 1006 });

        expect(news.onRetrying).toHaveBeenCalledTimes(1);

        expect(filings.onRetrying).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1_000);

        expect(FakeSocket.all).toHaveLength(2);

        FakeSocket.all[1].emit("open");

        expect(news.onOpen).toHaveBeenLastCalledWith(true);

        expect(filings.onOpen).toHaveBeenLastCalledWith(true);
    });

    it("a feed's re-subscribe timer is its own and dies with it", () => {
        const resubscribe = vi.fn();

        const a = openStreamSocket(URL, feed("news"));

        openStreamSocket(URL, feed("alerts"));

        FakeSocket.all[0].emit("open");

        a.resubscribeLater(resubscribe);

        a.dispose();

        vi.advanceTimersByTime(20_000);

        expect(resubscribe).not.toHaveBeenCalled();
    });
});
