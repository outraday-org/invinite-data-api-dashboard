import { Play } from "lucide-react";

import { formatMs } from "@/lib/earnings/format";
import { cn } from "@/lib/utils";

import { useCallAudio } from "./audio-context";

/**
 * A position in the call: a button that plays the recording from there (the first click loads
 * it), plain text when the call has no recording, nothing when untimed (`startMs` null —
 * company-document transcripts).
 */
export function SeekButton({ className, startMs }: { className?: string; startMs: null | number | undefined }) {
    const { seekMs } = useCallAudio();

    if (startMs === null || startMs === undefined) return null;

    if (seekMs === null) {
        return <span className={cn("text-muted-foreground tabular-nums", className)}>{formatMs(startMs)}</span>;
    }

    return (
        <button
            aria-label={`Play from ${formatMs(startMs)}`}
            className={cn(
                "text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 tabular-nums underline-offset-4 hover:underline",
                className,
            )}
            onClick={() => seekMs(startMs)}
            type="button"
        >
            <Play className="size-3" />
            {formatMs(startMs)}
        </button>
    );
}
