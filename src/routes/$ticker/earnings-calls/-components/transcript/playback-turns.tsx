import * as React from "react";

import type { HeardSegment, PlaybackSegment } from "@/lib/earnings/follow-along";

import { heardSegment, indexAt, segmentState } from "@/lib/earnings/follow-along";
import { usePlayerPosition } from "@/lib/player/player-context";
import { useFollowScroll } from "@/lib/player/use-follow-scroll";

import type { TurnBlockProps } from "./turn-block";

import { TurnBlock } from "./turn-block";

/** What a list's turns read: the heard segment, its active word and whether the audio plays. */
type Playback = { heard: HeardSegment; playing: boolean; segments: ReadonlyArray<PlaybackSegment>; word: number };

const NO_SEGMENTS: ReadonlyArray<PlaybackSegment> = [];

const IDLE: Playback = { heard: { index: -1, within: false }, playing: false, segments: NO_SEGMENTS, word: -1 };

const PlaybackContext = React.createContext<Playback>(IDLE);

/**
 * The ONE playback subscriber of a turn list (task O3; replaces `ActiveTurnBridge` and `FollowAlong`): it reads the
 * player's position every frame, works out the heard segment (`heardSegment`) and its word (`indexAt`), and publishes
 * them only when they change — so the turns (`PlaybackTurnBlock`) re-render at word rate, never at frame rate. It also
 * owns the list's Follow (`useFollowScroll`): the page keeps the heard segment in view while Follow is on.
 * `segments[i]` belongs to the block rendered with `index={i}`.
 */
export function PlaybackTurns({
    children,
    className,
    segments,
}: {
    children: React.ReactNode;
    className?: string;
    segments: ReadonlyArray<PlaybackSegment>;
}) {
    const { playing, positionMs } = usePlayerPosition();

    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const heard = heardSegment(segments, positionMs);

    const activeWords = heard.within ? segments[heard.index]?.words ?? null : null;

    const word = activeWords === null ? -1 : indexAt(activeWords, positionMs);

    const { index, within } = heard;

    const value = React.useMemo<Playback>(
        () => ({ heard: { index, within }, playing, segments, word }),
        [index, playing, segments, within, word],
    );

    useFollowScroll({ activeIndex: within ? index : -1, containerRef, enabled: playing });

    return (
        <PlaybackContext value={value}>
            <div className={className} ref={containerRef}>{children}</div>
        </PlaybackContext>
    );
}

/** A `TurnBlock` whose state comes from the enclosing `PlaybackTurns` (by its `index`). */
export function PlaybackTurnBlock(props: Omit<TurnBlockProps, "activeWord" | "state">) {
    const { heard, playing, segments, word } = React.use(PlaybackContext);

    const segment = segments[props.index] ?? { startMs: props.startMs };

    const state = segmentState(segment, props.index, heard, playing);

    return <TurnBlock {...props} activeWord={state === "active" ? word : -1} state={state} />;
}
