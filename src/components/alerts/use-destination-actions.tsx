import * as React from "react";
import { toast } from "sonner";

import type { DestinationAlertsState } from "@/components/alerts/destination-parts";
import type { DestinationAction } from "@/components/alerts/destinations-list-view";
import type { Destination } from "@/lib/api/types";

import { DestinationAlertsView } from "@/components/alerts/destination-parts";
import { SecretOnceDialog } from "@/components/alerts/secret-once-dialog";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { takeSecret } from "@/lib/alerts/destinations";
import { errorDescription } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { ALERT_QUERY_KEYS, DESTINATION_QUERY_KEYS, useAlertsInfinite } from "@/lib/api/queries";
import { formatInstant } from "@/lib/format";

type Target = Pick<Destination, "id" | "url">;

/** The confirm dialog's words for an action on a destination (pure, tested). Every destination action asks first. */
export function destinationConfirmWords(action: DestinationAction, target: Target): { confirmLabel: string; destructive: boolean; effect: string; title: string } {
    switch (action) {
        case "delete": return {
            confirmLabel: "Delete destination",
            destructive: true,
            effect: "The destination is deleted; alerts that named it stop sending to it. This cannot be undone.",
            title: "Delete this destination?",
        };

        case "disable": return {
            confirmLabel: "Disable",
            destructive: false,
            effect: `Deliveries to ${target.url} pause until you re-enable the destination.`,
            title: "Disable this destination?",
        };

        case "enable": return {
            confirmLabel: "Re-enable",
            destructive: false,
            effect: `Deliveries to ${target.url} start again, and its failure counter resets to 0.`,
            title: "Re-enable this destination?",
        };

        case "rotate": return {
            confirmLabel: "Rotate secret",
            destructive: false,
            effect: "A new signing secret is created and shown once. For 24 hours every delivery carries a signature with the current secret AND the new one (until the time the answer names), so your endpoint can switch over; after that only the new secret signs.",
            title: "Rotate the signing secret?",
        };

        case "test": return {
            confirmLabel: "Send test delivery",
            destructive: false,
            effect: `Sends one signed destination.test event to ${target.url} — a real request to your endpoint. Its delivery shows in the destination's delivery log.`,
            title: "Send a test delivery?",
        };
    }
}

/** The alerts that deliver to a destination: the first page of `GET /v1/alerts?destination_id=` (task 1's filter). */
export function useDestinationAlerts(id: string): DestinationAlertsState {
    const alerts = useAlertsInfinite({ destinationId: id });

    const first = alerts.data?.pages.at(0);

    return { alerts: first?.data ?? [], error: alerts.error, hasMore: first?.has_more ?? false, isLoading: alerts.isLoading };
}

/** The delete dialog's list of the alerts using the destination (mounted only while the dialog is open). */
function DestinationAlertsInDialog({ id }: { id: string }) {
    return <DestinationAlertsView state={useDestinationAlerts(id)} />;
}

type Pending = { action: DestinationAction; target: Target };

type Shown = { destinationId: string; expiresAt: string; secret: string };

/**
 * The actions of a destination (list rows and the detail page): send a test delivery, rotate the secret, disable /
 * re-enable, delete — each only after `ConfirmAction` stated the effect (the delete dialog also lists the alerts that
 * deliver there). A rotation shows the new secret ONCE (`SecretOnceDialog`, the mutation reset on close). One toast per
 * outcome (a test's is the watched delivery's notice); `onTested` gets the accepted test (its delivery id is then
 * watched), `onDeleted` the deleted id.
 */
export function useDestinationActions({ onDeleted, onTested }: { onDeleted?: (id: string) => void; onTested?: (id: string, deliveryId: string) => void } = {}) {
    const [pending, setPending] = React.useState<null | Pending>(null);

    const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set());

    const [shown, setShown] = React.useState<null | Shown>(null);

    const one = [DESTINATION_QUERY_KEYS.list, DESTINATION_QUERY_KEYS.destination];

    const test = useApiMutation("testDestination", { invalidates: [DESTINATION_QUERY_KEYS.deliveries] });

    const rotate = useApiMutation("rotateDestinationSecret", { invalidates: one });

    const update = useApiMutation("updateDestination", { invalidates: one });

    // The alerts that named it stop sending to it: their lists show the change.
    const remove = useApiMutation("deleteDestination", { invalidates: [DESTINATION_QUERY_KEYS.list, ALERT_QUERY_KEYS.list, ALERT_QUERY_KEYS.alert] });

    const mark = (id: string, on: boolean) => setBusy((current) => {
        const next = new Set(current);

        if (on) next.add(id);
        else next.delete(id);

        return next;
    });

    const run = async ({ action, target }: Pending) => {
        mark(target.id, true);

        try {
            switch (action) {
                case "delete": {
                    await remove.mutateAsync({ id: target.id });

                    toast.success(`Deleted ${target.id}`);

                    onDeleted?.(target.id);

                    break;
                }

                case "disable":
                case "enable": {
                    await update.mutateAsync({ body: { status: action === "enable" ? "active" : "disabled" }, id: target.id });

                    toast.success(action === "enable" ? `Re-enabled ${target.id}` : `Disabled ${target.id}`);

                    break;
                }

                case "rotate": {
                    const answer = await rotate.mutateAsync({ id: target.id });

                    // The secret leaves the answer object here: the mutation's state keeps only the expiry.
                    const secret = takeSecret(answer);

                    if (secret) setShown({ destinationId: target.id, expiresAt: answer.previous_secret_expires_at, secret });

                    break;
                }

                case "test": {
                    const accepted = await test.mutateAsync({ id: target.id });

                    // No toast: the watched delivery's notice on the destination page is the one message.
                    onTested?.(target.id, accepted.delivery_id);

                    break;
                }
            }
        }
        catch (error) {
            toast.error(`Could not ${action === "rotate" ? "rotate the secret of" : action} ${target.id}`, { description: errorDescription(error as Error) });
        }
        finally {
            mark(target.id, false);
        }
    };

    const request = (action: DestinationAction, target: Target) => setPending({ action, target });

    const confirm = async () => {
        if (!pending) return;

        await run(pending);

        setPending(null);
    };

    const words = pending ? destinationConfirmWords(pending.action, pending.target) : null;

    const dialog = (
        <>
            {words && pending && (
                <ConfirmAction
                    confirmLabel={words.confirmLabel}
                    destructive={words.destructive}
                    details={pending.action === "delete" ? <DestinationAlertsInDialog id={pending.target.id} /> : null}
                    effect={words.effect}
                    ids={[pending.target.id]}
                    noun="destination"
                    onConfirm={() => void confirm()}
                    onOpenChange={open => !open && setPending(null)}
                    open
                    pending={busy.has(pending.target.id)}
                    title={words.title}
                />
            )}
            {shown && (
                <SecretOnceDialog
                    destinationId={shown.destinationId}
                    note={`The previous secret keeps signing deliveries (beside the new one) until ${formatInstant(shown.expiresAt)}.`}
                    onClose={() => {
                        rotate.reset();

                        setShown(null);
                    }}
                    secret={shown.secret}
                    title="New signing secret"
                />
            )}
        </>
    );

    return { busy, dialog, request };
}
