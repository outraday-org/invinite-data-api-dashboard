import { Link } from "@tanstack/react-router";

import type { EarningsEventResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiBaseUrl, useEarningsLiveStream } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { liveTurns } from "@/lib/live/live-transcript-reducer";
import { activeTurnIndex, JUMP_TO_LIVE_AFTER_S, positionToCallMs } from "@/lib/live/position-to-call-ms";
import { useLiveAudio } from "@/lib/live/use-live-audio";
import { useLiveTranscript } from "@/lib/live/use-live-transcript";

import { LiveDot } from "../live-dot";
import { LiveAudioSection } from "./live-audio-section";
import { LiveTranscriptView } from "./live-transcript-view";

/**
 * The live player of a call in progress: the live audio (`GET /v1/earnings-calls/live/stream`,
 * hls.js) and the live transcript (`/v1/ws` `earnings-calls.live`), modelled on the admin
 * console's `live-player.tsx`.
 *
 * - Before "Tune in", or without live audio, the transcript runs at the edge as it arrives.
 * - At the edge while the audio plays, the text is SYNCED to it: the audio plays ~6 s behind
 *   the capture, so each word shows once the audio reaches it ("text synced to the audio · N s
 *   held back", `liveTurns`' `revealUntilMs` = `playingDate − call_t0`).
 * - Behind the edge (> 10 s) the transcript follows the audio: the turn being heard is
 *   highlighted and a turn click seeks there. `call_t0` null → no sync, no follow mode.
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

    // The ref apart from the state: the state is read during render, the ref only by `<audio>`.
    const { audioRef, ...audio } = useLiveAudio({ refreshStream, stream });

    const transcript = useLiveTranscript({ apiKey, apiKeyUpdatedAt, baseUrl, eventId: event.event_id });

    const assignments = transcript.state.speakerNames?.assignments ?? [];

    const allTurns = liveTurns(transcript.state, assignments);

    const callT0 = stream?.call_t0 ?? null;

    const callMs = positionToCallMs(audio.position.playingDate, callT0);

    const followMode = audio.started && audio.position.behindS > JUMP_TO_LIVE_AFTER_S && callMs !== null;

    // At the edge with a known position the text is held back to the audio.
    const syncedMs = audio.started && !followMode && audio.phase !== "ended" ? callMs : null;

    const turns = syncedMs === null ? allTurns : liveTurns(transcript.state, assignments, syncedMs);

    const activeIndex = followMode ? activeTurnIndex(turns, callMs) : -1;

    const latestEndMs = allTurns.at(-1)?.endMs ?? null;

    const heldBackS = syncedMs !== null && latestEndMs !== null ? Math.max(0, Math.round((latestEndMs - syncedMs) / 1000)) : null;

    const callEnded = transcript.state.ended || transcript.mode === "ended";

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
                    {liveAudio
                        ? <LiveAudioSection audio={audio} stream={stream} streamError={streamQuery.error} />
                        : <p className="text-muted-foreground text-sm">No live audio for this call (live transcript below).</p>}
                </section>

                <section aria-label="Live transcript" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-semibold">Live transcript</h3>
                        {transcript.reconnecting && <Badge variant="destructive">reconnecting</Badge>}
                        {transcript.stalled && <Badge variant="outline">no data for 60 s</Badge>}
                        {followMode && <Badge variant="secondary">following the audio</Badge>}
                        {heldBackS !== null && (
                            <span className="text-muted-foreground text-xs">
                                text synced to the audio ·
                                {" "}
                                {heldBackS}
                                {" "}
                                s held back
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
                            {" · "}
                            {audio.position.behindS.toFixed(1)}
                            {" s behind the edge"}
                        </dd>
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
                        <dt>Malformed frames</dt>
                        <dd>{transcript.malformedFrames}</dd>
                    </dl>
                </details>
            </CardContent>
        </Card>
    );
}
