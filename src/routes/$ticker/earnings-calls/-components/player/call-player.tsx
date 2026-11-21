import { Loader2, Play } from "lucide-react";
import * as React from "react";

import type { PlayerEngine } from "@/lib/player/engine";

import { Button } from "@/components/ui/button";
import { STICKY_TOP_CLASS } from "@/lib/layout";
import { engineHasMedia, PLAYER_SKIP_SECONDS, readStoredRate } from "@/lib/player/engine";
import { usePlayer } from "@/lib/player/player-context";
import { cn } from "@/lib/utils";

import type { PlayerDetail, PlayerDownload } from "./player-controls";
import type { PlayerMarker } from "./seek-bar";

import { MediaState } from "../media-state";
import { DownloadButton, FollowButton, MoreMenu, PlayPauseButton, SkipButtons, SpeedButtons, VolumeControl } from "./player-controls";
import { PlayerTime, SeekBar } from "./seek-bar";

/** Keys the page shortcuts leave alone: typing, and controls that answer Space themselves. */
const INTERACTIVE_SELECTOR = "input, textarea, select, button:not([role='tab']), a[href], [contenteditable=''], [contenteditable='true'], [role='slider'], [role='menuitem'], [role='combobox']";

function isTypingTarget(target: EventTarget | null) {
    return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

/** Space play / pause, J / L ∓15 s — on the page, never while typing or on a focused control. */
function usePlayerShortcuts(engine: PlayerEngine) {
    // An effect event: the listener is added once and always sees the current engine.
    const onKeyDown = React.useEffectEvent((event: KeyboardEvent) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;

        const key = event.key.toLowerCase();

        if (key === " ") {
            if (engine.state === "error" || engine.state === "loading") return;

            if (engine.paused) engine.play();
            else engine.pause();
        }
        else if ((key === "j" || key === "l") && engine.capabilities.skip && engineHasMedia(engine.state)) {
            engine.skip(key === "j" ? -PLAYER_SKIP_SECONDS : PLAYER_SKIP_SECONDS);
        }
        else {
            return;
        }

        event.preventDefault();
    });

    React.useEffect(() => {
        const listener = (event: KeyboardEvent) => onKeyDown(event);

        window.addEventListener("keydown", listener);

        return () => window.removeEventListener("keydown", listener);
    }, []);
}

/** True while the sticky bar is pinned (the page scrolled it to its `top`): the bar then takes its compact layout. */
function useStuck(ref: React.RefObject<HTMLElement | null>) {
    const [stuck, setStuck] = React.useState(false);

    React.useEffect(() => {
        let frame = 0;

        const measure = () => {
            frame = 0;

            const element = ref.current;

            if (!element) return;

            const top = Number.parseFloat(getComputedStyle(element).top) || 0;

            setStuck(window.scrollY > 0 && element.getBoundingClientRect().top <= top + 0.5);
        };

        const onScroll = () => {
            if (frame === 0) frame = requestAnimationFrame(measure);
        };

        window.addEventListener("scroll", onScroll, { passive: true });

        measure();

        return () => {
            cancelAnimationFrame(frame);

            window.removeEventListener("scroll", onScroll);
        };
    }, [ref]);

    return stuck;
}

/**
 * THE call player (owner 2026-11-21): one bar above the tabs of every call, sticky below the pinned ticker header,
 * thinner once pinned. It renders from `engine.state` and `engine.capabilities` only — it never knows whether a file
 * or a live stream plays (`usePlayer()`); what is specific to the media comes in as props (`caption`, `details`,
 * `download`, `markers`). Before the media is asked for, a Play button asks for it (never on page load).
 */
export function CallPlayer({
    caption,
    details = [],
    detailsTitle = "Recording",
    download = null,
    markers = [],
}: {
    /** The caption line under the controls (stays in the compact layout). */
    caption?: React.ReactNode;
    /** The `⋯` menu's rows. */
    details?: ReadonlyArray<PlayerDetail>;
    detailsTitle?: string;
    download?: null | PlayerDownload;
    markers?: ReadonlyArray<PlayerMarker>;
}) {
    const { engine, follow, setFollow } = usePlayer();

    const barRef = React.useRef<HTMLDivElement | null>(null);

    const compact = useStuck(barRef);

    usePlayerShortcuts(engine);

    // The remembered speed, applied once (a speed set on the element before its source carries over).
    const rateAppliedRef = React.useRef(false);

    React.useEffect(() => {
        if (rateAppliedRef.current || !engine.capabilities.rate) return;

        rateAppliedRef.current = true;

        const stored = readStoredRate();

        if (stored !== null && stored !== engine.rate) engine.setRate(stored);
    });

    let body: React.ReactNode;

    if (engine.state === "error") {
        body = <div className="grow"><MediaState error={engine.error} title="Failed to load the recording" /></div>;
    }
    else if (engine.state === "idle") {
        body = (
            <Button onClick={engine.play} size="sm" type="button">
                <Play />
                Play the recording
            </Button>
        );
    }
    else if (engine.state === "loading") {
        body = (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                Loading the recording…
            </span>
        );
    }
    else {
        body = (
            <>
                <PlayPauseButton engine={engine} />
                <PlayerTime engine={engine} />
                <SeekBar className="order-last basis-full sm:order-none sm:basis-auto" engine={engine} markers={markers} />
                <div className="flex flex-wrap items-center gap-1">
                    {engine.capabilities.skip && <SkipButtons engine={engine} />}
                    {engine.capabilities.rate && <SpeedButtons compact={compact} engine={engine} />}
                    <VolumeControl compact={compact} engine={engine} />
                    <FollowButton follow={follow} onFollowChange={setFollow} />
                    {engine.capabilities.download && download && <DownloadButton download={download} />}
                    {details.length > 0 && <MoreMenu details={details} title={detailsTitle} />}
                </div>
            </>
        );
    }

    return (
        <div
            aria-label="Call player"
            className={cn(
                "bg-background/95 sticky z-20 flex flex-col rounded-md border backdrop-blur transition-[padding]",
                STICKY_TOP_CLASS,
                compact ? "gap-0.5 px-2 py-1 shadow-sm" : "gap-2 p-3",
            )}
            data-compact={compact || undefined}
            ref={barRef}
            role="region"
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{body}</div>
            {engineHasMedia(engine.state) && caption}
        </div>
    );
}
