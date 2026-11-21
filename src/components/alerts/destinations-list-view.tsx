import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";
import { MoreHorizontalIcon } from "lucide-react";

import type { Destination, DestinationsListResponse } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { DestinationStatusBadge } from "@/components/alerts/destination-parts";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { digestText, kindLabel, presetLabel, rateText, secretHintText } from "@/lib/alerts/destinations";
import { formatInstant, formatNumber } from "@/lib/format";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

/** The row / detail actions of a destination (each confirmed first: `use-destination-actions.tsx`). */
export type DestinationAction = "delete" | "disable" | "enable" | "rotate" | "test";

export type DestinationsListState = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<DestinationsListResponse>;
};

type Actions = { busy: ReadonlySet<string>; onAction: (action: DestinationAction, destination: Destination) => void };

function RowActions({ busy, destination, onAction }: { busy: boolean; destination: Destination; onAction: Actions["onAction"] }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label={`Actions for ${destination.id}`} disabled={busy} size="icon-sm" type="button" variant="ghost" />}>
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    {destination.status === "active" && <DropdownMenuItem onClick={() => onAction("test", destination)}>Send test delivery…</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => onAction("rotate", destination)}>Rotate secret…</DropdownMenuItem>
                    {destination.status === "disabled"
                        ? <DropdownMenuItem onClick={() => onAction("enable", destination)}>Re-enable…</DropdownMenuItem>
                        : <DropdownMenuItem onClick={() => onAction("disable", destination)}>Disable…</DropdownMenuItem>}
                    <DropdownMenuItem render={<Link params={{ id: destination.id }} search={{ edit: true }} to="/alerts/destinations/$id" />}>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onAction("delete", destination)} variant="destructive">Delete…</DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function columnsOf({ busy, onAction }: Actions): Array<ColumnDef<Destination>> {
    return [
        {
            cell: ({ row }) => (
                <div className="flex min-w-0 flex-col">
                    <Link className="truncate font-medium underline-offset-4 hover:underline" params={{ id: row.original.id }} to="/alerts/destinations/$id">
                        {row.original.url}
                    </Link>
                    <span className="truncate text-muted-foreground">{row.original.description ?? row.original.id}</span>
                </div>
            ),
            header: "Destination",
            id: "url",
        },
        { cell: ({ row }) => `${kindLabel(row.original.kind)} · ${presetLabel(row.original.preset)}`, header: "Kind · preset", id: "kind" },
        {
            cell: ({ row }) => (
                <div className="flex flex-wrap items-center gap-1">
                    <DestinationStatusBadge disabledReason={row.original.disabled_reason} status={row.original.status} />
                    {row.original.consecutive_failures > 0 && (
                        <span className="text-destructive">{`${formatNumber(row.original.consecutive_failures)} failed in a row`}</span>
                    )}
                </div>
            ),
            header: "Status",
            id: "status",
        },
        { cell: ({ row }) => <span className="tabular-nums">{rateText(row.original.max_events_per_minute)}</span>, header: "Rate limit", id: "rate" },
        { cell: ({ row }) => digestText(row.original.digest_seconds), header: "Digest", id: "digest" },
        { cell: ({ row }) => <span className="font-mono">{secretHintText(row.original.secret_hint)}</span>, header: "Secret", id: "secret" },
        { cell: ({ row }) => formatInstant(row.original.created_at), header: "Created", id: "created_at" },
        { cell: ({ row }) => <RowActions busy={busy.has(row.original.id)} destination={row.original} onAction={onAction} />, header: () => <span className="sr-only">Actions</span>, id: "actions" },
    ];
}

/**
 * The account's destinations (pure): URL with description, kind and preset, status with the disabled reason in its
 * tooltip and the failures in a row, rate limit, digest window, the secret's last four characters, created, row
 * actions; "Load more" by cursor.
 */
export function DestinationsListView({ actions, state }: { actions: Actions; state: DestinationsListState }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <AlertsState error={error} title="Failed to load the destinations" />;

    const rows = pages.flatMap(page => page.data);

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columnClassName={id => (id === "actions" ? "w-10" : id === "url" ? "max-w-[320px]" : undefined)}
                columns={columnsOf(actions)}
                emptyIsGenuine={isV2GenuineEmpty(pages.at(0)?.meta.coverage)}
                emptyText="No destination yet: alerts without one reach the event feed and the live stream only."
                exportConfig={{ dataset: "destinations", scope: "account" }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listDestinations"
                rows={rows}
            />
            {error ? <AlertsState error={error} title="Failed to load more destinations" /> : null}
        </div>
    );
}
