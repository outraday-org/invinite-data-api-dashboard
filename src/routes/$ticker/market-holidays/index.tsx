import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { V2MarketHoliday } from "@/lib/api/types";

import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useV2MarketHolidaysInfinite } from "@/lib/api/queries";
import { DASH, formatDay, formatInstant } from "@/lib/format";
import { titleHead } from "@/lib/layout";

export const Route = createFileRoute("/$ticker/market-holidays/")({
    component: MarketHolidaysPage,
    head: () => titleHead("Market Holidays"),
});

/** A partial day's open / close; a day closed all day has neither ("Closed"). */
const sessionTime = (holiday: V2MarketHoliday, value: null | string) => {
    if (value) return formatInstant(value);

    return holiday.start_time || holiday.end_time ? DASH : "Closed";
};

const COLUMNS: Array<ColumnDef<V2MarketHoliday>> = [
    { cell: ({ row }) => formatDay(row.original.day), header: "Date", id: "day" },
    { cell: ({ row }) => row.original.event_name.trim() || DASH, header: "Holiday", id: "event_name" },
    { cell: ({ row }) => sessionTime(row.original, row.original.start_time), header: "Open", id: "start_time" },
    { cell: ({ row }) => sessionTime(row.original, row.original.end_time), header: "Close", id: "end_time" },
];

function MarketHolidaysPage() {
    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useV2MarketHolidaysInfinite({
        limit: 40,
        sort: "-date",
    });

    const holidays = React.useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                description="US market holidays, future to past. A partial day shows its open and close; any other day is closed all day."
                title="Market Holidays"
            />
            <DataTable
                columns={COLUMNS}
                emptyText="No market holidays available."
                errorState={error ? <ErrorState error={error} title="Failed to load market holidays" /> : null}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={() => void fetchNextPage()}
                rows={holidays}
            />
        </div>
    );
}
