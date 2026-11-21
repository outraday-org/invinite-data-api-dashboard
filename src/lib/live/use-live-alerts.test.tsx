// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EVENT_TEST, fixtureEvent } from "@/lib/alerts/alerts-fixtures";

import { useLiveAlerts } from "./use-live-alerts";
import { ALERTS_CHANNEL } from "./ws-frames";

/** A socket the test drives: `open`, `message`, `close` by hand; `sent` keeps the client frames. */
class FakeSocket {
    static all: Array<FakeSocket> = [];

    static readonly OPEN = 1;

    static get last() {
        return FakeSocket.all.at(-1)!;
    }

    listeners = new Map<string, Array<(event: unknown) => void>>();

    readyState = 0;

    sent: Array<Record<string, unknown>> = [];

    constructor(public url: string) {
        FakeSocket.all.push(this);
    }

    addEventListener(type: string, listener: (event: unknown) => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }

    close() {
        this.readyState = 3;
    }

    emit(type: string, event: unknown = {}) {
        if (type === "open") this.readyState = 1;

        for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    frame(frame: object) {
        this.emit("message", { data: JSON.stringify({ channel: ALERTS_CHANNEL, ...frame }) });
    }

    send(text: string) {
        this.sent.push(JSON.parse(text) as Record<string, unknown>);
    }
}

beforeEach(() => {
    FakeSocket.all = [];

    vi.stubGlobal("WebSocket", FakeSocket);

    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();

    vi.unstubAllGlobals();
});

const input = (patch: Partial<Parameters<typeof useLiveAlerts>[0]> = {}) => ({
    after: "evt_02",
    apiKey: "k",
    apiKeyUpdatedAt: 1,
    baseUrl: "https://api.example.com",
    enabled: true,
    filters: { externalUserId: "u1" },
    onStop: vi.fn(),
    ...patch,
});

describe("useLiveAlerts", () => {
    it("subscribes from the newest loaded event (after) with the filters; alert_event frames come first, once", () => {
        const { result } = renderHook(props => useLiveAlerts(props), { initialProps: input() });

        expect(FakeSocket.last.url).toBe("wss://api.example.com/v1/stream?api_key=k");

        act(() => FakeSocket.last.emit("open"));

        expect(FakeSocket.last.sent).toEqual([{ after: "evt_02", channel: "alerts", external_user_id: "u1", type: "subscribe" }]);

        act(() => FakeSocket.last.frame({ filters: { alert_ids: [], external_user_id: "u1", types: [] }, type: "subscribed" }));

        expect(result.current.mode).toBe("live");

        const newer = fixtureEvent("evt_04", { occurred_at: "2026-11-21T14:00:00Z" });

        act(() => {
            FakeSocket.last.frame({ event: EVENT_TEST, type: "alert_event" });

            FakeSocket.last.frame({ event: newer, type: "alert_event" });

            FakeSocket.last.frame({ event: newer, type: "alert_event" });
        });

        expect(result.current.events.map(event => event.id)).toEqual(["evt_04", "evt_03"]);
    });

    it("replay_truncated is kept for the page's note; unknown frames are counted; bad_message is a note, not a stop", () => {
        const onStop = vi.fn();

        const { result } = renderHook(props => useLiveAlerts(props), { initialProps: input({ onStop }) });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame({ last_event_id: "evt_77", type: "replay_truncated" });

            FakeSocket.last.frame({ type: "alert_digest" });

            FakeSocket.last.frame({ code: "bad_message", message: "after: no event evt_02 on this account; live delivery continues", type: "error" });
        });

        expect(result.current.truncatedAt).toBe("evt_77");

        expect(result.current.ignored).toBe(1);

        expect(result.current.note).toContain("live delivery continues");

        expect(onStop).not.toHaveBeenCalled();
    });

    it("a dropped socket reconnects and replays from the newest live event", () => {
        renderHook(props => useLiveAlerts(props), { initialProps: input() });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame({ event: EVENT_TEST, type: "alert_event" });

            FakeSocket.last.emit("close", { code: 1006 });
        });

        act(() => vi.advanceTimersByTime(1000));

        expect(FakeSocket.all).toHaveLength(2);

        act(() => FakeSocket.last.emit("open"));

        expect(FakeSocket.last.sent[0]).toMatchObject({ after: "evt_03", type: "subscribe" });
    });

    it("close 4003 (the stream's plan) and channel_unavailable stop without a reconnect", () => {
        const onStop = vi.fn();

        renderHook(props => useLiveAlerts(props), { initialProps: input({ onStop }) });

        act(() => FakeSocket.last.emit("close", { code: 4003 }));

        expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ kind: "plan" }));

        act(() => vi.advanceTimersByTime(60_000));

        expect(FakeSocket.all).toHaveLength(1);

        const second = vi.fn();

        renderHook(props => useLiveAlerts(props), { initialProps: input({ onStop: second }) });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame({ code: "channel_unavailable", message: "Alerts are not available yet", type: "error" });
        });

        expect(second).toHaveBeenCalledWith(expect.objectContaining({ kind: "unavailable" }));
    });

    it("switched off and on with the same filters, the new socket reads connecting (not the old live)", () => {
        const { rerender, result } = renderHook(props => useLiveAlerts(props), { initialProps: input() });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame({ filters: { alert_ids: [], external_user_id: "u1", types: [] }, type: "subscribed" });
        });

        expect(result.current.mode).toBe("live");

        rerender(input({ enabled: false }));

        rerender(input());

        expect(result.current.mode).toBe("connecting");
    });

    it("unavailable re-subscribes after 10 s on the same socket", () => {
        const { result } = renderHook(props => useLiveAlerts(props), { initialProps: input() });

        act(() => {
            FakeSocket.last.emit("open");

            FakeSocket.last.frame({ code: "unavailable", message: "The request failed on the server", type: "error" });
        });

        expect(result.current.mode).toBe("retrying");

        act(() => vi.advanceTimersByTime(10_000));

        expect(FakeSocket.last.sent.filter(frame => frame.type === "subscribe")).toHaveLength(2);
    });
});
