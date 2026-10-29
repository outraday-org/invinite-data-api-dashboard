import { describe, expect, it } from "vitest";

import { newsroomItem } from "@/lib/news/news-fixtures";

import {
    EARNINGS_FRAME_TYPES,
    liveWsUrl,
    NEWS_LIVE_CHANNEL,
    newsSubscribeFrame,
    parseNewsFrame,
    parseServerFrame,
    subscribeFrame,
    toAssignments,
    toLiveSegment,
    toPriceTick,
    toSpeakerNames,
    unsubscribeFrame,
} from "./ws-frames";

const SUB = { event_id: "6f1d2c3b-0000-4000-8000-000000000001", subscription_id: "9a8b7c6d-0000-4000-8000-000000000002" };

const ASSIGNMENT = {
    confidence: 0.9,
    firm: null,
    from_seq: 3,
    name: "Jane Doe",
    role: "executive",
    source: "self_introduction",
    speaker_label: "spk0",
    title: "CFO",
    to_seq: null,
};

// One valid example of every server frame of the earnings channel.
const FRAMES: Record<string, Record<string, unknown>> = {
    call_ended: { ...SUB, at: "2026-10-09T21:55:00.000Z", live_transcript_available: true, type: "call_ended" },
    call_started: { ...SUB, at: "2026-10-09T21:00:00.000Z", type: "call_started" },
    error: { code: "forbidden_tier", message: "Live earnings-call transcripts require the PRO plan", type: "error" },
    gap: { ...SUB, after_seq: 41, next_seq: 1042, type: "gap" },
    price_tick: {
        ...SUB,
        at: "2026-10-09T21:05:12.000Z",
        call_ms: 312_000,
        cik: "0000320193",
        conference_date: "2026-10-09T21:00:00.000Z",
        cumulative_volume: null,
        day_return_bps: -40.2,
        high: 230.5,
        low: 230.1,
        open: 230.2,
        prev_close: 231.4,
        price: 230.47,
        reference_price: 230,
        return_bps: 20.43,
        source: "stream",
        symbol: "AAPL",
        type: "price_tick",
        volume: 1200,
    },
    rescheduled: { ...SUB, at: "2026-10-09T20:00:00.000Z", new_conference_date: "2026-10-16T21:00:00.000Z", type: "rescheduled" },
    speaker_names: { ...SUB, assignments: [ASSIGNMENT], revision: 1760043600000, type: "speaker_names" },
    subscribed: {
        ...SUB,
        cik: "0000320193",
        conference_date: "2026-10-09T21:00:00.000Z",
        current_seq: null,
        state: "capturing",
        symbol: "AAPL",
        type: "subscribed",
    },
    transcript_provisional: { ...SUB, at: "2026-10-09T22:05:00.000Z", type: "transcript_provisional", version: 1, word_count: 9120 },
    transcript_ready: { ...SUB, at: "2026-10-09T22:30:00.000Z", type: "transcript_ready" },
    transcript_segment: {
        ...SUB,
        end_ms: 4200,
        is_final: true,
        seq: 7,
        speaker_label: "spk0",
        start_ms: 1500,
        text: "Good afternoon, everyone.",
        type: "transcript_segment",
    },
    unsubscribed: { reason: "transcript_ready", subscription_id: SUB.subscription_id, type: "unsubscribed" },
};

