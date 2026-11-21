/**
 * The call player's engine contract (backend `tasks/data-api-dashboard` O2). `CallPlayer` renders its controls from
 * `state` and `capabilities` only; an engine owns the media element and its source. The file engine
 * (`file-engine.ts`) plays a finished recording; the HLS engine (`hls-engine.ts`, O4) a live call.
 */
export type PlayerState = "ended" | "error" | "idle" | "live-behind" | "live-edge" | "loading" | "recording";

export type PlayerCapabilities = { download: boolean; rate: boolean; skip: boolean };

export type SeekOptions = {
    /** Start playing at the target (a timestamp click). Default `true`; the seek bar passes `false`. */
    play?: boolean;
};

export type PlayerEngine = {
    state: PlayerState;
    /**
     * Position in the call, ms (call clock: 0 = call start) at the last state event (play, pause, seek, duration).
     * Per-frame readers use `usePlayerPosition()`: the context is never updated at frame rate.
     */
    positionMs: number;
    /** Recording: its length. Live: the live edge. null while unknown. */
    endMs: null | number;
    /** Live only: how far behind the edge, ms (0 at the edge). */
    behindMs: number;
    paused: boolean;
    buffering: boolean;
    rate: number;
    volume: number;
    muted: boolean;
    capabilities: PlayerCapabilities;
    /** From `idle` it starts the lazy request and plays from the start once the media is in. */
    play: () => void;
    pause: () => void;
    /** Always callable: before the media is in it queues the seek and starts the lazy request. */
    seekMs: (ms: number, options?: SeekOptions) => void;
    skip: (seconds: number) => void;
    setRate: (rate: number) => void;
    setVolume: (volume: number, muted: boolean) => void;
    /** Live only: back to the edge (before "Tune in": tune in at the edge). */
    jumpToLive?: () => void;
    /** Live only: the audio is held to the transcript ("Synced"): the pill reads `LIVE · synced`. */
    synced?: boolean;
    error: unknown;
};

/** A state with media in the element (position, seek bar, follow); `idle` / `loading` / `error` have none. */
export function engineHasMedia(state: PlayerState): boolean {
    return state === "recording" || state === "ended" || state === "live-edge" || state === "live-behind";
}

export const PLAYER_SKIP_SECONDS = 15;

/** The speeds of a recording (no speed while live, owner 2026-11-21). */
export const PLAYER_RATES = [1, 1.5, 2] as const;

export const PLAYER_RATE_STORAGE_KEY = "invinite-data-api-player-rate";

/** The remembered speed; a refused origin, the server or an unknown value read as none. */
export function readStoredRate(): null | number {
    try {
        if (typeof window === "undefined") return null;

        const rate = Number(window.localStorage.getItem(PLAYER_RATE_STORAGE_KEY));

        return (PLAYER_RATES as ReadonlyArray<number>).includes(rate) ? rate : null;
    }
    catch {
        return null;
    }
}

export function writeStoredRate(rate: number): void {
    try {
        if (typeof window !== "undefined") window.localStorage.setItem(PLAYER_RATE_STORAGE_KEY, String(rate));
    }
    catch {
        // The speed holds for this page and is forgotten on reload.
    }
}
