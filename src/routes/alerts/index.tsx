import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { AlertsFilters } from "@/lib/api/queries";
import type { AlertStatus, AlertType } from "@/lib/api/types";

import { BatchResultsView } from "@/components/alerts/alert-parts";
import { AlertsListView } from "@/components/alerts/alerts-list-view";
import { useAlertActions } from "@/components/alerts/use-alert-actions";
import { useIdSelection } from "@/components/alerts/use-id-selection";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ALERT_STATUS_INFO, ALERT_STATUSES, ALERT_TYPE_INFO, ALERT_TYPES } from "@/lib/alerts/labels";
import { useAlertsInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalEnum, optionalText } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

/** The list's filters, named as the API names them (`symbol` / `destination_id`: Data API 7.1). */
const alertsSearchSchema = z.object({
    client_reference_id: optionalText(200),
    destination_id: optionalText(64),
    external_user_id: optionalText(200),
    status: optionalEnum(ALERT_STATUSES),
    symbol: optionalText(64),
    type: optionalEnum(ALERT_TYPES as [AlertType, ...Array<AlertType>]),
});

export type AlertsSearch = z.infer<typeof alertsSearchSchema>;

export const Route = createFileRoute("/alerts/")({
    component: AlertsPage,
    head: () => titleHead("Alerts"),
    validateSearch: alertsSearchSchema,
});

/** The request of a search state: every filter goes to the API (never a filter over loaded pages). */
export function alertsRequest(search: AlertsSearch): AlertsFilters {
    return {
        clientReferenceId: search.client_reference_id,
        destinationId: search.destination_id,
        externalUserId: search.external_user_id,
        status: search.status,
        symbol: search.symbol,
        type: search.type,
    };
}

const ALL = "all";

const STATUS_OPTIONS: Array<{ label: string; value: AlertStatus | typeof ALL }> = [
    { label: "Every status", value: ALL },
    ...ALERT_STATUSES.map(status => ({ label: ALERT_STATUS_INFO[status].label, value: status })),
];

const TYPE_OPTIONS: Array<{ label: string; value: AlertType | typeof ALL }> = [
    { label: "Every type", value: ALL },
    ...ALERT_TYPES.map(type => ({ label: ALERT_TYPE_INFO[type].label, value: type })),
];

/**
 * The account's alerts (`GET /v1/alerts`): filters status, type, end user, client reference, symbol and destination in
 * the URL and on the server; row actions; row selection → bulk pause / resume / delete with per-item results.
 */
function AlertsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<AlertsSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const alerts = useAlertsInfinite(alertsRequest(search));

    const [selected, setSelected] = useIdSelection();

    const actions = useAlertActions({ onDeleted: ids => setSelected(ids, false) });

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={<Button render={<Link to="/alerts/new" />} size="sm">New alert</Button>}
                description="Your alert rules, oldest first as the API lists them. Every filter is applied by the API. Fires and deliveries cost no credits; each list page costs 1."
                title="Alerts"
            />
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect aria-label="Status" className="w-[150px]" onValueChange={value => onChange({ status: value === ALL ? undefined : value })} options={STATUS_OPTIONS} value={search.status ?? ALL} />
                <FilterSelect aria-label="Type" className="w-[200px]" onValueChange={value => onChange({ type: value === ALL ? undefined : value })} options={TYPE_OPTIONS} value={search.type ?? ALL} />
                <DebouncedInput aria-label="Symbol" className="w-[120px]" onCommit={symbol => onChange({ symbol: symbol || undefined })} placeholder="Symbol" value={search.symbol ?? ""} />
                <DebouncedInput aria-label="Destination id" className="w-[220px]" onCommit={id => onChange({ destination_id: id || undefined })} placeholder="Destination id (dst_…)" value={search.destination_id ?? ""} />
                <DebouncedInput aria-label="End user id" className="w-[160px]" onCommit={id => onChange({ external_user_id: id || undefined })} placeholder="End user id" value={search.external_user_id ?? ""} />
                <DebouncedInput aria-label="Client reference id" className="w-[180px]" onCommit={id => onChange({ client_reference_id: id || undefined })} placeholder="Client reference id" value={search.client_reference_id ?? ""} />
            </div>
            {actions.batch && <BatchResultsView ids={actions.batch.ids} onDismiss={actions.dismissBatch} results={actions.batch.results} />}
            <AlertsListView
                selection={{ busy: actions.busy, onAction: actions.request, onSelect: setSelected, selected }}
                state={{
                    error: alerts.error,
                    hasNextPage: alerts.hasNextPage,
                    isFetchingNextPage: alerts.isFetchingNextPage,
                    isLoading: alerts.isLoading,
                    onLoadMore: () => void alerts.fetchNextPage(),
                    pages: alerts.data?.pages ?? [],
                }}
            />
            {actions.dialog}
        </div>
    );
}
