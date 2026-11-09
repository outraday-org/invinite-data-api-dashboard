import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";
import type { CalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useV2EventsInfinite } from "@/lib/api/queries";
import { calendarWindow, eventLabel, isCallToday, SESSION_LABELS } from "@/lib/earnings/format";
import { AvailabilityIcons } from "@/routes/$ticker/earnings-calls/-components/availability-icons";
import { CalendarFilters, matchesCalendarSearch, validateCalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";
import { CalendarCallCell, CalendarReportCell, CalendarStatusBadge } from "@/routes/$ticker/earnings-calls/-components/calendar-semantics";
import { CallStatusBadge } from "@/routes/$ticker/earnings-calls/-components/call-status-badge";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";
import { EventTypeBadge } from "@/routes/$ticker/earnings-calls/-components/event-type-badge";
import { EventVideoLink } from "@/routes/$ticker/earnings-calls/-components/event-video";
import { EventsTable } from "@/routes/$ticker/earnings-calls/-components/events-table";
import { LiveNowStrip } from "@/routes/$ticker/earnings-calls/-components/live-now-strip";
import { WebcastLink } from "@/routes/$ticker/earnings-calls/-components/webcast-link";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

export const Route = createFileRoute("/$ticker/earnings-calendar/")({
    component: EarningsCalendarPage,
    validateSearch: validateCalendarSearch,
});

function EarningsCalendarPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    // Once per mount (lazy initializer: render stays pure); the window follows the URL.
    const [now] = React.useState(() => new Date());

    const range = calendarWindow(search, now);

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2EventsInfinite({
        // The market calendar: no `company`, a New York day window (≤ 92 days without a company).
        dateKind: search.dateKind,
        expand: ["calendar"],
        limit: 50,
        scheduledAtGte: range.from,
        scheduledAtLte: range.to,
        sort: "scheduled_at",
        type: search.eventType,
    });

    // Session and event status have no `/v2/events` parameter: they filter the loaded rows.
    const events = React.useMemo(
        () => (data?.pages.flatMap(page => page.data) ?? []).filter(event => matchesCalendarSearch(event, search)),
        [data, search],
    );

    const columns = React.useMemo<Array<ColumnDef<V2Event>>>(
        () => [
            {
                cell: ({ row }) => <CalendarCallCell event={row.original} />,
                header: "Call",
                id: "scheduled_at",
            },
            {
                cell: ({ row }) => <CalendarReportCell calendar={row.original.calendar} />,
                header: "Report",
                id: "report",
            },
            {
                cell: ({ row }) => (
                    <EventLink className="font-medium hover:underline" event={row.original}>
                        {row.original.symbol}
                    </EventLink>
                ),
                header: "Symbol",
                id: "symbol",
            },
            {
                cell: ({ row }) => <div className="max-w-[220px] truncate">{row.original.company_name}</div>,
                header: "Company",
                id: "company_name",
            },
            {
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        {eventLabel(row.original)}
                        <EventTypeBadge event={row.original} />
                    </div>
                ),
                header: "Period",
                id: "fiscal_period",
            },
            {
                cell: ({ row }) => (row.original.session ? SESSION_LABELS[row.original.session] : "—"),
                header: "Session",
                id: "session",
            },
            {
                cell: ({ row }) => (
                    <div className="flex flex-wrap items-center gap-1">
                        <CallStatusBadge event={row.original} />
                        <CalendarStatusBadge calendar={row.original.calendar} />
                    </div>
                ),
                header: "Status",
                id: "status",
            },
            {
                cell: ({ row }) => (
                    <div className="flex items-center gap-3">
                        <AvailabilityIcons event={row.original} />
                        <WebcastLink url={row.original.webcast_url} />
                        <EventVideoLink event={row.original} />
                    </div>
                ),
                header: "Materials",
                id: "materials",
            },
        ],
        [],
    );

    const onFilterChange = (patch: Partial<CalendarSearch>) => {
        void navigate({ search: prev => ({ ...prev, ...patch }) });
    };

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col shrink-0 gap-3">
                <div className="flex flex-col gap-1">
                    <div>Earnings Calendar</div>
                    <div className="text-muted-foreground text-sm">
                        Calls of all covered US companies by New York call day (at most 92 days at once). Estimated = a
                        vendor or history estimate, unconfirmed = a first-party date without a time, confirmed = a
                        first-party start time. The report (results release) is shown apart from the call: its day and
                        before open / after close come from the results filing&apos;s acceptance. Session and event
                        status filter the loaded rows.
                    </div>
                </div>
                <CalendarFilters
                    from={range.from}
                    onChange={onFilterChange}
                    search={search}
                    to={range.to}
                />
            </div>

            <LiveNowStrip />

            {error
                ? <ErrorState error={error} title="Failed to load the earnings calendar" />
                : (
                        <div className="flex flex-col h-0 grow">
                            <ScrollArea className="h-0 grow">
                                <EventsTable
                                    columns={columns}
                                    events={events}
                                    isLoading={isLoading}
                                    rowClassName={event => (isCallToday(event, now) ? "bg-muted/30" : undefined)}
                                />

                                <LoadMoreButton
                                    hasNextPage={Boolean(hasNextPage)}
                                    isFetchingNextPage={isFetchingNextPage}
                                    onLoadMore={() => fetchNextPage()}
                                />

                                {!isLoading && events.length === 0 && (
                                    <div className="text-muted-foreground w-full text-center text-xs p-2">
                                        {hasNextPage ? "No matching calls loaded yet." : "No calls in this window."}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    )}
        </div>
    );
}
