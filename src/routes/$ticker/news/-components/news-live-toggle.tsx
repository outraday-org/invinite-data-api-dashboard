import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";

/**
 * The "Live" switch (default off): on = new items arrive over `news.live` and join the top of the list. The state pill
 * says whether the subscription is up; a stop (plan, connection limit, not enabled) turns the switch off and the page
 * shows why.
 */
export function NewsLiveToggle({
    live,
    mode,
    onChange,
}: {
    live: boolean;
    mode: "connecting" | "live" | "retrying";
    onChange: (live: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <Button
                aria-pressed={live}
                onClick={() => onChange(!live)}
                size="lg"
                type="button"
                variant={live ? "default" : "outline"}
            >
                Live
            </Button>
            {live && (
                <Badge variant={mode === "live" ? "secondary" : "outline"}>
                    {mode === "live" && <LiveDot />}
                    {mode === "live" ? "Listening for new items" : mode === "retrying" ? "Reconnecting…" : "Connecting…"}
                </Badge>
            )}
        </div>
    );
}
