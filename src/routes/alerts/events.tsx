import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { AlertEventsFilters } from "@/lib/api/queries";
import type { AlertEventType } from "@/lib/api/types";
import type { LiveAlertsMode, LiveAlertsStop } from "@/lib/live/use-live-alerts";

import { AlertEventsView, SingleEventView } from "@/components/alerts/alert-events-view";
import { useEventList } from "@/components/alerts/use-event-list";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { newestEventId, shouldAutoLoad } from "@/lib/alerts/alert-view";
import { ALERT_EVENT_TYPE_LABELS, ALERT_EVENT_TYPES } from "@/lib/alerts/labels";
import { useAlertEvent, useAlertEventsInfinite, useApiBaseUrl } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { useLiveAlerts } from "@/lib/live/use-live-alerts";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { IN_PLACE, optionalEnum, optionalFlag, optionalText } from "@/lib/url-state";

/** The feed's filters as the API names them, the opened event (`getAlertEvent`) and the Live switch. */
const eventsSearchSchema = z.object({
    alert_id: optionalText(64),
    event: optionalText(64),
    external_user_id: optionalText(200),
    live: optionalFlag(),
    type: optionalEnum(ALERT_EVENT_TYPES),
});

export type AlertEventsSearch = z.infer<typeof eventsSearchSchema>;

export const Route = createFileRoute("/alerts/events")({
    component: AlertEventsPage,
    head: () => titleHead("Alert events"),
    validateSearch: eventsSearchSchema,
});

export function eventsRequest(search: AlertEventsSearch): AlertEventsFilters {
    return { alertId: search.alert_id, externalUserId: search.external_user_id, type: search.type };
}

const ALL = "all";

const TYPE_OPTIONS: Array<{ label: string; value: AlertEventType | typeof ALL }> = [
    { label: "Every event type", value: ALL },
    ...ALERT_EVENT_TYPES.map(type => ({ label: ALERT_EVENT_TYPE_LABELS[type], value: type })),
];

const MODE_TEXT: Record<LiveAlertsMode, string> = { connecting: "Connecting…", live: "Live", no_key: "API key needed", retrying: "Reconnecting…" };

/** The Live switch's status line (pure): mode, skipped events, notes from the stream, ignored frames. */
export function LiveStatus({ ignored, mode, note, onReload, truncatedAt }: { ignored: number; mode: LiveAlertsMode; note: null | string; onReload: () => void; truncatedAt: null | string }) {
    return (
        <div className="flex flex-col gap-2" data-testid="live-status">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={mode === "live" ? "default" : "outline"}>{MODE_TEXT[mode]}</Badge>
                <span className="text-muted-foreground">New events appear at the top as they happen (no credits).</span>
                {ignored > 0 && <span className="text-muted-foreground">{`${ignored} unknown frame${ignored === 1 ? "" : "s"} ignored`}</span>}
            </div>
            {truncatedAt && (
                <Notice badge="Skipped" title="Some events were skipped">
                    <p>{`More events were missed than the live stream replays (it stopped at ${truncatedAt}). Reload the list to see them all.`}</p>
                    <Button className="mt-2" onClick={onReload} size="sm" type="button" variant="outline">Reload the list</Button>
                </Notice>
            )}
            {note && <p className="text-muted-foreground">{`Stream note: ${note}`}</p>}
        </div>
    );
}

/**
 * The event feed (`GET /v1/alert-events`, oldest first from the API, shown newest first): filters alert, type and end
 * user in the URL; `?event=` opens one event (`GET /v1/alert-events/{id}`, e.g. from "Send test event"); "Live" follows
 * the WebSocket channel `alerts` from the newest loaded event (missed ones are replayed) and puts new events on top.
 */
function AlertEventsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<AlertEventsSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const query = useAlertEventsInfinite(eventsRequest(search));

    const opened = useAlertEvent(search.event ?? "");

    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const baseUrl = useApiBaseUrl();

    const [stop, setStop] = React.useState<LiveAlertsStop | null>(null);

    // Live starts once the REST list settled (its newer pages loaded by themselves, or it stopped): `after` is then the
    // newest event the page holds, so the stream replays only what the list lacks. Latched per filter set, so a
    // background refetch never closes the socket.
    const filterKey = JSON.stringify(eventsRequest(search));

    const settled = (query.data !== null || query.error !== null) && !query.isFetchingNextPage && !shouldAutoLoad({
        hasNextPage: query.hasNextPage,
        isFetching: query.isFetching,
        nextPageFailed: query.isFetchNextPageError,
        pageCount: query.data?.pages.length ?? 0,
    });

    const [readyKey, setReadyKey] = React.useState("");

    if (settled && readyKey !== filterKey) setReadyKey(filterKey);

    const live = useLiveAlerts({
        after: newestEventId(query.data?.pages ?? []),
        apiKey,
        apiKeyUpdatedAt,
        baseUrl,
        enabled: Boolean(search.live) && readyKey === filterKey,
        filters: {
            alertIds: search.alert_id ? [search.alert_id] : undefined,
            externalUserId: search.external_user_id,
            types: search.type ? [search.type] : undefined,
        },
        onStop: (reason) => {
            setStop(reason);

            onChange({ live: undefined });
        },
    });

    const list = useEventList(query, live.events);

    const liveIds = React.useMemo(() => new Set(live.events.map(event => event.id)), [live.events]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <Button
                        aria-pressed={Boolean(search.live)}
                        onClick={() => {
                            setStop(null);

                            onChange({ live: search.live ? undefined : true });
                        }}
                        type="button"
                        variant={search.live ? "default" : "outline"}
                    >
                        {search.live ? "Live: on" : "Live: off"}
                    </Button>
                )}
                description="Every fired event of your alerts with its payload (the webhook's data). Each page costs 1 credit; the live stream costs none."
                title="Alert events"
            />
            <FilterBar
                activeCount={[search.type, search.alert_id, search.external_user_id].filter(Boolean).length}
                onReset={() => onChange({ alert_id: undefined, external_user_id: undefined, type: undefined })}
            >
                <FilterField label="Event type">
                    {id => <FilterSelect aria-label="Event type" className="w-full" id={id} onValueChange={value => onChange({ type: value === ALL ? undefined : value })} options={TYPE_OPTIONS} value={search.type ?? ALL} />}
                </FilterField>
                <FilterField label="Alert">
                    {id => <DebouncedInput aria-label="Alert" className="w-full font-mono" id={id} onCommit={value => onChange({ alert_id: value || undefined })} placeholder="alt_…" value={search.alert_id ?? ""} />}
                </FilterField>
                <FilterField label="End user">
                    {id => <DebouncedInput aria-label="End user" className="w-full" id={id} onCommit={value => onChange({ external_user_id: value || undefined })} placeholder="End user id" value={search.external_user_id ?? ""} />}
                </FilterField>
            </FilterBar>
            {search.event && (
                <SingleEventView error={opened.error} event={opened.data} isLoading={opened.isLoading} onClose={() => onChange({ event: undefined })} onRetry={() => void opened.refetch()} />
            )}
            {stop && <Notice badge="Live off" title={stop.message} />}
            {search.live && <LiveStatus ignored={live.ignored} mode={live.mode} note={live.note} onReload={() => void query.refetch()} truncatedAt={live.truncatedAt} />}
            <AlertEventsView events={list.events} liveIds={liveIds} loadedNote={list.note} operationId="listAlertEvents" state={list.state} />
        </div>
    );
}
