import type * as React from "react";

import { Link } from "@tanstack/react-router";

import type { AlertAction } from "@/components/alerts/use-alert-actions";
import type { FieldSpec } from "@/lib/alerts/condition-fields";
import type { Alert } from "@/lib/api/types";

import { AlertStatusBadge, DestinationChips, DetailRow, MoreActionsMenu } from "@/components/alerts/alert-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { fieldText } from "@/lib/alerts/alert-form";
import { alertTarget } from "@/lib/alerts/alert-view";
import { FIELD_SPECS, presentField, triggerFieldsFor, WEEKDAY_LABELS } from "@/lib/alerts/condition-fields";
import { ALERT_TYPE_INFO, canPause, canResume, enumWords } from "@/lib/alerts/labels";
import { describeMacroThreshold } from "@/lib/alerts/macro-condition";
import { ALERT_TYPE_FIELDS } from "@/lib/api/operations.gen";
import { formatInstant, formatNumber } from "@/lib/format";
import { isRecord } from "@/lib/guards";

/** A stored condition / trigger value in words (pure). */
export function valueText(spec: FieldSpec, value: unknown): React.ReactNode {
    if (value === undefined || value === null) return null;

    if (spec.kind === "datetime" && typeof value === "string") return formatInstant(value);

    if (spec.kind === "boolean") return value === true ? "Yes" : "No";

    if (spec.kind === "weekday" && typeof value === "number") return WEEKDAY_LABELS[value] ?? String(value);

    if (spec.kind === "weekday-list" && Array.isArray(value)) return value.map(day => WEEKDAY_LABELS[Number(day)] ?? String(day)).join(", ");

    if (spec.kind === "json" || spec.kind === "template") return <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>;

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
 * One alert (pure; ui-redesign task 13): the title row — type, status, what it watches, the id — with its actions
 * (pause / resume, edit, duplicate; send a test event and delete in the `⋯` menu, each confirmed by the page), a
 * `StatGrid` (fires, last fired, version, created, updated), then the condition and trigger as stored (labels from the
 * field map), delivery and references; the alert's events below (`children`).
 */
export function AlertDetailView({ alert, busy, children, onAction, onEdit }: { alert: Alert; busy: boolean; children?: React.ReactNode; onAction: (action: AlertAction) => void; onEdit: () => void }) {
    const condition: Record<string, unknown> = isRecord(alert.condition) ? alert.condition : {};

    const trigger: Record<string, unknown> = isRecord(alert.trigger) ? alert.trigger : {};

    const conditionRows = ALERT_TYPE_FIELDS[alert.type].condition.filter(field => condition[field.name] !== undefined).map(field => ({ ...presentField(field, FIELD_SPECS[field.name]), name: field.name }));

    const triggerRows = triggerFieldsFor(alert.type).filter(spec => trigger[spec.name] !== undefined);

    const metadata = isRecord(alert.metadata) ? Object.entries(alert.metadata) : [];

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                actions={(
                    <div className="flex flex-wrap items-center gap-2" data-testid="alert-actions">
                        {canPause(alert.status) && <Button disabled={busy} onClick={() => onAction("pause")} type="button" variant="outline">Pause</Button>}
                        {canResume(alert.status) && <Button disabled={busy} onClick={() => onAction("resume")} type="button" variant="outline">Resume</Button>}
                        <Button disabled={busy} onClick={onEdit} type="button" variant="outline">Edit</Button>
                        <Link className={buttonVariants({ variant: "outline" })} search={{ from: alert.id }} to="/alerts/new">Duplicate</Link>
                        <MoreActionsMenu
                            actions={[
                                { disabled: busy, label: "Send test event…", onSelect: () => onAction("test") },
                                { destructive: true, disabled: busy, label: "Delete…", onSelect: () => onAction("delete") },
                            ]}
                            disabled={busy}
                            label={`More actions for ${alert.id}`}
                        />
                    </div>
                )}
                description={ALERT_TYPE_INFO[alert.type].summary}
                meta={(
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <AlertStatusBadge disabledReason={alert.disabled_reason} status={alert.status} />
                        <span className="text-foreground font-medium">{alertTarget(alert)}</span>
                        <span className="inline-flex items-center gap-1 font-mono">
                            {alert.id}
                            <CopyButton label="Copy the alert id" value={alert.id} />
                        </span>
                        {alert.client_reference_id && <span className="font-mono">{alert.client_reference_id}</span>}
                    </span>
                )}
                title={`${ALERT_TYPE_INFO[alert.type].label} alert`}
            />
            <StatGrid>
                <Stat label="Fires" value={formatNumber(alert.fire_count)} />
                <Stat label="Last fired" value={alert.last_fired_at ? formatInstant(alert.last_fired_at) : "Never"} />
                <Stat label="Version" value={String(alert.version)} />
                <Stat label="Created" value={formatInstant(alert.created_at)} />
                <Stat label="Updated" value={formatInstant(alert.updated_at)} />
            </StatGrid>
            <div className="grid gap-8 lg:grid-cols-2">
                <Section title="Condition">
                    <dl className="flex flex-col">
                        <DetailRow label="Type">{ALERT_TYPE_INFO[alert.type].label}</DetailRow>
                        {conditionRows.map(spec => <DetailRow key={spec.name} label={spec.label}>{spec.name === "macro_threshold" ? describeMacroThreshold(condition[spec.name]) : valueText(spec, condition[spec.name])}</DetailRow>)}
                    </dl>
                </Section>
                <div className="flex min-w-0 flex-col gap-8">
                    <Section title="When it fires">
                        {triggerRows.length === 0 && trigger.active_window === undefined
                            ? <p className="text-muted-foreground">No trigger option set: the API&apos;s defaults apply.</p>
                            : (
                                    <dl className="flex flex-col">
                                        {triggerRows.map(spec => <DetailRow key={spec.name} label={spec.label}>{valueText(spec, trigger[spec.name])}</DetailRow>)}
                                        {trigger.active_window !== undefined && (
                                            <DetailRow label="Active window">
                                                <pre className="bg-muted/50 overflow-x-auto rounded-md p-2 font-mono text-xs">{JSON.stringify(trigger.active_window, null, 2)}</pre>
                                            </DetailRow>
                                        )}
                                    </dl>
                                )}
                    </Section>
                    <Section title="Delivery">
                        <dl className="flex flex-col">
                            <DetailRow label="Destinations"><DestinationChips ids={alert.destination_ids} /></DetailRow>
                            <DetailRow label="End user">{alert.external_user_id ?? "—"}</DetailRow>
                            <DetailRow label="Client reference id">{alert.client_reference_id ?? "—"}</DetailRow>
                            {metadata.length > 0 && (
                                <DetailRow label="Metadata">{metadata.map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join(" · ")}</DetailRow>
                            )}
                        </dl>
                    </Section>
                </div>
            </div>
            {children}
        </div>
    );
}
