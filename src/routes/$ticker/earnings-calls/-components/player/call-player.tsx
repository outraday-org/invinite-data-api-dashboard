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
import {
    BehindLiveButton,
    DownloadButton,
    FollowButton,
    LivePill,
    MoreMenu,
    PlayPauseButton,
    SkipButtons,
    SpeedButtons,
    TuneInButtons,
    VolumeControl,
} from "./player-controls";
import { PlayerTime, SeekBar } from "./seek-bar";

/**
 * Keys the page shortcuts leave alone: typing, controls that answer Space themselves, and anything inside an open
 * dialog / menu / list (`closest` also matches the focused popup itself, e.g. a menu with no item focused yet).
 */
const INTERACTIVE_SELECTOR = [
    "input",
    "textarea",
    "select",
    "button:not([role='tab'])",
    "a[href]",
    "summary",
    "[contenteditable='']",
    "[contenteditable='true']",
    "[role='slider']",
    "[role='menuitem']",
    "[role='combobox']",
    "[role='dialog']",
    "[role='alertdialog']",
    "[role='menu']",
    "[role='listbox']",
].join(", ");

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

        // A resize moves the pinned offset (the ticker header wraps) without a scroll.
        window.addEventListener("resize", onScroll);

        measure();

        return () => {
            cancelAnimationFrame(frame);

            window.removeEventListener("scroll", onScroll);

            window.removeEventListener("resize", onScroll);
        };
    }, [ref]);

    return stuck;
}

/**
 * THE call player (owner 2026-11-21): one bar above the tabs of every call, sticky below the pinned ticker header,
 * thinner once pinned. It renders from `engine.state` and `engine.capabilities` only — it never knows whether a file
 * or a live stream plays (`usePlayer()`); what is specific to the media comes in as props (`caption`, `details`,
 * `download`, `markers`, and for a live call `notice`, `status`, `menu`). Before the media is asked for, a Play button
 * asks for it (never on page load); a live engine (`jumpToLive`) offers "Tune in" / "From the beginning" instead.
 *
 * Live states (O4): `live-edge` = the `LIVE` pill (`LIVE · synced`) where the time stands; `live-behind` = `−MM:SS`
 * behind live (a click = back to live) and ±15 s. A live engine has no `rate` capability: no speed buttons.
 */
export function CallPlayer({
    caption,
    details = [],
    detailsNote,
    detailsTitle = "Recording",
    download = null,
    markers = [],
    menu,
    notice,
    playLabel = "Play the recording",
    status,
}: {
    /** The caption line under the controls (stays in the compact layout). */
    caption?: React.ReactNode;
    /** The `⋯` menu's rows. */
    details?: ReadonlyArray<PlayerDetail>;
    /** One muted line under the `⋯` menu's rows (the recording: permanent link, forensic watermark). */
    detailsNote?: string;
    detailsTitle?: string;
    download?: null | PlayerDownload;
    markers?: ReadonlyArray<PlayerMarker>;
    /** More `⋯` menu content (the live call's playback mode). */
    menu?: React.ReactNode;
    /** A line in place of the controls (a live stream not playable yet, a call that ended). */
    notice?: React.ReactNode;
    /** The idle Play button's text ("Play from 12:34" for a link at a time). */
    playLabel?: string;
    /** Status pills beside the controls (buffering, waiting for the transcript, reconnecting …). */
    status?: React.ReactNode;
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

    const live = engine.jumpToLive !== undefined;

    let body: React.ReactNode;

    if (notice) {
        body = <div className="text-muted-foreground grow" role="status">{notice}</div>;
    }
    else if (engine.state === "error") {
        body = <div className="grow"><MediaState error={engine.error} operationId={live ? "getLiveAudio" : "getAudio"} title={live ? "Live audio unavailable" : "Failed to load the recording"} /></div>;
    }
    else if (engine.state === "idle" && engine.jumpToLive) {
        const { jumpToLive } = engine;

        // The playback mode is chosen before tuning in too.
        body = (
            <>
                <TuneInButtons onFromStart={() => engine.seekMs(0)} onTuneIn={jumpToLive} />
                {menu && <MoreMenu details={details} note={detailsNote} title={detailsTitle}>{menu}</MoreMenu>}
            </>
        );
    }
    else if (engine.state === "idle") {
        body = (
            <Button className="max-sm:h-10" onClick={engine.play} size="sm" type="button">
                <Play />
                {playLabel}
            </Button>
        );
    }
    else if (engine.state === "loading") {
        body = (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                {live ? "Tuning in…" : "Loading the recording…"}
            </span>
        );
    }
    else {
        body = (
            <>
                <PlayPauseButton engine={engine} />
                {engine.state === "live-edge" && <LivePill synced={engine.synced === true} />}
                {engine.state === "live-behind" && engine.jumpToLive && <BehindLiveButton behindMs={engine.behindMs} onJumpToLive={engine.jumpToLive} />}
                {engine.state !== "live-edge" && engine.state !== "live-behind" && <PlayerTime engine={engine} />}
                <SeekBar className="order-last basis-full sm:order-none sm:basis-auto" engine={engine} markers={markers} />
                <div className="flex flex-wrap items-center gap-1">
                    {/* At the edge there is nothing ahead: ±15 s only once behind (J / L still move back). */}
                    {engine.capabilities.skip && engine.state !== "live-edge" && <SkipButtons engine={engine} />}
                    {engine.capabilities.rate && <SpeedButtons compact={compact} engine={engine} />}
                    <VolumeControl compact={compact} engine={engine} />
                    <FollowButton follow={follow} onFollowChange={setFollow} />
                    {engine.capabilities.download && download && <DownloadButton download={download} />}
                    {(details.length > 0 || menu) && <MoreMenu details={details} note={detailsNote} title={detailsTitle}>{menu}</MoreMenu>}
                </div>
            </>
        );
    }

    return (
        <div
            aria-label="Call player"
            className={cn(
                // No box (ui-redesign task 10): a top hairline; once pinned a bottom hairline and a shadow part it from the
                // text scrolling under it. The background stays opaque enough to read the controls over the transcript.
                "bg-background/95 sticky z-20 flex flex-col border-t backdrop-blur transition-[padding]",
                STICKY_TOP_CLASS,
                compact ? "gap-0.5 border-b py-1 shadow-sm" : "gap-2 py-2.5",
            )}
            data-compact={compact || undefined}
            ref={barRef}
            role="region"
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {body}
                {status}
            </div>
            {engineHasMedia(engine.state) && caption}
        </div>
    );
}
