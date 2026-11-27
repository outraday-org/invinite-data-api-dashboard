import type { V2Me } from "@/lib/api/types";

import { STREAM_TIER } from "@/lib/api/operations.gen";
import { useKeyState } from "@/lib/api/queries";
import { planAllows } from "@/lib/api/request-meta";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

/**
 * Whether a plan reaches the `/v1/stream` socket: the stream's `x-tier` (`STREAM_TIER`), never a standalone
 * pay-as-you-go account (credits without a plan reach what PRO reaches EXCEPT live data). Unknown plan = no.
 */
export function planStreams(me: null | undefined | V2Me): boolean {
    return Boolean(me && me.plan !== "payg" && planAllows(me.plan, STREAM_TIER));
}

/**
 * Live feeds (filings, news) are on by default (owner 2026-11-27) when this browser holds a key — the socket never
 * uses the server's — and its plan reaches the stream. Until `/v1/me` answered the default is off, so no socket opens
 * for a plan that would be refused.
 */
export function useLiveDefault(): boolean {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const { me } = useKeyState();

    return Boolean(apiKey) && planStreams(me);
}

/** The switch's state: the URL's `live` when written (`?live=false` / `?live=true`), else the default. */
export function liveOn(live: boolean | undefined, byDefault: boolean): boolean {
    return live ?? byDefault;
}

/** The URL value that writes a switch state: the default is written as `undefined`. */
export function liveParam(on: boolean, byDefault: boolean): boolean | undefined {
    return on === byDefault ? undefined : on;
}
