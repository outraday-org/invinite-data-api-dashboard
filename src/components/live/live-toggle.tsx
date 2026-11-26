import type { StreamMode, StreamStop } from "@/lib/live/stream-socket";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TIER_BADGE_LABELS } from "@/components/ui/credit-hint";
import { Notice } from "@/components/ui/notice";
import { STREAM_TIER } from "@/lib/api/operations.gen";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";

/** The pill's words; `live` = the feed's own `listening` text. */
const LIVE_PILL_TEXT: Partial<Record<StreamMode, string>> = { connecting: "Connecting…", no_key: "API key needed", retrying: "Reconnecting…" };

/** A feed switched on without a key stored in this browser (`no_key`): the socket needs it. */
export const LIVE_NO_KEY_TEXT = "Live feeds need an API key stored in this browser: enter it with the key button in the top bar. The server's key is used for the lists only and never sent to the browser.";

/**
 * The "Live" switch of a `/v1/stream` feed (filings, news): on = new rows arrive over the feed's channel. The pill says
 * whether the socket is up (`listening` = the feed's own words while it is); a stop (plan, connection limit, key, not
 * enabled) turns the switch off and `LiveStopNotice` says why.
 */
export function LiveToggle({
    listening,
    live,
    mode,
    onChange,
    size,
}: {
    listening: string;
    live: boolean;
    mode: StreamMode;
    onChange: (live: boolean) => void;
    size?: "lg";
}) {
    return (
        <div className="flex items-center gap-2">
            {live && (
                <Badge variant={mode === "live" ? "secondary" : "outline"}>
                    {mode === "live" && <LiveDot />}
                    {LIVE_PILL_TEXT[mode] ?? listening}
                </Badge>
            )}
            <Button aria-pressed={live} onClick={() => onChange(!live)} size={size} type="button" variant={live ? "default" : "outline"}>
                Live
            </Button>
        </div>
    );
}

/** The badge of a plan stop: the stream's own `x-tier` (`STREAM_TIER`). */
const STREAM_TIER_BADGE = TIER_BADGE_LABELS[STREAM_TIER];

export const LIVE_FILINGS_PLAN_NOTE = `The live filings feed needs the ${STREAM_TIER_BADGE} plan; the list still works.`;

export const LIVE_NEWS_PLAN_NOTE = `The live news feed needs the ${STREAM_TIER_BADGE} plan; the list above still works.`;

/** Why a live feed stopped (null = it did not); `planNote` = the sentence under a plan stop. */
export function LiveStopNotice({ planNote, stop }: { planNote: string; stop: null | StreamStop }) {
    if (!stop) return null;

    return (
        <Notice badge={stop.kind === "plan" ? STREAM_TIER_BADGE : undefined} title={stop.message}>
            {stop.kind === "plan" ? planNote : undefined}
        </Notice>
    );
}
