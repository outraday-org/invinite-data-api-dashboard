import type * as React from "react";

import { Link } from "@tanstack/react-router";

import type { BatchItemResult } from "@/lib/alerts/labels";
import type { AlertQuotaUsage, AlertStatus } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { ALERT_STATUS_INFO, batchResultText, disabledReasonText } from "@/lib/alerts/labels";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format";

/** A status badge; its tooltip says what the status means, and why the platform disabled the alert. */
export function AlertStatusBadge({ disabledReason, status }: { disabledReason: null | string; status: AlertStatus }) {
    const info = ALERT_STATUS_INFO[status];

    const reason = disabledReasonText(disabledReason);

    return <StatusBadge label={info.label} reason={reason} tone={info.tone} tooltip={reason ? `${info.meaning} ${reason}` : info.meaning} />;
}

/** Destination ids as chips linking each destination's page (empty = "Feed only": the pull feed and the WebSocket). */
export function DestinationChips({ ids }: { ids: ReadonlyArray<string> }) {
    if (ids.length === 0) return <span className="text-muted-foreground">Feed only</span>;

    return (
        <div className="flex flex-wrap gap-1">
            {ids.map(id => <Badge className="font-mono" key={id} render={<Link params={{ id }} to="/alerts/destinations/$id" />} variant="outline">{id}</Badge>)}
        </div>
    );
}

/** The account's alert quota in one line (every `listAlerts` page carries it). */
export function quotaText(quota: AlertQuotaUsage) {
    const parts = [
        `${formatNumber(quota.active_alerts)} of ${formatNumber(quota.active_alerts_limit)} alerts in use`,
        `${formatNumber(quota.script_alerts)} of ${formatNumber(quota.script_alerts_limit)} script / indicator alerts`,
        quota.fires_per_day_limit === null ? "no daily fire cap" : `fire cap ${formatNumber(quota.fires_per_day_limit)} a day (UTC)`,
    ];

    return parts.join(" · ");
}

/**
 * Every state of an alerts request that is not data: the plan gate, a 404 (the page's own words), the platform switched
 * off (503 `unavailable`), a 400 in the API's words, else the error card.
 */
export function AlertsState({ error, notFound = "Not found.", title }: { error: unknown; notFound?: string; title: string }) {
    if (isTierError(error)) {
        return <Notice badge="Plan" title="Your plan does not include this">{error instanceof Error ? error.message : null}</Notice>;
    }

    if (error instanceof ApiRequestError) {
        if (error.status === 404) return <Notice title={notFound}>{error.message}</Notice>;

        if (error.status === 503) return <Notice title="Alerts are switched off on the API right now">{error.message}</Notice>;

        if (error.status === 400) return <ErrorState message={error.message} title={title} />;
    }

    return <ErrorState error={error} title={title} />;
}

/**
 * A refusal of a create / edit that is about limits, not about a field: the active-alert quota (`403 plan_required` on
 * create, with the numbers of `meta.quota`), an end user's cap or pause (`alert_user_limit_reached` /
 * `alert_user_paused`). Null for any other error.
 */
export function LimitNotice({ error, onLoadQuota, quota }: { error: unknown; onLoadQuota?: () => void; quota: AlertQuotaUsage | null }) {
    if (!(error instanceof ApiRequestError)) return null;

    if (error.code === "alert_user_limit_reached") return <Notice badge="Limit" title="This end user's alert limit is reached">{error.message}</Notice>;

    if (error.code === "alert_user_paused") return <Notice badge="Paused" title="This end user is paused">{error.message}</Notice>;

    if (!isTierError(error)) return null;

    return (
        <Notice badge="Quota" title="The plan's alert quota or access refused this alert">
            <p>{error.message}</p>
            {quota
                ? <p className="mt-1 text-foreground">{quotaText(quota)}</p>
                : onLoadQuota && <Button className="mt-2" onClick={onLoadQuota} size="sm" type="button" variant="outline">Show the quota (1 credit)</Button>}
        </Notice>
    );
}

/** Per-item results of a bulk change (`AlertBatchResult`, A4: `AlertUserBatchResult`): counts first, every refusal listed with its reason. */
export function BatchResultsView({ ids, onDismiss, results }: { ids: ReadonlyArray<string>; onDismiss: () => void; results: ReadonlyArray<BatchItemResult> }) {
    const refused = results.filter(result => !result.ok);

    const done = results.length - refused.length;

    return (
        <div className={refused.length > 0 ? "rounded-lg border border-destructive/40 bg-destructive/5 p-3" : "rounded-lg border p-3"} data-testid="batch-results" role="status">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                    {`${done} of ${results.length} done`}
                    {refused.length > 0 && <span className="text-destructive">{` · ${refused.length} refused`}</span>}
                </p>
                <Button onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
                {results.map(result => (
                    <li className={result.ok ? "text-muted-foreground" : "text-destructive"} key={result.index}>
                        <span className="font-mono">{ids[result.index] ?? `#${result.index + 1}`}</span>
                        {": "}
                        {batchResultText(result)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** A labelled value of a definition list (summary cards). */
export function DetailRow({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{children}</dd>
        </div>
    );
}
