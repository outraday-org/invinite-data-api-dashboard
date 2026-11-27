import { z } from "zod";

import type { components } from "../api/schema";
import type { LivePriceTick } from "./live-prices-reducer";
import type { LiveSegment, LiveSpeakerAssignment, LiveSpeakerNames } from "./live-transcript-reducer";

/**
 * The `WS /v1/stream` frames of the data API's live earnings-call channel `events.live`, as zod schemas. Names and
 * shapes mirror IDA `src/routes/websocket/types/earningsMessages.ts` — change both or neither (the stream renames the
 * registry's channel names at its edge, both ways: IDA `src/lib/v1/stream.ts`).
 *
 * Client → server: `subscribe` / `unsubscribe` only (IDA answers any other frame, a `ping`
 * included, with `bad_message`; keep-alive is the server's WebSocket-protocol ping, which the
 * browser answers by itself). Server → client: the frames below, plus `new_filing` broadcasts
 * and the odd application-level `{ type: "ping" }` on the same socket, which are ignored.
 */

export const EARNINGS_LIVE_CHANNEL = "events.live";

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

/** Where a keyword hit was found: a live final, or the final transcript at `transcript_ready` (once per subscription). */
export const KEYWORD_HIT_LAYERS = ["live", "final"] as const;

/**
 * `keyword_hit` (O4; `WebSocketKeywordHitEvent`): a watched keyword (`subscribe.keywords`) in a FINAL segment (`layer`
 * `live`, `start_ms` from `call_t0`) or in the final transcript (`final`, `start_ms` from the recording's start).
 */
export const keywordHitFrameSchema = z.object({
    ...subscriptionFields,
    cik: z.string(),
    conference_date: z.string(),
    context_before: z.string().nullable(),
    end_ms: z.number().nullable(),
    keyword: z.string(),
    latency_ms: z.number().nullable(),
    layer: z.enum(KEYWORD_HIT_LAYERS),
    seq: z.number().int().nullable(),
    speaker_label: z.string().nullable(),
    speaker_name: z.string().nullable(),
    speaker_role: z.string().nullable(),
    start_ms: z.number().nullable(),
    symbol: z.string(),
    text: z.string(),
    type: z.literal("keyword_hit"),
});

/**
 * `guidance_flash` (O4; `WebSocketGuidanceFlashEvent`): a forward-looking number seconds after it was spoken, one per
 * metric / period; a restatement repeats it with a higher `revision`. Provisional (`/v1/guidance` replaces it later).
 */
export const guidanceFlashFrameSchema = z.object({
    ...subscriptionFields,
    cik: z.string(),
    conference_date: z.string(),
    currency: z.string().nullable(),
    high: z.number().nullable(),
    low: z.number().nullable(),
    metric: z.string(),
    metric_normalized: z.string(),
    period_label: z.string(),
    point: z.number().nullable(),
    revision: z.number().int(),
    seq: z.number().int(),
    source_sentence: z.string(),
    start_ms: z.number(),
    symbol: z.string(),
    type: z.literal("guidance_flash"),
    unit: z.string().nullable(),
});

/** `warning` (O4; `WebSocketWarningEvent`): the subscription is degraded but keeps running. A code it does not know is still a warning. */
export const warningFrameSchema = z.object({
    code: z.string(),
    message: z.string(),
    subscription_id: z.string(),
    type: z.literal("warning"),
});

export type KeywordHitFrame = z.infer<typeof keywordHitFrameSchema>;

export type GuidanceFlashFrame = z.infer<typeof guidanceFlashFrameSchema>;

/** The watch list of a subscription (`keywords`, `keyword_match`); empty = none sent. */
export type KeywordWatch = { keywords: ReadonlyArray<string>; match: "exact" | "stem" };

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
    keywordHitFrameSchema,
    guidanceFlashFrameSchema,
    warningFrameSchema,
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
 * `price_tick` frames (an API without the option strips the key); `watch` adds `keywords` / `keyword_match`.
 */
export function subscribeFrame(eventId: string, sinceSeq: number, prices = false, watch?: KeywordWatch) {
    return {
        channel: EARNINGS_LIVE_CHANNEL,
        event_id: eventId,
        partials: true,
        prices,
        since_seq: Math.max(-1, sinceSeq),
        type: "subscribe",
        // A watch list (O4): a `keyword_hit` per final holding one of them. None = the key is left out.
        ...(watch && watch.keywords.length > 0 ? { keyword_match: watch.match, keywords: [...watch.keywords] } : {}),
    } as const;
}

