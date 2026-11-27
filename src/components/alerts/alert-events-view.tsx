import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

import type { AlertEvent } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { JsonTree } from "@/components/api/json-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGrid } from "@/components/ui/stat";
import { eventSummary, isTestEvent } from "@/lib/alerts/alert-view";
import { fieldLabel } from "@/lib/alerts/condition-fields";
import { alertEventTypeLabel, alertTypeLabel } from "@/lib/alerts/labels";
import { ALERT_TYPE_FIELDS } from "@/lib/api/operations.gen";
import { formatInstant } from "@/lib/format";
import { isRecord } from "@/lib/guards";
import { cn } from "@/lib/utils";

/** How long a live event stays highlighted after it arrived. */
export const LIVE_HIGHLIGHT_MS = 4000;

function EventRow({ event, fresh, onToggle, open }: { event: AlertEvent; fresh: boolean; onToggle: () => void; open: boolean }) {
    // A live event is highlighted when it appears, then fades (the row stays marked "New").
    const [glow, setGlow] = React.useState(fresh);

    React.useEffect(() => {
        if (!glow) return undefined;

        const timer = setTimeout(() => setGlow(false), LIVE_HIGHLIGHT_MS);

        return () => clearTimeout(timer);
    }, [glow]);

    const json = React.useMemo(() => (open ? JSON.stringify(event.payload, null, 2) : ""), [event.payload, open]);

    return (
        <li className={cn("rounded-lg border transition-colors duration-1000", glow ? "border-brand/50 bg-brand/10" : "bg-background")} data-event-id={event.id} data-fresh={fresh || undefined}>
            <button aria-expanded={open} className="flex w-full items-start gap-2 p-3 text-left" onClick={onToggle} type="button">
                {open ? <ChevronDownIcon className="mt-0.5 size-3.5 shrink-0" /> : <ChevronRightIcon className="mt-0.5 size-3.5 shrink-0" />}
                <span className="flex min-w-0 grow flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{alertEventTypeLabel(event.type)}</Badge>
                        {isTestEvent(event) && <Badge variant="outline">Test</Badge>}
                        {fresh && <Badge>New</Badge>}
                        <span className="text-muted-foreground text-xs">{formatInstant(event.occurred_at)}</span>
                    </span>
                    <span className="font-medium break-words">{eventSummary(event)}</span>
                </span>
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-3 pl-8 text-xs text-muted-foreground">
                {event.alert_id
                    ? <Link className="font-mono underline-offset-4 hover:underline" params={{ id: event.alert_id }} to="/alerts/$id">{event.alert_id}</Link>
                    : <span>Account event</span>}
                {event.external_user_id && <span>{`End user ${event.external_user_id}`}</span>}
                <span className="inline-flex items-center gap-1 font-mono">
                    {event.id}
                    <CopyButton label="Copy the event id" value={event.id} />
                </span>
            </div>
            {open && (
                <div className="border-t px-3 py-2">
                    {event.type === "alert.fired" && <FiredDetails payload={event.payload} />}
                    <details open={event.type !== "alert.fired"}>
                        <summary className="cursor-pointer text-xs text-muted-foreground">Raw payload (the data of the webhook)</summary>
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Payload (the data of the webhook)</span>
                            <CopyButton label="Copy the payload as JSON" value={json} />
                        </div>
                        <JsonTree className="bg-muted/30 max-h-[50vh] overflow-auto rounded-md border p-2" value={event.payload} />
                    </details>
                </div>
            )}
        </li>
    );
}

/** Required on current fires; historical/test details may omit individual fields. */
function FiredDetails({ payload }: { payload: Extract<AlertEvent, { type: "alert.fired" }>["payload"] }) {
    // Read as unknown first so pre-13 stored fires without alert_type can use their nested alert type.
    const historical: Record<string, unknown> = payload;

    const namedType = historical.alert_type;

    const type = typeof namedType === "string" && namedType ? namedType : (isRecord(historical.alert) && typeof historical.alert.type === "string" ? historical.alert.type : "unknown");

    const metadata = Object.hasOwn(ALERT_TYPE_FIELDS, type) ? ALERT_TYPE_FIELDS[type as keyof typeof ALERT_TYPE_FIELDS] : null;

    const reason = isRecord(payload.reason) ? payload.reason : null;

    const details: Record<string, unknown> = reason && isRecord(reason.details) ? reason.details : {};

    return (
        <div className="mb-3 flex flex-col gap-2" data-testid="fired-details">
            <StatGrid>
                <Stat label="Alert type" value={`${alertTypeLabel(type)} (${type})`} />
                <Stat label="Summary" value={reason?.summary ?? "—"} />
                {metadata?.firedDetails.filter(field => details[field.name] !== undefined).map(field => (
                    <Stat key={field.name} label={<span title={field.description}>{fieldLabel(field.name)}</span>} value={detailValue(details[field.name])} />
                ))}
            </StatGrid>
        </div>
    );
}

