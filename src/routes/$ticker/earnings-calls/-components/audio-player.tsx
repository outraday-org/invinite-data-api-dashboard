import { RotateCcw, RotateCw } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatMs } from "@/lib/earnings/format";
import { cn } from "@/lib/utils";

import { useCallAudio } from "./audio-context";
import { CaptionLine } from "./caption-line";

const SKIP_SECONDS = 15;

const SPEEDS = [1, 1.5, 2] as const;

/**
 * The call recording: the page's one `<audio>` element plus a small bar (±15 s, speed, file
 * facts). Mounted above the tab panels and only hidden off the Audio tab, so a transcript
 * timestamp can seek and start it. The recording's URL is permanent (no refresh); the provider
 * (`CallAudioProvider`) owns the element's src.
 */
export function AudioPlayer({ visible }: { visible: boolean }) {
    const { audioRef, playedUrl, recording: data, setPlaybackRate, skip } = useCallAudio();

    const [speed, setSpeed] = React.useState<number>(1);

    if (!data && !playedUrl) return null;

    const changeSpeed = (next: number) => {
        setPlaybackRate(next);

        setSpeed(next);
    };

    return (
        <div className={cn("flex flex-col gap-2 rounded-md border p-3", !visible && "hidden")}>
            {/* Captions do not exist for a call recording; the transcript tab is its text. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
                className="w-full"
                controls
                onRateChange={event => setSpeed(event.currentTarget.playbackRate)}
                preload="metadata"
                ref={audioRef}
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button aria-label={`Back ${SKIP_SECONDS} seconds`} onClick={() => skip(-SKIP_SECONDS)} size="sm" type="button" variant="outline">
                    <RotateCcw />
                    {SKIP_SECONDS}
                    {" "}
                    s
                </Button>
                <Button aria-label={`Forward ${SKIP_SECONDS} seconds`} onClick={() => skip(SKIP_SECONDS)} size="sm" type="button" variant="outline">
                    <RotateCw />
                    {SKIP_SECONDS}
                    {" "}
                    s
                </Button>
                <div className="flex items-center gap-1">
                    {SPEEDS.map(value => (
                        <Button
                            aria-pressed={speed === value}
                            key={value}
                            onClick={() => changeSpeed(value)}
                            size="sm"
                            type="button"
                            variant={speed === value ? "secondary" : "ghost"}
                        >
                            {value}
                            ×
                        </Button>
                    ))}
                </div>
                {data && (
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        <span>{data.duration_seconds === null ? "Duration —" : formatMs(data.duration_seconds * 1000)}</span>
                        <span>{formatBytes(data.bytes)}</span>
                        {data.codec && <Badge variant="outline">{data.codec}</Badge>}
                        {data.capture_path && <Badge variant="outline">{data.capture_path.replaceAll("_", " ")}</Badge>}
                    </div>
                )}
            </div>
            {/* The words being spoken, flowing past in one row (the follow view below has the whole text). */}
            <CaptionLine />
        </div>
    );
}
