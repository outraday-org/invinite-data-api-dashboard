import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import { AlertDetailView } from "@/components/alerts/alert-detail-view";
import { EditAlertForm } from "@/components/alerts/alert-editor";
import { AlertEventsView } from "@/components/alerts/alert-events-view";
import { AlertsState } from "@/components/alerts/alert-parts";
import { useAlertActions } from "@/components/alerts/use-alert-actions";
import { useEventList } from "@/components/alerts/use-event-list";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { fromAlert } from "@/lib/alerts/alert-form";
import { alertTypeLabel } from "@/lib/alerts/labels";
import { useAlert, useAlertEventsForAlertInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalFlag } from "@/lib/url-state";

const alertSearchSchema = z.object({ edit: optionalFlag() });

export const Route = createFileRoute("/alerts/$id")({
    component: AlertPage,
    head: () => titleHead("Alert"),
    validateSearch: alertSearchSchema,
});

/** One alert's events, newest first (the API lists them oldest first: `useEventList`). */
function AlertEvents({ id }: { id: string }) {
    const query = useAlertEventsForAlertInfinite(id);

    const list = useEventList(query);

    return (
        <Section title="Events">
            <AlertEventsView emptyText="This alert has not fired yet." events={list.events} liveIds={new Set()} loadedNote={list.note} operationId="listAlertEventsForAlert" state={list.state} />
        </Section>
    );
}

/**
 * One alert (`GET /v1/alerts/{id}`): summary, status with its actions, the condition and trigger, its events
 * (`listAlertEventsForAlert`), "Duplicate"; `?edit=true` = the form in place (`updateAlert` with `version`).
 */
function AlertPage() {
    const { id } = Route.useParams();

    const { edit } = Route.useSearch();

    const navigate = Route.useNavigate();

    const alert = useAlert(id);

    const actions = useAlertActions({ onDeleted: () => void navigate({ to: "/alerts" }) });

    // The form starts from the alert as loaded when Edit opened; Reload (after a conflict) starts it again.
    const [formGeneration, setFormGeneration] = React.useState(0);

    const setEdit = (on: boolean) => void navigate({ ...IN_PLACE, search: { edit: on || undefined } });

    const title = alert.data ? `${alertTypeLabel(alert.data.type)} alert` : "Alert";

    if (!alert.data) {
        return (
            <div className="flex flex-col gap-4">
                <PageHeader title={title} />
                {alert.error ? <AlertsState error={alert.error} notFound={`No alert ${id} on this account.`} title="Failed to load the alert" /> : <Skeleton className="h-64 w-full" />}
            </div>
        );
    }

    const loaded = alert.data;

    return (
        <div className="flex flex-col gap-4">
            {edit && <PageHeader description={`Editing version ${loaded.version}. The type never changes.`} title={`Edit ${title.toLowerCase()}`} />}
            {edit
                ? (
                        <EditAlertForm
                            alert={loaded}
                            initial={fromAlert(loaded)}
                            key={`${loaded.id}:${formGeneration}`}
                            onDone={() => setEdit(false)}
                            onReload={() => void alert.refetch().then(() => setFormGeneration(current => current + 1))}
                        />
                    )
                : (
                        <AlertDetailView alert={loaded} busy={actions.busy.has(loaded.id)} onAction={action => actions.request(action, [loaded])} onEdit={() => setEdit(true)}>
                            <AlertEvents id={loaded.id} />
                        </AlertDetailView>
                    )}
            {actions.dialog}
        </div>
    );
}
