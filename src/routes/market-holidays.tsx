import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2MarketHoliday, V2MarketHolidaysResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useV2MarketHolidaysInfinite } from "@/lib/api/queries";
import { zonedDate } from "@/lib/earnings/format";
import { DASH, formatDay, formatInstant } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalDay, orderedWindow } from "@/lib/url-state";

/** `?tab=past` (absent = upcoming); `?from=&to=` = a day range inside the tab (`date.gte` / `.lte`). */
const holidaysSearchSchema = z.object({
    from: optionalDay(),
    tab: z.literal("past").optional().catch(undefined),
    to: optionalDay(),
});

export type HolidaysSearch = z.infer<typeof holidaysSearchSchema>;

export const Route = createFileRoute("/market-holidays")({
    component: MarketHolidaysPage,
    head: () => titleHead("Market holidays"),
    validateSearch: holidaysSearchSchema,
});

/** The US exchanges' clock: a partial day's open / close reads in New York time ("1:00 PM EST"), not the viewer's zone. */
const EXCHANGE_TIME_ZONE = "America/New_York";

/** A partial day's open / close; a day closed all day has neither ("Closed"). */
const sessionTime = (holiday: V2MarketHoliday, value: null | string) => {
    if (value) return formatInstant(value, EXCHANGE_TIME_ZONE);

    return holiday.start_time || holiday.end_time ? DASH : "Closed";
};

/** "Early close" for a partial day (the answer states its open / close), else "Closed". */
export const holidayStatus = (holiday: Pick<V2MarketHoliday, "end_time" | "start_time">) =>
    (holiday.start_time || holiday.end_time ? "Early close" : "Closed");

const COLUMNS: Array<ColumnDef<V2MarketHoliday>> = [
    { cell: ({ row }) => formatDay(row.original.day), header: "Date", id: "day" },
    { cell: ({ row }) => row.original.event_name.trim() || DASH, header: "Holiday", id: "event_name" },
    {
        cell: ({ row }) => {
            const status = holidayStatus(row.original);

            return <Badge variant={status === "Closed" ? "secondary" : "outline"}>{status}</Badge>;
        },
        header: "Status",
        id: "status",
    },
    { cell: ({ row }) => sessionTime(row.original, row.original.start_time), header: "Open", id: "start_time" },
    { cell: ({ row }) => sessionTime(row.original, row.original.end_time), header: "Close", id: "end_time" },
];

/** The holidays list (pure). */
export function MarketHolidaysView({ error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages }: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2MarketHolidaysResponse>;
}) {
    const holidays = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    return (
        <DataTable
            columns={COLUMNS}
            emptyText="No market holidays in this list."
            errorState={error ? <ErrorState error={error} title="Failed to load market holidays" /> : null}
            exportConfig={{ dataset: "market-holidays", scope: "us" }}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isLoading}
            onLoadMore={onLoadMore}
            operationId="listMarketHolidays"
            rows={holidays}
        />
    );
}

/** Yesterday's New York day (`YYYY-MM-DD`): the last day of the Past tab. */
const yesterdayOf = (today: string) => {
    const at = new Date(`${today}T00:00:00Z`);

    at.setUTCDate(at.getUTCDate() - 1);

    return at.toISOString().slice(0, 10);
};

/**
 * The request of a search state (pure): Upcoming = from today (or the later "from") on, ascending; Past = up to
 * yesterday (or the earlier "to"), newest first. The range narrows the tab, never leaves it.
 */
export function holidaysRequest(search: HolidaysSearch, today: string) {
    const { from, to } = orderedWindow({ from: search.from, to: search.to });

    const later = (a: string, b: string | undefined) => (b && b > a ? b : a);

    const earlier = (a: string, b: string | undefined) => (b && b < a ? b : a);

    if (search.tab === "past") return { dateGte: from, dateLte: earlier(yesterdayOf(today), to), limit: 40, sort: "-date" as const };

    return { dateGte: later(today, from), dateLte: to, limit: 40, sort: "date" as const };
}

/**
 * US market holidays (`/v1/market-holidays`): Upcoming (today on, ascending) and Past (newest first). The answer states
 * no exchange (the US aggregate calendar); the status is read from the day's open / close.
 */
function MarketHolidaysPage() {
    const search = Route.useSearch();

    const { tab } = search;

    const navigate = Route.useNavigate();

    const [today] = React.useState(() => zonedDate(new Date(), EXCHANGE_TIME_ZONE));

    const past = tab === "past";

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2MarketHolidaysInfinite(holidaysRequest(search, today));

    const onRange = (patch: Pick<HolidaysSearch, "from" | "to">) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    return (
        <PageContainer>
            <PageHeader
                description="US market holidays. The answer names no exchange: one calendar for the US exchanges. A partial day shows its open and close in New York time; any other day is closed all day."
                title="Market holidays"
            />
            <Tabs
                // A tab change keeps the day range (it narrows either tab).
                onValueChange={value => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, tab: value === "past" ? "past" : undefined }) })}
                value={past ? "past" : "upcoming"}
            >
                <TabsList aria-label="Holidays" variant="line">
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="past">Past</TabsTrigger>
                </TabsList>
            </Tabs>
            <FilterBar activeCount={search.from ?? search.to ? 1 : 0} onReset={() => onRange({ from: undefined, to: undefined })}>
                <FilterField label="Date" span={2}>
                    <DayRange from={search.from} labels={{ from: "Holidays from", to: "Holidays to" }} onChange={onRange} to={search.to} />
                </FilterField>
            </FilterBar>
            <MarketHolidaysView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => void fetchNextPage()}
                pages={data?.pages ?? []}
            />
        </PageContainer>
    );
}
