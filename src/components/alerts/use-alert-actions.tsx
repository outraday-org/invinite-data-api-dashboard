import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import type { Alert, AlertBatchOp, AlertBatchResult } from "@/lib/api/types";

import { ConfirmAction } from "@/components/ui/confirm-action";
import { errorDescription } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { ALERT_QUERY_KEYS } from "@/lib/api/queries";
import { ALERT_BATCH_MAX } from "@/lib/api/server-functions-alerts";

export type AlertAction = "delete" | "pause" | "resume" | "test";

type Target = Pick<Alert, "destination_ids" | "id">;

type Pending = { action: AlertAction; targets: ReadonlyArray<Target> };

export type BatchOutcome = { ids: Array<string>; results: Array<AlertBatchResult> };

const BULK_OP: Record<Exclude<AlertAction, "test">, AlertBatchOp> = { delete: "delete", pause: "pause", resume: "resume" };

/** The confirm dialog's words for an action on `targets` (pure, tested). Pause / resume of one alert needs none. */
export function confirmWords(action: AlertAction, targets: ReadonlyArray<Target>): null | { confirmLabel: string; destructive: boolean; effect: string; title: string } {
    const many = targets.length > 1;

    const count = `${targets.length} alerts`;

    switch (action) {
        case "delete": return {
            confirmLabel: many ? `Delete ${count}` : "Delete",
            destructive: true,
            effect: `${many ? `The ${count} are` : "The alert is"} removed and stop${many ? "" : "s"} firing at once; ${many ? "their" : "its"} events stay readable. This cannot be undone.`,
            title: many ? `Delete ${count}?` : "Delete this alert?",
        };

        case "pause": return many
            ? { confirmLabel: `Pause ${count}`, destructive: false, effect: `The ${count} stop firing until resumed; paused ones stay as they are.`, title: `Pause ${count}?` }
            : null;

        case "resume": return many
            ? { confirmLabel: `Resume ${count}`, destructive: false, effect: `The ${count} are armed again (scheduled while their activation time lies ahead); triggered ones can fire again.`, title: `Resume ${count}?` }
            : null;

        case "test": {
            const destinations = targets[0]?.destination_ids.length ?? 0;

            return {
                confirmLabel: "Send test event",
                destructive: false,
                effect: destinations > 0
                    ? `Queues one test "alert.fired" event (marked test: true) and DELIVERS it to the alert's ${destinations} destination${destinations === 1 ? "" : "s"} — a real request to each endpoint. It also appears in the event feed.`
                    : "Queues one test \"alert.fired\" event (marked test: true). The alert has no destination, so it appears in the event feed and the live stream only.",
                title: "Send a test event?",
            };
        }
    }
}

/** Splits a bulk change into requests of at most `ALERT_BATCH_MAX` items (pure). */
export function batchChunks<T>(items: ReadonlyArray<T>, size = ALERT_BATCH_MAX): Array<Array<T>> {
    const chunks: Array<Array<T>> = [];

    for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));

    return chunks;
}

/**
 * The row / detail actions of alerts: pause and resume one alert at once; send a test event, delete, and every bulk
 * change (`batchAlerts`, ≤ 500 items a request) only after `ConfirmAction` stated the effect. One toast per outcome
 * (the mutation hook never toasts); a bulk change shows its per-item results (`batch`), a partial failure included.
 */
