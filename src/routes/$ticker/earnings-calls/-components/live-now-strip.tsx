import type { V2Event } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { isTierError } from "@/lib/api/errors";
import { useV2LiveEvents } from "@/lib/api/queries";
import { formatStartedAgo } from "@/lib/earnings/format";

import { EventLink } from "./event-link";
import { LiveDot } from "./live-dot";

/** "Live now": events being captured right now (`/v2/events?status=live&type=all`, refetched every 15 s); hidden when none. */
export function LiveNowStrip() {
    const { data, dataUpdatedAt, error } = useV2LiveEvents();

    if (error) {
        return (
            <div className="text-muted-foreground text-xs">
                {isTierError(error)
                    ? "Live calls are not included in your plan."
                    : `Live calls unavailable: ${error.message}`}
            </div>
        );
    }

    const events: Array<V2Event> = data?.data ?? [];

    if (events.length === 0) return null;

    // When the answer arrived (v2 lists carry no server time): refreshed with every refetch.
    const asOf = new Date(dataUpdatedAt);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
                <LiveDot />
                Live now
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {events.map(event => (
                    <EventLink className="shrink-0" event={event} key={event.event_id}>
                        <Card className="w-64 hover:bg-muted/50 transition-colors" size="sm">
                            <CardContent className="flex flex-col gap-1.5">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-medium">{event.symbol}</span>
                                    <span className="text-muted-foreground truncate">{event.company_name}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    {event.started_at ? formatStartedAgo(event.started_at, asOf) : "starting"}
                                </div>
                                <div className="flex gap-1">
                                    <Badge variant="secondary">Live transcript</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </EventLink>
                ))}
            </div>
        </div>
    );
}
