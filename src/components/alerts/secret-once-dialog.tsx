import { Check, Copy } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The ONE place a destination's signing secret is shown (create: `DestinationCreated`, rotate: `DestinationSecret`):
 * the secret, a copy button and the "you will not see this again" line. Closing before the secret was copied asks first.
 * The secret lives only in the caller's component state (taken out of the write's answer by `takeSecret`); the caller
 * drops it on `onClose`, so after closing it is in no store, cache or DOM node. Never toasted, logged or put in the URL.
 */
export function SecretOnceDialog({ destinationId, note, onClose, secret, title }: {
    destinationId: string;
    /** One line about the secret's lifetime (rotate: the previous secret signs until …). */
    note?: React.ReactNode;
    onClose: () => void;
    secret: string;
    title: string;
}) {
    const [copied, setCopied] = React.useState(false);

    const [asking, setAsking] = React.useState(false);

    const [copyFailed, setCopyFailed] = React.useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(secret);

            setCopied(true);

            setAsking(false);
        }
        catch {
            setCopyFailed(true);
        }
    };

    const requestClose = () => {
        if (copied) onClose();
        else setAsking(true);
    };

    return (
        <Dialog onOpenChange={open => !open && requestClose()} open>
            <DialogContent className="sm:max-w-lg" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription render={<div />}>
                        <p>{`The signing secret of ${destinationId}. Your endpoint verifies each delivery's webhook-signature header with it.`}</p>
                        {note && <p className="mt-1">{note}</p>}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/40 p-2">
                    <code className="min-w-0 flex-1 font-mono break-all select-all" data-testid="secret-value">{secret}</code>
                    <Button aria-label="Copy the signing secret" onClick={() => void copy()} size="sm" type="button" variant="outline">
                        {copied ? <Check /> : <Copy />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                </div>
                <p className="font-medium text-destructive" role="note">You will not see this secret again. Store it now; if it is lost, rotate the secret.</p>
                {copyFailed && <p className="text-destructive" role="alert">The clipboard refused the copy: select the secret and copy it by hand.</p>}
                {asking && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2" role="alert">
                        <p>Close without copying? The secret cannot be shown again.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Button onClick={() => setAsking(false)} size="sm" type="button" variant="outline">Keep it open</Button>
                            <Button onClick={onClose} size="sm" type="button" variant="destructive">Close anyway</Button>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button onClick={requestClose} type="button">{copied ? "Done" : "Close"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
