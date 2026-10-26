import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import type { EarningsSlideTimelineEntry } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { indexAt } from "@/lib/earnings/follow-along";
import { formatMs } from "@/lib/earnings/format";

import { useCallAudio, useCallPlayback } from "./audio-context";

/**
 * The webcast player's slides on the audio's clock (`timeline`, ascending `at_ms`). While a
 * recording is loaded the pane follows it: the slide with the last `at_ms` ≤ the position
 * (binary search), and prev / next seek the audio to their slide. A click on the slide plays
 * the call from it (the first click loads the recording). Without a recording (`has_audio`
 * false) it is a plain carousel.
 */
export function SlideTimeline({
    onMediaError,
    timeline,
}: {
    onMediaError: () => void;
    timeline: Array<EarningsSlideTimelineEntry>;
}) {
    const { loaded, seekMs } = useCallAudio();

    const { positionMs } = useCallPlayback();

    const entries = React.useMemo(() => timeline.map(entry => ({ startMs: entry.at_ms })), [timeline]);

    // The carousel's own position while no recording plays.
    const [browsed, setBrowsed] = React.useState(0);

    const following = loaded && seekMs !== null;

    const index = Math.min(timeline.length - 1, following ? Math.max(0, indexAt(entries, positionMs)) : browsed);

    if (timeline.length === 0) return null;

    const slide = timeline[index];

    const show = (next: number) => {
        const target = Math.min(timeline.length - 1, Math.max(0, next));

        if (following) seekMs(timeline[target].at_ms);
        else setBrowsed(target);
    };

    const alt = `Webcast slide ${index + 1} at ${formatMs(slide.at_ms)}`;

    const image = (
        <img
            alt={alt}
            className="aspect-video w-full rounded-sm object-contain bg-muted/30"
            onError={onMediaError}
            src={slide.image_url}
        />
    );

    return (
        <div className="flex w-full max-w-2xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">Webcast slides</span>
                <span className="text-muted-foreground">
                    {seekMs === null
                        ? "As shown in the webcast player"
                        : following
                            ? "Following the audio"
                            : "Click a slide to play the call from it"}
                </span>
            </div>

            {seekMs === null
                ? image
                : (
                        <button
                            aria-label={`Play from ${formatMs(slide.at_ms)}`}
                            className="rounded-md border p-1 hover:bg-muted/50"
                            onClick={() => seekMs(slide.at_ms)}
                            type="button"
                        >
                            {image}
                        </button>
                    )}

            <div className="flex items-center gap-2 text-xs">
                <Button aria-label="Previous slide" disabled={index === 0} onClick={() => show(index - 1)} size="icon-sm" variant="outline">
                    <ChevronLeft />
                </Button>
                <span className="tabular-nums">
                    {index + 1}
                    {" / "}
                    {timeline.length}
                </span>
                <Button
                    aria-label="Next slide"
                    disabled={index === timeline.length - 1}
                    onClick={() => show(index + 1)}
                    size="icon-sm"
                    variant="outline"
                >
                    <ChevronRight />
                </Button>
                <span className="text-muted-foreground tabular-nums">{formatMs(slide.at_ms)}</span>
            </div>
        </div>
    );
}
