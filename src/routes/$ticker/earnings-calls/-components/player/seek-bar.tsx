import * as React from "react";

import type { PlayerEngine } from "@/lib/player/engine";

import { formatMs } from "@/lib/earnings/format";
import { usePlayerPosition } from "@/lib/player/player-context";
import { cn } from "@/lib/utils";

/** A point of the call on the seek bar (the Q&A start; O3 adds the slide changes). */
export type PlayerMarker = { label: string; ms: number };

/** ← / → move this far; with Shift `SHIFT_STEP_SECONDS`. */
const STEP_SECONDS = 5;

const SHIFT_STEP_SECONDS = 15;

function share(ms: number, endMs: number) {
    return `${Math.min(100, Math.max(0, (ms / endMs) * 100))}%`;
}

/**
 * The player's seek bar (`role="slider"`): the played part, the buffered range, the markers, a hover time and the
 * keyboard (← / → 5 s, Shift 15 s, Home / End). A drag shows its target and seeks on release, without starting a
 * paused recording. Re-renders per frame (it subscribes `usePlayerPosition()` itself); nothing without a known end.
 */
export function SeekBar({ className, engine, markers }: { className?: string; engine: PlayerEngine; markers: ReadonlyArray<PlayerMarker> }) {
    const { bufferedMs, durationMs, positionMs } = usePlayerPosition();

    const trackRef = React.useRef<HTMLDivElement | null>(null);

    const [hoverMs, setHoverMs] = React.useState<null | number>(null);

    const [dragMs, setDragMs] = React.useState<null | number>(null);

    const endMs = engine.endMs ?? durationMs;

    if (endMs === null || endMs <= 0) return <div className={cn("bg-muted h-1 grow rounded-full", className)} />;

    const shownMs = dragMs ?? positionMs;

    const msAt = (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();

        if (!rect || rect.width <= 0) return 0;

        return Math.min(endMs, Math.max(0, ((clientX - rect.left) / rect.width) * endMs));
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        const step = event.shiftKey ? SHIFT_STEP_SECONDS : STEP_SECONDS;

        if (event.key === "ArrowLeft" || event.key === "ArrowDown") engine.skip(-step);
        else if (event.key === "ArrowRight" || event.key === "ArrowUp") engine.skip(step);
        else if (event.key === "Home") engine.seekMs(0, { play: false });
        else if (event.key === "End") engine.seekMs(endMs, { play: false });
        else return;

        event.preventDefault();

        // The page's Space / J / L shortcuts never see a key the slider took.
        event.stopPropagation();
    };

    return (
        <div
            aria-label="Seek"
            aria-valuemax={Math.round(endMs / 1000)}
            aria-valuemin={0}
            aria-valuenow={Math.round(shownMs / 1000)}
            aria-valuetext={`${formatMs(shownMs)} of ${formatMs(endMs)}`}
            className={cn(
                "group/seek focus-visible:ring-ring/40 relative flex h-4 min-w-24 grow cursor-pointer touch-none items-center rounded-sm outline-none focus-visible:ring-2",
                className,
            )}
            onKeyDown={onKeyDown}
            // A cancelled drag (the OS took the pointer, the window lost focus) seeks nowhere and lets go of the thumb.
            onPointerCancel={() => setDragMs(null)}
            onPointerDown={(event) => {
                // The main button / a touch / a pen only: a right click opens the context menu, it never seeks.
                if (event.button !== 0) return;

                event.currentTarget.setPointerCapture(event.pointerId);

                setDragMs(msAt(event.clientX));
            }}
            onPointerLeave={() => setHoverMs(null)}
            onPointerMove={(event) => {
                const ms = msAt(event.clientX);

                setHoverMs(ms);

                if (dragMs !== null) setDragMs(ms);
            }}
            onPointerUp={(event) => {
                if (dragMs === null) return;

                engine.seekMs(msAt(event.clientX), { play: false });

                setDragMs(null);
            }}
            ref={trackRef}
            role="slider"
            tabIndex={0}
        >
            <div className="bg-muted relative h-1 w-full rounded-full group-hover/seek:h-1.5">
                <div className="bg-muted-foreground/25 absolute inset-y-0 left-0 rounded-full" style={{ width: share(bufferedMs, endMs) }} />
                <div className="bg-primary absolute inset-y-0 left-0 rounded-full" style={{ width: share(shownMs, endMs) }} />
                {markers.filter(marker => marker.ms > 0 && marker.ms < endMs).map(marker => (
                    <div
                        aria-hidden="true"
                        className="bg-foreground/70 absolute -top-1 h-[calc(100%+0.5rem)] w-0.5 -translate-x-1/2 rounded-full"
                        data-marker={marker.label}
                        key={`${marker.label}-${marker.ms}`}
                        style={{ left: share(marker.ms, endMs) }}
                        title={`${marker.label} · ${formatMs(marker.ms)}`}
                    />
                ))}
            </div>
            <div
                aria-hidden="true"
                className="bg-primary absolute size-3 -translate-x-1/2 rounded-full shadow-sm"
                style={{ left: share(shownMs, endMs) }}
            />
            {hoverMs !== null && (
                <div
                    aria-hidden="true"
                    className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 rounded-sm border px-1 py-0.5 text-[10px] tabular-nums shadow-sm"
                    style={{ left: share(hoverMs, endMs) }}
                >
                    {formatMs(hoverMs)}
                    {markers.filter(marker => Math.abs(marker.ms - hoverMs) <= endMs * 0.01).map(marker => ` · ${marker.label}`)}
                </div>
            )}
        </div>
    );
}

/** `21:22 / 45:47` (per frame, like the seek bar). */
export function PlayerTime({ engine }: { engine: PlayerEngine }) {
    const { durationMs, positionMs } = usePlayerPosition();

    const endMs = engine.endMs ?? durationMs;

    return (
        <span className="shrink-0 tabular-nums">
            {formatMs(positionMs)}
            {endMs !== null && ` / ${formatMs(endMs)}`}
        </span>
    );
}