export function unsubscribeFrame(subscriptionId: string) {
    return { subscription_id: subscriptionId, type: "unsubscribe" } as const;
}

/**
 * `wss://<api>/v1/stream?api_key=<key>` from the API base URL (`http` → `ws`, `https` → `wss`).
 * The result carries the key: never log it, never put it in an error message.
 */
export function liveWsUrl(baseUrl: string, apiKey: string): string {
    const url = new URL("/v1/stream", baseUrl);

    url.protocol = url.protocol === "http:" ? "ws:" : "wss:";

    url.searchParams.set("api_key", apiKey);

    return url.toString();
}

// ── News (`news`, backend earnings tasks/inhouse-news-pipeline task 16 / 17) ──────────────────────────────────
// Mirrors IDA `src/routes/websocket/types/newsMessages.ts` and the spec's `WebSocket*News*` schemas — change both or
// neither. Every news frame carries `channel: "news"`; its `error` / `subscribed` / `unsubscribed` share their
// `type` with the earnings frames above, so news frames are told apart by `channel`, never parsed as earnings ones.

export const NEWS_LIVE_CHANNEL = "news";

export const NEWS_WS_ERROR_CODES = ["bad_message", "forbidden_tier", "channel_unavailable", "unavailable"] as const;

export type NewsWsErrorCode = (typeof NEWS_WS_ERROR_CODES)[number];

const newsChannel = z.literal(NEWS_LIVE_CHANNEL);

export const newsSubscribedFrameSchema = z.object({
    channel: newsChannel,
    filters: z.object({
        ciks: z.array(z.string()),
        earnings_only: z.boolean(),
        kinds: z.array(z.string()),
        sources: z.array(z.string()),
        tickers: z.array(z.string()),
    }),
    type: z.literal("subscribed"),
});

/**
 * `news_item`: the same object as a `GET /v1/news` row. Only the fields the page reads are checked; the item is kept
 * whole (`looseObject`) and typed as `NewsItemPublic` by the hook.
 */
export const newsItemFrameSchema = z.object({
    channel: newsChannel,
    item: z.looseObject({
        attribution: z.looseObject({ published_at: z.string(), publisher: z.string(), source_url: z.string() }),
        id: z.string(),
        is_earnings_news: z.boolean(),
        kind: z.string(),
        publications: z.array(z.looseObject({})),
        published_at: z.string(),
        source: z.looseObject({ id: z.string() }),
        symbols: z.array(z.string()),
        title: z.string(),
        topics: z.array(z.string()),
        url: z.string(),
    }),
    type: z.literal("news_item"),
});

export const newsUnsubscribedFrameSchema = z.object({ channel: newsChannel, type: z.literal("unsubscribed") });

export const newsErrorFrameSchema = z.object({
    channel: newsChannel,
    code: z.enum(NEWS_WS_ERROR_CODES),
    message: z.string(),
    type: z.literal("error"),
});

export const newsServerFrameSchema = z.discriminatedUnion("type", [
    newsSubscribedFrameSchema,
    newsItemFrameSchema,
    newsUnsubscribedFrameSchema,
    newsErrorFrameSchema,
]);

export type NewsServerFrame = z.infer<typeof newsServerFrameSchema>;

/** One raw socket `message`: a news frame, anything else on the socket (`other`), or a malformed news frame. */
export type ParsedNewsFrame
    = | { frame: NewsServerFrame; kind: "frame" }
        | { kind: "malformed" }
        | { kind: "other" };

export function parseNewsFrame(data: unknown): ParsedNewsFrame {
    if (typeof data !== "string") return { kind: "other" };

    let value: unknown;

    try {
        value = JSON.parse(data);
    }
    catch {
        return { kind: "other" };
    }

    if (typeof value !== "object" || value === null) return { kind: "other" };

    const record = value as Record<string, unknown>;

    if (record.channel !== NEWS_LIVE_CHANNEL && record.type !== "news_item") return { kind: "other" };

    const parsed = newsServerFrameSchema.safeParse(value);

    return parsed.success ? { frame: parsed.data, kind: "frame" } : { kind: "malformed" };
}

