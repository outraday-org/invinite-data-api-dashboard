import type * as React from "react";

import type { DestinationAction } from "@/components/alerts/destinations-list-view";
import type { Destination } from "@/lib/api/types";

import { DetailRow, MoreActionsMenu } from "@/components/alerts/alert-parts";
import { DestinationStatusBadge } from "@/components/alerts/destination-parts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { destinationDisabledText, digestText, KIND_INFO, PRESET_INFO, rateText, secretHintText } from "@/lib/alerts/destinations";
import { formatInstant, formatNumber } from "@/lib/format";

/**
 * One destination (pure; ui-redesign task 13): the title row — the URL, status, id — with its actions (send a test
 * delivery, edit; rotate the secret, disable, delete in the `⋯` menu, each confirmed by the page), a disabled
 * destination's reason with "Re-enable", a `StatGrid` (kind, preset, rate limit, digest, failures in a row, signing
 * secret's last four characters), its settings (header NAMES only: values are never returned; the rotation window);
 * `children` = the alerts delivering here and the delivery log.
 */
export function DestinationDetailView({ busy, children, destination, onAction, onEdit }: { busy: boolean; children?: React.ReactNode; destination: Destination; onAction: (action: DestinationAction) => void; onEdit: () => void }) {
    const disabled = destination.status === "disabled";

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
                <PageHeader
                    actions={(
                        <div className="flex flex-wrap items-center gap-2" data-testid="destination-actions">
                            <Button disabled={busy || disabled} onClick={() => onAction("test")} type="button" variant="outline">Send test delivery…</Button>
                            <Button disabled={busy} onClick={onEdit} type="button" variant="outline">Edit</Button>
                            <MoreActionsMenu
                                actions={[
                                    { disabled: busy, label: "Rotate secret…", onSelect: () => onAction("rotate") },
                                    ...(disabled ? [] : [{ destructive: true, disabled: busy, label: "Disable…", onSelect: () => onAction("disable") }]),
                                    { destructive: true, disabled: busy, label: "Delete…", onSelect: () => onAction("delete") },
                                ]}
                                disabled={busy}
                                label={`More actions for ${destination.id}`}
                            />
                        </div>
                    )}
                    description={destination.description ?? undefined}
                    meta={(
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <DestinationStatusBadge disabledReason={destination.disabled_reason} status={destination.status} />
                            <span className="inline-flex items-center gap-1 font-mono">
                                {destination.id}
                                <CopyButton label="Copy the destination id" value={destination.id} />
                            </span>
                        </span>
                    )}
                    title={<span className="break-all">{destination.url}</span>}
                />
                {disabled && (
                    <Notice action={<Button disabled={busy} onClick={() => onAction("enable")} size="sm" type="button">Re-enable…</Button>} badge="Disabled" title="No deliveries go out to this destination" tone="warn">
                        <p data-testid="disabled-reason">{destinationDisabledText(destination.disabled_reason) ?? "Disabled."}</p>
                    </Notice>
                )}
                {!disabled && destination.consecutive_failures > 0 && (
                    <Notice badge="Failing" title={`${formatNumber(destination.consecutive_failures)} failed deliveries in a row`} tone="warn">
                        The platform disables a destination after only failures for 72 hours with at least 10 failed attempts in a row, or at once on a 410 Gone. The log below shows each attempt.
                    </Notice>
                )}
            </div>
            <StatGrid>
                <Stat label="Kind" sub={KIND_INFO[destination.kind].meaning} value={KIND_INFO[destination.kind].label} />
                <Stat label="Preset" sub={PRESET_INFO[destination.preset].meaning} value={PRESET_INFO[destination.preset].label} />
                <Stat label="Rate limit" value={rateText(destination.max_events_per_minute)} />
                <Stat label="Digest window" value={digestText(destination.digest_seconds)} />
                <Stat label="Failures in a row" value={formatNumber(destination.consecutive_failures)} />
                <Stat label="Signing secret" value={<span className="font-mono">{secretHintText(destination.secret_hint)}</span>} />
            </StatGrid>
            <Section title="Settings">
                <dl className="flex flex-col">
                    <DetailRow label="Custom headers">{destination.header_names.length > 0 ? `${destination.header_names.join(", ")} (values are never shown)` : "None"}</DetailRow>
                    <DetailRow label="Body template">
                        {destination.body_template
                            ? <pre className="bg-muted/50 max-h-48 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap">{destination.body_template}</pre>
                            : "None"}
                    </DetailRow>
                    {destination.previous_secret_expires_at && (
                        <DetailRow label="Previous secret">{`Still signs until ${formatInstant(destination.previous_secret_expires_at)}`}</DetailRow>
                    )}
                    <DetailRow label="Created">{formatInstant(destination.created_at)}</DetailRow>
                    <DetailRow label="Updated">{formatInstant(destination.updated_at)}</DetailRow>
                </dl>
            </Section>
            {children}
        </div>
    );
}
