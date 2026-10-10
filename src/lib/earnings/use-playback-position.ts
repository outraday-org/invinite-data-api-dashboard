import * as React from "react";

export type PlaybackPosition = {
    /** The element's duration in ms, null until known. */
    durationMs: null | number;
    playing: boolean;
    /** The element's position in ms; 0 while nothing is loaded. */
    positionMs: number;
};

const IDLE: PlaybackPosition = { durationMs: null, playing: false, positionMs: 0 };

/**
 * The play state and position of the page's `<audio>` element. Media events alone update the
 * position ~4 times a second; while playing a `requestAnimationFrame` loop reads it every
 * frame, so a word highlight lands on the word. Idle (`IDLE`) until a recording is in.
 */
export function usePlaybackPosition(audioRef: React.RefObject<HTMLAudioElement | null>, loaded: boolean): PlaybackPosition {
    const [state, setState] = React.useState<PlaybackPosition>(IDLE);

    React.useEffect(() => {
        const element = audioRef.current;

        if (!loaded || !element) {
            setState(IDLE);

            return undefined;
        }

        let frame = 0;

        const read = () => {
            const next: PlaybackPosition = {
                durationMs: Number.isFinite(element.duration) ? element.duration * 1000 : null,
                playing: !element.paused && !element.ended,
                positionMs: element.currentTime * 1000,
            };

            setState(previous =>
                previous.durationMs === next.durationMs && previous.playing === next.playing && previous.positionMs === next.positionMs
                    ? previous
                    : next,
            );
        };

        const tick = () => {
            read();

            frame = element.paused ? 0 : requestAnimationFrame(tick);
        };

        const onPlay = () => {
            cancelAnimationFrame(frame);

            frame = requestAnimationFrame(tick);
        };

        const events = ["durationchange", "emptied", "ended", "loadedmetadata", "pause", "seeked", "timeupdate"] as const;

        events.forEach(name => element.addEventListener(name, read));

        element.addEventListener("play", onPlay);

        if (!element.paused) onPlay();
        else read();

        return () => {
            cancelAnimationFrame(frame);

            events.forEach(name => element.removeEventListener(name, read));

            element.removeEventListener("play", onPlay);
        };
    }, [audioRef, loaded]);

    return state;
}
