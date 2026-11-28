import { Link2 } from "lucide-react";

import type { V2AudioResponse, V2Event } from "@/lib/api/types";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { callFileName } from "@/lib/download";
import { formatBytes, formatMs } from "@/lib/earnings/format";
import { usePlayer } from "@/lib/player/player-context";

import type { PlayerDetail, PlayerDownload } from "./player-controls";
import type { PlayerMarker } from "./seek-bar";

import { useCallAudio } from "../audio-context";
import { CaptionLine } from "../caption-line";
import { CallPlayer } from "./call-player";

/** `mp3` from the URL's path, else the codec, else `mp3`. */
function extensionOf(recording: Pick<V2AudioResponse, "codec" | "url">) {
    try {
        const match = /\.([a-z0-9]{2,5})$/i.exec(new URL(recording.url).pathname);

        if (match) return match[1].toLowerCase();
    }
    catch {
        // Not a URL: the codec decides.
    }

    return recording.codec?.toLowerCase() || "mp3";
}

/** `AAPL-Q3-FY2026-call.mp3` (`AAPL-call.mp3` without a fiscal period). */
export function recordingFilename(event: Pick<V2Event, "fiscal_quarter" | "fiscal_year" | "symbol">, recording: Pick<V2AudioResponse, "codec" | "url">) {
    return callFileName(event, "call", extensionOf(recording));
}

/** The `⋯` menu's file facts (what `AudioPlayer` showed beside its bar). */
export function recordingDetails(recording: V2AudioResponse): Array<PlayerDetail> {
    return [
        { label: "Duration", value: recording.duration_seconds === null ? "—" : formatMs(recording.duration_seconds * 1000) },
        { label: "Size", value: formatBytes(recording.bytes) },
        { label: "Codec", value: recording.codec ?? "—" },
    ];
}

/** `⋯` → "Copy link at current time": hands the page the element's position in whole seconds (`?t=`). */
function CopyTimeLinkItem({ onCopyLinkAt }: { onCopyLinkAt: (seconds: number) => void }) {
    const { engine, mediaRef } = usePlayer();

    return (
        <DropdownMenuItem
            onClick={() => onCopyLinkAt(Math.floor((mediaRef.current?.currentTime ?? engine.positionMs / 1000)))}
        >
            <Link2 />
            Copy link at current time
        </DropdownMenuItem>
    );
}

/**
 * The finished call's player: `CallPlayer` on the file engine with the recording's own pieces — the caption line,
 * the markers (the Q&A start = the words transcript's `qa_start_ms`, shown once that transcript is in; the webcast slide
 * changes once the Slides tab loaded its timeline), the file facts (+ the permanent-link note), the download and
 * "Copy link at current time" (`?t=`). A link's `?t=` labels the Play button until the recording is asked for.
 * Nothing for a call without a recording (unless a search hit plays).
 */
export function RecordingPlayer({ event, onCopyLinkAt }: { event: V2Event; onCopyLinkAt?: (seconds: number) => void }) {
    const { canSeek, recording, slideMarkers, startAtMs, words } = useCallAudio();

    if (!canSeek) return null;

    const qaStartMs = words.data?.qa_start_ms ?? null;

    const markers: Array<PlayerMarker> = [...(qaStartMs === null ? [] : [{ label: "Q&A", ms: qaStartMs }]), ...slideMarkers];

    const download: null | PlayerDownload = recording ? { filename: recordingFilename(event, recording), url: recording.url } : null;

    return (
        <CallPlayer
            caption={<CaptionLine />}
            details={recording ? recordingDetails(recording) : []}
            detailsNote="Permanent link; the file carries a forensic watermark."
            download={download}
            markers={markers}
            menu={onCopyLinkAt ? <CopyTimeLinkItem onCopyLinkAt={onCopyLinkAt} /> : undefined}
            playLabel={startAtMs === null ? undefined : `Play from ${formatMs(startAtMs)}`}
        />
    );
}
