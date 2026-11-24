import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";
import { MoreHorizontalIcon } from "lucide-react";

import type { LimitRow } from "@/lib/alerts/alert-users";
import type { AlertUser, AlertUsersListResponse, AlertUserStatus } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ALERT_USER_STATUS_INFO, isPathSafeUserId, LIMIT_SOURCE_TEXT, limitRows, UNADDRESSABLE_ID_TEXT, usageShare, usageText } from "@/lib/alerts/alert-users";
import { formatInstant } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The row / page actions of one end user (edit opens the dialog; the others ask first). */
export type AlertUserAction = "delete" | "edit" | "pause" | "resume";

/** An end user's status badge; the tooltip says what it means (the spec names no pause source: status only). */
export function AlertUserStatusBadge({ status }: { status: AlertUserStatus }) {
    const info = ALERT_USER_STATUS_INFO[status];

    return (
        <Tooltip>
            <TooltipTrigger aria-label={`Status ${info.label}`} render={<span />}>
                <Badge variant={info.tone}>{info.label}</Badge>
            </TooltipTrigger>
            <TooltipContent>{info.meaning}</TooltipContent>
        </Tooltip>
    );
}

/**
 * Usage against one effective limit (ui-redesign task 13): a bar in the brand colour (80 % = warn, full = red) with
 * "3 of 10" beside it ("· default" when the limit is the account default); no bar without a limit.
 */
export function UsageBar({ className, row }: { className?: string; row: Pick<LimitRow, "effective" | "label" | "source" | "used"> }) {
    const share = usageShare(row.used, row.effective);

    return (
        <div className={cn("flex min-w-36 items-center gap-2", className)} title={`${row.label}: ${usageText(row.used, row.effective)} — ${LIMIT_SOURCE_TEXT[row.source]}`}>
            {share !== null && (
                <div aria-label={`${row.label} ${Math.round(share * 100)} % used`} className="bg-muted h-1.5 min-w-12 flex-1 overflow-hidden rounded-full" role="img">
                    <div className={cn("h-full rounded-full", share >= 1 ? "bg-destructive" : share >= 0.8 ? "bg-warn" : "bg-brand")} style={{ width: `${Math.max(2, share * 100)}%` }} />
                </div>
            )}
            <span className="shrink-0 tabular-nums whitespace-nowrap">
                {usageText(row.used, row.effective)}
                {row.source === "default" && <span className="text-muted-foreground"> · default</span>}
            </span>
        </div>
    );
}

/** The link of an end user's page (the id is any text: the router encodes it as one path segment; `.` / `..` cannot be one). */
export function AlertUserLink({ className, externalUserId }: { className?: string; externalUserId: string }) {
    if (!isPathSafeUserId(externalUserId)) return <span className={cn("font-mono font-medium", className)} title={UNADDRESSABLE_ID_TEXT}>{externalUserId}</span>;

    return (
        <Link className={cn("font-mono font-medium break-all underline-offset-4 hover:underline", className)} params={{ externalUserId }} to="/alerts/users/$externalUserId">
            {externalUserId}
        </Link>
    );
}

function RowActions({ busy, onAction, user }: { busy: boolean; onAction: (action: AlertUserAction, user: AlertUser) => void; user: AlertUser }) {
    const deleting = user.status === "deleting";

    if (!isPathSafeUserId(user.external_user_id)) return <span className="text-muted-foreground" title={UNADDRESSABLE_ID_TEXT}>—</span>;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label={`Actions for ${user.external_user_id}`} disabled={busy} size="icon-sm" type="button" variant="ghost" />}>
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    {user.status === "active" && <DropdownMenuItem onClick={() => onAction("pause", user)}>Pause…</DropdownMenuItem>}
                    {user.status === "paused" && <DropdownMenuItem onClick={() => onAction("resume", user)}>Resume…</DropdownMenuItem>}
                    {!deleting && <DropdownMenuItem onClick={() => onAction("edit", user)}>Edit</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onAction("delete", user)} variant="destructive">{deleting ? "Continue deleting…" : "Delete…"}</DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function columnsOf(busy: ReadonlySet<string>, onAction: (action: AlertUserAction, user: AlertUser) => void): Array<ColumnDef<AlertUser>> {
    const limitColumn = (index: number, header: string): ColumnDef<AlertUser> => ({
        cell: ({ row }) => <UsageBar row={limitRows(row.original)[index]} />,
        header,
        id: `limit-${index}`,
    });

    return [
        {
            cell: ({ row }) => (
                <div className="flex min-w-0 flex-col">
                    <AlertUserLink externalUserId={row.original.external_user_id} />
                    {row.original.display_name && <span className="truncate text-muted-foreground">{row.original.display_name}</span>}
                </div>
            ),
            header: "End user",
            id: "external_user_id",
        },
        { cell: ({ row }) => <AlertUserStatusBadge status={row.original.status} />, header: "Status", id: "status" },
        limitColumn(0, "Active alerts"),
        limitColumn(1, "Script alerts"),
        limitColumn(2, "Fires today"),
        { cell: ({ row }) => (row.original.usage.last_fired_at ? formatInstant(row.original.usage.last_fired_at) : <span className="text-muted-foreground">Never</span>), header: "Last fired", id: "last_fired_at" },
        { cell: ({ row }) => <RowActions busy={busy.has(row.original.external_user_id)} onAction={onAction} user={row.original} />, header: () => <span className="sr-only">Actions</span>, id: "actions" },
    ];
}

export type AlertUsersListState = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<AlertUsersListResponse>;
};

/**
 * The end users (pure): id + display name (linking its page), status, usage against the three effective limits
 * ("· default" when the limit is the account default), last fired, row actions; "Load more" by cursor.
 */
export function AlertUsersListView({ busy, onAction, state }: { busy: ReadonlySet<string>; onAction: (action: AlertUserAction, user: AlertUser) => void; state: AlertUsersListState }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <AlertsState error={error} title="Failed to load the end users" />;

    const rows = pages.flatMap(page => page.data);

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columnClassName={id => (id === "actions" ? "w-10" : undefined)}
                columns={columnsOf(busy, onAction)}
                emptyText="No end user matches. End users are created by the first alert naming them, by Add end user or by a bulk upsert."
                exportConfig={{ dataset: "alert-users", scope: "account" }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listAlertUsers"
                rows={rows}
            />
            {error ? <AlertsState error={error} title="Failed to load more end users" /> : null}
        </div>
    );
}
