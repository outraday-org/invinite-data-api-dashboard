import type * as React from "react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Ids listed by name in the dialog; more are counted ("and 12 more"). */
export const CONFIRM_IDS_SHOWN = 8;

/** "alt_1, alt_2 and 3 more" (pure). */
export function affectedText(ids: ReadonlyArray<string>, shown = CONFIRM_IDS_SHOWN) {
    if (ids.length <= shown) return ids.join(", ");

    return `${ids.slice(0, shown).join(", ")} and ${ids.length - shown} more`;
}

/**
 * THE confirmation of every destructive or outward action of the alerts area (delete, bulk change, send a test event;
 * A3: rotate a secret, test a destination): what happens in plain words (`effect`), the affected ids or count, and the
 * confirm button's verb. Controlled (`open` / `onOpenChange`); `pending` disables both buttons while the write runs, and
 * the dialog stays open until the caller closes it (on success, or to show the outcome elsewhere).
 */
export function ConfirmAction({
    confirmLabel,
    destructive = false,
    details,
    effect,
    ids,
    noun = "alert",
    onConfirm,
    onOpenChange,
    open,
    pending = false,
    title,
}: {
    confirmLabel: string;
    destructive?: boolean;
    /** More below the ids (A3: the alerts that deliver to a destination about to be deleted); may hold block elements. */
    details?: React.ReactNode;
    /** What the action does, in words ("The alert stops firing; its events stay readable. This cannot be undone."). */
    effect: React.ReactNode;
    /** The affected ids (listed, the rest counted); omitted = none listed. */
    ids?: ReadonlyArray<string>;
    /** What the ids are ("alert"; A3: "destination"); the plural adds an s. */
    noun?: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    pending?: boolean;
    title: string;
}) {
    return (
        <AlertDialog onOpenChange={next => !pending && onOpenChange(next)} open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription render={<div />}>
                        <p>{effect}</p>
                        {ids && ids.length > 0 && (
                            <p className="mt-2 font-mono break-all" data-testid="confirm-ids">
                                {`${ids.length === 1 ? noun.charAt(0).toUpperCase() + noun.slice(1) : `${ids.length} ${noun}s`}: ${affectedText(ids)}`}
                            </p>
                        )}
                        {details && <div className="mt-2">{details}</div>}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={pending} onClick={onConfirm} variant={destructive ? "destructive" : "default"}>
                        {pending ? "Working…" : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
