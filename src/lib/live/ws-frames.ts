import { z } from "zod";

import type { LivePriceTick } from "./live-prices-reducer";
import type { LiveSegment, LiveSpeakerAssignment, LiveSpeakerNames } from "./live-transcript-reducer";

/**
 * The `/v1/ws` frames of the data API's live earnings-call channel, as zod schemas. Names and
 * shapes mirror IDA `src/routes/websocket/types/earningsMessages.ts` — change both or neither.
 *
 * Client → server: `subscribe` / `unsubscribe` only (IDA answers any other frame, a `ping`
 * included, with `bad_message`; keep-alive is the server's WebSocket-protocol ping, which the
 * browser answers by itself). Server → client: the frames below, plus `new_filing` broadcasts
 * and the odd application-level `{ type: "ping" }` on the same socket, which are ignored.
 */

export const EARNINGS_LIVE_CHANNEL = "earnings-calls.live";

export const EARNINGS_WS_ERROR_CODES = [
    "bad_message",
    "not_live",
    "not_found",
    "forbidden_tier",
    "subscription_limit",
    "attach_failed",
    "resume_unavailable",
    "unavailable",
] as const;

export type EarningsWsErrorCode = (typeof EARNINGS_WS_ERROR_CODES)[number];

export const LIVE_EVENT_STATES = ["scheduled", "capturing", "ended"] as const;

export type LiveEventState = (typeof LIVE_EVENT_STATES)[number];

export const UNSUBSCRIBE_REASONS = [
    "requested",
    "transcript_ready",
    "rescheduled",
    "no_transcript",
    "call_not_live",
    "max_duration",
] as const;

export type UnsubscribeReason = (typeof UNSUBSCRIBE_REASONS)[number];

const subscriptionFields = {
    event_id: z.string(),
    subscription_id: z.string(),
};

export const subscribedFrameSchema = z.object({
    cik: z.string(),
    conference_date: z.string(),
    current_seq: z.number().int().nullable(),
    event_id: z.string(),
    state: z.enum(LIVE_EVENT_STATES),
    subscription_id: z.string(),
    symbol: z.string(),
    type: z.literal("subscribed"),
});

export const transcriptSegmentFrameSchema = z.object({
    ...subscriptionFields,
    end_ms: z.number(),
    is_final: z.boolean(),
    seq: z.number().int(),
    speaker_label: z.string().nullable(),
    start_ms: z.number(),
    text: z.string(),
    type: z.literal("transcript_segment"),
});

export const speakerNameAssignmentSchema = z.object({
    confidence: z.number(),
    firm: z.string().nullable(),
    from_seq: z.number().int(),
    name: z.string(),
    role: z.string(),
    source: z.string(),
    speaker_label: z.string(),
    title: z.string().nullable(),
    to_seq: z.number().int().nullable(),
});

export const speakerNamesFrameSchema = z.object({
    ...subscriptionFields,
    assignments: z.array(speakerNameAssignmentSchema),
    revision: z.number(),
    type: z.literal("speaker_names"),
});

export const gapFrameSchema = z.object({
    ...subscriptionFields,
    after_seq: z.number().int(),
    next_seq: z.number().int(),
    type: z.literal("gap"),
});

export const callStartedFrameSchema = z.object({
    ...subscriptionFields,
    at: z.string(),
    type: z.literal("call_started"),
});

export const callEndedFrameSchema = z.object({
    ...subscriptionFields,
    at: z.string(),
    live_transcript_available: z.boolean().nullable(),
    type: z.literal("call_ended"),
});

export const transcriptProvisionalFrameSchema = z.object({
    ...subscriptionFields,
    at: z.string(),
    type: z.literal("transcript_provisional"),
    version: z.number().int(),
    word_count: z.number().int(),
});

export const transcriptReadyFrameSchema = z.object({
    ...subscriptionFields,
    at: z.string(),
    type: z.literal("transcript_ready"),
});

export const rescheduledFrameSchema = z.object({
    ...subscriptionFields,
    at: z.string(),
    new_conference_date: z.string(),
    type: z.literal("rescheduled"),
});

export const unsubscribedFrameSchema = z.object({
    reason: z.enum(UNSUBSCRIBE_REASONS),
    subscription_id: z.string(),
    type: z.literal("unsubscribed"),
});

/** Where a price tick came from: the real-time stream, or the polled snapshot while the stream is down. */
export const PRICE_TICK_SOURCES = ["stream", "snapshot"] as const;

/**
 * One second of the call's stock price (≤ 1 / s, only seconds with a trade), sent only to a
 * subscription with `prices: true`. `call_ms` = the bar start on the transcript clock (null
 * before the call's clock is known); `return_bps` vs `reference_price` (the last trade before
 * the call start), `day_return_bps` vs `prev_close`.
 */
export const priceTickFrameSchema = z.object({
    ...subscriptionFields,
    at: z.string(),
    call_ms: z.number().nullable(),
    cik: z.string(),
    conference_date: z.string(),
    cumulative_volume: z.number().nullable(),
    day_return_bps: z.number().nullable(),
    high: z.number(),
    low: z.number(),
    open: z.number(),
    prev_close: z.number().nullable(),
    price: z.number(),
    reference_price: z.number().nullable(),
    return_bps: z.number().nullable(),
    source: z.enum(PRICE_TICK_SOURCES),
    symbol: z.string(),
    type: z.literal("price_tick"),
    volume: z.number(),
});

