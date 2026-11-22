import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";

import type { TestTracking } from "@/lib/alerts/destinations";
import type { DestinationDeliveriesResponse, DestinationDelivery, DestinationDeliveryStatus } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { DeliveryStatusBadge } from "@/components/alerts/destination-parts";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Notice } from "@/components/ui/notice";
import { deliveriesWithStatus, DELIVERY_STATUS_INFO, DELIVERY_STATUSES, deliveryErrorInfo, TEST_POLL_MS, TEST_WATCH_MS } from "@/lib/alerts/destinations";
import { formatInstant, formatNumber } from "@/lib/format";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export type DeliveriesListState = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<DestinationDeliveriesResponse>;
};

const ALL = "all";

const STATUS_OPTIONS: Array<{ label: string; value: DestinationDeliveryStatus | typeof ALL }> = [
    { label: "Every status", value: ALL },
    ...DELIVERY_STATUSES.map(status => ({ label: DELIVERY_STATUS_INFO[status].label, value: status })),
];

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

/** How many loaded deliveries share each batch id (the rows of one `alert.fired.batch`). */
export function batchSizes(rows: ReadonlyArray<DestinationDelivery>): ReadonlyMap<string, number> {
    const sizes = new Map<string, number>();

    for (const row of rows) {
        if (row.batch_id) sizes.set(row.batch_id, (sizes.get(row.batch_id) ?? 0) + 1);
    }

    return sizes;
}

const columnsOf = (sizes: ReadonlyMap<string, number>): Array<ColumnDef<DestinationDelivery>> => [
    { cell: ({ row }) => <DeliveryStatusBadge status={row.original.status} />, header: "Status", id: "status" },
    {
        cell: ({ row }) => (
            <div className="flex min-w-0 flex-col">
                <Link className="font-mono underline-offset-4 hover:underline" search={{ event: row.original.event_id }} to="/alerts/events">{row.original.event_id}</Link>
                <span className="font-mono text-muted-foreground">{row.original.id}</span>
            </div>
        ),
        header: "Event · delivery",
        id: "event",
    },
    {
        cell: ({ row }) => {
            const batch = row.original.batch_id;

            if (!batch) return muted("—");

            const size = sizes.get(batch) ?? 1;

            return <span className="font-mono" title={`${size} loaded deliver${size === 1 ? "y" : "ies"} in this batch`}>{size > 1 ? `${batch} (${size})` : batch}</span>;
        },
        header: "Batch",
        id: "batch",
    },
    { cell: ({ row }) => <div className="text-right tabular-nums">{formatNumber(row.original.attempts)}</div>, header: () => <div className="text-right">Attempts</div>, id: "attempts" },
    { cell: ({ row }) => (row.original.last_status === null ? muted("—") : <span className="tabular-nums">{`HTTP ${row.original.last_status}`}</span>), header: "Last answer", id: "last_status" },
    {
        cell: ({ row }) => {
            const info = deliveryErrorInfo(row.original.last_error);

            return info ? <span className="break-words text-destructive" title={info.meaning}>{info.label}</span> : muted("—");
        },
        header: "Last error",
        id: "last_error",
    },
    { cell: ({ row }) => (row.original.duration_ms === null ? muted("—") : <span className="tabular-nums">{`${formatNumber(row.original.duration_ms)} ms`}</span>), header: "Duration", id: "duration" },
    { cell: ({ row }) => (row.original.next_attempt_at ? formatInstant(row.original.next_attempt_at) : muted("—")), header: "Next attempt", id: "next_attempt_at" },
    { cell: ({ row }) => formatInstant(row.original.created_at), header: "Created", id: "created_at" },
    { cell: ({ row }) => (row.original.delivered_at ? formatInstant(row.original.delivered_at) : muted("—")), header: "Delivered", id: "delivered_at" },
];

