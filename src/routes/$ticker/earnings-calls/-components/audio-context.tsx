import * as React from "react";

import type { V2AudioResponse, V2LiveAudioResponse } from "@/lib/api/types";
import type { WordTurn } from "@/lib/earnings/follow-along";
import type { LiveAudioMode } from "@/lib/live/live-sync";
import type { LiveAudio } from "@/lib/live/use-live-audio";
import type { KeywordWatch } from "@/lib/live/ws-frames";
import type { PlayedUrl } from "@/lib/player/file-engine";

import { useApiBaseUrl, useV2Audio, useV2LiveAudio, useV2Transcript } from "@/lib/api/queries";
import { toWordTurns } from "@/lib/earnings/follow-along";
import { newestReleasedFinal, resolveLiveMode } from "@/lib/live/live-sync";
import { useLiveAudio } from "@/lib/live/use-live-audio";
import { useLiveTranscript } from "@/lib/live/use-live-transcript";
import { engineHasMedia } from "@/lib/player/engine";
import { useFileEngine } from "@/lib/player/file-engine";
import { useHlsEngine } from "@/lib/player/hls-engine";
import { readStoredLiveMode, writeStoredLiveMode } from "@/lib/player/live-mode";
import { CallPlayerProvider } from "@/lib/player/player-context";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type { CallLiveSession, RecordingWait } from "./live/use-call-live-session";
import type { PlayerMarker } from "./player/seek-bar";

export type { PlayedUrl } from "@/lib/player/file-engine";

type AudioQuery = ReturnType<typeof useV2Audio>;

type WordsQuery = ReturnType<typeof useV2Transcript>;

export type CallAudio = {
    /** The `/audio` query; idle (never sent) until the first play or timestamp click. */
    audio: AudioQuery;
    /** `audio.data`: the recording at its permanent public URL; `null` while idle or loading. */
    recording: null | V2AudioResponse;
    /**
     * The transcript with its words (`include=words`, once a recording is in): what the caption line, the Q&A tab's
     * word highlight and the seek bar's Q&A marker (`qa_start_ms`) run over. Idle while nothing is loaded. The same
     * query (same key) as the Transcript tab's Speakers format of the current version: one request for both.
     */
    words: WordsQuery;
    /** `words` narrowed (`toWordTurns`); `[]` until it is in. */
    wordTurns: Array<WordTurn>;
    /** A recording (`/audio` or a played search hit) is in the element. */
    loaded: boolean;
    /** The search hit playing (its `audio_url`), when one was played. */
    playedUrl: null | PlayedUrl;
    /** Plays a search hit's `audio_url` in the page's `<audio>` element. */
    playUrl: (url: string) => void;
    /** The call has something a timestamp can play (`has_audio`, a played search hit, the live stream). */
    canSeek: boolean;
    /** Seek + play (the page's engine's `seekMs`); the first call requests `/audio` and plays once it is in. */
    seekMs: (ms: number) => void;
    /**
     * The link's `?t=` (call ms) while it still decides where the recording starts: the first Play starts there. `null`
     * once anything asked for the recording (a play, a timestamp, a search hit) or without a `?t=`.
     */
    startAtMs: null | number;
    /**
     * The webcast slide changes on the recording's clock, as seek-bar markers: published by the Slides tab once its
     * `/slides?include=timeline` answer is in (never requested for the markers alone), kept when the tab closes.
     */
    slideMarkers: ReadonlyArray<PlayerMarker>;
    setSlideMarkers: (markers: ReadonlyArray<PlayerMarker>) => void;
};

/** The live call the page follows (O4): the stream, the live hook, the transcript socket, the mode and the watch list. */
export type LiveCall = {
    audio: LiveAudio;
    /** The call ended (the socket said so). */
    callEnded: boolean;
    callT0: null | string;
    chooseMode: (mode: LiveAudioMode) => void;
    mode: LiveAudioMode;
    newestFinal: null | { endMs: number; startMs: number };
    /** The HLS engine is the page's engine (until the recording is published and takes over). */
    onAir: boolean;
    /** After the end: the event is polled for the recording, or gave up after 60 min. */
    recordingWait: RecordingWait;
    stream: null | V2LiveAudioResponse;
    /** The `/live-audio` request: `null` = not asked (the recording took over) or still asking. */
    streamError: unknown;
    streamStatus: "not_requested" | "request failed" | "requesting" | V2LiveAudioResponse["status"];
    transcript: ReturnType<typeof useLiveTranscript>;
    /**
     * Asks `/live-audio` once more (5 credits), on the listener's click only: a `not_started` answer is never polled
     * (one request per live view), so "Check again" is how the audio is found once it starts.
     */
    retryStream: () => void;
    /** A refused subscription ends the transcript for good: nothing to sync to, no mode choice. */
    transcriptVisible: boolean;
    watch: KeywordWatch;
    setWatch: (watch: KeywordWatch) => void;
};