describe("parseServerFrame", () => {
    it("covers every frame type of the channel", () => {
        expect([...EARNINGS_FRAME_TYPES].sort()).toStrictEqual(Object.keys(FRAMES).sort());
    });

    it.each(Object.entries(FRAMES))("parses a %s frame", (type, frame) => {
        const parsed = parseServerFrame(JSON.stringify(frame));

        expect(parsed.kind).toBe("frame");

        expect(parsed.kind === "frame" && parsed.frame.type).toBe(type);
    });

    it("parses an error frame tied to a subscription and every error code", () => {
        for (const code of ["bad_message", "not_live", "not_found", "subscription_limit", "attach_failed", "resume_unavailable", "unavailable"]) {
            const parsed = parseServerFrame(JSON.stringify({ code, message: "m", subscription_id: SUB.subscription_id, type: "error" }));

            expect(parsed.kind).toBe("frame");
        }
    });

    it("reads frames of other channels and pings as other", () => {
        expect(parseServerFrame(JSON.stringify({ filing: {}, type: "new_filing" })).kind).toBe("other");

        expect(parseServerFrame(JSON.stringify({ type: "ping" })).kind).toBe("other");
    });

    it("rejects malformed frames", () => {
        expect(parseServerFrame("not json").kind).toBe("malformed");

        expect(parseServerFrame(new ArrayBuffer(2)).kind).toBe("malformed");

        expect(parseServerFrame(JSON.stringify(null)).kind).toBe("malformed");

        expect(parseServerFrame(JSON.stringify({ seq: 1 })).kind).toBe("malformed");

        // An earnings frame type with a missing / mistyped field.
        expect(parseServerFrame(JSON.stringify({ ...FRAMES.transcript_segment, seq: "7" })).kind).toBe("malformed");

        expect(parseServerFrame(JSON.stringify({ ...FRAMES.gap, next_seq: undefined })).kind).toBe("malformed");

        // An error code or unsubscribe reason the API does not send.
        expect(parseServerFrame(JSON.stringify({ ...FRAMES.error, code: "teapot" })).kind).toBe("malformed");

        expect(parseServerFrame(JSON.stringify({ ...FRAMES.unsubscribed, reason: "bored" })).kind).toBe("malformed");

        expect(parseServerFrame(JSON.stringify({ ...FRAMES.subscribed, state: "live" })).kind).toBe("malformed");

        // A tick from a source the API does not send, or without a price.
        expect(parseServerFrame(JSON.stringify({ ...FRAMES.price_tick, source: "feed" })).kind).toBe("malformed");

        expect(parseServerFrame(JSON.stringify({ ...FRAMES.price_tick, price: null })).kind).toBe("malformed");
    });
});

describe("frame conversions", () => {
    it("turns a segment frame into the reducer's segment", () => {
        const parsed = parseServerFrame(JSON.stringify(FRAMES.transcript_segment));

        if (parsed.kind !== "frame" || parsed.frame.type !== "transcript_segment") throw new Error("not a segment");

        expect(toLiveSegment(parsed.frame)).toStrictEqual({
            endMs: 4200,
            seq: 7,
            speakerLabel: "spk0",
            startMs: 1500,
            text: "Good afternoon, everyone.",
        });
    });

    it("turns a speaker_names frame into assignments and a snapshot", () => {
        const parsed = parseServerFrame(JSON.stringify(FRAMES.speaker_names));

        if (parsed.kind !== "frame" || parsed.frame.type !== "speaker_names") throw new Error("not names");

        const expected = {
            confidence: 0.9,
            firm: null,
            fromSeq: 3,
            name: "Jane Doe",
            role: "executive",
            source: "self_introduction",
            speakerLabel: "spk0",
            title: "CFO",
            toSeq: null,
        };

        expect(toAssignments(parsed.frame)).toStrictEqual([expected]);

        expect(toSpeakerNames(parsed.frame)).toStrictEqual({ assignments: [expected], revision: 1760043600000 });
    });
});

describe("price ticks", () => {
    it("turns a price_tick frame into the reducer's tick", () => {
        const parsed = parseServerFrame(JSON.stringify(FRAMES.price_tick));

        if (parsed.kind !== "frame" || parsed.frame.type !== "price_tick") throw new Error("not a tick");

        expect(toPriceTick(parsed.frame)).toStrictEqual({
            at: "2026-10-09T21:05:12.000Z",
            callMs: 312_000,
            cumulativeVolume: null,
            dayReturnBps: -40.2,
            high: 230.5,
            low: 230.1,
            open: 230.2,
            prevClose: 231.4,
            price: 230.47,
            referencePrice: 230,
            returnBps: 20.43,
            source: "stream",
            volume: 1200,
        });
    });

    it("accepts a snapshot tick before the call clock is known", () => {
        const parsed = parseServerFrame(JSON.stringify({ ...FRAMES.price_tick, call_ms: null, return_bps: null, source: "snapshot" }));

        expect(parsed.kind).toBe("frame");
    });
});

