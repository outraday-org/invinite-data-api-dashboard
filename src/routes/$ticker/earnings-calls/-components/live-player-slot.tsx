import * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { isEarningsEventLiveish, useV2LiveEvents } from "@/lib/api/queries";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { LivePlayer } from "./live/live-player";
import { Notice } from "./media-state";

/**
 * The live player's place on the call page, above the tabs: `LivePlayer` while the call is
 * capturing (`capture_status`) or listed by `/v1/events?status=live` (asked only for a call that may be live).
 * Once shown it stays for the page's life, so after the end its "final transcript in progress"
 * note remains while the event refetch (every 30 s) waits for `has_transcript`. Keyed by event:
 * a navigation always builds fresh hls.js / WebSocket instances.
 */
export function LivePlayerSlot({ event }: { event: V2Event }) {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    const { data: live } = useV2LiveEvents(isEarningsEventLiveish(event));

    const listed = live?.data.find(item => item.event_id === event.event_id);

    // Sticky: the call leaves the live list (and `capturing`) when it ends; the player stays.
    const [shown, setShown] = React.useState(false);

    if (!shown && (event.capture_status === "capturing" || listed !== undefined)) setShown(true);

    if (!shown || !hasHydrated) return null;

    if (apiKey === null) {
        return (
            <Notice badge="Live" title="Enter your API key to follow this call live">
                The live transcript opens a WebSocket from this browser with the API key stored on the landing page.
            </Notice>
        );
    }

    return (
        <LivePlayer
            apiKey={apiKey}
            apiKeyUpdatedAt={apiKeyUpdatedAt}
            event={event}
            key={event.event_id}
            // v2's Event has no `live_audio` flag: the player asks `/live-audio`, whose `disabled` status is the
            // "no live audio" state.
            liveAudio
        />
    );
}
