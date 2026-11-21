import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2MarketHoliday, V2MarketHolidaysResponse } from "@/lib/api/types";

import { TabStrip } from "@/components/navigation/tab-strip";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useV2MarketHolidaysInfinite } from "@/lib/api/queries";
import { zonedDate } from "@/lib/earnings/format";
import { DASH, formatDay, formatInstant } from "@/lib/format";
import { titleHead } from "@/lib/layout";

export const Route = createFileRoute("/market-holidays")({
    component: MarketHolidaysPage,
    head: () => titleHead("Market holidays"),
    // `?tab=past`; absent = upcoming.
    validateSearch: (search: Record<string, unknown>): { tab?: "past" } => (search.tab === "past" ? { tab: "past" } : {}),
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
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isLoading}
            onLoadMore={onLoadMore}
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
 * US market holidays (`/v1/market-holidays`): Upcoming (today on, ascending) and Past (newest first). The answer states
 * no exchange (the US aggregate calendar); the status is read from the day's open / close.
 */
function MarketHolidaysPage() {
    const { tab } = Route.useSearch();

    const navigate = Route.useNavigate();

    const [today] = React.useState(() => zonedDate(new Date(), EXCHANGE_TIME_ZONE));

    const past = tab === "past";

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2MarketHolidaysInfinite(
        past ? { dateLte: yesterdayOf(today), limit: 40, sort: "-date" } : { dateGte: today, limit: 40, sort: "date" },
    );

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader
                actions={(
                    <TabStrip
                        aria-label="Holidays"
                        onSelect={value => void navigate({ resetScroll: false, search: value === "past" ? { tab: "past" } : {} })}
                        options={[{ label: "Upcoming", value: "upcoming" }, { label: "Past", value: "past" }]}
                        value={past ? "past" : "upcoming"}
                    />
                )}
                description="US market holidays. The answer names no exchange: one calendar for the US exchanges. A partial day shows its open and close in New York time; any other day is closed all day."
                title="Market holidays"
            />
            <MarketHolidaysView
                error={error}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => void fetchNextPage()}
                pages={data?.pages ?? []}
            />
        </div>
    );
}