function detailValue(value: unknown): React.ReactNode {
    if (value === null) return "—";

    if (typeof value === "boolean") return value ? "Yes" : "No";

    if (typeof value === "object") return <pre className="max-w-full overflow-x-auto text-xs">{JSON.stringify(value, null, 2)}</pre>;

    return String(value);
}

export type AlertEventsListState = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
};

/**
 * Alert events (pure): newest first, each expandable to its payload (`JsonTree`); events that arrived live are marked
 * "New" and highlighted for a moment. The API lists events oldest first: `loadedNote` says how far the loaded pages
 * reach, and "Load more" brings NEWER events.
 */
export function AlertEventsView({
    emptyText = "No event yet.",
    events,
    liveIds,
    loadedNote,
    operationId,
    state,
}: {
    emptyText?: string;
    events: ReadonlyArray<AlertEvent>;
    liveIds: ReadonlySet<string>;
    loadedNote?: React.ReactNode;
    operationId: "listAlertEvents" | "listAlertEventsForAlert";
    state: AlertEventsListState;
}) {
    const [openIds, setOpenIds] = React.useState<ReadonlySet<string>>(new Set());

    const toggle = (id: string) => setOpenIds((current) => {
        const next = new Set(current);

        if (next.has(id)) next.delete(id);
        else next.add(id);

        return next;
    });

    if (state.error && events.length === 0) return <AlertsState error={state.error} title="Failed to load the events" />;

    if (state.isLoading && events.length === 0) {
        return (
            <div className="flex flex-col gap-2" data-testid="events-loading">
                {[0, 1, 2].map(row => <Skeleton className="h-16 w-full" key={row} />)}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {loadedNote && <p className="text-muted-foreground text-xs">{loadedNote}</p>}
            {events.length === 0
                ? <p className="text-muted-foreground">{emptyText}</p>
                : (
                        <ul className="flex flex-col gap-2" data-testid="alert-events">
                            {events.map(event => <EventRow event={event} fresh={liveIds.has(event.id)} key={event.id} onToggle={() => toggle(event.id)} open={openIds.has(event.id)} />)}
                        </ul>
                    )}
            <LoadMoreButton hasNextPage={state.hasNextPage} isFetchingNextPage={state.isFetchingNextPage} loadedCount={events.length} onLoadMore={state.onLoadMore} operationId={operationId} />
            {state.error && events.length > 0 ? <AlertsState error={state.error} title="Failed to load more events" /> : null}
        </div>
    );
}

/** One event by id (`/alerts/events?event=`): the row, open; a 404 = not in the log (yet). */
export function SingleEventView({ error, event, isLoading, onClose, onRetry }: { error: unknown; event: AlertEvent | null; isLoading: boolean; onClose: () => void; onRetry: () => void }) {
    return (
        <section aria-label="Opened event" className="flex flex-col gap-2 rounded-lg border border-brand/40 p-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-section">Opened event</h3>
                <Button onClick={onClose} size="sm" type="button" variant="ghost">Close</Button>
            </div>
            {isLoading && <Skeleton className="h-16 w-full" />}
            {event && (
                <ul className="flex flex-col gap-2">
                    <EventRowOpen event={event} />
                </ul>
            )}
            {!event && !isLoading && error
                ? (
                        <div className="flex flex-col gap-2">
                            <AlertsState error={error} notFound="This event is not in the log yet (a test event is queued first)." title="Failed to load the event" />
                            <Button className="self-start" onClick={onRetry} size="sm" type="button" variant="outline">Try again</Button>
                        </div>
                    )
                : null}
        </section>
    );
}

function EventRowOpen({ event }: { event: AlertEvent }) {
    const [open, setOpen] = React.useState(true);

    return <EventRow event={event} fresh={false} onToggle={() => setOpen(current => !current)} open={open} />;
}
