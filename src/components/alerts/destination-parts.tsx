import { Link } from "@tanstack/react-router";

import type { Alert, DestinationDeliveryStatus, DestinationStatus } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { alertsUsingText, DELIVERY_STATUS_INFO, destinationDisabledText } from "@/lib/alerts/destinations";
import { alertTypeLabel } from "@/lib/alerts/labels";

/** A destination's status; the tooltip says why it is disabled (`disabled_reason`). */
export function DestinationStatusBadge({ disabledReason, status }: { disabledReason: null | string; status: DestinationStatus }) {
    const reason = destinationDisabledText(disabledReason);

    const label = status === "active" ? "Active" : "Disabled";

    return (
        <Tooltip>
            <TooltipTrigger aria-label={`Status ${label}${reason ? `: ${reason}` : ""}`} render={<span />}>
                <Badge variant={status === "active" ? "default" : "destructive"}>{label}</Badge>
            </TooltipTrigger>
            <TooltipContent>{reason ?? (status === "active" ? "Deliveries go out." : "No deliveries go out.")}</TooltipContent>
        </Tooltip>
    );
}

/** A delivery's status with its meaning in the tooltip. */
export function DeliveryStatusBadge({ status }: { status: DestinationDeliveryStatus }) {
    const info = DELIVERY_STATUS_INFO[status];

    return (
        <Tooltip>
            <TooltipTrigger aria-label={`Delivery ${info.label}`} render={<span />}>
                <Badge variant={info.tone}>{info.label}</Badge>
            </TooltipTrigger>
            <TooltipContent>{info.meaning}</TooltipContent>
        </Tooltip>
    );
}

export type DestinationAlertsState = { alerts: ReadonlyArray<Alert>; error: unknown; hasMore: boolean; isLoading: boolean };

/**
 * The alerts that deliver to a destination (pure; the first page of `GET /v1/alerts?destination_id=`): a count — "N"
 * when it is the only page, "N+" when more exist — and the page's alerts as links.
 */
export function DestinationAlertsView({ state }: { state: DestinationAlertsState }) {
    const { alerts, error, hasMore, isLoading } = state;

    if (isLoading) return <Skeleton className="h-10 w-full" />;

    if (error) return <AlertsState error={error} title="Failed to load the alerts using this destination" />;

    if (alerts.length === 0) return <p className="text-muted-foreground" data-testid="destination-alerts">No alert delivers here.</p>;

    const one = alerts.length === 1 && !hasMore;

    return (
        <div className="flex flex-col gap-1" data-testid="destination-alerts">
            <p className="font-medium">{`${alertsUsingText(alerts.length, hasMore)} ${one ? "alert delivers" : "alerts deliver"} here`}</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {alerts.map(alert => (
                    <li key={alert.id}>
                        <Link className="underline-offset-4 hover:underline" params={{ id: alert.id }} to="/alerts/$id">
                            {`${alertTypeLabel(alert.type)} · ${alert.client_reference_id ?? alert.id}`}
                        </Link>
                    </li>
                ))}
            </ul>
            {hasMore && <p className="text-muted-foreground">More alerts use it: the first page is listed.</p>}
        </div>
    );
}
