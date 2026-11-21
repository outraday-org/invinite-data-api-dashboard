import * as React from "react";
import { toast } from "sonner";

import type { DestinationErrors, DestinationFormState } from "@/lib/alerts/destinations";
import type { Destination } from "@/lib/api/types";

import { DestinationFormView } from "@/components/alerts/destination-form-view";
import { SecretOnceDialog } from "@/components/alerts/secret-once-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { destinationErrorsOf, destinationFormOf, emptyDestinationForm, forgetHeaderValues, takeSecret, toCreateDestinationBody, toUpdateDestinationBody } from "@/lib/alerts/destinations";
import { ApiRequestError, errorDescription } from "@/lib/api/errors";
import { useApiMutation, useIdempotencyKey } from "@/lib/api/mutations";
import { DESTINATION_QUERY_KEYS } from "@/lib/api/queries";

/** A refused create / edit: a 400's problems under their fields, anything else as one error above the buttons. */
function refusal(error: unknown): { errors: DestinationErrors; other: unknown } {
    if (error instanceof ApiRequestError && error.status === 400) return { errors: destinationErrorsOf(error), other: null };

    return { errors: {}, other: error };
}

type Created = { destination: Destination; secret: string };

/**
 * Create (`destination` null) or edit a destination in a dialog. A create sends ONE `Idempotency-Key` per submission
 * (a double click or a retry after a lost answer makes one destination), then shows the signing secret ONCE
 * (`SecretOnceDialog`): `takeSecret` moved it out of the answer, the mutation is reset on close, and `onCreated` gets
 * the destination without it. An edit sends only what changed (`toUpdateDestinationBody`). Header values are write-only:
 * once a write settled, its input forgets them (`forgetHeaderValues`), so the mutation cache keeps names only.
 */
export function DestinationEditorDialog({ destination, onClose, onCreated }: { destination: Destination | null; onClose: () => void; onCreated?: (destination: Destination) => void }) {
    const mode = destination ? "edit" : "create";

    const [state, setState] = React.useState<DestinationFormState>(() => (destination ? destinationFormOf(destination) : emptyDestinationForm()));

    const [errors, setErrors] = React.useState<DestinationErrors>({});

    const [other, setOther] = React.useState<unknown>(null);

    const [created, setCreated] = React.useState<Created | null>(null);

    const create = useApiMutation("createDestination", { invalidates: [DESTINATION_QUERY_KEYS.list] });

    const update = useApiMutation("updateDestination", { invalidates: [DESTINATION_QUERY_KEYS.list, DESTINATION_QUERY_KEYS.destination] });

    const idempotency = useIdempotencyKey();

    const fail = (error: unknown) => {
        const next = refusal(error);

        setErrors(next.errors);

        setOther(next.other);
    };

    const onSubmit = async () => {
        setOther(null);

        if (!destination) {
            const { body, errors: local } = toCreateDestinationBody(state);

            setErrors(local);

            if (Object.keys(local).length > 0) return;

            const input = { body, idempotencyKey: idempotency.keyFor(body) };

            try {
                const answer = await create.mutateAsync(input);

                idempotency.settle(null);

                // The secret leaves the answer object here: the mutation's state keeps the destination only.
                const secret = takeSecret(answer);

                if (secret) setCreated({ destination: answer, secret });
                else {
                    toast.success(`Destination ${answer.id} created`);

                    onCreated?.(answer);

                    onClose();
                }
            }
            catch (error) {
                idempotency.settle(error);

                fail(error);
            }
            finally {
                forgetHeaderValues(input);
            }

            return;
        }

        const { body, errors: local } = toUpdateDestinationBody(state, destination);

        setErrors(local);

        if (Object.keys(local).length > 0) return;

        const input = { body, id: destination.id };

        try {
            await update.mutateAsync(input);

            toast.success(`Destination ${destination.id} saved`);

            onClose();
        }
        catch (error) {
            fail(error);
        }
        finally {
            forgetHeaderValues(input);
        }
    };

    if (created) {
        return (
            <SecretOnceDialog
                destinationId={created.destination.id}
                onClose={() => {
                    const done = created.destination;

                    create.reset();

                    setCreated(null);

                    onCreated?.(done);

                    onClose();
                }}
                secret={created.secret}
                title="Destination created: its signing secret"
            />
        );
    }

    const pending = create.isPending || update.isPending;

    return (
        <Dialog onOpenChange={open => !open && !pending && onClose()} open>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{destination ? `Edit ${destination.id}` : "New destination"}</DialogTitle>
                    <DialogDescription>
                        {destination
                            ? "Only what you change is sent. Header values are write-only: keep the stored headers, replace them all, or remove them."
                            : "A webhook endpoint for your alerts. Its signing secret is shown once, right after it is created."}
                    </DialogDescription>
                </DialogHeader>
                <DestinationFormView
                    errors={errors}
                    mode={mode}
                    notice={other ? <ErrorState message={errorDescription(other as Error)} title={destination ? "The API refused the change" : "The API refused the destination"} /> : null}
                    onCancel={onClose}
                    onChange={(next) => {
                        setState(next);

                        setOther(null);
                    }}
                    onSubmit={() => void onSubmit()}
                    pending={pending}
                    state={state}
                    storedHeaderNames={destination?.header_names ?? []}
                />
            </DialogContent>
        </Dialog>
    );
}