export type NewsSubscribeOptions = {
    ciks?: ReadonlyArray<string>;
    earningsOnly?: boolean;
    kinds?: ReadonlyArray<string>;
    sources?: ReadonlyArray<string>;
    /** Omitted / empty = the whole market. */
    tickers?: ReadonlyArray<string>;
};

/** The `news` subscribe frame; an empty filter is left out (no filter = every item). */
export function newsSubscribeFrame({ ciks, earningsOnly, kinds, sources, tickers }: NewsSubscribeOptions = {}) {
    return {
        channel: NEWS_LIVE_CHANNEL,
        type: "subscribe",
        ...(tickers?.length ? { tickers: [...tickers] } : {}),
        ...(ciks?.length ? { ciks: [...ciks] } : {}),
        ...(earningsOnly ? { earnings_only: true } : {}),
        ...(kinds?.length ? { kinds: [...kinds] } : {}),
        ...(sources?.length ? { sources: [...sources] } : {}),
    } as const;
}

// ── Filings (`filings`, STANDARD; backend tasks/data-api-dashboard O7 group 3) ─────────────────────────────────────
// Mirrors the spec's `WebSocketNewFilingEvent` / `WebSocketFiling` (IDA `src/lib/ablyRealtimeListener.ts`
// `toWebSocketFiling`) — change both or neither. `new_filing` is broadcast to EVERY connection of the stream: there is
// no subscribe frame, and the frame carries no `channel`.

export const newFilingFrameSchema = z.object({
    filing: z.looseObject({
        accession_number: z.string(),
        calendar_quarter: z.number().int(),
        calendar_year: z.number().int(),
        cik: z.string(),
        filing_date: z.string(),
        fiscal_quarter: z.number().int().nullable(),
        fiscal_year: z.number().int().nullable(),
        form_type: z.string(),
        html_url: z.string().nullable(),
        period_end: z.string().nullable(),
        proposed_symbols: z.array(z.looseObject({ symbol: z.string() })).nullable(),
        ticker: z.string().nullable(),
    }),
    type: z.literal("new_filing"),
});

export type NewFilingFrame = z.infer<typeof newFilingFrameSchema>;

/** One filing of a `new_filing` frame (snake_case, as sent). */
export type LiveFiling = NewFilingFrame["filing"];

/** One raw socket `message`: a `new_filing` frame, anything else on the socket (`other`), or a malformed `new_filing`. */
export type ParsedFilingFrame
    = | { frame: NewFilingFrame; kind: "frame" }
        | { kind: "malformed" }
        | { kind: "other" };

export function parseFilingFrame(data: unknown): ParsedFilingFrame {
    if (typeof data !== "string") return { kind: "other" };

    let value: unknown;

    try {
        value = JSON.parse(data);
    }
    catch {
        return { kind: "other" };
    }

    if (typeof value !== "object" || value === null || (value as Record<string, unknown>).type !== "new_filing") return { kind: "other" };

    const parsed = newFilingFrameSchema.safeParse(value);

    return parsed.success ? { frame: parsed.data, kind: "frame" } : { kind: "malformed" };
}

// ── Alerts (`alerts`; backend tasks/data-api-dashboard 2-alerts task 2) ─────────────────────────────────────────────
// Mirrors the spec's `WebSocket*Alerts*` / `WebSocketAlertEventEvent` schemas and IDA `routes/websocket/types/
// alertMessages.ts` (its `error` frame is not in the spec) — change both or neither. Every alerts frame carries
// `channel: "alerts"`; its `error` / `subscribed` / `unsubscribed` share their `type` with other channels' frames, so
// they are told apart by `channel`. A frame of the channel with a type this page does not know is counted, never thrown.

export const ALERTS_CHANNEL = "alerts";

/** Alert ids one subscription may name (`WebSocketSubscribeAlerts.alert_ids` `maxItems`). */
export const ALERTS_WS_MAX_ALERT_IDS = 100;

/**
 * The codes IDA sends today (`ALERTS_WS_ERROR_CODES`), pinned to the spec's `StreamErrorEvent.code` enum (the union of
 * every channel's codes, FU3010): a code that leaves the spec fails `tsc`. Another code still parses (the hook treats it
 * as a stop).
 */
