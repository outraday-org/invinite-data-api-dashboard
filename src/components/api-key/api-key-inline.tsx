import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { cn } from "@/lib/utils";

import { NoKeyYetHint } from "./no-key-yet";

export function ApiKeyInlineField({ className }: { className?: string }) {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const clearApiKey = useApiKeyStore(s => s.clearApiKey);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    const setApiKey = useApiKeyStore(s => s.setApiKey);

    const [draft, setDraft] = React.useState("");

    React.useEffect(() => {
        if (!hasHydrated) return;

        setDraft(apiKey ?? "");
    }, [apiKey, hasHydrated]);

    const hasKey = hasHydrated && Boolean(apiKey);

    const isDirty = hasHydrated && draft.trim() !== (apiKey ?? "");

    function onSave() {
        setApiKey(draft);
    }

    function onClear() {
        clearApiKey();

        setDraft("");
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2" htmlFor="api-key-inline">
                    API Key
                    {hasHydrated
                        && (hasKey
                            ? (
                                    <Badge variant="secondary">set</Badge>
                                )
                            : (
                                    <Badge variant="outline">not set</Badge>
                                ))}
                </Label>

                {hasKey && (
                    <Button onClick={onClear} type="button" variant="destructive">
                        Clear
                    </Button>
                )}
            </div>

            <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();

                    onSave();
                }}
            >
                <Input
                    autoComplete="off"
                    id="api-key-inline"
                    onChange={e => setDraft(e.target.value)}
                    placeholder="invd_..."
                    spellCheck={false}
                    type="password"
                    value={draft}
                />
                <Button disabled={!isDirty} type="submit">
                    Save
                </Button>
            </form>
            <NoKeyYetHint />
        </div>
    );
}
