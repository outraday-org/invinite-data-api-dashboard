import * as React from "react";

import type { V2AudioResponse } from "@/lib/api/types";
import type { WordTurn } from "@/lib/earnings/follow-along";
import type { PlayedUrl } from "@/lib/player/file-engine";

import { useV2Audio, useV2Transcript } from "@/lib/api/queries";
import { toWordTurns } from "@/lib/earnings/follow-along";
import { engineHasMedia } from "@/lib/player/engine";
import { useFileEngine } from "@/lib/player/file-engine";
import { CallPlayerProvider } from "@/lib/player/player-context";

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
    /** The call has something a timestamp can play (`has_audio`, or a played search hit). */
    canSeek: boolean;
    /** Seek + play (the engine's `seekMs`); the first call requests `/audio` and plays once it is in. */
    seekMs: (ms: number) => void;
    /**
     * The webcast slide changes on the recording's clock, as seek-bar markers: published by the Slides tab once its
     * `/slides?include=timeline` answer is in (never requested for the markers alone), kept when the tab closes.
     */
    slideMarkers: ReadonlyArray<PlayerMarker>;
    setSlideMarkers: (markers: ReadonlyArray<PlayerMarker>) => void;
};

const CallAudioContext = React.createContext<CallAudio | null>(null);

/**
 * The call's recording for the whole page: the file engine (`useFileEngine`) on the page's one hidden `<audio>`
 * element, provided to `CallPlayer` and every timestamp through the player context (`usePlayer`), plus the
 * recording's own data (`useCallAudio`: the `/audio` answer, the words transcript, search-hit playback). The `/audio`
 * request goes out on the first play or timestamp click — never on page load (an empty id keeps it idle).
 */
export function CallAudioProvider({
    children,
    eventId,
    hasAudio,
}: {
    children: React.ReactNode;
    eventId: string;
    hasAudio: boolean;
}) {
    const [requested, setRequested] = React.useState(false);

    const audio = useV2Audio(requested ? eventId : "");

    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    const [playedUrl, setPlayedUrl] = React.useState<null | PlayedUrl>(null);

    const [slideMarkers, setSlideMarkers] = React.useState<ReadonlyArray<PlayerMarker>>([]);

    const recording = audio.data ?? null;

    const engine = useFileEngine({
        error: audio.error,
        hit: playedUrl,
        mediaRef: audioRef,
        onRequest: () => setRequested(true),
        recordingUrl: recording?.url ?? null,
        requested,
    });

    const playUrl = (url: string) => {
        setPlayedUrl(previous => ({ nonce: (previous?.nonce ?? 0) + 1, url }));
    };

    const loaded = recording !== null || playedUrl !== null;

    // The text to follow, asked for once a recording plays (a search hit plays the same recording).
    const words = useV2Transcript({ eventId: loaded ? eventId : "", words: true });

    const wordTurns = React.useMemo(() => (words.data ? toWordTurns(words.data.turns) : []), [words.data]);

    // A played search hit loads the same recording: its timestamps can seek it too.
    const canSeek = hasAudio || playedUrl !== null;

    const value: CallAudio = {
        audio,
        canSeek,
        loaded: loaded && engineHasMedia(engine.state),
        playedUrl,
        playUrl,
        recording,
        seekMs: ms => engine.seekMs(ms),
        setSlideMarkers,
        slideMarkers,
        words,
        wordTurns,
    };

    return (
        <CallAudioContext value={value}>
            <CallPlayerProvider canSeek={canSeek} engine={engine} mediaRef={audioRef}>
                {/* The one media element of the page, without controls: `CallPlayer` is its UI. */}
                {/* Captions do not exist for a call recording; the transcript is its text. */}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio className="hidden" preload="metadata" ref={audioRef} />
                {children}
            </CallPlayerProvider>
        </CallAudioContext>
    );
}

export function useCallAudio(): CallAudio {
    const value = React.use(CallAudioContext);

    if (!value) throw new Error("useCallAudio must be used inside CallAudioProvider");

    return value;
}
