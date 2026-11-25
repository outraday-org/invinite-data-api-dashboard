import type { V2Event } from "@/lib/api/types";

/**
 * Whether the event's planned or running capture is a REPLAY (`capture_mode`, Data API 11.4): a recording captured
 * after the call (a missed call being recovered). Its `capture_status` moves through pending / armed / capturing /
 * captured like a live capture, but nothing of it is live — the earnings app publishes no live frame for a replay of a
 * past call. A missing field (an older API) = not a replay.
 */
export function isReplayCapture(event: Pick<V2Event, "capture_mode">): boolean {
    return event.capture_mode === "replay";
}

/** A live list without the replay captures (`/v1/events?status=live` counts a capturing replay as live). */
export function withoutReplayCaptures<T extends { data: Array<Pick<V2Event, "capture_mode">> }>(page: T): T {
    return page.data.some(isReplayCapture) ? { ...page, data: page.data.filter(event => !isReplayCapture(event)) } : page;
}