export const ALERTS_WS_ERROR_CODES = ["bad_message", "channel_unavailable", "unavailable"] as const satisfies ReadonlyArray<
    components["schemas"]["StreamErrorEvent"]["code"]
>;

const alertsChannel = z.literal(ALERTS_CHANNEL);

export const alertsSubscribedFrameSchema = z.object({
    channel: alertsChannel,
    filters: z.object({ alert_ids: z.array(z.string()), external_user_id: z.string().nullable(), types: z.array(z.string()) }),
    type: z.literal("subscribed"),
});

/** `alert_event`: exactly the row of `GET /v1/alert-events` (replayed or live); the payload is kept whole. */
export const alertEventFrameSchema = z.object({
    channel: alertsChannel,
    event: z.object({
        alert_id: z.string().nullable(),
        external_user_id: z.string().nullable(),
        id: z.string(),
        occurred_at: z.string(),
        payload: z.record(z.string(), z.json()),
        type: z.string(),
    }),
    type: z.literal("alert_event"),
});

/** More than 1,000 events were missed: the replay stopped at `last_event_id` (the rest: the REST feed). */
export const alertsReplayTruncatedFrameSchema = z.object({ channel: alertsChannel, last_event_id: z.string(), type: z.literal("replay_truncated") });

export const alertsUnsubscribedFrameSchema = z.object({ channel: alertsChannel, type: z.literal("unsubscribed") });

export const alertsErrorFrameSchema = z.object({ channel: alertsChannel, code: z.string(), message: z.string(), type: z.literal("error") });

export const alertsServerFrameSchema = z.discriminatedUnion("type", [
    alertsSubscribedFrameSchema,
    alertEventFrameSchema,
    alertsReplayTruncatedFrameSchema,
    alertsUnsubscribedFrameSchema,
    alertsErrorFrameSchema,
]);

export type AlertsServerFrame = z.infer<typeof alertsServerFrameSchema>;

const ALERTS_FRAME_TYPES: ReadonlySet<string> = new Set(alertsServerFrameSchema.options.map(option => option.shape.type.value));

/**
 * One raw socket `message`: an alerts frame, a frame of the channel with a type this page does not know (`unknown`:
 * counted), a malformed alerts frame, or anything else on the socket (`other`).
 */
export type ParsedAlertsFrame
    = | { frame: AlertsServerFrame; kind: "frame" }
        | { kind: "malformed" }
        | { kind: "other" }
        | { kind: "unknown"; type: string };

export function parseAlertsFrame(data: unknown): ParsedAlertsFrame {
    if (typeof data !== "string") return { kind: "other" };

    let value: unknown;

    try {
        value = JSON.parse(data);
    }
    catch {
        return { kind: "other" };
    }

    if (typeof value !== "object" || value === null) return { kind: "other" };

    const record = value as Record<string, unknown>;

    if (record.channel !== ALERTS_CHANNEL) return { kind: "other" };

    if (typeof record.type !== "string" || !ALERTS_FRAME_TYPES.has(record.type)) return { kind: "unknown", type: String(record.type) };

    const parsed = alertsServerFrameSchema.safeParse(value);

    return parsed.success ? { frame: parsed.data, kind: "frame" } : { kind: "malformed" };
}

export type AlertsSubscribeOptions = {
    /** An event id: up to 1,000 missed events after it are replayed first. */
    after?: string;
    /** ≤ 100 (`ALERTS_WS_MAX_ALERT_IDS`); more are refused by the API, so the caller never sends more. */
    alertIds?: ReadonlyArray<string>;
    externalUserId?: string;
    types?: ReadonlyArray<string>;
};

/** The `alerts` subscribe frame; an empty filter is left out (no filter = every event of the account). */
export function alertsSubscribeFrame({ after, alertIds, externalUserId, types }: AlertsSubscribeOptions = {}) {
    return {
        channel: ALERTS_CHANNEL,
        type: "subscribe",
        ...(alertIds?.length ? { alert_ids: alertIds.slice(0, ALERTS_WS_MAX_ALERT_IDS) } : {}),
        ...(externalUserId ? { external_user_id: externalUserId } : {}),
        ...(types?.length ? { types: [...types] } : {}),
        ...(after ? { after } : {}),
    } as const;
}