export const errorFrameSchema = z.object({
    code: z.enum(EARNINGS_WS_ERROR_CODES),
    message: z.string(),
    subscription_id: z.string().optional(),
    type: z.literal("error"),
});

export const earningsServerFrameSchema = z.discriminatedUnion("type", [
    subscribedFrameSchema,
    transcriptSegmentFrameSchema,
    speakerNamesFrameSchema,
    gapFrameSchema,
    callStartedFrameSchema,
    callEndedFrameSchema,
    transcriptProvisionalFrameSchema,
    transcriptReadyFrameSchema,
    rescheduledFrameSchema,
    unsubscribedFrameSchema,
    priceTickFrameSchema,
    errorFrameSchema,
]);

export type EarningsServerFrame = z.infer<typeof earningsServerFrameSchema>;

export type SubscribedFrame = z.infer<typeof subscribedFrameSchema>;

export type TranscriptSegmentFrame = z.infer<typeof transcriptSegmentFrameSchema>;

export type SpeakerNamesFrame = z.infer<typeof speakerNamesFrameSchema>;

export type PriceTickFrame = z.infer<typeof priceTickFrameSchema>;

export type ErrorFrame = z.infer<typeof errorFrameSchema>;

/** Every frame type of the earnings channel; anything else on the socket is not ours. */
export const EARNINGS_FRAME_TYPES: ReadonlySet<string> = new Set(
    earningsServerFrameSchema.options.map(option => option.shape.type.value),
);

/**
 * One raw `message` of the socket: an earnings frame, a frame of something else on the same
 * socket (`other`: `new_filing`, a ping), or `malformed` (not JSON, or an earnings frame type
 * whose fields do not match — the hook ignores and counts it).
 */
export type ParsedServerFrame
    = | { frame: EarningsServerFrame; kind: "frame" }
        | { kind: "malformed" }
        | { kind: "other" };

export function parseServerFrame(data: unknown): ParsedServerFrame {
    if (typeof data !== "string") return { kind: "malformed" };

    let value: unknown;

    try {
        value = JSON.parse(data);
    }
    catch {
        return { kind: "malformed" };
    }

    if (typeof value !== "object" || value === null) return { kind: "malformed" };

    const type = (value as Record<string, unknown>).type;

    if (typeof type !== "string") return { kind: "malformed" };

    if (!EARNINGS_FRAME_TYPES.has(type)) return { kind: "other" };

    const parsed = earningsServerFrameSchema.safeParse(value);

    return parsed.success ? { frame: parsed.data, kind: "frame" } : { kind: "malformed" };
}

/** A `transcript_segment` frame → the reducer's segment (snake → camel). */
export function toLiveSegment(frame: TranscriptSegmentFrame): LiveSegment {
    return {
        endMs: frame.end_ms,
        seq: frame.seq,
        speakerLabel: frame.speaker_label,
        startMs: frame.start_ms,
        text: frame.text,
    };
}

/** A `speaker_names` frame's assignments → the reducer's (snake → camel). */
export function toAssignments(frame: SpeakerNamesFrame): Array<LiveSpeakerAssignment> {
    return frame.assignments.map(assignment => ({
        confidence: assignment.confidence,
        firm: assignment.firm,
        fromSeq: assignment.from_seq,
        name: assignment.name,
        role: assignment.role,
        source: assignment.source,
        speakerLabel: assignment.speaker_label,
        title: assignment.title,
        toSeq: assignment.to_seq,
    }));
}

/** A `speaker_names` frame → the reducer's snapshot (the higher `revision` wins there). */
export function toSpeakerNames(frame: SpeakerNamesFrame): LiveSpeakerNames {
    return { assignments: toAssignments(frame), revision: frame.revision };
}

/** A `price_tick` frame → the prices reducer's tick (snake → camel). */
export function toPriceTick(frame: PriceTickFrame): LivePriceTick {
    return {
        at: frame.at,
        callMs: frame.call_ms,
        cumulativeVolume: frame.cumulative_volume,
        dayReturnBps: frame.day_return_bps,
        high: frame.high,
        low: frame.low,
        open: frame.open,
        prevClose: frame.prev_close,
        price: frame.price,
        referencePrice: frame.reference_price,
        returnBps: frame.return_bps,
        source: frame.source,
        volume: frame.volume,
    };
}

/**
 * The subscribe frame. `since_seq` = the last contiguous final held (`-1` = replay every
 * final of the call); `partials: true` for the greyed tail; `prices: true` adds the call's
 * `price_tick` frames (an API without the option strips the key).
 */
export function subscribeFrame(eventId: string, sinceSeq: number, prices = false) {
    return {
        channel: EARNINGS_LIVE_CHANNEL,
        event_id: eventId,
        partials: true,
        prices,
        since_seq: Math.max(-1, sinceSeq),
        type: "subscribe",
    } as const;
}

export function unsubscribeFrame(subscriptionId: string) {
    return { subscription_id: subscriptionId, type: "unsubscribe" } as const;
}

/**
 * `wss://<api>/v1/ws?api_key=<key>` from the API base URL (`http` → `ws`, `https` → `wss`).
 * The result carries the key: never log it, never put it in an error message.
 */
export function liveWsUrl(baseUrl: string, apiKey: string): string {
    const url = new URL("/v1/ws", baseUrl);

    url.protocol = url.protocol === "http:" ? "ws:" : "wss:";

    url.searchParams.set("api_key", apiKey);

    return url.toString();
}
