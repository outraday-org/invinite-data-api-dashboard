import type { DeleteOutcome } from "@/components/alerts/use-alert-user-actions";
import type { AlertUser } from "@/lib/api/types";

import { DetailRow } from "@/components/alerts/alert-parts";
import { AlertUserStatusBadge, UsageBar } from "@/components/alerts/alert-user-list-view";
import { JsonTree } from "@/components/api/json-tree";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { deleteResultText, limitOriginText, limitRows } from "@/lib/alerts/alert-users";
import { formatInstant } from "@/lib/format";

/**
 * One end user (pure; ui-redesign task 13): the profile (id, display name, status, metadata, created / updated) and its
 * limits — its own value (empty = it follows the account default) against the effective one, where the effective one
 * comes from, and the usage against it as a brand bar with "N of M" beside it.
 */
export function AlertUserProfileView({ user }: { user: AlertUser }) {
    const rows = limitRows(user);

    return (
        <div className="grid gap-8 lg:grid-cols-2">
            <Section title="Profile">
                <dl className="flex flex-col">
                    <DetailRow label="End user id">
                        <span className="inline-flex items-center gap-1 font-mono break-all">
                            {user.external_user_id}
                            <CopyButton label="Copy end user id" value={user.external_user_id} />
                        </span>
                    </DetailRow>
                    <DetailRow label="Display name">{user.display_name ?? <span className="text-muted-foreground">None</span>}</DetailRow>
                    <DetailRow label="Status"><AlertUserStatusBadge status={user.status} /></DetailRow>
                    <DetailRow label="Last fired">{user.usage.last_fired_at ? formatInstant(user.usage.last_fired_at) : <span className="text-muted-foreground">Never</span>}</DetailRow>
                    <DetailRow label="Created">{formatInstant(user.created_at)}</DetailRow>
                    <DetailRow label="Updated">{formatInstant(user.updated_at)}</DetailRow>
                    <DetailRow label="Metadata">
                        {Object.keys(user.metadata).length > 0 ? <JsonTree value={user.metadata} /> : <span className="text-muted-foreground">None</span>}
                    </DetailRow>
                </dl>
            </Section>
            <div data-testid="alert-user-limits">
                <Section title="Limits and usage">
                    <ul className="flex flex-col gap-4">
                        {rows.map(row => (
                            <li className="flex flex-col gap-1" key={row.field}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                    <span className="font-medium">{row.label}</span>
                                    <span className="text-muted-foreground text-xs">{limitOriginText(row)}</span>
                                </div>
                                <UsageBar row={row} />
                                <span className="text-muted-foreground text-xs">{row.help}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            </div>
        </div>
    );
}

/** What a delete removed (`AlertUserDeleteResult`); a `deleting` answer says the rest runs in the background. */
export function AlertUserDeleteResultNotice({ onDismiss, outcome }: { onDismiss: () => void; outcome: DeleteOutcome }) {
    return (
        <Notice badge={outcome.result.status === "deleted" ? "Deleted" : "Deleting"} title={`End user ${outcome.externalUserId}`}>
            <p data-testid="delete-result">{deleteResultText(outcome.result)}</p>
            <Button className="mt-2" onClick={onDismiss} size="sm" type="button" variant="ghost">Dismiss</Button>
        </Notice>
    );
}
