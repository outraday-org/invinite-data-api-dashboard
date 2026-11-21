import type { LiveAudioMode } from "@/lib/live/live-sync";

import { parseLiveMode } from "@/lib/live/live-sync";

/** The live call's playback mode ("Synced" / "Live audio"), remembered per browser (moved from `live-player.tsx`, O4). */
export const LIVE_MODE_STORAGE_KEY = "invinite-data-api-live-mode";

/** The remembered mode; a refused origin or the server read as none. */
export function readStoredLiveMode(): LiveAudioMode | null {
    try {
        return typeof window === "undefined" ? null : parseLiveMode(window.localStorage.getItem(LIVE_MODE_STORAGE_KEY));
    }
    catch {
        return null;
    }
}

export function writeStoredLiveMode(mode: LiveAudioMode): void {
    try {
        if (typeof window !== "undefined") window.localStorage.setItem(LIVE_MODE_STORAGE_KEY, mode);
    }
    catch {
        // The choice holds for this page and is forgotten on reload.
    }
}
