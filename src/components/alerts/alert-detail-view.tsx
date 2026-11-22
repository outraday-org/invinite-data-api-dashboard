import type * as React from "react";

import { Link } from "@tanstack/react-router";

import type { AlertAction } from "@/components/alerts/use-alert-actions";
import type { FieldSpec } from "@/lib/alerts/condition-fields";
import type { Alert } from "@/lib/api/types";

import { AlertStatusBadge, DestinationChips, DetailRow } from "@/components/alerts/alert-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { fieldText } from "@/lib/alerts/alert-form";
import { alertTarget } from "@/lib/alerts/alert-view";
import { CONDITION_FIELDS, triggerFieldsFor, WEEKDAY_LABELS } from "@/lib/alerts/condition-fields";
import { ALERT_TYPE_INFO, canPause, canResume, enumWords } from "@/lib/alerts/labels";
import { formatInstant, formatNumber } from "@/lib/format";
import { isRecord } from "@/lib/guards";

/** A stored condition / trigger value in words (pure). */
export function valueText(spec: FieldSpec, value: unknown): React.ReactNode {
    if (value === undefined || value === null) return null;

    if (spec.kind === "datetime" && typeof value === "string") return formatInstant(value);

    if (spec.kind === "boolean") return value === true ? "Yes" : "No";

    if (spec.kind === "weekday" && typeof value === "number") return WEEKDAY_LABELS[value] ?? String(value);

    if (spec.kind === "weekday-list" && Array.isArray(value)) return value.map(day => WEEKDAY_LABELS[Number(day)] ?? String(day)).join(", ");

    if (spec.kind === "json" || spec.kind === "template") return <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-[0.6875rem]">{JSON.stringify(value, null, 2)}</pre>;

    // An enum value in the form's words ("prior_close" → "prior close"); a list one entry per comma, never the
    // form's newline-joined text (a keyword may hold spaces: two keywords must not read as one phrase).
    if (spec.kind === "enum" && typeof value === "string") return enumWords(value);

    if (Array.isArray(value) && (spec.kind === "enum-list" || spec.kind === "string-list" || spec.kind === "int-list")) {
        return value.map(item => (spec.kind === "enum-list" ? enumWords(String(item)) : String(item))).join(", ");
    }

    const text = fieldText(spec, value);

    return Array.isArray(text) ? text.join(", ") : text;
}

/**
 * One alert (pure): what it watches, its status with the actions it allows (pause / resume, send a test event, edit,
 * duplicate, delete), the condition and trigger as stored (labels from the field map), delivery and references; the
 * alert's events below (`children`).
 */
export function AlertDetailView({ alert, busy, children, onAction, onEdit }: { alert: Alert; busy: boolean; children?: React.ReactNode; onAction: (action: AlertAction) => void; onEdit: () => void }) {
    const condition = isRecord(alert.condition) ? alert.condition : {};

    const trigger: Record<string, unknown> = isRecord(alert.trigger) ? alert.trigger : {};

    const conditionRows = CONDITION_FIELDS[alert.type].filter(spec => condition[spec.name] !== undefined);

    const triggerRows = triggerFieldsFor(alert.type).filter(spec => trigger[spec.name] !== undefined);

    const metadata = isRecord(alert.metadata) ? Object.entries(alert.metadata) : [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <AlertStatusBadge disabledReason={alert.disabled_reason} status={alert.status} />
                <span className="font-medium">{alertTarget(alert)}</span>
                <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
                    {alert.id}
                    <CopyButton label="Copy the alert id" value={alert.id} />
                </span>
            </div>
            <div className="flex flex-wrap gap-2" data-testid="alert-actions">
                {canPause(alert.status) && <Button disabled={busy} onClick={() => onAction("pause")} size="sm" type="button" variant="outline">Pause</Button>}
                {canResume(alert.status) && <Button disabled={busy} onClick={() => onAction("resume")} size="sm" type="button" variant="outline">Resume</Button>}
                <Button disabled={busy} onClick={() => onAction("test")} size="sm" type="button" variant="outline">Send test event…</Button>
                <Button disabled={busy} onClick={onEdit} size="sm" type="button" variant="outline">Edit</Button>
                <Link className={buttonVariants({ size: "sm", variant: "outline" })} search={{ from: alert.id }} to="/alerts/new">Duplicate</Link>
                <Button disabled={busy} onClick={() => onAction("delete")} size="sm" type="button" variant="destructive">Delete…</Button>
            </div>
            <dl className="flex flex-col gap-2 rounded-xl border p-4">
                <DetailRow label="Type">{`${ALERT_TYPE_INFO[alert.type].label} — ${ALERT_TYPE_INFO[alert.type].summary}`}</DetailRow>
                {conditionRows.map(spec => <DetailRow key={spec.name} label={spec.label}>{valueText(spec, condition[spec.name])}</DetailRow>)}
                {triggerRows.map(spec => <DetailRow key={spec.name} label={spec.label}>{valueText(spec, trigger[spec.name])}</DetailRow>)}
                {trigger.active_window !== undefined && (
                    <DetailRow label="Active window">
                        <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-[0.6875rem]">{JSON.stringify(trigger.active_window, null, 2)}</pre>
                    </DetailRow>
                )}
                <DetailRow label="Destinations"><DestinationChips ids={alert.destination_ids} /></DetailRow>
                <DetailRow label="End user">{alert.external_user_id ?? "—"}</DetailRow>
                <DetailRow label="Client reference id">{alert.client_reference_id ?? "—"}</DetailRow>
                {metadata.length > 0 && (
                    <DetailRow label="Metadata">{metadata.map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join(" · ")}</DetailRow>
                )}
                <DetailRow label="Fires">{formatNumber(alert.fire_count)}</DetailRow>
                <DetailRow label="Last fired">{alert.last_fired_at ? formatInstant(alert.last_fired_at) : "Never"}</DetailRow>
                <DetailRow label="Version">{String(alert.version)}</DetailRow>
                <DetailRow label="Created">{formatInstant(alert.created_at)}</DetailRow>
                <DetailRow label="Updated">{formatInstant(alert.updated_at)}</DetailRow>
            </dl>
            {children}
        </div>
    );
}
