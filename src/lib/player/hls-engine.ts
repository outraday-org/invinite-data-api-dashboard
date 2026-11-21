import * as React from "react";

import type { LiveAudioMode } from "@/lib/live/live-sync";
import type { LiveAudio } from "@/lib/live/use-live-audio";

import { positionToCallMs } from "@/lib/live/position-to-call-ms";

import type { PlayerCapabilities, PlayerEngine, PlayerState, SeekOptions } from "./engine";
import type { PlayerClock } from "./player-context";

/** No speed while live (owner 2026-11-21), no file to save; ±15 s moves the playhead (behind the edge). */
const HLS_CAPABILITIES: PlayerCapabilities = { download: false, rate: false, skip: true };

/** A seek this close to the edge is a jump to live (End, the seek bar's right end): it never makes the player "behind". */
const AT_EDGE_MS = 1_000;

/** A clock offset moves only past this: hls.js's `playingDate` is whole ms, a jitter is no discontinuity. */
const OFFSET_SLACK_MS = 100;

export type HlsAudioView = Pick<LiveAudio, "autoplayBlocked" | "canJumpToLive" | "phase" | "position" | "started">;

/** The live audio's state on the player contract. */
export function hlsEngineState(audio: HlsAudioView, streamError: unknown): PlayerState {
    if (audio.phase === "unavailable") return "error";

    if (!audio.started) {
        if (streamError) return "error";

        return audio.phase === "ended" ? "ended" : "idle";
    }

    if (audio.phase === "ended") return "ended";

    // A refused autoplay: the element waits for the listener's play, so the bar shows its controls.
    if (audio.phase === "loading" || audio.phase === "idle") return audio.autoplayBlocked ? (audio.canJumpToLive ? "live-behind" : "live-edge") : "loading";

    return audio.canJumpToLive ? "live-behind" : "live-edge";
}

/**
 * Media time → call ms: `playingDate − call_t0 − currentTime` (constant between two discontinuities of the playlist).
 * `null` while unknown (no `playingDate` yet, no `call_t0`): the caller keeps its last one, or 0 = media time.
 */
export function hlsClockOffsetMs(position: HlsAudioView["position"], callT0: null | string): null | number {
    const t0Ms = callT0 === null ? Number.NaN : Date.parse(callT0);

    if (position.playingDate === null || Number.isNaN(t0Ms)) return null;

    return position.playingDate.getTime() - t0Ms - position.currentTime * 1000;
}

export type HlsEngineFields = {
    behindMs: number;
    endMs: null | number;
    positionMs: number;
    state: PlayerState;
};

/**
 * The slow fields, in whole seconds (the context changes at most once a second; per-frame readers use
 * `usePlayerPosition()`): `positionMs` = the heard call ms (media time without `call_t0`), `endMs` = the edge (hls.js's
 * sync position: the thumb sits at the right end at the edge), `behindMs` = `behindS` — in Synced 0 unless the listener
 * went back (`canJumpToLive`), the sync point's normal distance is not "behind".
 */
export function hlsEngineFields(audio: HlsAudioView, input: { callT0: null | string; mode: LiveAudioMode; offsetMs: number; streamError: unknown }): HlsEngineFields {
    const { position } = audio;

    const second = (ms: number) => Math.floor(ms / 1000) * 1000;

    const heardMs = positionToCallMs(position.heardDate, input.callT0) ?? position.currentTime * 1000 + input.offsetMs;

    const edgeSeconds = position.edgeSeconds;

    const behindS = input.mode === "synced" && !audio.canJumpToLive ? 0 : position.behindS;

    return {
        behindMs: second(behindS * 1000),
        endMs: edgeSeconds === null ? null : second(edgeSeconds * 1000 + input.offsetMs),
        positionMs: second(Math.max(0, heardMs)),
        state: hlsEngineState(audio, input.streamError),
    };
}

export type HlsEngineInput = {
    audio: LiveAudio;
    callT0: null | string;
    mediaRef: React.RefObject<HTMLMediaElement | null>;
    mode: LiveAudioMode;
    /** The `/live-audio` request's error (the plan gate, a licence refusal, an outage). */
    streamError: unknown;
};

const UNAVAILABLE = new Error("The live audio stream is unavailable");

/** The element's volume, read on its `volumechange` (the live hook does not track it). */
function useElementVolume(mediaRef: React.RefObject<HTMLMediaElement | null>) {
    const [volume, setVolume] = React.useState({ muted: false, volume: 1 });

    React.useEffect(() => {
        const element = mediaRef.current;

        if (!element) return undefined;

        const read = () => setVolume(previous => (previous.muted === element.muted && previous.volume === element.volume ? previous : { muted: element.muted, volume: element.volume }));

        element.addEventListener("volumechange", read);

        read();

        return () => element.removeEventListener("volumechange", read);
    }, [mediaRef]);

    return volume;
}

