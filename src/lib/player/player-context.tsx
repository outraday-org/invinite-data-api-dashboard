import * as React from "react";

import type { PlaybackPosition } from "@/lib/earnings/use-playback-position";

import { usePlaybackPosition } from "@/lib/earnings/use-playback-position";

import type { PlayerEngine } from "./engine";

import { engineHasMedia } from "./engine";

/**
 * A live engine's call clock (O4): media ms + `offsetMs` = call ms (the live transcript's `start_ms`), and the
 * listener's play state (a sync hold pauses the element, not the listener: the text stays highlighted meanwhile).
 */
export type PlayerClock = { offsetMs: number; playing: boolean };

/**
 * What the call page's player context carries: the engine's slow fields and actions, never the per-frame position
 * (`usePlayerPosition()` subscribes each reader on its own, so the page is not re-rendered at frame rate).
 */
export type CallPlayerValue = {
    engine: PlayerEngine;
    /**
     * The call has media a timestamp can play (a recording, a played search hit, later the live stream). `false` =
     * timestamps render as text; it never depends on whether the media is loaded yet (`engine.seekMs` queues).
     */
    canSeek: boolean;
    /** The transcript follows the audio (default on, not persisted); the reader's scroll switches it off. */
    follow: boolean;
    setFollow: (on: boolean) => void;
    /** The engine's media element: the per-frame position source of `usePlayerPosition()`. */
    mediaRef: React.RefObject<HTMLMediaElement | null>;
    /** The call clock when it is not the media clock (a live stream); absent = the media clock is the call clock. */
    clock?: PlayerClock;
};

const CallPlayerContext = React.createContext<CallPlayerValue | null>(null);

/** Provides an engine to the page; the follow state lives here (an engine knows nothing about scrolling). */
export function CallPlayerProvider({
    canSeek,
    children,
    clock,
    engine,
    mediaRef,
}: {
    canSeek: boolean;
    children: React.ReactNode;
    clock?: PlayerClock;
    engine: PlayerEngine;
    mediaRef: React.RefObject<HTMLMediaElement | null>;
}) {
    const [follow, setFollow] = React.useState(true);

    // Memoised: a provider re-rendered by a media hook (the live one, on every `timeupdate`) re-renders no reader.
    const value = React.useMemo<CallPlayerValue>(
        () => ({ canSeek, clock, engine, follow, mediaRef, setFollow }),
        [canSeek, clock, engine, follow, mediaRef],
    );

    return <CallPlayerContext value={value}>{children}</CallPlayerContext>;
}

export function usePlayer(): CallPlayerValue {
    const value = React.use(CallPlayerContext);

    if (!value) throw new Error("usePlayer must be used inside CallPlayerProvider");

    return value;
}

/**
 * The play state and position (call clock), read per frame while playing. Each consumer (the seek bar, the caption
 * line, the transcript highlight, the slide timeline) subscribes itself. Idle until the engine has media. A live
 * engine's `clock` maps the media clock to the call clock (position, buffered end, duration) and gives the play state.
 */
export function usePlayerPosition(): PlaybackPosition {
    const { clock, engine, mediaRef } = usePlayer();

    const media = usePlaybackPosition(mediaRef, engineHasMedia(engine.state));

    if (!clock || !engineHasMedia(engine.state)) return media;

    return {
        bufferedMs: media.bufferedMs > 0 ? media.bufferedMs + clock.offsetMs : 0,
        durationMs: media.durationMs === null ? null : media.durationMs + clock.offsetMs,
        playing: clock.playing,
        positionMs: Math.max(0, media.positionMs + clock.offsetMs),
    };
}
