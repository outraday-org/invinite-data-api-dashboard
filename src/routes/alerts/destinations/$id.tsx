import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import { AlertsState } from "@/components/alerts/alert-parts";
import { DeliveriesView, TestDeliveryNotice } from "@/components/alerts/deliveries-view";
import { DestinationDetailView } from "@/components/alerts/destination-detail-view";
import { DestinationEditorDialog } from "@/components/alerts/destination-editor";
import { DestinationAlertsView } from "@/components/alerts/destination-parts";
import { useDestinationActions, useDestinationAlerts } from "@/components/alerts/use-destination-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DELIVERY_STATUSES, TEST_POLL_MS, TEST_WATCH_MS, testTracking } from "@/lib/alerts/destinations";
import { useDestination, useDestinationDeliveriesInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalEnum, optionalFlag, optionalText } from "@/lib/url-state";

const destinationSearchSchema = z.object({
    edit: optionalFlag(),
    /** The delivery status filter over the loaded rows. */
    status: optionalEnum(DELIVERY_STATUSES),
    /** A test delivery to watch (`dlv_…`, from "Send test delivery"). */
    test: optionalText(64),
});

type DestinationSearch = z.infer<typeof destinationSearchSchema>;

export const Route = createFileRoute("/alerts/destinations/$id")({
    component: DestinationPage,
    head: () => titleHead("Destination"),
    validateSearch: destinationSearchSchema,
});

/**
 * The delivery log with the watched test delivery: while it is pending / in flight (or not listed yet) the log is asked
 * again every `TEST_POLL_MS` for up to `TEST_WATCH_MS`, then polling stops and the notice says so. Keyed by the
 * delivery id, so each test starts its own 30 seconds.
 */
function Deliveries({ id, onChange, search }: { id: string; onChange: (patch: Partial<DestinationSearch>) => void; search: DestinationSearch }) {
    const testId = search.test ?? null;

    const [timedOut, setTimedOut] = React.useState(false);

    React.useEffect(() => {
        if (!testId) return;

        const timer = setTimeout(() => setTimedOut(true), TEST_WATCH_MS);

        return () => clearTimeout(timer);
    }, [testId]);

    const elapsed = timedOut ? TEST_WATCH_MS : 0;

    const deliveries = useDestinationDeliveriesInfinite(id, testId
        ? (pages) => {
                const tracking = testTracking(testId, pages.flatMap(page => page.data), elapsed);

                return tracking.state === "waiting" ? TEST_POLL_MS : false;
            }
        : undefined);

    const pages = deliveries.data?.pages ?? [];

    const tracking = testId ? testTracking(testId, pages.flatMap(page => page.data), elapsed) : null;

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Deliveries</h3>
            {testId && tracking && (
                <TestDeliveryNotice deliveryId={testId} onDismiss={() => onChange({ test: undefined })} onRefresh={() => void deliveries.refetch()} tracking={tracking} />
            )}
            <DeliveriesView
                highlight={testId}
                onStatusChange={status => onChange({ status: status ?? undefined })}
                state={{
                    error: deliveries.error,
                    hasNextPage: deliveries.hasNextPage,
                    isFetchingNextPage: deliveries.isFetchingNextPage,
                    isLoading: deliveries.isLoading,
                    onLoadMore: () => void deliveries.fetchNextPage(),
                    pages,
                }}
                status={search.status ?? null}
            />
        </section>
    );
}

function DestinationAlerts({ id }: { id: string }) {
    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Alerts delivering here</h3>
            <DestinationAlertsView state={useDestinationAlerts(id)} />
        </section>
    );
}

/**
 * One destination (`GET /v1/destinations/{id}`): settings, status (a disabled one with its reason and "Re-enable"),
 * actions (test, rotate secret, edit — `?edit=true` —, disable, delete), the alerts delivering here
 * (`listAlerts?destination_id=`), and its delivery log (`listDestinationDeliveries`, `?status=` over the loaded rows,
 * `?test=<delivery id>` watched after "Send test delivery").
 */
function DestinationPage() {
    const { id } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<DestinationSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const destination = useDestination(id);

    const actions = useDestinationActions({
        onDeleted: () => void navigate({ to: "/alerts/destinations" }),
        onTested: (_, deliveryId) => onChange({ test: deliveryId }),
    });

    if (!destination.data) {
        return (
            <div className="flex flex-col gap-4">
                <PageHeader title="Destination" />
                {destination.error ? <AlertsState error={destination.error} notFound={`No destination ${id} on this account.`} title="Failed to load the destination" /> : <Skeleton className="h-64 w-full" />}
            </div>
        );
    }

    const loaded = destination.data;

    return (
        <div className="flex flex-col gap-4">
            <PageHeader description={loaded.description ?? undefined} title="Destination" />
            <DestinationDetailView busy={actions.busy.has(loaded.id)} destination={loaded} onAction={action => actions.request(action, loaded)} onEdit={() => onChange({ edit: true })}>
                <DestinationAlerts id={loaded.id} />
                <Deliveries id={loaded.id} key={search.test ?? ""} onChange={onChange} search={search} />
            </DestinationDetailView>
            {search.edit && <DestinationEditorDialog destination={loaded} onClose={() => onChange({ edit: undefined })} />}
            {actions.dialog}
        </div>
    );
}
