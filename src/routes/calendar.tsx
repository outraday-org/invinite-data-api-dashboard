import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";
import type { CalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useV2EventsInfinite } from "@/lib/api/queries";
import { FILL_PAGES_MAX, useAutoLoadPages } from "@/lib/api/use-auto-load-pages";
import { addDays, callDayIn, dayHeading, groupEventsByDay, todayIn, viewerTimeZone, weekDaysOf } from "@/lib/earnings/calendar-groups";
import { calendarWindow, eventLabel, SESSION_LABELS } from "@/lib/earnings/format";
import { titleHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";
import { AvailabilityIcons } from "@/routes/$ticker/earnings-calls/-components/availability-icons";
import { CalendarFilters, matchesCalendarSearch, validateCalendarSearch } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";
import { CalendarDayCell, CalendarRowStatus, CalendarTimeCell } from "@/routes/$ticker/earnings-calls/-components/calendar-semantics";
import { CalendarWeekStrip } from "@/routes/$ticker/earnings-calls/-components/calendar-week-strip";
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

/** Events per page of `/v1/events` (every page is billed; the API's maximum, so a week takes one or two pages). */
const CALENDAR_PAGE = 200;

/** A call page's path (a ⌘ / Ctrl click on a row opens it in a new tab). */
const callPath = (event: Pick<V2Event, "event_id" | "symbol">) => `/${encodeURIComponent(event.symbol)}/earnings-calls/${encodeURIComponent(event.event_id)}`;

const COLUMNS: Array<ColumnDef<V2Event>> = [
    { cell: ({ row }) => <CalendarDayCell event={row.original} />, header: "Day", id: "scheduled_at" },
    { cell: ({ row }) => <CalendarTimeCell event={row.original} />, header: "Time", id: "time" },
    {
        cell: ({ row }) => (
            <EventLink className="hover-fill font-medium" event={row.original}>
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
    /** A click on a row (anywhere but its links / buttons) opens the call. */
    onOpenEvent?: (event: V2Event, newTab: boolean) => void;
    /** The zone the rows are grouped by day in (the page: the viewer's). */
    timeZone: string;
};

/**
 * The calendar's rows (pure): grouped by New York day under sticky day headings with the day's count ("12 calls"),
 * today's rows tinted. A client-side filter (session, event status) that found nothing in the pages it loaded by itself
 * says so and leaves "Load more" to the reader (every page is billed).
 */
export function CalendarView({ capped, error, events, filtering, hasNextPage, isFetchingNextPage, isLoading, now, onLoadMore, onOpenEvent, timeZone }: CalendarViewProps) {
    const searching = filtering && events.length === 0 && hasNextPage && !capped;

    // `DataTable` groups consecutive rows: a date-only event (`scheduled_at` = its day's UTC midnight, the evening before
    // in New York) arrives before the previous day's late calls, so the rows are put in day order first.
    const dayOrdered = React.useMemo(() => groupEventsByDay(events, timeZone).flatMap(group => group.events), [events, timeZone]);

    const today = todayIn(now, timeZone);

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
                groupOf={event => callDayIn(event, timeZone)}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading || searching}
                onLoadMore={onLoadMore}
                onRowClick={onOpenEvent ? (event, click) => onOpenEvent(event, click.metaKey || click.ctrlKey) : undefined}
                rowClassName={event => (callDayIn(event, timeZone) === today ? "bg-muted/30" : undefined)}
                rows={dayOrdered}
            />
        </div>
    );
}

/**
 * One window of `/v1/events` with the page's filters: its events through the client-side filters, the calls per New
 * York day, and (`autoLoad`) every page loaded by itself, at most `FILL_PAGES_MAX`.
 */
function useCalendarEvents(search: CalendarSearch, window: { from: string; to: string }, { autoLoad, enabled = true, timeZone }: { autoLoad: boolean; enabled?: boolean; timeZone: string }) {
    const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, isLoading } = useV2EventsInfinite({
        company: search.company,
        dateKind: search.dateKind,
        enabled,
        expand: ["calendar"],
        fiscalQuarter: search.fiscalQuarter,
        fiscalYear: search.fiscalYear,
        limit: CALENDAR_PAGE,
        scheduledAtGte: window.from,
        scheduledAtLte: window.to,
        sort: "scheduled_at",
        status: search.status ? [search.status] : undefined,
        toastErrors: false,
        type: search.eventType,
    });

    const pages = React.useMemo(() => data?.pages ?? [], [data]);

    const matching = React.useMemo(
        () => pages.flatMap(page => page.data).filter(event => matchesCalendarSearch(event, search)),
        [pages, search],
    );

    const counts = React.useMemo(() => {
        const byDay = new Map<string, number>();

        for (const event of matching) byDay.set(callDayIn(event, timeZone), (byDay.get(callDayIn(event, timeZone)) ?? 0) + 1);

        return byDay;
    }, [matching, timeZone]);

    const query = { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, pageCount: pages.length };

    useAutoLoadPages(query, { enabled: enabled && autoLoad, max: FILL_PAGES_MAX });

    return { counts, error, isFetchingNextPage, isLoading, matching, query };
}

