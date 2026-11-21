import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2Event } from "@/lib/api/types";

import { CopyButton } from "@/components/ui/copy-button";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiRequestError } from "@/lib/api/errors";
import { useV2EventsInfinite } from "@/lib/api/queries";
import { eventLabel, formatInstant, isUpcoming } from "@/lib/earnings/format";
import { tickerHead } from "@/lib/layout";
import { IN_PLACE, optionalEnum } from "@/lib/url-state";
import { DocumentSearch } from "@/routes/$ticker/documents/-components/document-search";

import { AskThisCall } from "./-components/ask-this-call";
import { AvailabilityIcons } from "./-components/availability-icons";
import { FilterSelect } from "./-components/calendar-filters";
import { CallStatusBadge } from "./-components/call-status-badge";
import { CallTime } from "./-components/call-time";
import { EventLink } from "./-components/event-link";
import { EventTypeBadge } from "./-components/event-type-badge";
import { LiveNowStrip } from "./-components/live-now-strip";

/** `?fiscalYear=`, `?tab=upcoming|past` (default: Upcoming when a call is ahead), `?search=documents` (default transcripts). */
const callsSearchSchema = z.object({
    fiscalYear: z.coerce.number().int().min(1900).max(2200).optional().catch(undefined),
    search: optionalEnum(["documents"]),
    tab: optionalEnum(["upcoming", "past"]),
});

export const Route = createFileRoute("/$ticker/earnings-calls/")({
    component: EarningsCallsPage,
    head: ({ params }) => tickerHead(params.ticker, "Earnings Calls"),
    validateSearch: callsSearchSchema,
});

/** A tab's count: "40+" while the list has a next page (the API has no totals). */
export const loadedCount = (count: number, hasMore: boolean) => `${count}${hasMore ? "+" : ""}`;

/**
 * The tab counts of a newest-first list: further pages hold only older calls, so the upcoming count is complete once a
 * past call is loaded ("3", not "3+"); the past count is "40+" while a next page exists.
 */
export function callTabCounts(upcoming: number, past: number, hasNextPage: boolean) {
    return { past: loadedCount(past, hasNextPage), upcoming: loadedCount(upcoming, hasNextPage && past === 0) };
}

/** The columns of a tab: an upcoming call has not started or ended, so the Upcoming tab has no such columns. */
export function columnsForTab<T extends { id?: string }>(columns: ReadonlyArray<T>, tab: "past" | "upcoming"): Array<T> {
    return tab === "upcoming" ? columns.filter(column => column.id !== "started_at" && column.id !== "ended_at") : [...columns];
}

/** The fiscal years of the picker: the next one and the eight before it. */
const fiscalYearOptions = (now: Date) => {
    const next = now.getUTCFullYear() + 1;

    return [{ label: "Any fiscal year", value: "all" }, ...Array.from({ length: 9 }, (_, index) => ({ label: `FY${next - index}`, value: String(next - index) }))];
};

type CallsTab = "past" | "upcoming";

/** What the company search box searches: call transcripts / slides, or company-published documents. */
type SearchScope = "documents" | "transcripts";

function EarningsCallsPage() {
    const { ticker } = Route.useParams();

    const { fiscalYear } = Route.useSearch();

    const navigate = Route.useNavigate();

    // Once per mount (lazy initializer: render stays pure).
    const [now] = React.useState(() => new Date());

    const search = Route.useSearch();

    const selectedTab: CallsTab | null = search.tab ?? null;

    const searchScope: SearchScope = search.search ?? "transcripts";

    const setSearch = (patch: Partial<typeof search>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useV2EventsInfinite({
        company: ticker,
        fiscalYear,
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
    const counts = callTabCounts(upcoming.length, past.length, hasNextPage);

    const tab: CallsTab = selectedTab ?? (upcoming.length > 0 ? "upcoming" : "past");

    const events = tab === "upcoming" ? upcoming : past;

    const yearOptions = React.useMemo(() => fiscalYearOptions(now), [now]);

    const columns = React.useMemo<Array<ColumnDef<V2Event>>>(
        () => [
            {
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <EventLink className="font-medium hover:underline" event={row.original}>
                            {eventLabel(row.original)}
                        </EventLink>
                        <EventTypeBadge event={row.original} />
                        <CopyButton label="Copy event id" value={row.original.event_id} />
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

    const shownColumns = React.useMemo(() => columnsForTab(columns, tab), [columns, tab]);

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
                        <Notice badge="Not covered" title="No earnings-call data">
                            This company is outside the in-house coverage scope; the API returns no earnings-call data for it.
                        </Notice>
                    )
                : (
                        <div className="flex flex-col gap-2">
                            {/* Only while this company has an event live; nothing otherwise. */}
                            <LiveNowStrip ticker={ticker} />

                            {/* Company-wide search: transcripts ("Search this call", hits link to their call) or documents. */}
                            <div className="flex flex-col gap-1">
                                <Tabs onValueChange={value => setSearch({ search: value === "documents" ? "documents" : undefined })} value={searchScope}>
                                    <TabsList variant="line">
                                        <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
                                        <TabsTrigger value="documents">Documents</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                {searchScope === "transcripts"
                                    ? <AskThisCall scope={{ identifier: ticker, kind: "company" }} />
                                    : <DocumentSearch identifier={ticker} />}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Tabs onValueChange={value => setSearch({ tab: value as CallsTab })} value={tab}>
                                    <TabsList variant="line">
                                        <TabsTrigger value="upcoming">
                                            Upcoming
                                            {" "}
                                            <span className="text-muted-foreground">{counts.upcoming}</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="past">
                                            Past
                                            {" "}
                                            <span className="text-muted-foreground">{counts.past}</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <FilterSelect
                                    aria-label="Fiscal year"
                                    className="w-[150px]"
                                    onValueChange={value => setSearch({ fiscalYear: value === "all" ? undefined : Number(value) })}
                                    options={yearOptions}
                                    value={fiscalYear ? String(fiscalYear) : "all"}
                                />
                            </div>

                            <DataTable
                                columns={shownColumns}
                                emptyText={tab === "upcoming" ? "No upcoming calls." : "No past calls."}
                                exportConfig={{ dataset: `calls-${tab}`, scope: ticker }}
                                hasNextPage={hasNextPage}
                                isFetchingNextPage={isFetchingNextPage}
                                isLoading={isLoading}
                                onLoadMore={() => void fetchNextPage()}
                                operationId="listEvents"
                                rows={events}
                            />
                        </div>
                    )}
        </div>
    );
}
