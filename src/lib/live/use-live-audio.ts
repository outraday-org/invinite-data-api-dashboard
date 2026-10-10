import type HlsType from "hls.js";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EarningsLiveStreamResponse } from "@/lib/api/types";

import { LIVE_STREAM_REFRESH_BEFORE_MS, msUntilRefresh } from "@/lib/earnings/media-timing";

import type { PlaylistFragment } from "./position-to-call-ms";

import { LIVE_HLS_CONFIG, loadHls } from "./live-clients";
import { JUMP_TO_LIVE_AFTER_S, mediaTimeForCallMs, secondsBehindEdge } from "./position-to-call-ms";

/**
 * The live audio of one call: hls.js on the URL of `GET /v1/earnings-calls/live/stream`
 * (an `EVENT` playlist served by the edge Worker), or the browser's native HLS where there is
 * no MSE (Safari). Modelled on the admin console's `use-live-audio.ts`.
 *
 * - FATAL ERRORS: `404` (the rendition was deleted after publish) → `ended`. `403` (the token
 *   expired early) → ONE fresh URL (`refreshStream`) and a reload at the same position (the
 *   edge when within 3 s of it). Any other fatal error gets one recovery; the second failure
 *   → `unavailable`.
 * - EXPIRY: the URL lives 2 h. `LIVE_STREAM_REFRESH_BEFORE_MS` before the LOADED URL expires a
 *   new one is fetched and adopted through `reload()` at the current position. A new URL is
 *   never adopted otherwise: hls.js answers `loadSource` by re-attaching the media element,
 *   which stops playback, and every stream request costs 5 credits.
 * - STALLS: "buffering" past 5 s; one `stopLoad()` / `startLoad()` past 20 s (the edge when
 *   the stall began at the edge, else the same place — never a backwards seek).
 * - POSITION: hls.js's `playingDate` (from `#EXT-X-PROGRAM-DATE-TIME`), the live edge and the
 *   distance to it on the MEDIA timeline — never wall-clock arithmetic. Nothing logs the URL.
 */

export type LiveAudioPhase = "ended" | "idle" | "loading" | "playing" | "unavailable";

export type LiveAudioPosition = {
    readonly behindS: number;
    readonly currentTime: number;
    /** The live edge on the media timeline, `null` before it is known. */
    readonly edgeSeconds: null | number;
    readonly playingDate: Date | null;
};

const IDLE_POSITION: LiveAudioPosition = { behindS: 0, currentTime: 0, edgeSeconds: null, playingDate: null };

const BUFFERING_AFTER_MS = 5_000;

const STALL_KICK_AFTER_MS = 20_000;

/** The time must move on this far (s) past the stall's position to end it. */
const STALL_RESUMED_AFTER_S = 0.5;

/** Within this of the edge counts as "at the edge" for a reload. */
const AT_EDGE_S = 3;

export type LiveAudioHlsError = { readonly atMs: number; readonly details: string; readonly type: string };