const CallAudioContext = React.createContext<CallAudio | null>(null);

const LiveCallContext = React.createContext<LiveCall | null>(null);

const NO_WATCH: KeywordWatch = { keywords: [], match: "exact" };

/** A stream answer the live audio can play (`available`, or `ended` while its rendition is still served). */
function playableStream(stream: null | V2LiveAudioResponse): boolean {
    return stream !== null && (stream.status === "available" || stream.status === "ended");
}

/**
 * The call's audio for the whole page, behind ONE player context (`usePlayer`). Two engines run here, each inert until
 * it is used, and the provider publishes one (switching provider components would remount every tab):
 *
 * - FILE (`useFileEngine`): the finished recording on the page's hidden `<audio>`, plus the recording's own data
 *   (`useCallAudio()`: `/audio`, the words transcript, search-hit playback). `/audio` goes out on the first play or
 *   timestamp click — never on page load (an empty id keeps it idle).
 * - HLS (`useHlsEngine` over `useLiveAudio`, O4): while the page follows the call live (`live.sawLive`, a stored key)
 *   and the recording is not published, on a second hidden `<audio>`. With it the transcript socket
 *   (`useLiveTranscript`), the mode (Synced / Live audio, remembered per browser) and the watch list live here, read by
 *   the bar, the Transcript tab and the live slot through `useLiveCall()`.
 *
 * THE SWITCH: `has_audio` turning true takes the page to the recording without a reload: hls.js is stopped and, if the
 * listener had tuned in, the file engine starts at the same call position (playing only if the live audio played).
 * The transcript socket stays until it ends itself (`transcript_ready`), so the live text stays until the final one.
 */
