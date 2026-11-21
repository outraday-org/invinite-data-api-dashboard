import * as React from "react";

import type { PlaybackPosition } from "@/lib/earnings/use-playback-position";

import { usePlaybackPosition } from "@/lib/earnings/use-playback-position";

import type { PlayerEngine } from "./engine";

import { engineHasMedia } from "./engine";

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
};

const CallPlayerContext = React.createContext<CallPlayerValue | null>(null);

/** Provides an engine to the page; the follow state lives here (an engine knows nothing about scrolling). */
export function CallPlayerProvider({
    canSeek,
    children,
    engine,
    mediaRef,
}: {
    canSeek: boolean;
    children: React.ReactNode;
    engine: PlayerEngine;
    mediaRef: React.RefObject<HTMLMediaElement | null>;
}) {
    const [follow, setFollow] = React.useState(true);

    const value: CallPlayerValue = { canSeek, engine, follow, mediaRef, setFollow };

    return <CallPlayerContext value={value}>{children}</CallPlayerContext>;
}

export function usePlayer(): CallPlayerValue {
    const value = React.use(CallPlayerContext);

    if (!value) throw new Error("usePlayer must be used inside CallPlayerProvider");

    return value;
}

/**
 * The play state and position (call clock), read per frame while playing. Each consumer (the seek bar, the caption
 * line, the transcript highlight, the slide timeline) subscribes itself. Idle until the engine has media.
 */
export function usePlayerPosition(): PlaybackPosition {
    const { engine, mediaRef } = usePlayer();

    return usePlaybackPosition(mediaRef, engineHasMedia(engine.state));
}
