import * as React from "react";
import { toast } from "sonner";

import type { AlertUser, AlertUserDeleteResult } from "@/lib/api/types";

import { ConfirmAction } from "@/components/ui/confirm-action";
import { alertUserConfirmWords } from "@/lib/alerts/alert-users";
import { errorDescription } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { ALERT_QUERY_KEYS, ALERT_USER_QUERY_KEYS } from "@/lib/api/queries";

type Action = "delete" | "pause" | "resume";

type Target = Pick<AlertUser, "external_user_id" | "usage">;

export type DeleteOutcome = { externalUserId: string; result: AlertUserDeleteResult };

/**
 * Pause / resume / delete of one end user, each after `ConfirmAction` stated the effect (a pause pauses deliveries of
 * its counted alerts; a delete erases it). One toast per outcome; a delete's counts stay on the page (`deleted`) until
 * dismissed — a `deleting` end user stays in the list with that status. Its alerts and events are refetched too (a
 * pause / resume changes their status; a delete removes them).
 */
export function useAlertUserActions({ onDeleted }: { onDeleted?: (outcome: DeleteOutcome) => void } = {}) {
    const [pending, setPending] = React.useState<null | { action: Action; target: Target }>(null);

    const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set());

    const [deleted, setDeleted] = React.useState<DeleteOutcome | null>(null);

    const stale = [ALERT_USER_QUERY_KEYS.users, ALERT_QUERY_KEYS.list, ALERT_QUERY_KEYS.alert, ALERT_QUERY_KEYS.events];

    const pause = useApiMutation("pauseAlertUser", { invalidates: stale });

    const resume = useApiMutation("resumeAlertUser", { invalidates: stale });

    const remove = useApiMutation("deleteAlertUser", { invalidates: stale });

    const run = async (action: Action, { external_user_id: externalUserId }: Target) => {
        setBusy(current => new Set(current).add(externalUserId));

        try {
            if (action === "pause") {
                await pause.mutateAsync({ externalUserId });

                toast.success(`Paused ${externalUserId}`);
            }
            else if (action === "resume") {
                await resume.mutateAsync({ externalUserId });

                toast.success(`Resumed ${externalUserId}`);
            }
            else {
                const result = await remove.mutateAsync({ externalUserId });

                toast.success(result.status === "deleted" ? `Deleted ${externalUserId}` : `Deleting ${externalUserId} in the background`);

                setDeleted({ externalUserId, result });

                onDeleted?.({ externalUserId, result });
            }
        }
        catch (error) {
            toast.error(`Could not ${action} ${externalUserId}`, { description: errorDescription(error as Error) });
        }
        finally {
            setBusy((current) => {
                const next = new Set(current);

                next.delete(externalUserId);

                return next;
            });
        }
    };

    const words = pending ? alertUserConfirmWords(pending.action, pending.target) : null;

    const dialog = words && pending
        ? (
                <ConfirmAction
                    confirmLabel={words.confirmLabel}
                    destructive={words.destructive}
                    effect={words.effect}
                    ids={[pending.target.external_user_id]}
                    noun="end user"
                    onConfirm={() => void run(pending.action, pending.target).then(() => setPending(null))}
                    onOpenChange={open => !open && setPending(null)}
                    open
                    pending={busy.has(pending.target.external_user_id)}
                    title={words.title}
                />
            )
        : null;

    return {
        busy,
        deleted,
        dialog,
        dismissDeleted: () => setDeleted(null),
        request: (action: Action, target: Target) => setPending({ action, target }),
    };
}
