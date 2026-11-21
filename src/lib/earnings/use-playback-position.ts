import * as React from "react";

export type PlaybackPosition = {
    /** End of the buffered range around the position, ms (0 when nothing around it is buffered). */
    bufferedMs: number;
    /** The element's duration in ms, null until known. */
    durationMs: null | number;
    playing: boolean;
    /** The element's position in ms; 0 while nothing is loaded. */
    positionMs: number;
};

const IDLE: PlaybackPosition = { bufferedMs: 0, durationMs: null, playing: false, positionMs: 0 };

/** The end (ms) of the element's buffered range that holds `seconds`; 0 without one. */
function bufferedEndMs(element: HTMLMediaElement, seconds: number): number {
    // jsdom answers no `buffered`.
    const ranges = element.buffered as TimeRanges | undefined;

    if (!ranges) return 0;

    for (let index = 0; index < ranges.length; index += 1) {
        if (ranges.start(index) <= seconds && seconds <= ranges.end(index)) return ranges.end(index) * 1000;
    }

    return 0;
}

/**
 * The play state and position of the page's `<audio>` element. Media events alone update the
 * position ~4 times a second; while playing a `requestAnimationFrame` loop reads it every
 * frame, so a word highlight lands on the word. Idle (`IDLE`) until a recording is in.
 */
export function usePlaybackPosition(audioRef: React.RefObject<HTMLMediaElement | null>, loaded: boolean): PlaybackPosition {
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
                bufferedMs: bufferedEndMs(element, element.currentTime),
                durationMs: Number.isFinite(element.duration) ? element.duration * 1000 : null,
                playing: !element.paused && !element.ended,
                positionMs: element.currentTime * 1000,
            };

            setState(previous =>
                previous.bufferedMs === next.bufferedMs && previous.durationMs === next.durationMs && previous.playing === next.playing && previous.positionMs === next.positionMs
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

        const events = ["durationchange", "emptied", "ended", "loadedmetadata", "pause", "progress", "seeked", "timeupdate"] as const;

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
