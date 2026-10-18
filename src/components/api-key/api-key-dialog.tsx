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
import { Input } from "@/components/ui/input";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { cn } from "@/lib/utils";

import { NoKeyYetHint } from "./no-key-yet";

export function ApiKeyDialogButton({ className }: { className?: string }) {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const clearApiKey = useApiKeyStore(s => s.clearApiKey);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    const setApiKey = useApiKeyStore(s => s.setApiKey);

    const [open, setOpen] = React.useState(false);

    const [draft, setDraft] = React.useState("");

    const hasKey = hasHydrated && Boolean(apiKey);

    React.useEffect(() => {
        if (!hasHydrated) return;

        if (!open) return;

        setDraft(apiKey ?? "");
    }, [apiKey, hasHydrated, open]);

    const isDirty = hasHydrated && draft.trim() !== (apiKey ?? "");

    function onSave() {
        setApiKey(draft);

        setOpen(false);
    }

    function onClear() {
        clearApiKey();

        setDraft("");

        setOpen(false);
    }

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger
                render={(
                    <Button
                        aria-label={hasKey ? "API Key is set" : "Set API Key"}
                        className={cn("relative", className)}
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
                    onSubmit={(e) => {
                        e.preventDefault();

                        onSave();
                    }}
                >
                    <Input
                        autoComplete="off"
                        id="api-key"
                        onChange={e => setDraft(e.target.value)}
                        placeholder="invd_..."
                        spellCheck={false}
                        type="password"
                        value={draft}
                    />
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
                        <Button disabled={!isDirty} type="submit">
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
