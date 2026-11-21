import * as React from "react";
import { toast } from "sonner";

import { keyValidText } from "@/lib/account";
import { fromSerialized, isUnauthorized } from "@/lib/api/errors";
import { getMe } from "@/lib/api/server-functions";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

export type KeyCheck
    = | { kind: "checking" }
        | { kind: "idle" }
        | { kind: "invalid"; message: string }
        | { kind: "valid"; message: string };

/** The inline message of a refused or uncheckable key. */
export function keyErrorText(error: unknown) {
    const apiError = fromSerialized(error);

    if (isUnauthorized(apiError)) return "This key was refused. Check it in your Data API dashboard; your previous key is kept.";

    const message = apiError?.message ?? (error instanceof Error ? error.message : String(error));

    return `The key could not be checked (${message}); your previous key is kept.`;
}

/**
 * Saving a key validates it first: `GET /v1/me` with the draft (0 credits). Valid → the key is stored, "Key valid · PRO
 * plan · N credits"; refused → an inline error and the stored key stays. `save` resolves true when the key was stored.
 */
export function useKeyValidation() {
    const setApiKey = useApiKeyStore(s => s.setApiKey);

    const [check, setCheck] = React.useState<KeyCheck>({ kind: "idle" });

    const save = React.useCallback(async (draft: string) => {
        const key = draft.trim();

        if (!key) {
            setCheck({ kind: "invalid", message: "Enter a key first." });

            return false;
        }

        setCheck({ kind: "checking" });

        try {
            const me = await getMe({ data: { apiKey: key } });

            const message = keyValidText(me);

            setApiKey(key);

            setCheck({ kind: "valid", message });

            toast.success(message);

            return true;
        }
        catch (error) {
            setCheck({ kind: "invalid", message: keyErrorText(error) });

            return false;
        }
    }, [setApiKey]);

    const reset = React.useCallback(() => setCheck({ kind: "idle" }), []);

    return { check, reset, save };
}
