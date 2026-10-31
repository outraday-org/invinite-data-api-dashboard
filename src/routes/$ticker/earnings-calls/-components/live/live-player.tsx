import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { EarningsEventResponse } from "@/lib/api/types";
import type { LiveAudioMode } from "@/lib/live/live-sync";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isEarningsEventLiveish, useApiBaseUrl, useEarningsLiveStream, useEarningsPriceAttribution } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { newestReleasedFinal, parseLiveMode, resolveLiveMode, textBehindEdgeS } from "@/lib/live/live-sync";
import { liveTurns } from "@/lib/live/live-transcript-reducer";
import { activeTurnIndex, positionToCallMs } from "@/lib/live/position-to-call-ms";
import { useLiveAudio } from "@/lib/live/use-live-audio";
import { useLiveTranscript } from "@/lib/live/use-live-transcript";

import { LiveDot } from "../live-dot";
import { LiveAudioSection } from "./live-audio-section";
import { LivePriceChart } from "./live-price-chart";
import { formatWallTime } from "./live-price-chart-data";
import { LiveTranscriptView } from "./live-transcript-view";

export const LIVE_MODE_STORAGE_KEY = "invinite-data-api-live-mode";

/** The remembered mode; a refused origin or the server read as none. */
function readStoredLiveMode(): LiveAudioMode | null {
    try {
        return typeof window === "undefined" ? null : parseLiveMode(window.localStorage.getItem(LIVE_MODE_STORAGE_KEY));
    }
    catch {
        return null;
    }
}

function writeStoredLiveMode(mode: LiveAudioMode): void {
    try {
        if (typeof window !== "undefined") window.localStorage.setItem(LIVE_MODE_STORAGE_KEY, mode);
    }
    catch {
        // The choice holds for this page and is forgotten on reload.
    }
}

/**
 * The live player of a call in progress: the live audio (`GET /v1/earnings-calls/live/stream`,
 * hls.js) and the live transcript (`/v1/ws` `earnings-calls.live`), modelled on the admin
 * console's `live-player.tsx`.
 *
 * - Before "Tune in", or without live audio, the transcript runs at the edge as it arrives.
 * - Modes (`live-sync.ts`; the text is released ≈ 8 s + STT latency behind the capture). SYNCED, the
 *   default: the AUDIO is held behind the newest released final (0.9× past it, "waiting for the
 *   transcript" 3 s past it, a jump forward 20 s behind it) and each word, partials too, shows once the
 *   audio reaches it (`liveTurns`' `revealUntilMs` = `playingDate − call_t0`). LIVE AUDIO: at the edge,
 *   the text appends as released ("transcript ≈ N s behind"). Remembered per browser.
 * - Behind the edge (Live: > 10 s; Synced: after an explicit seek) the transcript follows the audio:
 *   the turn being heard is highlighted and a turn click seeks there. `call_t0` null → no sync, no
 *   follow mode.
 *
 * - Between the two, the call's stock (`LivePriceChart`): the price-attribution minute rows so
 *   far (refetched every 60 s while live) then the `price_tick` frames of the same socket, on the
 *   transcript clock; the cursor marks the audio position while it plays.
 *
 * Credits: every stream request costs 5. The stream is asked once, then only every 15 s while
 * `not_started`, before the loaded URL expires and once on a 403 — never on a timer otherwise.
 */
