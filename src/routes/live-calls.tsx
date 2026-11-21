import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isTierError } from "@/lib/api/errors";
import { useV2EventsInfinite, useV2LiveEvents } from "@/lib/api/queries";
import { eventLabel, formatCallTime, formatStartedAgo, zonedDate } from "@/lib/earnings/format";
import { titleHead } from "@/lib/layout";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";
import { EventTypeBadge } from "@/routes/$ticker/earnings-calls/-components/event-type-badge";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";

export const Route = createFileRoute("/live-calls")({
    component: LiveCallsPage,
    head: () => titleHead("Live calls"),
});

/** How many upcoming calls the empty state names. */
const NEXT_CALLS = 6;

/** One live call: company, period, started, what it carries; opens the call page. */
export function LiveCallCard({ asOf, event }: { asOf: Date; event: V2Event }) {
    return (
        <EventLink className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" event={event}>
            <Card className="hover:bg-muted/50 h-full transition-colors" data-testid="live-call-card" size="sm">
                <CardContent className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <LiveDot />
                        <span className="text-sm font-semibold">{event.symbol}</span>
                        <span className="text-muted-foreground truncate">{event.company_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {eventLabel(event)}
                        <EventTypeBadge event={event} />
                    </div>
                    <div className="text-muted-foreground">{event.started_at ? formatStartedAgo(event.started_at, asOf) : "starting"}</div>
                    <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">Live transcript</Badge>
                        {event.webcast_url && <Badge variant="outline">Webcast</Badge>}
                    </div>
                </CardContent>
            </Card>
        </EventLink>
    );
}

/**
 * The live calls (pure): one card per call being captured now; none → the next scheduled calls by name (so the page
 * is never a blank "nothing live").
 */
export function LiveCallsView({ asOf, error, isLoading, live, next, nextLoading }: {
    asOf: Date;
    error: unknown;
    isLoading: boolean;
    live: ReadonlyArray<V2Event>;
    next: ReadonlyArray<V2Event>;
    nextLoading: boolean;
}) {
    if (error) {
        if (isTierError(error)) return <Notice badge="Plan" title="Live calls are not included in your plan." />;

        return <ErrorState error={error} title="Failed to load the live calls" />;
    }

    if (isLoading) return <Skeleton className="h-32 w-full" />;

    if (live.length > 0) {
        return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {live.map(event => <LiveCallCard asOf={asOf} event={event} key={event.event_id} />)}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <Notice badge="None live" title="No call is live right now.">
                The page refreshes every 15 seconds; a call shows here once its capture starts.
            </Notice>
            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Next scheduled calls</h3>
                {nextLoading
                    ? <Skeleton className="h-20 w-full" />
                    : next.length === 0
                        ? <p className="text-muted-foreground">No call is scheduled in the next days.</p>
                        : (
                                <ul className="flex flex-col divide-y" data-testid="next-calls">
                                    {next.map(event => (
                                        <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5" key={event.event_id}>
                                            <span className="text-muted-foreground w-44 tabular-nums">{formatCallTime(event)}</span>
                                            <EventLink className="font-medium hover:underline" event={event}>{event.symbol}</EventLink>
                                            <span className="truncate">{event.company_name}</span>
                                            <span className="text-muted-foreground">{eventLabel(event)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
            </section>
        </div>
    );
}

/**
 * Every call live now (`/v1/events?status=live&type=all`, refetched every 15 s) as cards to its call page; with none
 * live, the next upcoming calls (`status=upcoming` from today, one page). The live list carries no live-audio flag
 * (asking `/live-audio` per card is billed): the call page tells.
 */
function LiveCallsPage() {
    const { data, dataUpdatedAt, error, isLoading } = useV2LiveEvents();

    const live = data?.data ?? [];

    const [today] = React.useState(() => zonedDate(new Date(), "America/New_York"));

    const next = useV2EventsInfinite({
        enabled: !isLoading && !error && live.length === 0,
        limit: NEXT_CALLS,
        scheduledAtGte: today,
        sort: "scheduled_at",
        status: ["upcoming"],
        toastErrors: false,
        type: "all",
    });

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader
                description={live.length > 0 ? `${live.length} ${live.length === 1 ? "call" : "calls"} live now. Open one to follow its transcript and audio.` : "Earnings calls and events being captured right now."}
                title="Live calls"
            />
            <LiveCallsView
                asOf={new Date(dataUpdatedAt)}
                error={error}
                isLoading={isLoading}
                live={live}
                next={next.data?.pages.flatMap(page => page.data).slice(0, NEXT_CALLS) ?? []}
                nextLoading={next.isLoading}
            />
        </div>
    );
}
