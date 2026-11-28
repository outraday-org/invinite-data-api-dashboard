import * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { useV2LiveEvents } from "@/lib/api/queries";
import { liveMembership, LIVE_MEMBERSHIP_MAX_AGE_MS } from "@/lib/earnings/live-membership";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

export type RecordingWait = "gave-up" | "waiting" | null;

export type CallLiveSession = {
    sawLive: boolean;
    isLive: boolean;
    ended: boolean;
    recordingWait: RecordingWait;
    reportActive?: (active: boolean) => void;
    reportEnded?: () => void;
};

type Session = { ended: boolean; identity: string; lastPositiveAt: number; sawLive: boolean; transportActive: boolean };

const emptySession = (identity: string): Session => ({ ended: false, identity, lastPositiveAt: 0, sawLive: false, transportActive: false });

/** An observed session survives failed/partial refreshes; only complete fresh absence or media completion ends it. */
export function useCallLiveSession(event: null | V2Event, options: {
    availabilityActive?: boolean;
    onAvailabilityChange?: () => void;
    visible?: boolean;
} = {}): CallLiveSession {
    const auth = useApiKeyStore(state => state.apiKeyUpdatedAt);
    const identity = `${event?.event_id ?? ""}:${auth}`;
    const live = useV2LiveEvents(event !== null && options.visible !== false, event?.cik);
    const [fresh, setFresh] = React.useState(false);
    const [memory, setMemory] = React.useState(() => emptySession(identity));
    const current = memory.identity === identity ? memory : emptySession(identity);

    React.useEffect(() => {
        setMemory(previous => previous.identity === identity ? previous : emptySession(identity));
    }, [identity]);

    React.useEffect(() => {
        const remaining = live.dataUpdatedAt + LIVE_MEMBERSHIP_MAX_AGE_MS - Date.now();

        setFresh(remaining > 0 && options.visible !== false);

        if (remaining <= 0 || options.visible === false) return undefined;

        const timer = setTimeout(() => setFresh(false), remaining);

        return () => clearTimeout(timer);
    }, [live.dataUpdatedAt, options.visible]);

    const membership = liveMembership(event?.event_id ?? "", {
        data: live.data,
        error: live.error,
        fetching: live.fetchStatus === "fetching",
        fresh,
        success: live.isSuccess && !live.isPlaceholderData,
    });

    React.useEffect(() => {
        if (!membership.verified) return;

        setMemory(previous => {
            const session = previous.identity === identity ? previous : emptySession(identity);

            if (membership.present) {
                if (session.sawLive && !session.ended && session.lastPositiveAt === live.dataUpdatedAt) return session;

                return { ...session, ended: false, lastPositiveAt: live.dataUpdatedAt, sawLive: true };
            }

            if (membership.complete && session.sawLive && live.dataUpdatedAt > session.lastPositiveAt && !session.ended)
                return { ...session, ended: true, transportActive: false };

            return session;
        });
    }, [identity, live.dataUpdatedAt, membership.complete, membership.present, membership.verified]);

    const reportActive = React.useCallback((active: boolean) => {
        setMemory(previous => previous.identity === identity && previous.transportActive !== active
            ? { ...previous, transportActive: active }
            : previous);
    }, [identity]);

    const onAvailabilityChange = React.useRef(options.onAvailabilityChange);

    React.useEffect(() => { onAvailabilityChange.current = options.onAvailabilityChange; }, [options.onAvailabilityChange]);
    const reportEnded = React.useCallback(() => {
        setMemory(previous => previous.identity === identity && !previous.ended
            ? { ...previous, ended: true, transportActive: false }
            : previous);
        onAvailabilityChange.current?.();
    }, [identity]);

    return {
        ended: current.ended,
        isLive: !current.ended && (membership.present || current.transportActive),
        recordingWait: event === null || !current.ended || event.has_audio ? null : options.availabilityActive && !event.has_transcript ? "waiting" : "gave-up",
        reportActive,
        reportEnded,
        sawLive: current.sawLive || membership.present,
    };
}
