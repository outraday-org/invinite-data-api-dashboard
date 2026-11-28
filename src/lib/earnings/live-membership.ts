import type { V2EventsResponse } from "@/lib/api/types";

/** Two missed 15-second refreshes no longer establish current membership. */
export const LIVE_MEMBERSHIP_MAX_AGE_MS = 30_000;

export function liveMembership(eventId: string, observation: {
    data: null | V2EventsResponse;
    error: unknown;
    fresh: boolean;
    fetching: boolean;
    success: boolean;
}): { complete: boolean; present: boolean; verified: boolean } {
    const verified = observation.fresh && observation.success && !observation.error && observation.data !== null;
    const present = verified && observation.data?.data.some(event => event.event_id === eventId) === true;
    const complete = verified && !observation.fetching && observation.data?.has_more === false && !observation.data.next_cursor;

    return { complete, present, verified };
}
