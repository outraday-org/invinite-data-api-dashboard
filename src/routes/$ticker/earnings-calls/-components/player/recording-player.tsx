import type { V2AudioResponse, V2Event } from "@/lib/api/types";

import { formatBytes, formatFiscalPeriod, formatMs } from "@/lib/earnings/format";

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
    const period = formatFiscalPeriod(event);

    const parts = [event.symbol, period === "—" ? null : period.replaceAll(" ", "-"), "call"].filter(Boolean);

    return `${parts.join("-")}.${extensionOf(recording)}`;
}

/** The `⋯` menu's file facts (what `AudioPlayer` showed beside its bar). */
export function recordingDetails(recording: V2AudioResponse): Array<PlayerDetail> {
    return [
        { label: "Duration", value: recording.duration_seconds === null ? "—" : formatMs(recording.duration_seconds * 1000) },
        { label: "Size", value: formatBytes(recording.bytes) },
        { label: "Codec", value: recording.codec ?? "—" },
        { label: "Capture", value: recording.capture_path?.replaceAll("_", " ") ?? "—" },
    ];
}

/**
 * The finished call's player: `CallPlayer` on the file engine with the recording's own pieces — the caption line,
 * the Q&A start marker (the words transcript's `qa_start_ms`, shown once that transcript is in), the file facts and
 * the download. Nothing for a call without a recording (unless a search hit plays).
 */
export function RecordingPlayer({ event }: { event: V2Event }) {
    const { canSeek, recording, words } = useCallAudio();

    if (!canSeek) return null;

    const qaStartMs = words.data?.qa_start_ms ?? null;

    const markers: Array<PlayerMarker> = qaStartMs === null ? [] : [{ label: "Q&A", ms: qaStartMs }];

    const download: null | PlayerDownload = recording ? { filename: recordingFilename(event, recording), url: recording.url } : null;

    return (
        <CallPlayer
            caption={<CaptionLine />}
            details={recording ? recordingDetails(recording) : []}
            download={download}
            markers={markers}
        />
    );
}