/**
 * The HLS engine (backend `tasks/data-api-dashboard` O4): `useLiveAudio` on the player contract. Every rule of
 * `live-sync.ts` stays in the live hook (0.9× hold, 3-s wait, 20-s jump); this only maps:
 *
 * - `state`: before "Tune in" `idle` (`play` = Tune in at the edge, `seekMs` = from the beginning, then the seek),
 *   `loading`, `live-edge` / `live-behind` (`canJumpToLive`: Live audio > 10 s behind, Synced after an explicit seek),
 *   `ended`, `error` (the stream request failed or the stream is unavailable).
 * - `seekMs(ms, { play })` → `seekCallMs` (`seekMedia` without `call_t0`); at the edge → `jumpToLive`. `skip` moves
 *   the media time, clamped to the edge. `setRate` does nothing: the sync rule's 0.9× is never a listener's speed.
 * - `paused` = the listener's pause (a sync hold pauses the element, not the listener); `clock` = the call clock of
 *   the per-frame position (`CallPlayerProvider`'s `clock`).
 *
 * The engine object changes only when a field does (whole seconds), so `usePlayer()` readers do not re-render on
 * every `timeupdate` of the live hook.
 */
export function useHlsEngine({ audio, callT0, mediaRef, mode, streamError }: HlsEngineInput): { clock: PlayerClock; engine: PlayerEngine } {
    const { muted, volume } = useElementVolume(mediaRef);

    // The last known offset: a seek clears `playingDate` until the next `timeupdate`.
    const [offsetMs, setOffsetMs] = React.useState(0);

    const measured = hlsClockOffsetMs(audio.position, callT0);

    if (measured !== null && Math.abs(measured - offsetMs) > OFFSET_SLACK_MS) setOffsetMs(measured);

    const fields = hlsEngineFields(audio, { callT0, mode, offsetMs, streamError });

    // The actions read the newest render's values (they are called from events, after it committed).
    const latest = React.useRef({ audio, callT0, fields, mediaRef });

    React.useLayoutEffect(() => {
        latest.current = { audio, callT0, fields, mediaRef };
    });

    // "▷ m:ss" before "Tune in": the stream starts from the beginning and the seek waits for the audio.
    const pendingSeekRef = React.useRef<null | { ms: number; play: boolean }>(null);

    const actions = React.useMemo(() => {
        const seekNow = (ms: number) => {
            const { audio: live, callT0: t0, fields: now } = latest.current;

            if (now.endMs !== null && ms >= now.endMs - AT_EDGE_MS) {
                live.jumpToLive();

                return;
            }

            if (t0 === null) live.seekMedia(Math.max(0, ms) / 1000);
            else live.seekCallMs(Math.max(0, ms));
        };

        const play = () => {
            const { audio: live } = latest.current;

            if (!live.started) live.start("live");
            else if (!live.isPlaying) live.togglePlay();
        };

        return {
            jumpToLive: () => {
                const { audio: live } = latest.current;

                if (live.started) live.jumpToLive();
                else live.start("live");
            },
            pause: () => {
                const { audio: live } = latest.current;

                if (live.isPlaying) live.togglePlay();
            },
            play,
            seekMs: (ms: number, options?: SeekOptions) => {
                const shouldPlay = options?.play ?? true;

                const { audio: live } = latest.current;

                if (!live.started) {
                    // From the beginning: the stream starts at its first second; any other point waits for the audio.
                    pendingSeekRef.current = ms > 0 ? { ms, play: shouldPlay } : null;

                    live.start("beginning");

                    return;
                }

                seekNow(ms);

                if (shouldPlay && !live.isPlaying) live.togglePlay();
            },
            seekNow,
            setRate: () => undefined,
            setVolume: (level: number, mute: boolean) => {
                const element = latest.current.mediaRef.current;

                if (!element) return;

                element.volume = Math.min(1, Math.max(0, level));

                element.muted = mute;
            },
            skip: (seconds: number) => {
                const { audio: live } = latest.current;

                if (!live.started) return;

                const target = live.position.currentTime + seconds;

                const edge = live.position.edgeSeconds;

                if (seconds > 0 && edge !== null && target >= edge) live.jumpToLive();
                else live.seekMedia(Math.max(0, target));
            },
        };
    }, []);

    // The queued seek, once the stream plays (its fragments are known then).
    const playing = audio.phase === "playing";

    React.useEffect(() => {
        const pending = pendingSeekRef.current;

        if (!playing || pending === null) return;

        pendingSeekRef.current = null;

        actions.seekNow(pending.ms);

        if (!pending.play) actions.pause();
    }, [actions, playing]);

    const paused = !audio.isPlaying;

    const { behindMs, endMs, positionMs, state } = fields;

    const error = audio.phase === "unavailable" ? UNAVAILABLE : streamError;

    const synced = mode === "synced";

    const { buffering } = audio;

    const engine = React.useMemo<PlayerEngine>(() => ({
        behindMs,
        buffering,
        capabilities: HLS_CAPABILITIES,
        endMs,
        error,
        jumpToLive: actions.jumpToLive,
        muted,
        pause: actions.pause,
        paused,
        play: actions.play,
        positionMs,
        rate: 1,
        seekMs: actions.seekMs,
        setRate: actions.setRate,
        setVolume: actions.setVolume,
        skip: actions.skip,
        state,
        synced,
        volume,
    }), [actions, behindMs, buffering, endMs, error, muted, paused, positionMs, state, synced, volume]);

    const clock = React.useMemo<PlayerClock>(() => ({ offsetMs, playing: audio.isPlaying }), [audio.isPlaying, offsetMs]);

    return { clock, engine };
}
