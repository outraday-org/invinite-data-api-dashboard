import type * as React from "react";

import { RefreshCw } from "lucide-react";

import type { V2Event } from "@/lib/api/types";
import type { LiveAudioMode } from "@/lib/live/live-sync";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";

import type { LiveCall } from "../audio-context";

import { useLiveCall } from "../audio-context";
import { CallPlayer } from "./call-player";
import { RecordingPlayer } from "./recording-player";

export const LIVE_WAITING_FOR_TEXT_TEXT = "waiting for the transcript";

export const RECORDING_PREPARING_TEXT = "Call ended — the recording is being prepared";

const MODE_LABELS: Record<LiveAudioMode, string> = {
    live: "as live as possible",
    synced: "synced to the transcript",
};

/** What stands in place of the controls, or nothing (the controls; an error is the engine's `error` state). */
function liveNotice(live: LiveCall): React.ReactNode {
    const { audio, callEnded, recordingWait, stream, streamError } = live;

    if (audio.phase === "ended" || (callEnded && !audio.started)) {
        if (recordingWait === "gave-up") {
            return (
                <span className="inline-flex flex-wrap items-center gap-2">
                    {RECORDING_PREPARING_TEXT}
                    {" "}
                    — not published within an hour; reload the page later.
                    <Button onClick={() => window.location.reload()} size="sm" type="button" variant="outline">
                        <RefreshCw />
                        Reload
                    </Button>
                </span>
            );
        }

        return `${RECORDING_PREPARING_TEXT}; the transcript stays below.`;
    }

    if (audio.started || streamError) return null;

    if (stream === null) return "Asking for the live stream…";

    if (stream.status === "not_started") {
        // Never polled (5 credits a request): the listener asks again.
        return (
            <span className="inline-flex flex-wrap items-center gap-2">
                No live audio yet — the live transcript runs meanwhile.
                <Button onClick={live.retryStream} size="sm" title="Asks for the live stream again (5 credits)" type="button" variant="outline">
                    <RefreshCw />
                    Check again
                </Button>
            </span>
        );
    }

    if (stream.status === "disabled") return "No live audio for this call — the live transcript runs below.";

    return null;
}

/** The bar's status pills: the audio's, the transcript socket's, the stream's warning. */
function LiveStatus({ live }: { live: LiveCall }) {
    const { audio, callEnded, transcript } = live;

    return (
        <>
            {audio.buffering && <Badge variant="destructive">buffering — reconnecting to the live edge</Badge>}
            {audio.waitingForText && <Badge data-testid="live-waiting-for-text" role="status" variant="outline">{LIVE_WAITING_FOR_TEXT_TEXT}</Badge>}
            {transcript.reconnecting && <Badge variant="destructive">reconnecting</Badge>}
            {transcript.stalled && <Badge variant="outline">no data for 60 s</Badge>}
            {transcript.warning !== null && <Badge title={transcript.warning} variant="outline">{transcript.warning}</Badge>}
            {callEnded && audio.started && audio.phase !== "ended" && <Badge variant="secondary">call ended</Badge>}
        </>
    );
}

/** `⋯` → "Playback": the sync mode, remembered per browser (only with a live transcript to sync to). */
function PlaybackModeMenu({ live }: { live: LiveCall }) {
    return (
        <DropdownMenuGroup>
            <DropdownMenuLabel>Playback</DropdownMenuLabel>
            <DropdownMenuRadioGroup onValueChange={(value: LiveAudioMode) => live.chooseMode(value)} value={live.mode}>
                {(["synced", "live"] as const).map(option => (
                    <DropdownMenuRadioItem key={option} value={option}>
                        {MODE_LABELS[option]}
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
    );
}

/**
 * The live call's player (O4; the live twin of `RecordingPlayer`): `CallPlayer` on the HLS engine with the live pieces —
 * the stream's states in place of the controls (asking, no audio yet + "Check again", no live audio, the call ended while the
 * recording is prepared + "Reload" after an hour), the status pills (buffering, waiting for the transcript,
 * reconnecting, no data for 60 s, a stream warning) and the playback mode in the `⋯` menu.
 */
export function LiveCallPlayer() {
    const live = useLiveCall();

    if (live === null || !live.onAir) return null;

    const canChooseMode = live.transcriptVisible && live.stream?.status === "available";

    return (
        <CallPlayer
            detailsTitle="Live audio"
            menu={canChooseMode ? <PlaybackModeMenu live={live} /> : undefined}
            notice={liveNotice(live)}
            status={<LiveStatus live={live} />}
        />
    );
}

/**
 * The page's one bar: the live call's while the HLS engine is the page's, else the recording's. "Copy link at current
 * time" is the recording's only: a live position is not a moment a link can reopen before the recording is published.
 */
export function CallPlayerBar({ event, onCopyLinkAt }: { event: V2Event; onCopyLinkAt?: (seconds: number) => void }) {
    const live = useLiveCall();

    return live?.onAir ? <LiveCallPlayer /> : <RecordingPlayer event={event} onCopyLinkAt={onCopyLinkAt} />;
}