export function CallAudioProvider({
    children,
    eventId,
    hasAudio,
    live,
    startAtMs,
}: {
    children: React.ReactNode;
    eventId: string;
    hasAudio: boolean;
    /** The page's live session (`useCallLiveSession`); absent = never live. */
    live?: CallLiveSession;
    /**
     * Where the first Play starts (the link's `?t=`, call ms). Read once: the recording is still never asked for on page
     * load (a pro operation billed per request), so a link at a time arms the Play button instead of loading the file.
     */
    startAtMs?: number;
}) {
    const [requested, setRequested] = React.useState(false);

    const audio = useV2Audio(requested ? eventId : "");

    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    const [playedUrl, setPlayedUrl] = React.useState<null | PlayedUrl>(null);

    const [slideMarkers, setSlideMarkers] = React.useState<ReadonlyArray<PlayerMarker>>([]);

    const recording = audio.data ?? null;

    // Only a call with a published recording at mount: a live call's link time is not applied (the stream has its own
    // "Tune in" / "From the beginning"; the handover keeps the live position).
    const [linkStartMs] = React.useState(() => (hasAudio && startAtMs !== undefined ? startAtMs : null));

    const fileEngineRaw = useFileEngine({
        error: audio.error,
        hit: playedUrl,
        mediaRef: audioRef,
        onRequest: () => setRequested(true),
        recordingUrl: recording?.url ?? null,
        requested,
    });

    // Armed until anything asks for the recording; then the listener's own seeks decide.
    const startAt = linkStartMs !== null && !requested && playedUrl === null ? linkStartMs : null;

    const fileEngine: typeof fileEngineRaw = startAt === null
        ? fileEngineRaw
        : { ...fileEngineRaw, play: () => fileEngineRaw.seekMs(startAt) };

    const playUrl = (url: string) => {
        setPlayedUrl(previous => ({ nonce: (previous?.nonce ?? 0) + 1, url }));
    };

    const loaded = recording !== null || playedUrl !== null;

    // The text to follow, asked for once a recording plays (a search hit plays the same recording).
    const words = useV2Transcript({ eventId: loaded ? eventId : "", words: true });

    const wordTurns = React.useMemo(() => (words.data ? toWordTurns(words.data.turns) : []), [words.data]);

    // ── Live (O4) ──────────────────────────────────────────────────────────────────────────────────────────────────

    const apiKey = useApiKeyStore(s => s.apiKey);

    const apiKeyUpdatedAt = useApiKeyStore(s => s.apiKeyUpdatedAt);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    // The socket opens from this browser with the stored key: no key, no live session ("Enter your API key").
    const following = live?.sawLive === true && hasHydrated && apiKey !== null;

    // A played search hit carries the recording's URL: it is published, even before the event's poll says `has_audio`
    // (never two elements playing at once).
    const onAir = following && !hasAudio && playedUrl === null;

    const baseUrl = useApiBaseUrl();

    // Credits: 5 per request — asked once per live view, once more for an expired token (`refreshStream`).
    const streamQuery = useV2LiveAudio(onAir ? eventId : "");

    const stream = streamQuery.data ?? null;

    const { refetch } = streamQuery;

    // A failed refetch resolves with the OLD answer still in `data`; reloading that URL would loop on the same 403.
    const refreshStream = async () => {
        const result = await refetch();

        if (result.isError) throw result.error;

        return result.data ?? null;
    };

    const [watch, setWatch] = React.useState<KeywordWatch>(NO_WATCH);

    const transcript = useLiveTranscript({ apiKey: following ? apiKey : null, apiKeyUpdatedAt, baseUrl, eventId, watch });

    const [storedMode, setStoredMode] = React.useState(readStoredLiveMode);

    const transcriptVisible = transcript.mode !== "error";

    const mode = resolveLiveMode(storedMode, transcriptVisible);

    const chooseMode = (next: LiveAudioMode) => {
        setStoredMode(next);

        writeStoredLiveMode(next);
    };

    const newestFinal = newestReleasedFinal(transcript.state.finals);

    const callEnded = transcript.state.ended || transcript.mode === "ended";

    // The ref apart from the state: the state is read during render, the ref only by `<audio>`.
    const { audioRef: liveAudioRef, ...liveAudio } = useLiveAudio({ callEnded, mode, newestFinal, refreshStream, stream });

    const callT0 = stream?.call_t0 ?? null;

    const hls = useHlsEngine({ audio: liveAudio, callT0, mediaRef: liveAudioRef, mode, streamError: streamQuery.error });

    // The HLS engine is no longer the page's. The recording published (`has_audio`): the live audio's place carries
    // over (only if the listener tuned in). A played search hit plays from its own `#t=`; a key removed mid-call
    // (no recording) only stops the stream — `/audio` would answer 404.
    const handOver = React.useEffectEvent(() => {
        if (!liveAudio.started) return;

        const media = liveAudioRef.current;

        const positionMs = media === null ? hls.engine.positionMs : Math.max(0, media.currentTime * 1000 + hls.clock.offsetMs);

        const play = liveAudio.isPlaying;

        liveAudio.stop();

        if (hasAudio && playedUrl === null) fileEngine.seekMs(positionMs, { play });
    });

    const wasOnAirRef = React.useRef(onAir);

    React.useEffect(() => {
        if (wasOnAirRef.current && !onAir) handOver();

        wasOnAirRef.current = onAir;
    }, [onAir]);

    const engine = onAir ? hls.engine : fileEngine;

    // A played search hit loads the same recording: its timestamps can seek it too.
    const canSeek = onAir ? playableStream(stream) : hasAudio || playedUrl !== null;

    const value: CallAudio = {
        audio,
        canSeek,
        loaded: !onAir && loaded && engineHasMedia(fileEngine.state),
        playedUrl,
        playUrl,
        recording,
        seekMs: ms => engine.seekMs(ms),
        setSlideMarkers,
        slideMarkers,
        startAtMs: onAir ? null : startAt,
        words,
        wordTurns,
    };

    const streamStatus: LiveCall["streamStatus"] = !onAir
        ? "not_requested"
        : stream?.status ?? (streamQuery.error ? "request failed" : "requesting");

    const liveCall: LiveCall | null = following
        ? {
                audio: liveAudio,
                callEnded,
                callT0,
                chooseMode,
                mode,
                newestFinal,
                onAir,
                recordingWait: live.recordingWait,
                retryStream: () => void refetch(),
                setWatch,
                stream,
                streamError: streamQuery.error,
                streamStatus,
                transcript,
                transcriptVisible,
                watch,
            }
        : null;

    return (
        <CallAudioContext value={value}>
            <LiveCallContext value={liveCall}>
                <CallPlayerProvider
                    canSeek={canSeek}
                    clock={onAir ? hls.clock : undefined}
                    engine={engine}
                    mediaRef={onAir ? liveAudioRef : audioRef}
                >
                    {/* The media elements of the page, without controls: `CallPlayer` is their UI. Captions do not */}
                    {/* exist for a call recording; the transcript is its text. The live one is always mounted, so "Tune */}
                    {/* in" has an element to attach hls.js to. */}
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio className="hidden" data-engine="file" preload="metadata" ref={audioRef} />
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio className="hidden" data-engine="live" preload="none" ref={liveAudioRef} />
                    {children}
                </CallPlayerProvider>
            </LiveCallContext>
        </CallAudioContext>
    );
}

export function useCallAudio(): CallAudio {
    const value = React.use(CallAudioContext);

    if (!value) throw new Error("useCallAudio must be used inside CallAudioProvider");

    return value;
}

/** The live call the page follows, or `null` (never live on this page, or no stored key). */
export function useLiveCall(): LiveCall | null {
    return React.use(LiveCallContext);
}
