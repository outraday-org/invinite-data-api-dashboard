import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";
import type { CalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useV2EventsInfinite } from "@/lib/api/queries";
import { calendarWindow, eventLabel, isCallToday, SESSION_LABELS } from "@/lib/earnings/format";
import { titleHead } from "@/lib/layout";
import { AvailabilityIcons } from "@/routes/$ticker/earnings-calls/-components/availability-icons";
import { CalendarFilters, matchesCalendarSearch, validateCalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";
import { CalendarCallCell, CalendarReportCell, CalendarRowStatus } from "@/routes/$ticker/earnings-calls/-components/calendar-semantics";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";
import { EventTypeBadge } from "@/routes/$ticker/earnings-calls/-components/event-type-badge";
import { EventVideoLink } from "@/routes/$ticker/earnings-calls/-components/event-video";
import { LiveNowStrip } from "@/routes/$ticker/earnings-calls/-components/live-now-strip";
import { WebcastLink } from "@/routes/$ticker/earnings-calls/-components/webcast-link";

export const Route = createFileRoute("/$ticker/earnings-calendar/")({
    component: EarningsCalendarPage,
    head: () => titleHead("Earnings Calendar"),
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
        toastErrors: false,
        type: search.eventType,
    });

    // Session and event status have no `/v1/events` parameter: they filter the loaded rows.
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
                cell: ({ row }) => <CalendarRowStatus event={row.original} />,
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
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
                <PageHeader
                    description={(
                        <>
                            Calls of all covered US companies by New York call day (at most 92 days at once). Estimated = a
                            vendor or history estimate, unconfirmed = a first-party date without a time, confirmed = a
                            first-party start time. The report (results release) is shown apart from the call: its day and
                            before open / after close come from the results filing&apos;s acceptance. Session and event
                            status filter the loaded rows.
                        </>
                    )}
                    title="Earnings Calendar"
                />
                <CalendarFilters
                    from={range.from}
                    onChange={onFilterChange}
                    search={search}
                    to={range.to}
                />
            </div>

            <LiveNowStrip />

            <DataTable
                columns={columns}
                emptyText={hasNextPage ? "No matching calls loaded yet." : "No calls in this window."}
                errorState={error ? <ErrorState error={error} title="Failed to load the earnings calendar" /> : null}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => void fetchNextPage()}
                rowClassName={event => (isCallToday(event, now) ? "bg-muted/30" : undefined)}
                rows={events}
            />
        </div>
    );
}