/** A delivery's outcome in one line: "Succeeded · HTTP 200 · 182 ms" / "Failed · Timed out · 10,000 ms · next attempt …". */
export function deliveryOutcomeText(delivery: DestinationDelivery) {
    const parts = [DELIVERY_STATUS_INFO[delivery.status].label];

    if (delivery.last_status !== null) parts.push(`HTTP ${delivery.last_status}`);

    const error = deliveryErrorInfo(delivery.last_error);

    if (error) parts.push(error.label);

    if (delivery.duration_ms !== null) parts.push(`${formatNumber(delivery.duration_ms)} ms`);

    if (delivery.next_attempt_at) parts.push(`next attempt ${formatInstant(delivery.next_attempt_at)}`);

    return parts.join(" · ");
}

/** Where a test delivery stands, above the log (`testTracking`): waiting, its outcome, or "no outcome after 30 s". */
export function TestDeliveryNotice({ deliveryId, onDismiss, onRefresh, tracking }: { deliveryId: string; onDismiss: () => void; onRefresh: () => void; tracking: TestTracking }) {
    const seconds = TEST_WATCH_MS / 1000;

    if (tracking.state === "waiting") {
        return (
            <Notice badge="Test" title={`Test delivery ${deliveryId} sent`}>
                {`Waiting for its outcome${tracking.delivery ? ` (now ${DELIVERY_STATUS_INFO[tracking.delivery.status].label.toLowerCase()})` : ""}: the log is asked again every ${TEST_POLL_MS / 1000} s for up to ${seconds} s (1 credit per loaded page each time).`}
            </Notice>
        );
    }

    const dismiss = <Button className="mt-2" onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>;

    if (tracking.state === "done") {
        return (
            <Notice badge="Test" title={`Test delivery ${deliveryId}: ${DELIVERY_STATUS_INFO[tracking.delivery.status].label.toLowerCase()}`}>
                <p data-testid="test-outcome">{deliveryOutcomeText(tracking.delivery)}</p>
                {dismiss}
            </Notice>
        );
    }

    return (
        <Notice badge="Test" title={`No outcome for test delivery ${deliveryId} after ${seconds} s`}>
            <p>{`${tracking.delivery ? `It is still ${DELIVERY_STATUS_INFO[tracking.delivery.status].label.toLowerCase()}.` : "It is not in the log yet."} Polling stopped; refresh the log to look again.`}</p>
            <div className="flex flex-wrap gap-2">
                <Button className="mt-2" onClick={onRefresh} size="sm" type="button" variant="outline">Refresh the log</Button>
                {dismiss}
            </div>
        </Notice>
    );
}

/**
 * A destination's delivery log (pure; newest first, as the API lists it): status, event (links to it in the event
 * feed) and delivery id, batch id (rows of one `alert.fired.batch` share it; the loaded rows of a batch are counted), attempts, last HTTP answer, last error,
 * duration, next attempt, created, delivered. The operation has no status filter: the status select filters the LOADED
 * rows and says so. `highlight` marks the watched test delivery.
 */
export function DeliveriesView({ highlight, onStatusChange, state, status }: { highlight?: null | string; onStatusChange: (status: DestinationDeliveryStatus | null) => void; state: DeliveriesListState; status: DestinationDeliveryStatus | null }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <AlertsState error={error} title="Failed to load the deliveries" />;

    const loaded = pages.flatMap(page => page.data);

    const rows = deliveriesWithStatus(loaded, status);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect aria-label="Delivery status" className="w-[160px]" onValueChange={value => onStatusChange(value === ALL ? null : value)} options={STATUS_OPTIONS} value={status ?? ALL} />
                {status !== null && (
                    <span className="text-muted-foreground" data-testid="deliveries-filter-note">
                        {`${formatNumber(rows.length)} of the ${formatNumber(loaded.length)} loaded deliveries${hasNextPage ? " (older ones are not loaded: the API has no status filter)" : ""}.`}
                    </span>
                )}
            </div>
            <DataTable
                columns={columnsOf(batchSizes(loaded))}
                emptyText={status === null ? "No delivery yet: send a test delivery to see one." : "No loaded delivery has this status."}
                exportConfig={{ dataset: "deliveries", scope: "destination" }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listDestinationDeliveries"
                rowClassName={delivery => (delivery.id === highlight ? "bg-primary/10" : undefined)}
                rows={rows}
            />
            {error ? <AlertsState error={error} title="Failed to load more deliveries" /> : null}
        </div>
    );
}
