import * as React from "react";

import type { EarningsEventResponse } from "@/lib/api/types";

import { isEarningsEventLiveish, useEarningsLive } from "@/lib/api/queries";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { LivePlayer } from "./live/live-player";
import { Notice } from "./media-state";

/**
 * The live player's place on the call page, above the tabs: `LivePlayer` while the call is
 * capturing (`capture_status`) or listed by `/live` (asked only for a call that may be live).
 * Once shown it stays for the page's life, so after the end its "final transcript in progress"
 * note remains while the event refetch (every 30 s) waits for `has_transcript`. Keyed by event:
 * a navigation always builds fresh hls.js / WebSocket instances.
 */
export function LivePlayerSlot({ event }: { event: EarningsEventResponse }) {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    const { data: live } = useEarningsLive(isEarningsEventLiveish(event));

    const listed = live?.events.find(item => item.event_id === event.event_id);

    // Sticky: the call leaves `/live` (and `capturing`) when it ends; the player stays.
    const [shown, setShown] = React.useState(false);

    if (!shown && (event.capture_status === "capturing" || listed !== undefined)) setShown(true);

    // Sticky too: a playing stream must not vanish when the ended call drops out of `/live`.
    const [liveAudio, setLiveAudio] = React.useState(false);

    if (!liveAudio && listed?.live_audio === true) setLiveAudio(true);

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
            liveAudio={liveAudio}
        />
    );
}
