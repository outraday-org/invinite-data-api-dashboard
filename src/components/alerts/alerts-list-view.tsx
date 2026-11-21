import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";
import { MoreHorizontalIcon } from "lucide-react";

import type { AlertAction } from "@/components/alerts/use-alert-actions";
import type { Alert, AlertsListResponse } from "@/lib/api/types";

import { AlertsState, AlertStatusBadge, DestinationChips, quotaText } from "@/components/alerts/alert-parts";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { alertTarget } from "@/lib/alerts/alert-view";
import { alertTypeLabel, canPause, canResume } from "@/lib/alerts/labels";
import { formatInstant, formatNumber } from "@/lib/format";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

export type AlertsListState = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<AlertsListResponse>;
};

type Selection = {
    busy: ReadonlySet<string>;
    onAction: (action: AlertAction, alerts: ReadonlyArray<Alert>) => void;
    onSelect: (ids: ReadonlyArray<string>, selected: boolean) => void;
    selected: ReadonlySet<string>;
};

function RowActions({ alert, busy, onAction }: { alert: Alert; busy: boolean; onAction: Selection["onAction"] }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label={`Actions for ${alert.id}`} disabled={busy} size="icon-sm" type="button" variant="ghost" />}>
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    {canPause(alert.status) && <DropdownMenuItem onClick={() => onAction("pause", [alert])}>Pause</DropdownMenuItem>}
                    {canResume(alert.status) && <DropdownMenuItem onClick={() => onAction("resume", [alert])}>Resume</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => onAction("test", [alert])}>Send test event…</DropdownMenuItem>
                    <DropdownMenuItem render={<Link params={{ id: alert.id }} search={{ edit: true }} to="/alerts/$id" />}>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onAction("delete", [alert])} variant="destructive">Delete…</DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function columnsOf({ busy, onAction, onSelect, selected }: Selection, rows: ReadonlyArray<Alert>): Array<ColumnDef<Alert>> {
    const allSelected = rows.length > 0 && rows.every(alert => selected.has(alert.id));

    return [
        {
            cell: ({ row }) => (
                <input
                    aria-label={`Select ${row.original.id}`}
                    checked={selected.has(row.original.id)}
                    className="size-3.5 accent-primary"
                    onChange={event => onSelect([row.original.id], event.target.checked)}
                    type="checkbox"
                />
            ),
            header: () => (
                <input
                    aria-label="Select every loaded alert"
                    checked={allSelected}
                    className="size-3.5 accent-primary"
                    onChange={event => onSelect(rows.map(alert => alert.id), event.target.checked)}
                    type="checkbox"
                />
            ),
            id: "select",
        },
        {
            cell: ({ row }) => (
                <div className="flex min-w-0 flex-col">
                    <Link className="font-medium underline-offset-4 hover:underline" params={{ id: row.original.id }} to="/alerts/$id">
                        {alertTypeLabel(row.original.type)}
                    </Link>
                    <span className="truncate font-mono text-muted-foreground">{row.original.client_reference_id ?? row.original.id}</span>
                </div>
            ),
            header: "Alert",
            id: "alert",
        },
        { cell: ({ row }) => <span className="font-medium">{alertTarget(row.original)}</span>, header: "Watches", id: "target" },
        { cell: ({ row }) => <AlertStatusBadge disabledReason={row.original.disabled_reason} status={row.original.status} />, header: "Status", id: "status" },
        { cell: ({ row }) => <DestinationChips ids={row.original.destination_ids} />, header: "Destinations", id: "destinations" },
        { cell: ({ row }) => row.original.external_user_id ?? <span className="text-muted-foreground">—</span>, header: "End user", id: "external_user_id" },
        { cell: ({ row }) => <div className="text-right tabular-nums">{formatNumber(row.original.fire_count)}</div>, header: () => <div className="text-right">Fires</div>, id: "fire_count" },
        { cell: ({ row }) => (row.original.last_fired_at ? formatInstant(row.original.last_fired_at) : <span className="text-muted-foreground">Never</span>), header: "Last fired", id: "last_fired_at" },
        { cell: ({ row }) => <RowActions alert={row.original} busy={busy.has(row.original.id)} onAction={onAction} />, header: () => <span className="sr-only">Actions</span>, id: "actions" },
    ];
}

/** The bulk bar over the selection: pause / resume / delete through `batchAlerts` (each confirmed first). */
function BulkBar({ onAction, onSelect, rows, selected }: Pick<Selection, "onAction" | "onSelect" | "selected"> & { rows: ReadonlyArray<Alert> }) {
    const picked = rows.filter(alert => selected.has(alert.id));

    if (picked.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2" data-testid="bulk-bar">
            <span className="font-medium">{`${picked.length} selected`}</span>
            <Button onClick={() => onAction("pause", picked)} size="sm" type="button" variant="outline">Pause…</Button>
            <Button onClick={() => onAction("resume", picked)} size="sm" type="button" variant="outline">Resume…</Button>
            <Button onClick={() => onAction("delete", picked)} size="sm" type="button" variant="destructive">Delete…</Button>
            <Button onClick={() => onSelect(picked.map(alert => alert.id), false)} size="sm" type="button" variant="ghost">Clear</Button>
        </div>
    );
}

/**
 * The alerts list (pure): quota line, bulk bar, one row per alert (type + reference, what it watches, status with the
 * disabled reason in its tooltip, destinations as chips, end user, fire count, last fired, row actions), "Load more".
 */
export function AlertsListView({ selection, state }: { selection: Selection; state: AlertsListState }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <AlertsState error={error} title="Failed to load the alerts" />;

    const rows = pages.flatMap(page => page.data);

    const quota = pages.at(0)?.meta.quota;

    return (
        <div className="flex flex-col gap-2">
            {quota && <p className="text-muted-foreground" data-testid="alerts-quota">{quotaText(quota)}</p>}
            <BulkBar onAction={selection.onAction} onSelect={selection.onSelect} rows={rows} selected={selection.selected} />
            <DataTable
                columnClassName={id => (id === "select" ? "w-8" : id === "actions" ? "w-10" : undefined)}
                columns={columnsOf(selection, rows)}
                emptyIsGenuine={isV2GenuineEmpty(pages.at(0)?.meta.coverage)}
                emptyText="No alert matches these filters."
                exportConfig={{ dataset: "alerts", scope: "account" }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listAlerts"
                rowClassName={alert => (selection.selected.has(alert.id) ? "bg-muted/50" : undefined)}
                rows={rows}
            />
            {error ? <AlertsState error={error} title="Failed to load more alerts" /> : null}
        </div>
    );
}
