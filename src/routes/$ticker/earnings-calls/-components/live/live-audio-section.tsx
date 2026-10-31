import type * as React from "react";

import { Pause, Play } from "lucide-react";

import type { EarningsLiveStreamResponse } from "@/lib/api/types";
import type { LiveAudioMode } from "@/lib/live/live-sync";
import type { LiveAudio } from "@/lib/live/use-live-audio";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { formatMs } from "@/lib/earnings/format";
import { JUMP_TO_LIVE_AFTER_S } from "@/lib/live/position-to-call-ms";

const SPEEDS = [1, 1.5, 2] as const;

const LIVE_WAITING_TEXT = "Waiting for audio…";

export const LIVE_WAITING_FOR_TEXT_TEXT = "waiting for the transcript";

const LIVE_AUDIO_TIER_TEXT = "PRO plan required for live audio";

function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "destructive" | "muted" }) {
    return (
        <p className={tone === "destructive" ? "text-destructive text-sm" : "text-muted-foreground text-sm"} role="status">
            {children}
        </p>
    );
}

/** The stream request's failure as one sentence (the REST plan gate, IDA's media codes). */
function streamErrorText(error: unknown): string {
    if (isTierError(error)) return LIVE_AUDIO_TIER_TEXT;

    if (error instanceof ApiRequestError) {
        if (error.code === "audio_unavailable") return "Audio for this company is not available under the current licence";

        if (error.code === "media_unavailable") return "Live audio is temporarily unavailable";

        if (error.status === 404) return "No live audio found for this call";
    }

    return error instanceof Error ? `Live audio unavailable: ${error.message}` : "Live audio unavailable";
}

/**
 * The live audio controls: Tune in / From the beginning, then play-pause, a seek bar from 0 to
 * the live edge, "Jump to live" past 10 s behind (Synced: "Back to synced" after a seek), 1× / 1.5× / 2×
 * only behind, the "waiting for the transcript" and the buffering pill. The stream's own states come first.
 */
export function LiveAudioSection({
    audio,
    mode,
    stream,
    streamError,
}: {
    audio: LiveAudio;
    mode: LiveAudioMode;
    stream: EarningsLiveStreamResponse | null;
    streamError: unknown;
}) {
    if (stream === null) return <Note>{streamError ? streamErrorText(streamError) : "Asking for the live stream…"}</Note>;

    if (stream.status === "not_started") return <Note>{LIVE_WAITING_TEXT}</Note>;

    if (stream.status === "disabled") return <Note>No live audio for this call (live transcript below).</Note>;

    if (audio.phase === "unavailable") return <Note tone="destructive">Live audio stream unavailable.</Note>;

    if (audio.phase === "ended") return <Note>The live audio has ended.</Note>;

    if (!audio.started) {
        return (
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => audio.start("live")} size="sm" type="button">
                    Tune in
                </Button>
                <Button onClick={() => audio.start("beginning")} size="sm" type="button" variant="outline">
                    From the beginning
                </Button>
            </div>
        );
    }

    const edge = Math.max(0, audio.position.edgeSeconds ?? audio.position.currentTime);

    const synced = mode === "synced";

    // Synced: only an explicit seek is "behind"; the sync point itself is not.
    const behind = synced ? audio.canJumpToLive : audio.position.behindS > JUMP_TO_LIVE_AFTER_S;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    aria-label={audio.isPlaying ? "Pause" : "Play"}
                    onClick={audio.togglePlay}
                    size="icon"
                    type="button"
                >
                    {audio.isPlaying ? <Pause /> : <Play />}
                </Button>
                {audio.autoplayBlocked && !audio.isPlaying && (
                    <Button onClick={audio.togglePlay} size="sm" type="button" variant="outline">
                        Click to start
                    </Button>
                )}
                <span className="text-muted-foreground text-xs tabular-nums">
                    {formatMs(audio.position.currentTime * 1000)}
                    {" / "}
                    {formatMs(edge * 1000)}
                </span>
                {audio.buffering && <Badge variant="destructive">buffering — reconnecting to the live edge</Badge>}
                {audio.waitingForText && <Badge data-testid="live-waiting-for-text" role="status" variant="outline">{LIVE_WAITING_FOR_TEXT_TEXT}</Badge>}
                {audio.canJumpToLive
                    ? (
                            <Button onClick={audio.jumpToLive} size="sm" type="button" variant="outline">
                                {synced ? "Back to synced" : "Jump to live"}
                            </Button>
                        )
                    : <Badge variant="secondary">{synced ? "synced to the transcript" : "at the live edge"}</Badge>}
                <span aria-label="Playback speed" className="inline-flex gap-0.5" role="group">
                    {SPEEDS.map(speed => (
                        <Button
                            aria-pressed={audio.rate === speed}
                            // At the edge there is nothing to catch up on: 1× only.
                            disabled={!behind && speed !== 1}
                            key={speed}
                            onClick={() => audio.setRate(speed)}
                            size="sm"
                            type="button"
                            variant={audio.rate === speed ? "secondary" : "ghost"}
                        >
                            {speed}
                            ×
                        </Button>
                    ))}
                </span>
            </div>
            <input
                aria-label="Position in the call"
                className="accent-primary w-full"
                max={edge}
                min={0}
                onChange={event => audio.seekMedia(Number(event.target.value))}
                step={1}
                type="range"
                value={Math.min(audio.position.currentTime, edge)}
            />
        </div>
    );
}
