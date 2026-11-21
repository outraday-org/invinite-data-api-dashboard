import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import type { V2SlideTimelineEntry } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { indexAt } from "@/lib/earnings/follow-along";
import { formatMs } from "@/lib/earnings/format";
import { engineHasMedia } from "@/lib/player/engine";
import { usePlayer, usePlayerPosition } from "@/lib/player/player-context";
import { FOLLOW_SCROLL_MARGIN_CLASS, useFollowScroll } from "@/lib/player/use-follow-scroll";
import { cn } from "@/lib/utils";

import { SeekButton } from "./seek-button";

/**
 * The webcast player's slides on the audio's clock (`timeline`, ascending `at_ms`). While a
 * recording is loaded the pane follows it: the slide with the last `at_ms` ≤ the position
 * (binary search), and prev / next seek the audio to their slide. A click on the slide plays
 * the call from it (the first click loads the recording). Without a recording (`has_audio`
 * false) it is a plain carousel. While the audio plays the slide on screen is marked as the playhead's and, with the
 * player's Follow on, the page keeps it in view (`useFollowScroll`, `nearest`: it scrolls only when the pane is out of
 * sight); its timestamp is a `SeekButton`.
 */
export function SlideTimeline({ timeline }: { timeline: Array<V2SlideTimelineEntry> }) {
    const { canSeek, engine } = usePlayer();

    const { playing, positionMs } = usePlayerPosition();

    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const seekMs = canSeek ? engine.seekMs : null;

    const entries = React.useMemo(() => timeline.map(entry => ({ startMs: entry.at_ms })), [timeline]);

    // The carousel's own position while no recording plays.
    const [browsed, setBrowsed] = React.useState(0);

    const following = seekMs !== null && engineHasMedia(engine.state);

    const index = Math.min(timeline.length - 1, following ? Math.max(0, indexAt(entries, positionMs)) : browsed);

    const show = React.useCallback((next: number) => {
        const target = Math.min(timeline.length - 1, Math.max(0, next));

        if (following) seekMs(timeline[target].at_ms);
        else setBrowsed(target);
    }, [following, seekMs, timeline]);

    const atPlayhead = following && playing;

    useFollowScroll({ activeIndex: atPlayhead ? index : -1, block: "nearest", containerRef, enabled: playing });

    if (timeline.length === 0) return null;

    // The position ticks every animation frame; the view re-renders only when the slide changes.
    return (
        <div ref={containerRef}>
            <SlideTimelineView
                atPlayhead={atPlayhead}
                following={following}
                index={index}
                onShow={show}
                seekMs={seekMs}
                timeline={timeline}
            />
        </div>
    );
}

const SlideTimelineView = React.memo(function SlideTimelineView({
    atPlayhead,
    following,
    index,
    onShow,
    seekMs,
    timeline,
}: {
    /** The audio plays and this is the slide on screen at its position. */
    atPlayhead: boolean;
    following: boolean;
    index: number;
    onShow: (next: number) => void;
    seekMs: ((ms: number) => void) | null;
    timeline: Array<V2SlideTimelineEntry>;
}) {
    const slide = timeline[index];

    const alt = `Webcast slide ${index + 1} at ${formatMs(slide.at_ms)}`;

    const image = (
        <img
            alt={alt}
            className="aspect-video w-full rounded-sm object-contain bg-muted/30"
            src={slide.image_url}
        />
    );

    return (
        <div className={cn("flex w-full max-w-2xl flex-col gap-2", FOLLOW_SCROLL_MARGIN_CLASS)} data-follow-index={index}>
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
                            aria-label={`Play from slide ${index + 1} (${formatMs(slide.at_ms)})`}
                            className={cn("rounded-md border p-1 hover:bg-muted/50", atPlayhead && "border-primary ring-primary/30 ring-2")}
                            onClick={() => seekMs(slide.at_ms)}
                            type="button"
                        >
                            {image}
                        </button>
                    )}

            <div className="flex items-center gap-2 text-xs">
                <Button aria-label="Previous slide" disabled={index === 0} onClick={() => onShow(index - 1)} size="icon-sm" variant="outline">
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
                    onClick={() => onShow(index + 1)}
                    size="icon-sm"
                    variant="outline"
                >
                    <ChevronRight />
                </Button>
                <SeekButton startMs={slide.at_ms} />
                {atPlayhead && <span className="text-primary font-medium">At the playhead</span>}
            </div>
        </div>
    );
});