describe("client frames and the socket URL", () => {
    it("builds the subscribe frame with partials, prices off by default and a since_seq ≥ -1", () => {
        expect(subscribeFrame("e1", 12)).toStrictEqual({
            channel: "earnings-calls.live",
            event_id: "e1",
            partials: true,
            prices: false,
            since_seq: 12,
            type: "subscribe",
        });

        expect(subscribeFrame("e1", -5).since_seq).toBe(-1);

        expect(subscribeFrame("e1", -1, true).prices).toBe(true);
    });

    it("builds the unsubscribe frame", () => {
        expect(unsubscribeFrame("s1")).toStrictEqual({ subscription_id: "s1", type: "unsubscribe" });
    });

    it("maps the API base URL to the WebSocket URL", () => {
        expect(liveWsUrl("https://api.data.invinite.com", "k 1")).toBe("wss://api.data.invinite.com/v1/ws?api_key=k+1");

        expect(liveWsUrl("http://localhost:3000/", "abc")).toBe("ws://localhost:3000/v1/ws?api_key=abc");
    });
});

describe("news.live frames (mirrors IDA types/newsMessages.ts)", () => {
    const raw = (frame: object) => JSON.stringify(frame);

    it("parses every news server frame by its channel", () => {
        const frames = [
            { channel: NEWS_LIVE_CHANNEL, filters: { ciks: [], earnings_only: false, kinds: [], sources: [], tickers: ["NVDA"] }, type: "subscribed" },
            { channel: NEWS_LIVE_CHANNEL, item: newsroomItem(), type: "news_item" },
            { channel: NEWS_LIVE_CHANNEL, type: "unsubscribed" },
            { channel: NEWS_LIVE_CHANNEL, code: "forbidden_tier", message: "news.live needs the STANDARD plan", type: "error" },
            { channel: NEWS_LIVE_CHANNEL, code: "channel_unavailable", message: "off", type: "error" },
        ];

        for (const frame of frames) expect(parseNewsFrame(raw(frame)).kind, frame.type).toBe("frame");
    });

    it("keeps the whole pushed item (a GET /v1/news row)", () => {
        const parsed = parseNewsFrame(raw({ channel: NEWS_LIVE_CHANNEL, item: newsroomItem(), type: "news_item" }));

        expect(parsed.kind === "frame" && parsed.frame.type === "news_item" && parsed.frame.item).toMatchObject({
            attribution: { publisher: "NVIDIA Corporation" },
            publications: [{ publication_type: "press_release" }],
        });
    });

    it("leaves earnings frames, filings and pings alone; the earnings parser treats news frames as foreign", () => {
        expect(parseNewsFrame(raw({ code: "forbidden_tier", message: "PRO", type: "error" })).kind).toBe("other");

        expect(parseNewsFrame(raw({ type: "new_filing" })).kind).toBe("other");

        expect(parseNewsFrame("not json").kind).toBe("other");

        expect(parseNewsFrame(raw({ channel: NEWS_LIVE_CHANNEL, code: "nope", message: "x", type: "error" })).kind).toBe("malformed");

        expect(parseServerFrame(raw({ channel: NEWS_LIVE_CHANNEL, item: newsroomItem(), type: "news_item" })).kind).toBe("other");
    });

    it("builds the subscribe frame without empty filters (no filter = the whole market)", () => {
        expect(newsSubscribeFrame()).toStrictEqual({ channel: NEWS_LIVE_CHANNEL, type: "subscribe" });

        expect(newsSubscribeFrame({ earningsOnly: true, kinds: ["guidance"], sources: [], tickers: ["NVDA"] })).toStrictEqual({
            channel: NEWS_LIVE_CHANNEL,
            earnings_only: true,
            kinds: ["guidance"],
            tickers: ["NVDA"],
            type: "subscribe",
        });
    });
});
