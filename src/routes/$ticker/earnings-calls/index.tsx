import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiRequestError } from "@/lib/api/errors";
import { useV2EventsInfinite } from "@/lib/api/queries";
import { eventLabel, formatInstant, isUpcoming } from "@/lib/earnings/format";
import { tickerHead } from "@/lib/layout";
import { DocumentSearch } from "@/routes/$ticker/documents/-components/document-search";

import { AskThisCall } from "./-components/ask-this-call";
import { AvailabilityIcons } from "./-components/availability-icons";
import { CallStatusBadge } from "./-components/call-status-badge";
import { CallTime } from "./-components/call-time";
import { EventLink } from "./-components/event-link";
import { EventTypeBadge } from "./-components/event-type-badge";
import { LiveNowStrip } from "./-components/live-now-strip";

export const Route = createFileRoute("/$ticker/earnings-calls/")({
    component: EarningsCallsPage,
    head: ({ params }) => tickerHead(params.ticker, "Earnings Calls"),
});

type CallsTab = "past" | "upcoming";

/** What the company search box searches: call transcripts / slides, or company-published documents. */
type SearchScope = "documents" | "transcripts";

function EarningsCallsPage() {
    const { ticker } = Route.useParams();

    // Once per mount (lazy initializer: render stays pure).
    const [now] = React.useState(() => new Date());

    const [selectedTab, setSelectedTab] = React.useState<CallsTab | null>(null);

    const [searchScope, setSearchScope] = React.useState<SearchScope>("transcripts");

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2EventsInfinite({
        company: ticker,
        limit: 40,
        sort: "-scheduled_at",
        toastErrors: false,
        // Investor days, conferences and AGMs too (badge + title per row).
        type: "all",
    });

    // A company outside the in-house coverage answers 404 `not_covered`.
    const covered = !(error instanceof ApiRequestError && error.code === "not_covered");

    const { past, upcoming } = React.useMemo(() => {
        const all = data?.pages.flatMap(page => page.data) ?? [];

        return {
            past: all.filter(event => !isUpcoming(event, now)),
            // Soonest first (the API answers newest first).
            upcoming: all.filter(event => isUpcoming(event, now)).reverse(),
        };
    }, [data, now]);

    // Until the user picks a tab: Upcoming when the company has a call ahead, else Past.
    const tab: CallsTab = selectedTab ?? (upcoming.length > 0 ? "upcoming" : "past");

    const events = tab === "upcoming" ? upcoming : past;

    const columns = React.useMemo<Array<ColumnDef<V2Event>>>(
        () => [
            {
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <EventLink className="font-medium hover:underline" event={row.original}>
                            {eventLabel(row.original)}
                        </EventLink>
                        <EventTypeBadge event={row.original} />
                    </div>
                ),
                header: "Period",
                id: "fiscal_period",
            },
            {
                cell: ({ row }) => <CallTime event={row.original} />,
                header: "Date / time",
                id: "scheduled_at",
            },
            {
                cell: ({ row }) => <CallStatusBadge event={row.original} />,
                header: "Status",
                id: "status",
            },
            {
                cell: ({ row }) => <span className="tabular-nums whitespace-nowrap">{formatInstant(row.original.started_at)}</span>,
                header: "Started",
                id: "started_at",
            },
            {
                cell: ({ row }) => <span className="tabular-nums whitespace-nowrap">{formatInstant(row.original.ended_at)}</span>,
                header: "Ended",
                id: "ended_at",
            },
            {
                cell: ({ row }) => <AvailabilityIcons event={row.original} />,
                header: "Materials",
                id: "materials",
            },
            {
                cell: ({ row }) => (
                    <EventLink className="text-xs underline-offset-4 hover:underline" event={row.original}>
                        Open
                    </EventLink>
                ),
                header: "",
                id: "link",
            },
        ],
        [],
    );

    const header = (
        <PageHeader
            description={(
                <>
                    The company&apos;s earnings calls and other events (investor days, conferences, shareholder meetings),
                    newest first: transcript, audio, slides, press release and documents per event.
                </>
            )}
            title="Earnings Calls"
        />
    );

    if (error && covered) {
        return (
            <div className="flex flex-col gap-4">
                {header}
                <ErrorState error={error} title="Failed to load earnings calls" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {header}

            {!covered
                ? (
                        <Card className="border-muted-foreground/20" role="status" size="sm">
                            <CardHeader className="gap-2">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">Not covered</Badge>
                                    <CardTitle className="text-sm">No earnings-call data</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="text-muted-foreground">
                                This company is outside the in-house coverage scope; the API returns
                                no earnings-call data for it.
                            </CardContent>
                        </Card>
                    )
                : (
                        <div className="flex flex-col gap-2">
                            {/* Only while this company has an event live; nothing otherwise. */}
                            <LiveNowStrip ticker={ticker} />

                            {/* Company-wide search: transcripts ("Search this call", hits link to their call) or documents. */}
                            <div className="flex flex-col gap-1">
                                <Tabs onValueChange={value => setSearchScope(value as SearchScope)} value={searchScope}>
                                    <TabsList variant="line">
                                        <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
                                        <TabsTrigger value="documents">Documents</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                {searchScope === "transcripts"
                                    ? <AskThisCall scope={{ identifier: ticker, kind: "company" }} />
                                    : <DocumentSearch identifier={ticker} />}
                            </div>

                            <Tabs onValueChange={value => setSelectedTab(value as CallsTab)} value={tab}>
                                <TabsList variant="line">
                                    <TabsTrigger value="upcoming">
                                        Upcoming
                                        {" "}
                                        <span className="text-muted-foreground">{upcoming.length}</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="past">
                                        Past
                                        {" "}
                                        <span className="text-muted-foreground">{past.length}</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <DataTable
                                columns={columns}
                                emptyText={tab === "upcoming" ? "No upcoming calls." : "No past calls."}
                                hasNextPage={hasNextPage}
                                isFetchingNextPage={isFetchingNextPage}
                                isLoading={isLoading}
                                onLoadMore={() => void fetchNextPage()}
                                rows={events}
                            />
                        </div>
                    )}
        </div>
    );
}
