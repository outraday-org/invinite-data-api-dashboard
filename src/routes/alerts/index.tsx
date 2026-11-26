import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { AlertsFilters } from "@/lib/api/queries";
import type { AlertStatus, AlertType } from "@/lib/api/types";

import { BatchResultsView, quotaText } from "@/components/alerts/alert-parts";
import { AlertsListView } from "@/components/alerts/alerts-list-view";
import { useAlertActions } from "@/components/alerts/use-alert-actions";
import { useIdSelection } from "@/components/alerts/use-id-selection";
import { MacroAvailabilityNotice, useMacroAccess } from "@/components/macro/macro-availability";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { buttonVariants } from "@/components/ui/button";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { ALERT_STATUS_INFO, ALERT_STATUSES, ALERT_TYPE_INFO, ALERT_TYPES } from "@/lib/alerts/labels";
import { listState } from "@/lib/api/list-state";
import { useAlertsInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { IN_PLACE, optionalEnum, optionalText } from "@/lib/url-state";

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

    const macroAccess = useMacroAccess();

    if (search.type === "macro" && macroAccess !== "available") return <MacroAvailabilityNotice access={macroAccess} />;

    return <AlertsListContent macroAvailable={macroAccess === "available"} search={search} />;
}

/** The filters a search sets (the reset clears all six). */
const FILTER_KEYS = ["status", "type", "symbol", "destination_id", "external_user_id", "client_reference_id"] as const;

function AlertsListContent({ macroAvailable, search}: { search: AlertsSearch; macroAvailable: boolean }) {
    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<AlertsSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const alerts = useAlertsInfinite(alertsRequest(search));

    const [selected, setSelected] = useIdSelection();

    const actions = useAlertActions({ onBulkDone: ids => setSelected(ids, false), onDeleted: ids => setSelected(ids, false) });

    // The account's quota, from the list's own first page (`meta.quota`): no request of its own.
    const quota = alerts.data?.pages.at(0)?.meta.quota;

    const activeCount = FILTER_KEYS.filter(key => Boolean(search[key])).length;

    const onReset = () => onChange(Object.fromEntries(FILTER_KEYS.map(key => [key, undefined])));

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={<Link className={buttonVariants()} to="/alerts/new">New alert</Link>}
                description="Your alert rules, oldest first as the API lists them. Every filter is applied by the API. Fires and deliveries cost no credits; each list page costs 1."
                meta={quota ? <span data-testid="alerts-quota">{quotaText(quota)}</span> : undefined}
                title="Alerts"
            />
            <FilterBar activeCount={activeCount} onReset={onReset}>
                <FilterField label="Status">
                    {id => <FilterSelect aria-label="Status" className="w-full" id={id} onValueChange={value => onChange({ status: value === ALL ? undefined : value })} options={STATUS_OPTIONS} value={search.status ?? ALL} />}
                </FilterField>
                <FilterField label="Type">
                    {id => <FilterSelect aria-label="Type" className="w-full" id={id} onValueChange={value => onChange({ type: value === ALL ? undefined : value })} options={macroAvailable ? TYPE_OPTIONS : TYPE_OPTIONS.filter(option => option.value !== "macro")} value={search.type ?? ALL} />}
                </FilterField>
                <FilterField label="Symbol">
                    {id => <DebouncedInput aria-label="Symbol" className="w-full" id={id} onCommit={symbol => onChange({ symbol: symbol || undefined })} placeholder="AAPL" value={search.symbol ?? ""} />}
                </FilterField>
                <FilterField label="Webhook">
                    {id => <DebouncedInput aria-label="Webhook" className="w-full font-mono" id={id} onCommit={value => onChange({ destination_id: value || undefined })} placeholder="dst_…" value={search.destination_id ?? ""} />}
                </FilterField>
                <FilterField label="End user">
                    {id => <DebouncedInput aria-label="End user" className="w-full" id={id} onCommit={value => onChange({ external_user_id: value || undefined })} placeholder="End user id" value={search.external_user_id ?? ""} />}
                </FilterField>
                <FilterField label="Client reference">
                    {id => <DebouncedInput aria-label="Client reference" className="w-full" id={id} onCommit={value => onChange({ client_reference_id: value || undefined })} placeholder="Your alert id" value={search.client_reference_id ?? ""} />}
                </FilterField>
            </FilterBar>
            {actions.batch && <BatchResultsView ids={actions.batch.ids} onDismiss={actions.dismissBatch} results={actions.batch.results} />}
            <AlertsListView
                filtered={activeCount > 0}
                onResetFilters={onReset}
                selection={{ busy: actions.busy, onAction: actions.request, onSelect: setSelected, selected }}
                state={listState(alerts)}
            />
            {actions.dialog}
        </div>
    );
}
