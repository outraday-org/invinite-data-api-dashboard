import { AudioLines, Loader2, Pause, Play } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { formatMs } from "@/lib/earnings/format";

import { useCallAudio } from "./audio-context";
import { CaptionLine } from "./caption-line";

type ElementState = { durationMs: null | number; paused: boolean; positionMs: number };

const IDLE: ElementState = { durationMs: null, paused: true, positionMs: 0 };

/** Play state and position of the page's `<audio>` element while a recording is in it. */
function useElementState(audioRef: React.RefObject<HTMLAudioElement | null>, loaded: boolean): ElementState {
    const [state, setState] = React.useState<ElementState>(IDLE);

    React.useEffect(() => {
        const element = audioRef.current;

        if (!loaded || !element) return undefined;

        const read = () => setState({
            durationMs: Number.isFinite(element.duration) ? element.duration * 1000 : null,
            paused: element.paused,
            positionMs: element.currentTime * 1000,
        });

        const events = ["durationchange", "emptied", "loadedmetadata", "pause", "play", "seeked", "timeupdate"] as const;

        events.forEach(name => element.addEventListener(name, read));

        read();

        return () => events.forEach(name => element.removeEventListener(name, read));
    }, [audioRef, loaded]);

    return state;
}

/**
 * The compact player shown outside the Audio tab once a recording is asked for or playing
 * (a timestamp click, "Play from here"): play / pause, position and a way to the full player.
 * Sticky above the panel, so a seek on a long transcript stays audible and controllable.
 */
export function MiniPlayer({ onOpenAudioTab }: { onOpenAudioTab: () => void }) {
    const { audio, audioRef, loaded, playedUrl, requested } = useCallAudio();

    const { durationMs, paused, positionMs } = useElementState(audioRef, loaded);

    if (!loaded && !requested) return null;

    const togglePlay = () => {
        const element = audioRef.current;

        if (!element) return;

        if (element.paused) element.play().catch(() => undefined);
        else element.pause();
    };

    const openPlayer = (
        <Button onClick={onOpenAudioTab} size="xs" type="button" variant="ghost">
            <AudioLines />
            Audio tab
        </Button>
    );

    let body: React.ReactNode;

    if (loaded) {
        body = (
            <>
                <Button aria-label={paused ? "Play" : "Pause"} onClick={togglePlay} size="icon-xs" type="button" variant="outline">
                    {paused ? <Play /> : <Pause />}
                </Button>
                <span className="tabular-nums">
                    {formatMs(positionMs)}
                    {durationMs !== null && ` / ${formatMs(durationMs)}`}
                </span>
                {!audio.data && playedUrl && <span className="text-muted-foreground">search hit</span>}
            </>
        );
    }
    else if (audio.error) {
        body = <span className="text-muted-foreground">The recording could not be loaded — see the Audio tab.</span>;
    }
    else {
        body = (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                Loading the recording…
            </span>
        );
    }

    return (
        <div className="bg-background/95 sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs backdrop-blur">
            {body}
            <div className="ml-auto">{openPlayer}</div>
            {/* The words being spoken, so the other tabs still show what is said. */}
            {loaded && <CaptionLine className="basis-full" />}
        </div>
    );
}
