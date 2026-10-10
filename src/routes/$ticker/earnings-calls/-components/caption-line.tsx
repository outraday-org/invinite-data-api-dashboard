import * as React from "react";

import { buildCaptionWords, captionWindow, indexAt } from "@/lib/earnings/follow-along";
import { speakerName } from "@/lib/earnings/transcript";
import { cn } from "@/lib/utils";

import { useCallAudio, useCallPlayback } from "./audio-context";

/** A move of more words than this is a seek: re-centre without gliding. */
const GLIDE_MAX_WORDS = 4;

/**
 * The player's caption line (a port of the admin console's `CallCaptionLine.tsx`, keep in
 * step): the transcript as ONE line that flows right to left while the recording plays, the
 * word being spoken centred and lit, what was said before it to the left, what comes next
 * faint to the right.
 *
 * It glides by TRANSFORM, never by re-layout: the rendered words are a window of whole chunks
 * (`captionWindow`), so between two chunk boundaries the DOM stays put and only the track's
 * `translateX` moves. A chunk swap or a seek (more than a few words at once) re-centres
 * WITHOUT the transition, so a jump never scrolls a hundred words across the screen.
 *
 * Decorative twin of the follow view / Transcript tab (`aria-hidden`); nothing while the
 * words transcript is not in.
 */
export function CaptionLine({ className }: { className?: string }) {
    const { wordTurns } = useCallAudio();

    const { positionMs } = useCallPlayback();

    const words = React.useMemo(() => buildCaptionWords(wordTurns, speakerName), [wordTurns]);

    const viewportRef = React.useRef<HTMLDivElement | null>(null);

    const trackRef = React.useRef<HTMLDivElement | null>(null);

    const lastRef = React.useRef<null | { index: number; start: number }>(null);

    const activeIndex = indexAt(words, positionMs);

    const { end, start } = captionWindow(activeIndex, words.length);

    const anchorIndex = Math.max(activeIndex, start);

    React.useLayoutEffect(() => {
        const viewport = viewportRef.current;

        const track = trackRef.current;

        const anchor = track?.querySelector<HTMLElement>(`[data-caption-index="${anchorIndex}"]`);

        if (!viewport || !track || !anchor) return;

        const last = lastRef.current;

        const glide = last !== null && last.start === start && Math.abs(anchorIndex - last.index) <= GLIDE_MAX_WORDS;

        // Before the first word the line starts at the centre; afterwards the active word sits there.
        const anchorX = activeIndex < 0 ? anchor.offsetLeft : anchor.offsetLeft + anchor.offsetWidth / 2;

        track.style.transition = glide ? "transform 280ms ease-out" : "none";

        track.style.transform = `translateX(${Math.round(viewport.clientWidth / 2 - anchorX)}px)`;

        lastRef.current = { index: anchorIndex, start };
    }, [activeIndex, anchorIndex, start]);

    if (words.length === 0) return null;

    return (
        <div
            aria-hidden="true"
            className={cn(
                "relative h-7 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
                className,
            )}
            ref={viewportRef}
        >
            <div className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap" ref={trackRef}>
                {words.slice(start, end).map((word, offset) => {
                    const index = start + offset;

                    const state = index === activeIndex ? "active" : index < activeIndex ? "spoken" : "upcoming";

                    return (
                        <span className="inline-flex items-baseline" data-caption-index={index} key={index}>
                            {word.speakerName !== null && (
                                <span className="text-muted-foreground mr-1.5 ml-3 text-[10px] font-semibold tracking-wide uppercase">
                                    {word.speakerName}
                                </span>
                            )}
                            <span
                                className={cn(
                                    "mr-[0.3em] rounded-sm px-0.5 text-sm transition-colors duration-200",
                                    state === "active" && "bg-primary/15 text-foreground font-medium",
                                    state === "spoken" && "text-foreground/80",
                                    state === "upcoming" && "text-muted-foreground/50",
                                )}
                            >
                                {word.text}
                            </span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
