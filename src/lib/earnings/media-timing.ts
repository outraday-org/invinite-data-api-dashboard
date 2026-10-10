/**
 * Refresh rules of presigned media URLs (ported from the admin console's `media-timing.ts`).
 * `expiresAt: null` is a URL that never expires: used as is, never refetched. A presigned one
 * is refetched shortly before it expires; the audio player keeps its position across the swap.
 */

/** A presigned media URL (audio, slides, documents) is re-asked this long before it expires. */
export const MEDIA_URL_REFRESH_BEFORE_MS = 2 * 60_000;

/** The live-stream URL (task 8) is re-asked this long before it expires. */
export const LIVE_STREAM_REFRESH_BEFORE_MS = 5 * 60_000;

/** IDA's default signed-URL lifetime (`EARNINGS_SIGNED_URL_TTL_SECONDS`), for answers without `expires_at`. */
export const SIGNED_URL_DEFAULT_TTL_MS = 15 * 60_000;

/**
 * Whether an expiring URL must be fetched again now. `null` or an unreadable timestamp never
 * asks: refetching a URL that does not expire changes nothing, and a bad timestamp must not
 * turn into a refetch loop.
 */
export function urlNeedsRefresh(expiresAt: null | string, nowMs: number, beforeMs: number): boolean {
    if (expiresAt === null) return false;

    const expiresAtMs = Date.parse(expiresAt);

    if (Number.isNaN(expiresAtMs)) return false;

    return expiresAtMs - nowMs < beforeMs;
}

/** Milliseconds until the refresh is due (≥ 0), or `undefined` for a URL that is never refreshed. */
export function msUntilRefresh(expiresAt: null | string, nowMs: number, beforeMs: number): number | undefined {
    if (expiresAt === null) return undefined;

    const expiresAtMs = Date.parse(expiresAt);

    if (Number.isNaN(expiresAtMs)) return undefined;

    return Math.max(0, expiresAtMs - beforeMs - nowMs);
}
