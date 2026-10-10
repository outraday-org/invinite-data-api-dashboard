import * as React from "react";

import type { WordTurn } from "@/lib/earnings/follow-along";
import type { PlaybackPosition } from "@/lib/earnings/use-playback-position";

import { useEarningsAudio, useEarningsTranscript } from "@/lib/api/queries";
import { toWordTurns } from "@/lib/earnings/follow-along";
import { usePlaybackPosition } from "@/lib/earnings/use-playback-position";

type AudioQuery = ReturnType<typeof useEarningsAudio>;

type WordsQuery = ReturnType<typeof useEarningsTranscript>;

export type CallAudio = {
    /** The `/audio` query; idle (never sent) until the Audio tab first opens or a timestamp is clicked. */
    audio: AudioQuery;
    /**
     * The `format=words` transcript (one request, once a recording is in): what the follow
     * view and the caption line run over. Idle while nothing is loaded.
     */
    words: WordsQuery;
    /** `words` narrowed (`toWordTurns`); `[]` until it is in. */
    wordTurns: Array<WordTurn>;
    /** The page's one `<audio>` element, rendered by `AudioPlayer` while a recording is loaded. */
    audioRef: React.RefObject<HTMLAudioElement | null>;
    /** A recording (`/audio` or a played search hit) is in the element. */
    loaded: boolean;
    /** `/audio` was asked for (Audio tab or a timestamp click); the mini-player shows its progress. */
    requested: boolean;
    /**
     * A search hit's `audio_url` (already positioned by its `#t=<sec>` fragment) loaded into the
     * page's `<audio>` and played; `AudioPlayer` renders the element for it while `/audio` is idle.
     */
    playedUrl: null | PlayedUrl;
    /** Plays a search hit's `audio_url` in the page's `<audio>` element. */
    playUrl: (url: string) => void;
    /** Sets the element's playback rate. */
    setPlaybackRate: (rate: number) => void;
    /** Moves the position by `seconds` (clamped to the recording). */
    skip: (seconds: number) => void;
    /**
     * Seek + play; the first call requests `/audio` and plays once it is in. `null` when the call
     * has no recording to load (timestamps then render as text).
     */
    seekMs: ((ms: number) => void) | null;
};

/** `nonce` makes a second click on the same hit start it again. */
export type PlayedUrl = { nonce: number; url: string };

const CallAudioContext = React.createContext<CallAudio | null>(null);

/** Starts playback; a refusal (autoplay policy) is fine — the player's controls are there to press play. */
function playQuietly(element: HTMLMediaElement) {
    element.play().catch(() => undefined);
}

/** Moves to `ms` and plays, once the element knows its metadata. */
function seekElement(element: HTMLMediaElement, ms: number) {
    const start = () => {
        element.currentTime = Math.max(0, ms / 1000);

        playQuietly(element);
    };

    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
        start();

        return;
    }

    element.addEventListener("loadedmetadata", start, { once: true });
}

/**
 * Hosts the call's audio above the tabs, so a timestamp on any tab can seek and start the
 * recording while the Audio tab's player is hidden. The `/audio` request goes out the first
 * time the Audio tab opens (`audioTabOpen`) or a timestamp is clicked — never on page load:
 * before that the empty selector keeps it idle. A click before the recording is in is kept
 * and played once it loads.
 */
export function CallAudioProvider({
    audioTabOpen,
    children,
    eventId,
    hasAudio,
}: {
    audioTabOpen: boolean;
    children: React.ReactNode;
    eventId: string;
    hasAudio: boolean;
}) {
    const [requested, setRequested] = React.useState(false);

    if (!requested && hasAudio && audioTabOpen) setRequested(true);

    const audio = useEarningsAudio(requested ? { eventId } : {});

    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    // A seek clicked before the recording arrived (call ms); applied when its source is set.
    const pendingSeekRef = React.useRef<null | number>(null);

    const [playedUrl, setPlayedUrl] = React.useState<null | PlayedUrl>(null);

    const recordingUrl = audio.data?.url ?? null;

    // The src is set imperatively, never as a prop: a re-render with a refreshed presigned URL
    // would restart at 0. A replaced source resumes at the same position, rate and play state.
    React.useEffect(() => {
        const element = audioRef.current;

        if (!element || recordingUrl === null || element.getAttribute("src") === recordingUrl) return undefined;

        const hadSource = element.getAttribute("src") !== null;

        const position = element.currentTime;

        const wasPlaying = !element.paused;

        const rate = element.playbackRate;

        element.src = recordingUrl;

        if (!hadSource) {
            const pending = pendingSeekRef.current;

            pendingSeekRef.current = null;

            if (pending !== null) seekElement(element, pending);

            return undefined;
        }

        const restore = () => {
            element.currentTime = position;

            element.playbackRate = rate;

            if (wasPlaying) playQuietly(element);
        };

        element.addEventListener("loadedmetadata", restore, { once: true });

        return () => element.removeEventListener("loadedmetadata", restore);
    }, [recordingUrl]);

    // "Ask this call" → "Play from here": the hit's own URL starts at its `#t=` fragment.
    React.useEffect(() => {
        const element = audioRef.current;

        if (!element || playedUrl === null) return;

        element.src = playedUrl.url;

        playQuietly(element);
    }, [playedUrl]);

    const playUrl = (url: string) => {
        setPlayedUrl(previous => ({ nonce: (previous?.nonce ?? 0) + 1, url }));
    };

    const loaded = Boolean(audio.data) || playedUrl !== null;

    // The text to follow, asked for once a recording plays (a search hit plays the same recording).
    const words = useEarningsTranscript({ eventId: loaded ? eventId : undefined, format: "words" });

    const wordTurns = React.useMemo(() => (words.data ? toWordTurns(words.data.data) : []), [words.data]);

    const seek = (ms: number) => {
        const element = audioRef.current;

        if (!loaded || !element) {
            // Not loaded yet: remember the position and ask for the recording (no-op when asked).
            pendingSeekRef.current = ms;

            setRequested(true);

            return;
        }

        seekElement(element, ms);
    };

    const skip = (seconds: number) => {
        const element = audioRef.current;

        if (!element) return;

        const end = Number.isFinite(element.duration) ? element.duration : Number.POSITIVE_INFINITY;

        element.currentTime = Math.min(end, Math.max(0, element.currentTime + seconds));
    };

    const setPlaybackRate = (rate: number) => {
        const element = audioRef.current;

        if (element) element.playbackRate = rate;
    };

    const value: CallAudio = {
        audio,
        audioRef,
        loaded,
        playedUrl,
        playUrl,
        requested,
        // A played search hit loads the same recording: its timestamps can seek it too.
        seekMs: hasAudio || playedUrl ? seek : null,
        setPlaybackRate,
        skip,
        words,
        wordTurns,
    };

    return <CallAudioContext value={value}>{children}</CallAudioContext>;
}

export function useCallAudio(): CallAudio {
    const value = React.use(CallAudioContext);

    if (!value) throw new Error("useCallAudio must be used inside CallAudioProvider");

    return value;
}

/**
 * The element's play state and position, read per frame while playing. Each consumer (the
 * caption line, the follow view, the Transcript tab's highlight) subscribes itself, so the
 * provider's tree is not re-rendered at frame rate.
 */
export function useCallPlayback(): PlaybackPosition {
    const { audioRef, loaded } = useCallAudio();

    return usePlaybackPosition(audioRef, loaded);
}
