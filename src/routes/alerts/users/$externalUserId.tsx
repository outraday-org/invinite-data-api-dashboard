import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { AlertEventsView } from "@/components/alerts/alert-events-view";
import { AlertsState, BatchResultsView } from "@/components/alerts/alert-parts";
import { AlertUserDeleteResultNotice, AlertUserProfileView } from "@/components/alerts/alert-user-detail-view";
import { AlertUserEditDialog } from "@/components/alerts/alert-user-dialogs";
import { AlertsListView } from "@/components/alerts/alerts-list-view";
import { useAlertActions } from "@/components/alerts/use-alert-actions";
import { useAlertUserActions } from "@/components/alerts/use-alert-user-actions";
import { useEventList } from "@/components/alerts/use-event-list";
import { useIdSelection } from "@/components/alerts/use-id-selection";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fromAlertUser } from "@/lib/alerts/alert-users";
import { listState } from "@/lib/api/list-state";
import { useAlertEventsInfinite, useAlertsInfinite, useAlertUser, useAlertUserDefaults } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";

export const Route = createFileRoute("/alerts/users/$externalUserId")({
    component: AlertUserPage,
    head: () => titleHead("End user"),
});

/** The end user's alerts (`listAlerts?external_user_id=`), with the row and bulk actions of the alerts list. */
function AlertUserAlerts({ externalUserId }: { externalUserId: string }) {
    const alerts = useAlertsInfinite({ externalUserId });

    const [selected, setSelected] = useIdSelection();

    const actions = useAlertActions({ onBulkDone: ids => setSelected(ids, false), onDeleted: ids => setSelected(ids, false) });

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Alerts</h3>
            {actions.batch && <BatchResultsView ids={actions.batch.ids} onDismiss={actions.dismissBatch} results={actions.batch.results} />}
            <AlertsListView
                selection={{ busy: actions.busy, onAction: actions.request, onSelect: setSelected, selected }}
                state={listState(alerts)}
            />
            {actions.dialog}
        </section>
    );
}

/** The end user's events (`listAlertEvents?external_user_id=`), newest first. */
function AlertUserEvents({ externalUserId }: { externalUserId: string }) {
    const query = useAlertEventsInfinite({ externalUserId });

    const list = useEventList(query);

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Events</h3>
            <AlertEventsView emptyText="No alert of this end user has fired yet." events={list.events} liveIds={new Set()} loadedNote={list.note} operationId="listAlertEvents" state={list.state} />
        </section>
    );
}

/**
 * One end user (`GET /v1/alert-users/{id}`; the id is any text, one encoded path segment): profile, limits vs
 * effective limits with the usage, pause / resume / edit / delete, its alerts and its events.
 */
function AlertUserPage() {
    const { externalUserId } = Route.useParams();

    const navigate = Route.useNavigate();

    const user = useAlertUser(externalUserId);

    const defaults = useAlertUserDefaults();

    const actions = useAlertUserActions({
        onDeleted: ({ result }) => {
            if (result.status === "deleted") void navigate({ to: "/alerts/users" });
        },
    });

    const [editing, setEditing] = React.useState(false);

    if (!user.data) {
        return (
            <div className="flex flex-col gap-4">
                <PageHeader title={externalUserId} />
                {actions.deleted && <AlertUserDeleteResultNotice onDismiss={actions.dismissDeleted} outcome={actions.deleted} />}
                {user.error ? <AlertsState error={user.error} notFound={`No end user ${externalUserId} on this account.`} title="Failed to load the end user" /> : <Skeleton className="h-64 w-full" />}
            </div>
        );
    }

    const loaded = user.data;

    const busy = actions.busy.has(loaded.external_user_id);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <div className="flex flex-wrap gap-2" data-testid="alert-user-actions">
                        {loaded.status === "active" && <Button disabled={busy} onClick={() => actions.request("pause", loaded)} size="sm" type="button" variant="outline">Pause…</Button>}
                        {loaded.status === "paused" && <Button disabled={busy} onClick={() => actions.request("resume", loaded)} size="sm" type="button" variant="outline">Resume…</Button>}
                        {loaded.status !== "deleting" && <Button disabled={busy} onClick={() => setEditing(true)} size="sm" type="button" variant="outline">Edit</Button>}
                        <Button disabled={busy} onClick={() => actions.request("delete", loaded)} size="sm" type="button" variant="destructive">{loaded.status === "deleting" ? "Continue deleting…" : "Delete…"}</Button>
                    </div>
                )}
                description={loaded.display_name ? <span className="font-mono break-all">{loaded.external_user_id}</span> : "End user"}
                title={loaded.display_name ?? <span className="font-mono break-all">{loaded.external_user_id}</span>}
            />
            {actions.deleted && <AlertUserDeleteResultNotice onDismiss={actions.dismissDeleted} outcome={actions.deleted} />}
            <AlertUserProfileView user={loaded} />
            <AlertUserAlerts externalUserId={loaded.external_user_id} />
            <AlertUserEvents externalUserId={loaded.external_user_id} />
            {editing && <AlertUserEditDialog defaults={defaults.data} initial={fromAlertUser(loaded)} key={loaded.updated_at} mode="edit" onOpenChange={setEditing} open />}
            {actions.dialog}
        </div>
    );
}
