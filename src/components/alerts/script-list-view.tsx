import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";

import type { Script, ScriptsListResponse, ScriptVersion } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { diagnosticsSummary, SCRIPT_VERSIONS_MAX } from "@/lib/alerts/scripts";
import { formatInstant } from "@/lib/format";

/** A version's compile status: `ok` = usable in alerts, `error` = see its diagnostics. */
export function ScriptVersionStatusBadge({ status }: { status: ScriptVersion["status"] }) {
    return status === "ok"
        ? <Badge title="Compiled; usable in script alerts" variant="default">Compiled</Badge>
        : <Badge title="The compile failed: see the diagnostics" variant="destructive">Compile error</Badge>;
}

const columns: Array<ColumnDef<Script>> = [
    {
        cell: ({ row }) => (
            <div className="flex min-w-0 flex-col">
                <Link className="font-medium underline-offset-4 hover:underline" params={{ id: row.original.id }} to="/alerts/scripts/$id">{row.original.name}</Link>
                {row.original.description && <span className="line-clamp-2 text-muted-foreground">{row.original.description}</span>}
            </div>
        ),
        header: "Script",
        id: "name",
    },
    { cell: ({ row }) => <span className="tabular-nums">{`${row.original.version_count} of ${SCRIPT_VERSIONS_MAX}`}</span>, header: "Versions", id: "version_count" },
    {
        cell: ({ row }) => {
            const latest = row.original.latest_version;

            if (!latest) return <span className="text-muted-foreground">None stored</span>;

            return (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{`v${latest.version}`}</span>
                    <ScriptVersionStatusBadge status={latest.status} />
                    <span className="text-muted-foreground">{diagnosticsSummary(latest.diagnostics)}</span>
                </div>
            );
        },
        header: "Latest version",
        id: "latest_version",
    },
    { cell: ({ row }) => formatInstant(row.original.updated_at), header: "Updated", id: "updated_at" },
];

export type ScriptsListState = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<ScriptsListResponse>;
};

/** The account's scripts (pure; oldest first as the API lists them): name + description, versions, latest, updated. */
export function ScriptsListView({ state }: { state: ScriptsListState }) {
    const { error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages } = state;

    if (error && pages.length === 0) return <AlertsState error={error} title="Failed to load the scripts" />;

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columns={columns}
                emptyText="No script yet. Upload a chartlang script to use it in script alerts."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listScripts"
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <AlertsState error={error} title="Failed to load more scripts" /> : null}
        </div>
    );
}
