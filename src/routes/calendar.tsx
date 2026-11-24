import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";
import type { CalendarPreset } from "@/lib/earnings/calendar-groups";
import type { CalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import { TabStrip } from "@/components/navigation/tab-strip";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useV2EventsInfinite } from "@/lib/api/queries";
import { FILL_PAGES_MAX, useAutoLoadPages } from "@/lib/api/use-auto-load-pages";
import { calendarPresetWindow, dayHeading, groupEventsByNewYorkDay, newYorkCallDay, presetOf } from "@/lib/earnings/calendar-groups";
import { calendarWindow, eventLabel, isCallToday, SESSION_LABELS } from "@/lib/earnings/format";
import { titleHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";
import { AvailabilityIcons } from "@/routes/$ticker/earnings-calls/-components/availability-icons";
import { CalendarFilters, matchesCalendarSearch, validateCalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";
import { CalendarCallCell, CalendarReportCell, CalendarRowStatus } from "@/routes/$ticker/earnings-calls/-components/calendar-semantics";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";
import { EventTypeBadge } from "@/routes/$ticker/earnings-calls/-components/event-type-badge";
import { EventVideoLink } from "@/routes/$ticker/earnings-calls/-components/event-video";
import { LiveNowStrip } from "@/routes/$ticker/earnings-calls/-components/live-now-strip";
import { WebcastLink } from "@/routes/$ticker/earnings-calls/-components/webcast-link";

export const Route = createFileRoute("/calendar")({
    component: CalendarPage,
    head: () => titleHead("Earnings calendar"),
    validateSearch: validateCalendarSearch,
});

/** Events per page of `/v1/events` (every page is billed). */
const CALENDAR_PAGE = 50;

const PRESET_OPTIONS: Array<{ label: string; value: "custom" | CalendarPreset }> = [
    { label: "Today", value: "today" },
    { label: "This week", value: "this-week" },
    { label: "Next week", value: "next-week" },
];

const COLUMNS: Array<ColumnDef<V2Event>> = [
    { cell: ({ row }) => <CalendarCallCell event={row.original} />, header: "Call", id: "scheduled_at" },
    { cell: ({ row }) => <CalendarReportCell calendar={row.original.calendar} />, header: "Report", id: "report" },
    {
        cell: ({ row }) => (
            <EventLink className="font-medium hover:underline" event={row.original}>
                {row.original.symbol}
            </EventLink>
        ),
        header: "Symbol",
        id: "symbol",
    },
    { cell: ({ row }) => <div className="max-w-[180px] truncate">{row.original.company_name}</div>, header: "Company", id: "company_name" },
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
    { cell: ({ row }) => (row.original.session ? SESSION_LABELS[row.original.session] : "—"), header: "Session", id: "session" },
    { cell: ({ row }) => <CalendarRowStatus event={row.original} />, header: "Status", id: "status" },
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
];

export type CalendarViewProps = {
    capped: boolean;
    error: unknown;
    events: Array<V2Event>;
    filtering: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    now: Date;
    onLoadMore: () => void;
};

/**
 * The calendar's rows (pure): grouped by New York day under sticky day headings with the day's count ("12 calls"),
 * today's rows tinted. A client-side filter (session, event status) that found nothing in the pages it loaded by itself
 * says so and leaves "Load more" to the reader (every page is billed).
 */
export function CalendarView({ capped, error, events, filtering, hasNextPage, isFetchingNextPage, isLoading, now, onLoadMore }: CalendarViewProps) {
    const searching = filtering && events.length === 0 && hasNextPage && !capped;

    // `DataTable` groups consecutive rows: a date-only event (`scheduled_at` = its day's UTC midnight, the evening before
    // in New York) arrives before the previous day's late calls, so the rows are put in day order first.
    const dayOrdered = React.useMemo(() => groupEventsByNewYorkDay(events).flatMap(group => group.events), [events]);

    return (
        <div className="flex flex-col gap-2">
            {capped && (
                <Notice badge="Filtered" title="No call in the pages loaded so far matches the session / event status filter.">
                    Ten pages were checked; load more to keep looking further in the window.
                </Notice>
            )}
            <DataTable
                columns={COLUMNS}
                emptyIsGenuine={!searching && !capped}
                emptyText="No calls in this window."
                errorState={error ? <ErrorState error={error} title="Failed to load the earnings calendar" /> : null}
                groupHeading={(day, rows) => (
                    <span className="flex items-baseline gap-2 text-sm font-semibold">
                        {dayHeading(day)}
                        <span className="text-muted-foreground text-xs font-normal tabular-nums">{`${rows.length} ${rows.length === 1 ? "call" : "calls"}${hasNextPage ? " loaded" : ""}`}</span>
                    </span>
                )}
                groupOf={newYorkCallDay}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading || searching}
                onLoadMore={onLoadMore}
                rowClassName={event => (isCallToday(event, now) ? "bg-muted/30" : undefined)}
                rows={dayOrdered}
            />
        </div>
    );
}

/**
 * The market earnings calendar (`/v1/events`, `expand=calendar`): every covered US company's calls in a New York day
 * window (≤ 92 days), grouped by day. Presets Today / This week / Next week; the filters the API has a parameter for
 * (`company`, `type`, `status`, `date_kind`, `fiscal_year`, `fiscal_quarter`) go to the request, session and event status
 * filter the loaded rows and load further pages by themselves (at most 10 per change, then "Load more").
 */
function CalendarPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    // Once per mount (lazy initializer: render stays pure); the window follows the URL.
    const [now] = React.useState(() => new Date());

    const range = calendarWindow(search, now);

    const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, isLoading } = useV2EventsInfinite({
        company: search.company,
        dateKind: search.dateKind,
        expand: ["calendar"],
        fiscalQuarter: search.fiscalQuarter,
        fiscalYear: search.fiscalYear,
        limit: CALENDAR_PAGE,
        scheduledAtGte: range.from,
        scheduledAtLte: range.to,
        sort: "scheduled_at",
        status: search.status ? [search.status] : undefined,
        toastErrors: false,
        type: search.eventType,
    });

    const pages = React.useMemo(() => data?.pages ?? [], [data]);

    const events = React.useMemo(
        () => pages.flatMap(page => page.data).filter(event => matchesCalendarSearch(event, search)),
        [pages, search],
    );

    const filtering = Boolean(search.session || search.calendarStatus);

    // A client-side filter that shows nothing loads ≤ FILL_PAGES_MAX pages per filter change by itself; then "Load more".
    const { capped } = useAutoLoadPages(
        { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, pageCount: pages.length },
        { enabled: filtering && events.length === 0, max: FILL_PAGES_MAX, resetKey: JSON.stringify(search) },
    );

    const onFilterChange = (patch: Partial<CalendarSearch>) => {
        void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });
    };

    const preset = presetOf(range, now);

    return (
        <PageContainer>
            <PageHeader
                description={(
                    <>
                        Calls of all covered US companies by New York call day (at most 92 days at once). Estimated = a vendor or
                        history estimate, unconfirmed = a first-party date without a time, confirmed = a first-party start time.
                        The report (results release) is shown apart from the call. Session and event status filter the loaded
                        rows.
                    </>
                )}
                title="Earnings calendar"
            />
            {/* The window: presets beside the day inputs (not a filter: "Reset filters" keeps it). */}
            <div aria-label="Window" className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group">
                <TabStrip
                    aria-label="Window preset"
                    onSelect={value => onFilterChange(value === "custom" ? {} : calendarPresetWindow(value, now))}
                    options={preset ? PRESET_OPTIONS : [...PRESET_OPTIONS, { label: "Custom", value: "custom" }]}
                    value={preset ?? "custom"}
                />
                <DayRange from={range.from} labels={{ from: "From", to: "To" }} onChange={onFilterChange} to={range.to} />
                {(search.from || search.to) && (
                    <Button onClick={() => onFilterChange({ from: undefined, to: undefined })} size="sm" type="button" variant="ghost">
                        Default window
                    </Button>
                )}
            </div>
            <CalendarFilters onChange={onFilterChange} search={search} />
            <LiveNowStrip />
            <CalendarView
                capped={capped}
                error={error}
                events={events}
                filtering={filtering}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                now={now}
                onLoadMore={() => void fetchNextPage()}
            />
        </PageContainer>
    );
}
