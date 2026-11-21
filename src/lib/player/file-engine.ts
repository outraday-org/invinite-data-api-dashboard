import * as React from "react";

import type { PlayerCapabilities, PlayerEngine, PlayerState, SeekOptions } from "./engine";

/** A search hit's `audio_url` (positioned by its `#t=<sec>` fragment); `nonce` makes a second click start it again. */
export type PlayedUrl = { nonce: number; url: string };

const FILE_CAPABILITIES: PlayerCapabilities = { download: true, rate: true, skip: true };

/** What the element says, read on its (slow) media events. */
type ElementFields = {
    buffering: boolean;
    ended: boolean;
    endMs: null | number;
    mediaError: MediaError | null;
    muted: boolean;
    paused: boolean;
    positionMs: number;
    rate: number;
    volume: number;
};

const INITIAL: ElementFields = {
    buffering: false,
    ended: false,
    endMs: null,
    mediaError: null,
    muted: false,
    paused: true,
    positionMs: 0,
    rate: 1,
    volume: 1,
};

const ELEMENT_EVENTS = [
    "canplay",
    "durationchange",
    "emptied",
    "ended",
    "error",
    "loadedmetadata",
    "pause",
    "play",
    "playing",
    "ratechange",
    "seeked",
    "volumechange",
] as const;

/** Starts playback; a refusal (autoplay policy) is fine — the player's play button is there. */
function playQuietly(element: HTMLMediaElement) {
    element.play().catch(() => undefined);
}

/** Moves to `ms` (and plays unless `play` is false), once the element knows its metadata. */
function seekElement(element: HTMLMediaElement, ms: number, play: boolean) {
    const start = () => {
        element.currentTime = Math.max(0, ms / 1000);

        if (play) playQuietly(element);
    };

    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
        start();

        return;
    }

    element.addEventListener("loadedmetadata", start, { once: true });
}

/** Sets the element's source (a module function: the engine never assigns to its `mediaRef`'s element in a hook body). */
function loadSource(element: HTMLMediaElement, url: string) {
    element.src = url;
}

function sameFields(a: ElementFields, b: ElementFields) {
    return (Object.keys(a) as Array<keyof ElementFields>).every(key => a[key] === b[key]);
}

/**
 * The file engine: a finished recording at its permanent public URL in the page's one `<audio>` element
 * (`mediaRef`, rendered hidden by the provider). Nothing is requested on page load: `play` / `seekMs` before the
 * recording is in call `onRequest` (the `/audio` request) and the seek waits in `pendingSeekRef` until the source is
 * set. The src is set imperatively, so a changed recording URL swaps in at the same position, rate and play state;
 * a played search hit (`hit`) replaces the source and plays from its `#t=` fragment.
 */
export function useFileEngine({
    error,
    hit,
    mediaRef,
    onRequest,
    recordingUrl,
    requested,
}: {
    /** The `/audio` request's error. */
    error: unknown;
    hit: null | PlayedUrl;
    mediaRef: React.RefObject<HTMLMediaElement | null>;
    onRequest: () => void;
    recordingUrl: null | string;
    requested: boolean;
}): PlayerEngine {
    const [fields, setFields] = React.useState<ElementFields>(INITIAL);

    // A seek asked for before the recording arrived (call ms); applied when its source is set.
    const pendingSeekRef = React.useRef<null | { ms: number; play: boolean }>(null);

    const hasSource = recordingUrl !== null || hit !== null;

    React.useEffect(() => {
        const element = mediaRef.current;

        if (!element) return undefined;

        const read = () => {
            const next: ElementFields = {
                buffering: element.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && !element.paused && element.getAttribute("src") !== null,
                ended: element.ended,
                endMs: Number.isFinite(element.duration) ? element.duration * 1000 : null,
                mediaError: element.error,
                muted: element.muted,
                paused: element.paused,
                positionMs: element.currentTime * 1000,
                rate: element.playbackRate,
                volume: element.volume,
            };

            setFields(previous => (sameFields(previous, next) ? previous : next));
        };

        const onWaiting = () => setFields(previous => (previous.buffering ? previous : { ...previous, buffering: true }));

        ELEMENT_EVENTS.forEach(name => element.addEventListener(name, read));

        element.addEventListener("waiting", onWaiting);

        read();

        return () => {
            ELEMENT_EVENTS.forEach(name => element.removeEventListener(name, read));

            element.removeEventListener("waiting", onWaiting);
        };
    }, [mediaRef]);

    React.useEffect(() => {
        const element = mediaRef.current;

        if (!element || recordingUrl === null || element.getAttribute("src") === recordingUrl) return undefined;

        const hadSource = element.getAttribute("src") !== null;

        const position = element.currentTime;

        const wasPlaying = !element.paused;

        const rate = element.playbackRate;

        loadSource(element, recordingUrl);

        if (!hadSource) {
            const pending = pendingSeekRef.current;

            pendingSeekRef.current = null;

            if (pending !== null) seekElement(element, pending.ms, pending.play);

            return undefined;
        }

        const restore = () => {
            element.currentTime = position;

            element.playbackRate = rate;

            if (wasPlaying) playQuietly(element);
        };

        element.addEventListener("loadedmetadata", restore, { once: true });

        return () => element.removeEventListener("loadedmetadata", restore);
    }, [mediaRef, recordingUrl]);

    // "Search this call" → "Play from here": the hit's own URL starts at its `#t=` fragment.
    React.useEffect(() => {
        const element = mediaRef.current;

        if (!element || hit === null) return;

        pendingSeekRef.current = null;

        loadSource(element, hit.url);

        playQuietly(element);
    }, [hit, mediaRef]);

    let state: PlayerState;

    if (hasSource) state = fields.mediaError ? "error" : fields.ended ? "ended" : "recording";
    else if (error) state = "error";
    else state = requested ? "loading" : "idle";

    const element = () => mediaRef.current;

    const seekMs = (ms: number, options?: SeekOptions) => {
        const play = options?.play ?? true;

        const target = element();

        if (!hasSource || !target) {
            // Not loaded yet: remember the position and ask for the recording (a no-op once asked).
            pendingSeekRef.current = { ms, play };

            onRequest();

            return;
        }

        seekElement(target, ms, play);
    };

    return {
        behindMs: 0,
        buffering: fields.buffering,
        capabilities: FILE_CAPABILITIES,
        endMs: fields.endMs,
        error: hasSource ? fields.mediaError : error,
        muted: fields.muted,
        pause: () => element()?.pause(),
        paused: fields.paused,
        play: () => {
            const target = element();

            if (!hasSource || !target) seekMs(0);
            else playQuietly(target);
        },
        positionMs: fields.positionMs,
        rate: fields.rate,
        seekMs,
        setRate: (rate: number) => {
            const target = element();

            if (!target) return;

            // The default too: a swapped source starts at the chosen speed.
            target.defaultPlaybackRate = rate;

            target.playbackRate = rate;
        },
        setVolume: (volume: number, muted: boolean) => {
            const target = element();

            if (!target) return;

            target.volume = Math.min(1, Math.max(0, volume));

            target.muted = muted;
        },
        skip: (seconds: number) => {
            const target = element();

            if (!target || !hasSource) return;

            const end = Number.isFinite(target.duration) ? target.duration : Number.POSITIVE_INFINITY;

            target.currentTime = Math.min(end, Math.max(0, target.currentTime + seconds));
        },
        state,
        volume: fields.volume,
    };
}
