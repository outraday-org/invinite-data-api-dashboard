import { useState } from "react";

import type { LiveFilingsStop } from "@/lib/live/use-live-filings";

import { useApiBaseUrl } from "@/lib/api/queries";
import { useLiveFilings } from "@/lib/live/use-live-filings";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

/**
 * The live filings socket of a page (the stored key + the API base URL) and why it stopped. `onStopped` lets the page
 * turn its `?live=` off; `onReconnected` refetch its list (the stream replays nothing).
 */
export function useLiveFilingsFeed({ enabled, onReconnected, onStopped }: { enabled: boolean; onReconnected?: () => void; onStopped?: () => void }) {
    const [stop, setStop] = useState<LiveFilingsStop | null>(null);

    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const baseUrl = useApiBaseUrl();

    const live = useLiveFilings({
        apiKey,
        apiKeyUpdatedAt,
        baseUrl,
        enabled,
        onReconnected,
        onStop: (reason) => {
            setStop(reason);

            onStopped?.();
        },
    });

    return { ...live, clearStop: () => setStop(null), stop };
}