/**
 * The market earnings calendar (`/v1/events`, `expand=calendar`): every covered US company's calls, by day in the
 * viewer's timezone (days, today and times; the request window is padded a day each side).
 * The week strip picks a day (`?day=`, default today): the table's request window is that day's Monday … Sunday (every
 * page loads by itself, ≤ 10 pages of 200) and the table shows the picked day. Previous / next week set `?week=` only:
 * the strip asks that week for its day counts, the table keeps the picked day. A custom
 * day range (`?from=&to=`, under "More filters") replaces the strip and lists the range grouped by day. The filters the
 * API has a parameter for (`company`, `type`, `status`, `date_kind`, `fiscal_year`, `fiscal_quarter`) go to the
 * request; session and event status filter the loaded rows. A row opens its call.
 */
function CalendarPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    // Once per mount (lazy initializer: render stays pure); the window follows the URL.
    const [now] = React.useState(() => new Date());

    // The viewer's zone: days, today and every time on the page are the viewer's (owner, 2026-11-25).
    const [timeZone] = React.useState(viewerTimeZone);

    const today = todayIn(now, timeZone);

    const customRange = search.from !== undefined || search.to !== undefined;

    const day = search.day ?? today;

    const dayWeek = weekDaysOf(day);

    const shownWeek = weekDaysOf(search.week ?? day);

    // The table's window: the selected day's week (or the custom range); the strip's: the week it shows. The same week =
    // the same query (one request).
    // The request takes days (`scheduled_at.gte|lte`): a day more on each side holds every call of the week's local days
    // in any zone; the rows are then picked by their local day.
    const rowsWindow = customRange ? calendarWindow(search, now) : { from: addDays(dayWeek[0], -1), to: addDays(dayWeek[6], 1) };

    const rows = useCalendarEvents(search, rowsWindow, { autoLoad: !customRange, timeZone });

    const strip = useCalendarEvents(search, { from: addDays(shownWeek[0], -1), to: addDays(shownWeek[6], 1) }, {
        autoLoad: shownWeek[0] !== dayWeek[0] || customRange,
        enabled: !customRange,
        timeZone,
    });

    const events = customRange ? rows.matching : rows.matching.filter(event => callDayIn(event, timeZone) === day);

    const clientFiltered = Boolean(search.session || search.calendarStatus);

    // A custom range loads further pages by itself only while a client-side filter shows nothing, then "Load more".
    const { capped } = useAutoLoadPages(rows.query, {
        enabled: customRange && clientFiltered && events.length === 0,
        max: FILL_PAGES_MAX,
        resetKey: JSON.stringify(search),
    });

    const onFilterChange = (patch: Partial<CalendarSearch>) => {
        void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });
    };

    const onOpenEvent = (event: V2Event, newTab: boolean) => {
        if (newTab) {
            window.open(callPath(event), "_blank", "noopener");

            return;
        }

        void navigate({ params: { eventId: event.event_id, ticker: event.symbol }, to: "/$ticker/earnings-calls/$eventId" });
    };

    return (
        <PageContainer>
            <PageHeader
                description={(
                    <>
                        Calls of all covered US companies by day; days and times are in your timezone. Pick a day of the week; a row
                        opens its call.
                        Estimated = a vendor or history estimate, unconfirmed = a first-party date without a time, confirmed =
                        a first-party start time. The report (results release) is shown apart from the call.
                    </>
                )}
                title="Earnings calendar"
            />
            {customRange
                ? (
                        <Notice
                            action={(
                                <Button onClick={() => onFilterChange({ from: undefined, to: undefined })} size="sm" type="button" variant="outline">
                                    Back to the week
                                </Button>
                            )}
                            badge="Custom days"
                            title={`${dayHeading(rowsWindow.from)} – ${dayHeading(rowsWindow.to)}`}
                        >
                            A custom day range (at most 92 days) instead of the week strip.
                        </Notice>
                    )
                : (
                        <CalendarWeekStrip
                            counts={strip.isLoading ? null : strip.counts}
                            countsPartial={strip.query.hasNextPage}
                            day={day}
                            onSelectDay={next => onFilterChange({ day: next === today ? undefined : next, week: undefined })}
                            onShowWeek={monday => onFilterChange({ week: weekDaysOf(monday)[0] === dayWeek[0] ? undefined : monday })}
                            today={today}
                            weekOf={shownWeek[0]}
                        />
                    )}
            <CalendarFilters onChange={onFilterChange} search={search} />
            <LiveNowStrip />
            <CalendarView
                capped={capped}
                error={rows.error}
                events={events}
                filtering={!customRange || clientFiltered}
                hasNextPage={rows.query.hasNextPage}
                isFetchingNextPage={rows.isFetchingNextPage}
                isLoading={rows.isLoading}
                now={now}
                onLoadMore={() => void rows.query.fetchNextPage()}
                onOpenEvent={onOpenEvent}
                timeZone={timeZone}
            />
        </PageContainer>
    );
}
