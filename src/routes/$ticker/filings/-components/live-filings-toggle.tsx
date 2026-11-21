import type { LiveFilingsMode, LiveFilingsStop } from "@/lib/live/use-live-filings";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";

/**
 * The "Live" switch of the filings views: on = new filings arrive over the stream's `filings` channel (STANDARD). The
 * pill says whether the socket is up; a stop (plan, connection limit, key) turns the switch off and `LiveFilingsStopNotice`
 * says why.
 */
export function LiveFilingsToggle({ live, mode, onChange }: { live: boolean; mode: LiveFilingsMode; onChange: (live: boolean) => void }) {
    return (
        <div className="flex items-center gap-2">
            <Button aria-pressed={live} onClick={() => onChange(!live)} type="button" variant={live ? "default" : "outline"}>
                Live
            </Button>
            {live && (
                <Badge variant={mode === "live" ? "secondary" : "outline"}>
                    {mode === "live" && <LiveDot />}
                    {mode === "live" ? "Listening for new filings" : mode === "retrying" ? "Reconnecting…" : "Connecting…"}
                </Badge>
            )}
        </div>
    );
}

/** Why the live feed stopped (null = it did not). */
export function LiveFilingsStopNotice({ stop }: { stop: LiveFilingsStop | null }) {
    if (!stop) return null;

    return (
        <Notice badge={stop.kind === "plan" ? "STANDARD" : undefined} title={stop.message}>
            {stop.kind === "plan" ? "The live filings feed needs the STANDARD plan; the list still works." : undefined}
        </Notice>
    );
}
