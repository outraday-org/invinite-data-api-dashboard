import { useCallback, useEffect, useRef } from "react";

import { MEDIA_URL_REFRESH_BEFORE_MS, msUntilRefresh } from "./media-timing";

/**
 * Keeps a presigned media URL fresh: refetches the query `beforeMs` ahead of `expiresAt`
 * (presigned URLs live 15 min by default) and once more on a media load error (a URL that
 * expired while the tab slept). The caller swaps the new URL in; the audio host keeps its
 * position and paused state across the swap.
 */
export function useMediaUrl({
    beforeMs = MEDIA_URL_REFRESH_BEFORE_MS,
    expiresAt,
    refetch,
}: {
    beforeMs?: number;
    expiresAt: null | string | undefined;
    refetch: () => unknown;
}) {
    useEffect(() => {
        const waitMs = msUntilRefresh(expiresAt ?? null, Date.now(), beforeMs);

        if (waitMs === undefined) return undefined;

        const timer = setTimeout(() => void refetch(), waitMs);

        return () => clearTimeout(timer);
    }, [beforeMs, expiresAt, refetch]);

    // One refetch per URL generation: a URL that still fails after it is fresh is a real error.
    const retriedForRef = useRef<null | string>(null);

    const onMediaError = useCallback(() => {
        if (!expiresAt || retriedForRef.current === expiresAt) return;

        retriedForRef.current = expiresAt;

        void refetch();
    }, [expiresAt, refetch]);

    return { onMediaError };
}