export function useAlertActions({ onDeleted }: { onDeleted?: (ids: ReadonlyArray<string>) => void } = {}) {
    const navigate = useNavigate();

    const [pending, setPending] = React.useState<null | Pending>(null);

    const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set());

    const [batch, setBatch] = React.useState<BatchOutcome | null>(null);

    const listAndEvents = [ALERT_QUERY_KEYS.list, ALERT_QUERY_KEYS.events];

    const pause = useApiMutation("pauseAlert", { invalidates: [...listAndEvents, ALERT_QUERY_KEYS.alert] });

    const resume = useApiMutation("resumeAlert", { invalidates: [...listAndEvents, ALERT_QUERY_KEYS.alert] });

    const remove = useApiMutation("deleteAlert", { invalidates: listAndEvents });

    const test = useApiMutation("testAlert", { invalidates: [ALERT_QUERY_KEYS.events] });

    const bulk = useApiMutation("batchAlerts", { invalidates: [...listAndEvents, ALERT_QUERY_KEYS.alert] });

    const mark = (ids: ReadonlyArray<string>, on: boolean) => setBusy((current) => {
        const next = new Set(current);

        for (const id of ids) {
            if (on) next.add(id);
            else next.delete(id);
        }

        return next;
    });

    const runOne = async (action: AlertAction, target: Target) => {
        mark([target.id], true);

        try {
            if (action === "pause") {
                await pause.mutateAsync({ id: target.id });

                toast.success(`Paused ${target.id}`);
            }
            else if (action === "resume") {
                await resume.mutateAsync({ id: target.id });

                toast.success(`Resumed ${target.id}`);
            }
            else if (action === "delete") {
                await remove.mutateAsync({ id: target.id });

                toast.success(`Deleted ${target.id}`);

                onDeleted?.([target.id]);
            }
            else {
                const accepted = await test.mutateAsync({ id: target.id });

                toast.success("Test event queued", {
                    action: { label: "View event", onClick: () => void navigate({ search: { event: accepted.event_id }, to: "/alerts/events" }) },
                    description: accepted.event_id,
                });
            }
        }
        catch (error) {
            toast.error(`Could not ${action} ${target.id}`, { description: errorDescription(error as Error) });
        }
        finally {
            mark([target.id], false);
        }
    };

    const runBulk = async (action: Exclude<AlertAction, "test">, targets: ReadonlyArray<Target>) => {
        const ids = targets.map(target => target.id);

        mark(ids, true);

        const results: Array<AlertBatchResult> = [];

        try {
            for (const [chunkIndex, chunk] of batchChunks(ids).entries()) {
                const answer = await bulk.mutateAsync({ items: chunk.map(id => ({ id, op: BULK_OP[action] })) });

                // One result per item, in order: the index counts across the chunks.
                results.push(...answer.results.map(result => ({ ...result, index: result.index + chunkIndex * ALERT_BATCH_MAX })));
            }
        }
        catch (error) {
            toast.error(`The bulk ${action} stopped`, { description: `${errorDescription(error as Error)} — ${results.length} of ${ids.length} items had an answer.` });
        }
        finally {
            mark(ids, false);
        }

        if (results.length > 0) setBatch({ ids, results });

        if (action === "delete") onDeleted?.(results.filter(result => result.ok).map(result => ids[result.index]));
    };

    /** Asks first where the action calls for it, else runs at once. */
    const request = (action: AlertAction, targets: ReadonlyArray<Target>) => {
        if (targets.length === 0) return;

        if (confirmWords(action, targets)) setPending({ action, targets });
        else void runOne(action, targets[0]);
    };

    const confirm = async () => {
        if (!pending) return;

        const { action, targets } = pending;

        if (targets.length > 1 && action !== "test") await runBulk(action, targets);
        else await runOne(action, targets[0]);

        setPending(null);
    };

    const words = pending ? confirmWords(pending.action, pending.targets) : null;

    const dialog = words && pending
        ? (
                <ConfirmAction
                    confirmLabel={words.confirmLabel}
                    destructive={words.destructive}
                    effect={words.effect}
                    ids={pending.targets.map(target => target.id)}
                    onConfirm={() => void confirm()}
                    onOpenChange={open => !open && setPending(null)}
                    open
                    pending={pending.targets.some(target => busy.has(target.id))}
                    title={words.title}
                />
            )
        : null;

    return { batch, busy, dialog, dismissBatch: () => setBatch(null), request };
}
