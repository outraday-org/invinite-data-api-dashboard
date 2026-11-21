import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { DestinationEditorDialog } from "@/components/alerts/destination-editor";
import { DestinationsListView } from "@/components/alerts/destinations-list-view";
import { useDestinationActions } from "@/components/alerts/use-destination-actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useDestinationsInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalFlag } from "@/lib/url-state";

const destinationsSearchSchema = z.object({ new: optionalFlag() });

export const Route = createFileRoute("/alerts/destinations/")({
    component: DestinationsPage,
    head: () => titleHead("Destinations"),
    validateSearch: destinationsSearchSchema,
});

/**
 * The account's destinations (`GET /v1/destinations`): where alerts are delivered. "New destination" (`?new=true`)
 * opens the create dialog (the secret is shown once after it); row actions test / rotate / disable / re-enable /
 * delete (confirmed). A created destination opens its page; a test opens it with the delivery watched (`?test=`).
 */
function DestinationsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const destinations = useDestinationsInfinite();

    const actions = useDestinationActions({
        onTested: (id, deliveryId) => void navigate({ params: { id }, search: { test: deliveryId }, to: "/alerts/destinations/$id" }),
    });

    const setNew = (on: boolean) => void navigate({ ...IN_PLACE, search: { new: on || undefined } });

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={<Button onClick={() => setNew(true)} size="sm" type="button">New destination</Button>}
                description="Webhook endpoints your alerts deliver to, oldest first as the API lists them. Each request is signed with the destination's secret (see Webhooks). Each list page costs 1 credit."
                title="Destinations"
            />
            <DestinationsListView
                actions={{ busy: actions.busy, onAction: (action, destination) => actions.request(action, destination) }}
                state={{
                    error: destinations.error,
                    hasNextPage: destinations.hasNextPage,
                    isFetchingNextPage: destinations.isFetchingNextPage,
                    isLoading: destinations.isLoading,
                    onLoadMore: () => void destinations.fetchNextPage(),
                    pages: destinations.data?.pages ?? [],
                }}
            />
            {search.new && (
                <DestinationEditorDialog
                    destination={null}
                    onClose={() => setNew(false)}
                    onCreated={destination => void navigate({ params: { id: destination.id }, to: "/alerts/destinations/$id" })}
                />
            )}
            {actions.dialog}
        </div>
    );
}
