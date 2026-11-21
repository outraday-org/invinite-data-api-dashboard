import type { StreamMode, StreamStop } from "@/lib/live/stream-socket";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";

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
            <Button aria-pressed={live} onClick={() => onChange(!live)} size={size} type="button" variant={live ? "default" : "outline"}>
                Live
            </Button>
            {live && (
                <Badge variant={mode === "live" ? "secondary" : "outline"}>
                    {mode === "live" && <LiveDot />}
                    {mode === "live" ? listening : mode === "retrying" ? "Reconnecting…" : "Connecting…"}
                </Badge>
            )}
        </div>
    );
}

export const LIVE_FILINGS_PLAN_NOTE = "The live filings feed needs the STANDARD plan; the list still works.";

export const LIVE_NEWS_PLAN_NOTE = "The live news feed needs the STANDARD plan; the list above still works.";

/** Why a live feed stopped (null = it did not); `planNote` = the sentence under a plan stop. */
export function LiveStopNotice({ planNote, stop }: { planNote: string; stop: null | StreamStop }) {
    if (!stop) return null;

    return (
        <Notice badge={stop.kind === "plan" ? "STANDARD" : undefined} title={stop.message}>
            {stop.kind === "plan" ? planNote : undefined}
        </Notice>
    );
}