/** Safari's native HLS exposes the playlist's program date through the non-standard `getStartDate()`. */
function nativeStartDate(media: HTMLMediaElement): Date | null {
    if (!("getStartDate" in media)) return null;

    const getStartDate = media.getStartDate;

    if (typeof getStartDate !== "function") return null;

    const value: unknown = getStartDate.call(media);

    return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function mediaEdge(media: HTMLMediaElement, hls: HlsType | null): null | number {
    const sync = hls?.liveSyncPosition;

    if (typeof sync === "number" && Number.isFinite(sync)) return sync;

    const ranges = media.seekable;

    return ranges.length > 0 ? ranges.end(ranges.length - 1) : null;
}

function hlsFragments(hls: HlsType | null): ReadonlyArray<PlaylistFragment> {
    if (hls === null) return [];

    const level = hls.levels.at(Math.max(0, hls.currentLevel));

    const fragments = level?.details?.fragments ?? [];

    return fragments.map(fragment => ({
        duration: fragment.duration,
        programDateTime: fragment.programDateTime ?? null,
        start: fragment.start,
    }));
}

/** The URL a stream answer lets us play (`available` / `ended`), else null. */
function playableUrl(stream: EarningsLiveStreamResponse | null): null | string {
    return stream !== null && (stream.status === "available" || stream.status === "ended") ? stream.url : null;
}

export type UseLiveAudioInput = {
    /** A fresh stream answer (the query's `refetch`); rejects on a failed request. */
    refreshStream: () => Promise<EarningsLiveStreamResponse | null>;
    stream: EarningsLiveStreamResponse | null;
};

export function useLiveAudio({ refreshStream, stream }: UseLiveAudioInput) {
    /** The always-mounted `<audio>` (`LivePlayer`); a ref, so effects may drive it. */
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const hlsRef = useRef<HlsType | null>(null);

    const [phase, setPhase] = useState<LiveAudioPhase>("idle");

    const [started, setStarted] = useState(false);

    const [position, setPosition] = useState<LiveAudioPosition>(IDLE_POSITION);

    const [rate, setRate] = useState(1);

    const [isPlaying, setIsPlaying] = useState(false);

    /** `play()` was refused (autoplay policy): the UI offers "Click to start". */
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);

    const [stallSince, setStallSince] = useState<null | number>(null);

    /** The stall episode (`stallSince`) the buffering timer fired for. */
    const [bufferingFor, setBufferingFor] = useState<null | number>(null);

    const [hlsErrorCount, setHlsErrorCount] = useState(0);

    const [lastHlsError, setLastHlsError] = useState<LiveAudioHlsError | null>(null);

    /** The loaded URL's expiry (the refresh timer runs off it, never off the query's answer). */
    const [loadedExpiresAt, setLoadedExpiresAt] = useState<null | string>(null);

    const stallRef = useRef<null | { atEdge: boolean; atTime: number; kicked: boolean }>(null);

    const refreshed403Ref = useRef(false);

    const failuresRef = useRef(0);

    const url = playableUrl(stream);

    const expiresAt = stream?.expires_at ?? null;

    const callT0 = stream?.call_t0 ?? null;

    const playMedia = useCallback((media: HTMLMediaElement) => {
        media.play().then(
            () => setAutoplayBlocked(false),
            () => setAutoplayBlocked(true),
        );
    }, []);

    const beginStall = useCallback(() => {
        const media = audioRef.current;

        if (media === null || media.paused || stallRef.current !== null) return;

        const behind = secondsBehindEdge(mediaEdge(media, hlsRef.current), media.currentTime);

        stallRef.current = { atEdge: behind <= JUMP_TO_LIVE_AFTER_S, atTime: media.currentTime, kicked: false };

        setStallSince(Date.now());
    }, []);

    const endStall = useCallback(() => {
        if (stallRef.current === null) return;

        stallRef.current = null;

        setStallSince(null);
    }, []);

    /** Load `nextUrl` at `startPosition` (`-1` = the edge) keeping hls.js and the element. */
    const reload = useCallback((nextUrl: string, nextExpiresAt: null | string, startPosition: number) => {
        const media = audioRef.current;

        const hls = hlsRef.current;

        setLoadedExpiresAt(nextExpiresAt);

        if (media === null) return;

        if (hls !== null) {
            hls.stopLoad();

            hls.loadSource(nextUrl);

            hls.startLoad(startPosition);

            // A new source re-attaches the media element, which comes back paused.
            playMedia(media);

            return;
        }

        media.src = nextUrl;

        if (startPosition >= 0) {
            media.addEventListener("loadedmetadata", () => {
                media.currentTime = startPosition;
            }, { once: true });
        }

        playMedia(media);
    }, [playMedia]);

    /** Where a reload resumes: the edge when within `AT_EDGE_S` of it, else the same place. */
    const resumePosition = useCallback(() => {
        const media = audioRef.current;

        if (media === null) return -1;

        const behind = secondsBehindEdge(mediaEdge(media, hlsRef.current), media.currentTime);

        return behind < AT_EDGE_S ? -1 : media.currentTime;
    }, []);

    /** Ask for a fresh URL and adopt it at the current position; `ended` / failure → the matching phase. */
    const reloadWithFreshUrl = useCallback(async () => {
        const resumeAt = resumePosition();

        try {
            const next = await refreshStream();

            const nextUrl = playableUrl(next);

            if (next === null || nextUrl === null) {
                setPhase("unavailable");

                return;
            }

            reload(nextUrl, next.expires_at, resumeAt);
        }
        catch {
            setPhase("unavailable");
        }
    }, [refreshStream, reload, resumePosition]);

    const start = useCallback((from: "beginning" | "live") => {
        const media = audioRef.current;

        if (media === null || url === null) return;

        setStarted(true);

        setPhase("loading");

        setStallSince(null);

        stallRef.current = null;

        refreshed403Ref.current = false;

        failuresRef.current = 0;

        hlsRef.current?.destroy();

        hlsRef.current = null;

        void loadHls()
            .then((Hls) => {
                if (Hls.isSupported()) {
                    const hls = new Hls({ ...LIVE_HLS_CONFIG, startPosition: from === "beginning" ? 0 : -1 });

                    hls.on(Hls.Events.ERROR, (_event, data) => {
                        setHlsErrorCount(count => count + 1);

                        // A discontinuity, a gap, a short stall: hls.js handles them; a
                        // non-fatal error is only remembered (type + details, never a URL).
                        if (!data.fatal) {
                            setLastHlsError({ atMs: Date.now(), details: data.details, type: data.type });

                            if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) beginStall();

                            return;
                        }

                        const status = data.response?.code;

                        if (status === 404) {
                            setPhase("ended");

                            hls.stopLoad();

                            return;
                        }

                        failuresRef.current += 1;

                        // An expired token: ONE fresh URL, resumed at the same place. It counts as
                        // the first failure, so whatever fails next is the end.
                        if (status === 403 && !refreshed403Ref.current) {
                            refreshed403Ref.current = true;

                            void reloadWithFreshUrl();

                            return;
                        }

                        if (failuresRef.current >= 2) {
                            setPhase("unavailable");

                            hls.stopLoad();

                            return;
                        }

                        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                        else hls.startLoad();
                    });

                    hlsRef.current = hls;

                    setLoadedExpiresAt(expiresAt);

                    hls.loadSource(url);

                    hls.attachMedia(media);
                }
                else if (media.canPlayType("application/vnd.apple.mpegurl") !== "") {
                    setLoadedExpiresAt(expiresAt);

                    media.src = url;

                    if (from === "beginning") {
                        media.addEventListener("loadedmetadata", () => {
                            media.currentTime = 0;
                        }, { once: true });
                    }
                }
                else {
                    setPhase("unavailable");

                    return;
                }

                playMedia(media);
            })
            .catch(() => setPhase("unavailable"));
    }, [beginStall, expiresAt, playMedia, reloadWithFreshUrl, url]);

    // The media element's own events: position, play state, the end.
    useEffect(() => {
        const media = audioRef.current;

        if (media === null) return undefined;

        const onTime = () => {
            const hls = hlsRef.current;

            const edgeSeconds = mediaEdge(media, hls);

            const native = hls === null ? nativeStartDate(media) : null;

            const playingDate = hls?.playingDate
                ?? (native === null ? null : new Date(native.getTime() + media.currentTime * 1000));

            setPosition({
                behindS: secondsBehindEdge(edgeSeconds, media.currentTime),
                currentTime: media.currentTime,
                edgeSeconds,
                playingDate,
            });

            const stall = stallRef.current;

            if (stall !== null && Math.abs(media.currentTime - stall.atTime) > STALL_RESUMED_AFTER_S) endStall();
        };

        const onPlaying = () => {
            endStall();

            setIsPlaying(true);

            setAutoplayBlocked(false);

            setPhase(current => (current === "ended" || current === "unavailable" ? current : "playing"));
        };

        const onPause = () => {
            endStall();

            setIsPlaying(false);
        };

        const onEnded = () => {
            endStall();

            setIsPlaying(false);

            setPhase("ended");
        };

        media.addEventListener("timeupdate", onTime);

        media.addEventListener("waiting", beginStall);

        media.addEventListener("playing", onPlaying);

        media.addEventListener("pause", onPause);

        media.addEventListener("ended", onEnded);

        return () => {
            media.removeEventListener("timeupdate", onTime);

            media.removeEventListener("waiting", beginStall);

            media.removeEventListener("playing", onPlaying);

            media.removeEventListener("pause", onPause);

            media.removeEventListener("ended", onEnded);
        };
    }, [beginStall, endStall]);

    // A stall: "buffering" past 5 s, ONE restart of loading past 20 s.
    const stalledSince = phase === "ended" || phase === "unavailable" ? null : stallSince;

    useEffect(() => {
        if (stalledSince === null) return undefined;

        const elapsed = Date.now() - stalledSince;

        const bufferingTimer = setTimeout(() => setBufferingFor(stalledSince), Math.max(0, BUFFERING_AFTER_MS - elapsed));

        const kickTimer = setTimeout(() => {
            const stall = stallRef.current;

            const hls = hlsRef.current;

            const media = audioRef.current;

            // Native HLS (Safari) has no loader of ours to restart.
            if (stall === null || stall.kicked || hls === null || media === null) return;

            stall.kicked = true;

            hls.stopLoad();

            hls.startLoad(stall.atEdge ? -1 : media.currentTime);
        }, Math.max(0, STALL_KICK_AFTER_MS - elapsed));

        return () => {
            clearTimeout(bufferingTimer);

            clearTimeout(kickTimer);
        };
    }, [stalledSince]);

    // `LIVE_STREAM_REFRESH_BEFORE_MS` before the LOADED URL expires: a fresh URL, adopted at position.
    useEffect(() => {
        if (!started) return undefined;

        const waitMs = msUntilRefresh(loadedExpiresAt, Date.now(), LIVE_STREAM_REFRESH_BEFORE_MS);

        if (waitMs === undefined) return undefined;

        const timer = setTimeout(() => void reloadWithFreshUrl(), waitMs);

        return () => clearTimeout(timer);
    }, [loadedExpiresAt, reloadWithFreshUrl, started]);

    // At the edge the speed is 1×: there is nothing to catch up on.
    const behindEnough = position.behindS > JUMP_TO_LIVE_AFTER_S;

    const effectiveRate = behindEnough ? rate : 1;

    useEffect(() => {
        const media = audioRef.current;

        if (media !== null && media.playbackRate !== effectiveRate) media.playbackRate = effectiveRate;
    }, [effectiveRate]);

    useEffect(() => () => {
        hlsRef.current?.destroy();

        hlsRef.current = null;
    }, []);

    const jumpToLive = () => {
        const media = audioRef.current;

        if (media === null) return;

        const edge = mediaEdge(media, hlsRef.current);

        if (edge !== null) media.currentTime = edge;

        setRate(1);
    };

    const seekMedia = (seconds: number) => {
        const media = audioRef.current;

        if (media !== null && Number.isFinite(seconds)) media.currentTime = Math.max(0, seconds);
    };

    /** Seek to a CALL millisecond (a turn click). No-op without program dates or `call_t0`. */
    const seekCallMs = (callMs: number) => {
        const media = audioRef.current;

        if (media === null) return;

        const fromFragments = mediaTimeForCallMs(hlsFragments(hlsRef.current), callT0, callMs);

        if (fromFragments !== null) {
            media.currentTime = fromFragments;

            return;
        }

        const native = hlsRef.current === null ? nativeStartDate(media) : null;

        const t0Ms = callT0 === null ? Number.NaN : Date.parse(callT0);

        if (native !== null && !Number.isNaN(t0Ms)) {
            media.currentTime = Math.max(0, (t0Ms + callMs - native.getTime()) / 1000);
        }
    };

    const togglePlay = () => {
        const media = audioRef.current;

        if (media === null) return;

        if (media.paused) playMedia(media);
        else media.pause();
    };

    return {
        audioRef,
        autoplayBlocked,
        buffering: stalledSince !== null && bufferingFor === stalledSince,
        canJumpToLive: started && behindEnough,
        hlsErrorCount,
        isPlaying,
        jumpToLive,
        lastHlsError,
        loadedExpiresAt,
        phase,
        position,
        rate: effectiveRate,
        seekCallMs,
        seekMedia,
        setRate,
        stallSince: stalledSince,
        start,
        started,
        togglePlay,
    };
}

/** The hook's render state and controls (the `<audio>` ref is passed to the element on its own). */
export type LiveAudio = Omit<ReturnType<typeof useLiveAudio>, "audioRef">;