export function LivePlayer({
    apiKey,
    apiKeyUpdatedAt,
    event,
    liveAudio,
}: {
    apiKey: string;
    apiKeyUpdatedAt: number;
    event: EarningsEventResponse;
    /** `/live`'s `live_audio`: false = transcript only, the stream is never requested. */
    liveAudio: boolean;
}) {
    const baseUrl = useApiBaseUrl();

    const streamQuery = useEarningsLiveStream(liveAudio ? { eventId: event.event_id } : {});

    const stream = streamQuery.data;

    const { refetch } = streamQuery;

    // A failed refetch resolves with the OLD answer still in `data`; reloading that URL would
    // loop on the same 403, so a failure is a failure.
    const refreshStream = async () => {
        const result = await refetch();

        if (result.isError) throw result.error;

        return result.data ?? null;
    };

    const transcript = useLiveTranscript({ apiKey, apiKeyUpdatedAt, baseUrl, eventId: event.event_id });

    const [storedMode, setStoredMode] = useState(readStoredLiveMode);

    // A refused subscription ends the transcript for good: nothing to sync to.
    const transcriptVisible = transcript.mode !== "error";

    const mode = resolveLiveMode(storedMode, transcriptVisible);

    const chooseMode = (next: LiveAudioMode) => {
        setStoredMode(next);

        writeStoredLiveMode(next);
    };

    const newestFinal = newestReleasedFinal(transcript.state.finals);

    const callEnded = transcript.state.ended || transcript.mode === "ended";

    // The ref apart from the state: the state is read during render, the ref only by `<audio>`.
    const { audioRef, ...audio } = useLiveAudio({ callEnded, mode, newestFinal, refreshStream, stream });

    const assignments = transcript.state.speakerNames?.assignments ?? [];

    const allTurns = liveTurns(transcript.state, assignments);

    const callT0 = stream?.call_t0 ?? null;

    const callMs = positionToCallMs(audio.position.playingDate, callT0);

    const followMode = audio.canJumpToLive && callMs !== null;

    const trackedMs = audio.started && !followMode && audio.phase !== "ended" ? callMs : null;

    // Synced: every word, partials too, appears when the audio reaches it. Live audio: as released.
    const revealMs = mode === "synced" ? trackedMs : null;

    const turns = revealMs === null ? allTurns : liveTurns(transcript.state, assignments, revealMs);

    const activeIndex = followMode ? activeTurnIndex(turns, callMs) : -1;

    const latestEndMs = allTurns.at(-1)?.endMs ?? null;

    const textBehindS = trackedMs !== null && latestEndMs !== null ? Math.max(0, Math.round((trackedMs - latestEndMs) / 1000)) : null;

    const textBehindEdge = textBehindEdgeS(positionToCallMs(audio.position.edgeDate, callT0), newestFinal?.endMs ?? null);

    // The price line's backlog: the live minute rows (a 404 = none yet). Settled rows of the
    // post-call run use another reference, so only live rows seed the line.
    const minuteRows = useEarningsPriceAttribution({ eventId: event.event_id }, { live: isEarningsEventLiveish(event) }).data;

    const priceSeed = minuteRows?.live ? minuteRows.buckets : [];

    const { prices } = transcript;

    const lastTick = prices.last;

    const priceCursorMs = audio.started && audio.phase !== "ended" ? callMs : null;

    return (
        <Card size="sm">
            <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                    <LiveDot />
                    <CardTitle className="text-sm">{callEnded ? "Live call (ended)" : "Live call"}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {/* Always mounted, so "Tune in" has an element to attach hls.js to. Captions are the transcript below. */}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio className="hidden" preload="none" ref={audioRef} />

                {transcript.rescheduledTo !== null && (
                    <p className="text-sm" role="status">
                        This call was rescheduled to
                        {" "}
                        {formatEnDateTime(transcript.rescheduledTo, { hideTime: false })}
                        .
                        {" "}
                        <Link className="text-primary underline-offset-4 hover:underline" params={{ ticker: event.symbol }} to="/$ticker/earnings-calls">
                            All calls of
                            {" "}
                            {event.symbol}
                        </Link>
                    </p>
                )}

                {callEnded && transcript.rescheduledTo === null && (
                    <p className="bg-muted rounded-md p-3 text-sm" role="status">
                        {event.has_transcript
                            ? "Call ended — the final transcript is in the Transcript tab below."
                            : "Call ended — final transcript in progress."}
                    </p>
                )}

                <section aria-label="Live audio" className="flex flex-col gap-2">
                    {liveAudio && stream?.status === "available" && transcriptVisible && (
                        <span aria-label="Playback mode" className="inline-flex gap-0.5" role="group">
                            {(["synced", "live"] as const).map(option => (
                                <Button
                                    aria-pressed={mode === option}
                                    key={option}
                                    onClick={() => chooseMode(option)}
                                    size="sm"
                                    title={option === "synced"
                                        ? "The audio plays behind the transcript, so each word appears as it is heard"
                                        : "As live as possible; the transcript follows when it is released"}
                                    type="button"
                                    variant={mode === option ? "secondary" : "ghost"}
                                >
                                    {option === "synced" ? "Synced" : "Live audio"}
                                </Button>
                            ))}
                        </span>
                    )}
                    {liveAudio
                        ? <LiveAudioSection audio={audio} mode={mode} stream={stream} streamError={streamQuery.error} />
                        : <p className="text-muted-foreground text-sm">No live audio for this call (live transcript below).</p>}
                </section>

                <section aria-label="Live price" className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold">Price</h3>
                    {prices.ticks.length > 0 || priceSeed.length > 0
                        ? <LivePriceChart buckets={priceSeed} callT0={callT0} cursorMs={priceCursorMs} prices={prices} />
                        : <p className="text-muted-foreground text-sm">No price ticks yet.</p>}
                </section>

                <section aria-label="Live transcript" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-semibold">Live transcript</h3>
                        {transcript.reconnecting && <Badge variant="destructive">reconnecting</Badge>}
                        {transcript.stalled && <Badge variant="outline">no data for 60 s</Badge>}
                        {followMode && <Badge variant="secondary">following the audio</Badge>}
                        {revealMs !== null && (
                            <span className="text-muted-foreground text-xs" data-testid="live-sync">
                                audio synced to the transcript ·
                                {" "}
                                {Math.round(audio.position.edgeBehindS)}
                                {" "}
                                s behind the edge
                            </span>
                        )}
                        {revealMs === null && textBehindS !== null && (
                            <span className="text-muted-foreground text-xs" data-testid="live-sync">
                                transcript ≈
                                {" "}
                                {textBehindS}
                                {" "}
                                s behind
                            </span>
                        )}
                    </div>
                    {transcript.error !== null && <p className="text-destructive text-sm" role="alert">{transcript.error}</p>}
                    {transcript.notice !== null && <p className="text-muted-foreground text-xs" role="status">{transcript.notice}</p>}
                    {transcript.mode === "retrying" && (
                        <p className="text-muted-foreground text-xs" role="status">The live transcript is unavailable right now; retrying in 10 s.</p>
                    )}
                    {transcript.provisionalVersion !== null && !event.has_transcript && (
                        <p className="text-muted-foreground text-xs">
                            A provisional transcript (version
                            {" "}
                            {transcript.provisionalVersion}
                            ) is ready; the final one, with speaker names, follows.
                        </p>
                    )}
                    <LiveTranscriptView
                        activeIndex={activeIndex}
                        onTurnClick={followMode ? audio.seekCallMs : undefined}
                        turns={turns}
                    />
                </section>

                <details className="text-xs">
                    <summary className="text-muted-foreground cursor-pointer">Diagnostics</summary>
                    <dl className="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
                        <dt>Stream</dt>
                        <dd>{liveAudio ? (stream?.status ?? (streamQuery.error ? "request failed" : "requesting")) : "not requested (no live audio)"}</dd>
                        <dt>Stream URL expires</dt>
                        <dd>{audio.loadedExpiresAt ?? stream?.expires_at ?? "—"}</dd>
                        <dt>Call t0</dt>
                        <dd>{callT0 ?? "—"}</dd>
                        <dt>Credits</dt>
                        <dd>5 per stream request: asked once, every 15 s while not started, before the URL expires and once on a 403</dd>
                        <dt>Audio</dt>
                        <dd>
                            {audio.phase}
                        </dd>
                        <dt>Audio behind edge</dt>
                        <dd>
                            {audio.position.edgeBehindS.toFixed(1)}
                            {" s"}
                        </dd>
                        <dt>Text behind edge</dt>
                        <dd>{textBehindEdge === null ? "unknown" : `${textBehindEdge.toFixed(1)} s`}</dd>
                        <dt>Playback mode</dt>
                        <dd>{mode === "synced" ? "synced to the transcript" : "live audio"}</dd>
                        <dt>hls.js errors</dt>
                        <dd>
                            {audio.hlsErrorCount}
                            {audio.lastHlsError && ` · last ${audio.lastHlsError.type} / ${audio.lastHlsError.details}`}
                        </dd>
                        <dt>WebSocket</dt>
                        <dd>
                            {transcript.mode}
                            {transcript.reconnecting ? " · reconnecting" : ""}
                            {transcript.stalled ? " · stalled" : ""}
                        </dd>
                        <dt>Last contiguous seq</dt>
                        <dd>{transcript.state.lastSeq}</dd>
                        <dt>Pending gap</dt>
                        <dd>{transcript.state.gapRefetch === null ? "none" : `after seq ${transcript.state.gapRefetch.afterSeq}`}</dd>
                        <dt>Price ticks</dt>
                        <dd>
                            {prices.ticks.length}
                            {lastTick !== null && ` (last at ${formatWallTime(Date.parse(lastTick.at))} ET, ${lastTick.source})`}
                        </dd>
                        <dt>Minute rows</dt>
                        <dd>{priceSeed.length}</dd>
                        <dt>Malformed frames</dt>
                        <dd>{transcript.malformedFrames}</dd>
                    </dl>
                </details>
            </CardContent>
        </Card>
    );
}
