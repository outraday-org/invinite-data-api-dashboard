import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { PLAN_LABELS } from "@/lib/account";
import { useKeyState } from "@/lib/api/queries";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { cn } from "@/lib/utils";

import { ApiKeyInput, KeyCheckMessage } from "./api-key-input";
import { NoKeyYetHint } from "./no-key-yet";
import { useKeyValidation } from "./use-key-validation";

/**
 * The top bar's key control: the plan badge (→ `/account`) once the key answered `/v1/me`, and the key button whose
 * dialog validates a new key before storing it (a refused key leaves the stored one in place).
 */
export function ApiKeyDialogButton({ className }: { className?: string }) {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const clearApiKey = useApiKeyStore(s => s.clearApiKey);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    const { me } = useKeyState();

    const { check, reset, save } = useKeyValidation();

    const [open, setOpen] = React.useState(false);

    const [draft, setDraft] = React.useState("");

    const hasKey = hasHydrated && Boolean(apiKey);

    // On first load without a stored key the dialog opens by itself, once (never again after it is closed).
    const autoOpened = React.useRef(false);

    React.useEffect(() => {
        if (!hasHydrated || autoOpened.current) return;

        autoOpened.current = true;

        if (!apiKey) setOpen(true);
    }, [apiKey, hasHydrated]);

    const isDirty = hasHydrated && draft.trim().length > 0 && draft.trim() !== (apiKey ?? "");

    function onOpenChange(next: boolean) {
        setOpen(next);

        setDraft("");

        reset();
    }

    async function onSave() {
        if (await save(draft)) onOpenChange(false);
    }

    function onClear() {
        clearApiKey();

        onOpenChange(false);
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {me && (
                <Link aria-label={`Account: ${PLAN_LABELS[me.plan]} plan`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:hidden" to="/account">
                    <Badge data-testid="plan-badge" variant="secondary">{PLAN_LABELS[me.plan]}</Badge>
                </Link>
            )}
            <Dialog onOpenChange={onOpenChange} open={open}>
                <DialogTrigger
                    render={(
                        <Button
                            aria-label={hasKey ? "API Key is set" : "Set API Key"}
                            className="relative"
                            size="icon-lg"
                            variant={hasKey ? "secondary" : "outline"}
                        />
                    )}
                >
                    <KeyRound className={cn(hasKey ? "text-primary" : "text-muted-foreground")} />
                    {hasKey && (
                        <span className="bg-primary absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background" />
                    )}
                </DialogTrigger>

                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            API Key
                            {hasKey ? <Badge variant="secondary">set</Badge> : <Badge variant="outline">not set</Badge>}
                        </DialogTitle>
                    </DialogHeader>

                    <form
                        className="space-y-2"
                        onSubmit={(event) => {
                            event.preventDefault();

                            void onSave();
                        }}
                    >
                        <ApiKeyInput id="api-key" invalid={check.kind === "invalid"} onChange={setDraft} value={draft} />
                        <KeyCheckMessage check={check} />
                        <NoKeyYetHint />

                        <DialogFooter className="pt-2">
                            {hasKey && (
                                <Button onClick={onClear} type="button" variant="destructive">
                                    Clear
                                </Button>
                            )}
                            <DialogClose render={<Button type="button" variant="outline" />}>
                                Cancel
                            </DialogClose>
                            <Button disabled={!isDirty || check.kind === "checking"} type="submit">
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
