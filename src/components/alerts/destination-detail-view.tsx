import type * as React from "react";

import type { DestinationAction } from "@/components/alerts/destinations-list-view";
import type { Destination } from "@/lib/api/types";

import { DetailRow } from "@/components/alerts/alert-parts";
import { DestinationStatusBadge } from "@/components/alerts/destination-parts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { destinationDisabledText, digestText, KIND_INFO, PRESET_INFO, rateText, secretHintText } from "@/lib/alerts/destinations";
import { formatInstant, formatNumber } from "@/lib/format";

/**
 * One destination (pure): status with the failures in a row, a disabled destination's reason with "Re-enable", the
 * actions (send a test delivery, rotate the secret, edit, disable, delete), its settings (header NAMES only: values are
 * never returned), the secret's last four characters and the rotation window; `children` = the alerts delivering here
 * and the delivery log.
 */
export function DestinationDetailView({ busy, children, destination, onAction, onEdit }: { busy: boolean; children?: React.ReactNode; destination: Destination; onAction: (action: DestinationAction) => void; onEdit: () => void }) {
    const disabled = destination.status === "disabled";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <DestinationStatusBadge disabledReason={destination.disabled_reason} status={destination.status} />
                <span className="min-w-0 font-medium break-all">{destination.url}</span>
                <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
                    {destination.id}
                    <CopyButton label="Copy the destination id" value={destination.id} />
                </span>
            </div>
            {disabled && (
                <Notice badge="Disabled" title="No deliveries go out to this destination">
                    <p data-testid="disabled-reason">{destinationDisabledText(destination.disabled_reason) ?? "Disabled."}</p>
                    <Button className="mt-2" disabled={busy} onClick={() => onAction("enable")} size="sm" type="button">Re-enable…</Button>
                </Notice>
            )}
            {!disabled && destination.consecutive_failures > 0 && (
                <Notice badge="Failing" title={`${formatNumber(destination.consecutive_failures)} failed deliveries in a row`}>
                    The platform disables a destination after only failures for 72 hours with at least 10 failed attempts in a row, or at once on a 410 Gone. The log below shows each attempt.
                </Notice>
            )}
            <div className="flex flex-wrap gap-2" data-testid="destination-actions">
                <Button disabled={busy || disabled} onClick={() => onAction("test")} size="sm" type="button" variant="outline">Send test delivery…</Button>
                <Button disabled={busy} onClick={() => onAction("rotate")} size="sm" type="button" variant="outline">Rotate secret…</Button>
                <Button disabled={busy} onClick={onEdit} size="sm" type="button" variant="outline">Edit</Button>
                {!disabled && <Button disabled={busy} onClick={() => onAction("disable")} size="sm" type="button" variant="outline">Disable…</Button>}
                <Button disabled={busy} onClick={() => onAction("delete")} size="sm" type="button" variant="destructive">Delete…</Button>
            </div>
            <dl className="flex flex-col gap-2 rounded-xl border p-4">
                <DetailRow label="Description">{destination.description ?? "—"}</DetailRow>
                <DetailRow label="Kind">{`${KIND_INFO[destination.kind].label} — ${KIND_INFO[destination.kind].meaning}`}</DetailRow>
                <DetailRow label="Preset">{`${PRESET_INFO[destination.preset].label} — ${PRESET_INFO[destination.preset].meaning}`}</DetailRow>
                <DetailRow label="Rate limit">{rateText(destination.max_events_per_minute)}</DetailRow>
                <DetailRow label="Digest window">{digestText(destination.digest_seconds)}</DetailRow>
                <DetailRow label="Custom headers">{destination.header_names.length > 0 ? `${destination.header_names.join(", ")} (values are never shown)` : "None"}</DetailRow>
                <DetailRow label="Body template">
                    {destination.body_template
                        ? <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-[0.6875rem] whitespace-pre-wrap">{destination.body_template}</pre>
                        : "None"}
                </DetailRow>
                <DetailRow label="Signing secret"><span className="font-mono">{secretHintText(destination.secret_hint)}</span></DetailRow>
                {destination.previous_secret_expires_at && (
                    <DetailRow label="Previous secret">{`Still signs until ${formatInstant(destination.previous_secret_expires_at)}`}</DetailRow>
                )}
                <DetailRow label="Failures in a row">{formatNumber(destination.consecutive_failures)}</DetailRow>
                <DetailRow label="Created">{formatInstant(destination.created_at)}</DetailRow>
                <DetailRow label="Updated">{formatInstant(destination.updated_at)}</DetailRow>
            </dl>
            {children}
        </div>
    );
}
