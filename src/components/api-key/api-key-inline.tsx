import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { cn } from "@/lib/utils";

import { ApiKeyInput, KeyCheckMessage } from "./api-key-input";
import { NoKeyYetHint } from "./no-key-yet";
import { useKeyValidation } from "./use-key-validation";

/** The key field of the onboarding card: saving validates the key (`/v1/me`) before storing it. */
export function ApiKeyInlineField({ className }: { className?: string }) {
    const apiKey = useApiKeyStore(s => s.apiKey);

    const clearApiKey = useApiKeyStore(s => s.clearApiKey);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    const { check, reset, save } = useKeyValidation();

    const [draft, setDraft] = React.useState("");

    const hasKey = hasHydrated && Boolean(apiKey);

    const isDirty = hasHydrated && draft.trim().length > 0 && draft.trim() !== (apiKey ?? "");

    function onClear() {
        clearApiKey();

        setDraft("");

        reset();
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2" htmlFor="api-key-inline">
                    API Key
                    {hasHydrated && <Badge variant={hasKey ? "secondary" : "outline"}>{hasKey ? "set" : "not set"}</Badge>}
                </Label>

                {hasKey && (
                    <Button onClick={onClear} type="button" variant="destructive">
                        Clear
                    </Button>
                )}
            </div>

            <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                    event.preventDefault();

                    void save(draft).then(stored => stored && setDraft(""));
                }}
            >
                <ApiKeyInput id="api-key-inline" invalid={check.kind === "invalid"} onChange={setDraft} value={draft} />
                <Button disabled={!isDirty || check.kind === "checking"} type="submit">
                    Save
                </Button>
            </form>
            <KeyCheckMessage check={check} />
            <NoKeyYetHint />
        </div>
    );
}
