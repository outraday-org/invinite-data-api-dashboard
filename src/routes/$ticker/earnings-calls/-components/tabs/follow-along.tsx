import { LocateFixed } from "lucide-react";
import * as React from "react";

import type { TimedWord, WordTurn } from "@/lib/earnings/follow-along";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { activeTurnIndex, indexAt, timedWordsOf } from "@/lib/earnings/follow-along";
import { formatMs } from "@/lib/earnings/format";
import { speakerName } from "@/lib/earnings/transcript";
import { usePlayer, usePlayerPosition } from "@/lib/player/player-context";
import { cn } from "@/lib/utils";

import { useCallAudio } from "../audio-context";
import { MediaState } from "../media-state";

type TurnState = "active" | "spoken" | "upcoming";

/** `activeWord` of a turn that is not the active one; a constant so the memo holds. */
const NO_WORD = -2;

/**
 * One turn of the follow view. Memoised: only the active turn re-renders at word rate (its
 * `activeWord` changes); the others change only when the active turn moves past them.
 */
const FollowTurn = React.memo(function FollowTurn({
    activeWord,
    index,
    onSeek,
    state,
    timed,
    turn,
}: {
    activeWord: number;
    index: number;
    onSeek: ((ms: number) => void) | null;
    state: TurnState;
    timed: Array<TimedWord> | null;
    turn: WordTurn;
}) {
    const detail = [turn.title, turn.name ? null : turn.role].filter(Boolean).join(" · ");

    const body = timed === null
        ? <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{turn.text}</p>
        : (
                <p className="leading-relaxed">
                    {timed.map((word, wordIndex) => {
                        const wordState = state === "active"
                            ? wordIndex === activeWord ? "active" : wordIndex < activeWord ? "spoken" : "upcoming"
                            : state;

                        return (
                            <span
                                className={cn(
                                    "rounded-sm transition-colors duration-150",
                                    wordState === "active" && "bg-primary/15 text-foreground font-medium",
                                    wordState === "spoken" && "text-foreground",
                                    wordState === "upcoming" && "text-muted-foreground/40",
                                )}
                                // Words have no id; their order within one turn is stable.
                                key={wordIndex}
                            >
                                {word.text}
                                {" "}
                            </span>
                        );
                    })}
                </p>
            );

    const canSeek = onSeek !== null && turn.start_ms !== null;

    return (
        <div
            aria-current={state === "active" ? "true" : undefined}
            className={cn("flex flex-col gap-1 rounded-md px-2 py-1.5", state === "active" && "bg-accent/60")}
            data-follow-turn-index={index}
        >
            <div className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="font-medium">{speakerName(turn)}</span>
                {detail && <span className="text-muted-foreground">{detail}</span>}
                {turn.start_ms !== null && (
                    canSeek
                        ? (
                                <button
                                    aria-label={`Play from ${formatMs(turn.start_ms)}`}
                                    className="text-muted-foreground hover:text-foreground tabular-nums underline-offset-4 hover:underline"
                                    onClick={() => onSeek(turn.start_ms as number)}
                                    type="button"
                                >
                                    {formatMs(turn.start_ms)}
                                </button>
                            )
                        : <span className="text-muted-foreground tabular-nums">{formatMs(turn.start_ms)}</span>
                )}
            </div>
            {body}
        </div>
    );
});

/**
 * The follow view (under the Transcript tab's turns until O3's `TurnBlock` replaces it; nothing before a recording is
 * in): the transcript, the turn being heard highlighted and its words lit as they are spoken, what was said in full,
 * what comes next faint. The view keeps the heard turn in sight while the player's `follow` is on; a wheel / touch
 * scroll by the reader switches it off ("Follow the audio" or the player's Follow button resumes), and a turn's
 * timestamp seeks there. Untimed turns (a company-document transcript) are read, never followed.
 */
export function FollowAlong() {
    const { loaded, seekMs, words, wordTurns } = useCallAudio();

    const { follow, setFollow } = usePlayer();

    const { positionMs } = usePlayerPosition();

    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const paused = !follow;

    const setPaused = (on: boolean) => setFollow(!on);

    const timed = React.useMemo(
        () => wordTurns.map((turn, index) => {
            const next = wordTurns.slice(index + 1).find(candidate => candidate.start_ms !== null);

            return timedWordsOf(turn, next?.start_ms ?? null);
        }),
        [wordTurns],
    );

    const activeIndex = activeTurnIndex(wordTurns, positionMs);

    const activeWord = activeIndex >= 0 && timed[activeIndex] ? indexAt(timed[activeIndex], positionMs) : NO_WORD;

    // Keep the heard turn in view unless the reader took the scroll.
    React.useEffect(() => {
        if (paused || activeIndex < 0) return;

        const box = containerRef.current;

        const node = box?.querySelector<HTMLElement>(`[data-follow-turn-index="${activeIndex}"]`);

        // Only the box scrolls (never the page: the reader may be reading the turns above it).
        if (box && node) box.scrollTo({ behavior: "smooth", top: node.offsetTop - box.clientHeight / 2 + node.offsetHeight / 2 });
    }, [activeIndex, paused]);

    if (!loaded) return null;

    if (words.error) return <MediaState error={words.error} title="The transcript could not be loaded to follow the recording" />;

    if (!words.data) return <Skeleton className="h-40 w-full" />;

    if (wordTurns.length === 0) return <p className="text-muted-foreground text-xs">No transcript text to follow.</p>;

    const timedAny = timed.some(entry => entry !== null);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">Follow along</span>
                <span className="text-muted-foreground">
                    {timedAny ? "The words light up as they are spoken; a timestamp plays from there." : "This transcript has no timings — it is shown as text."}
                </span>
                {paused && timedAny && (
                    <Button className="ml-auto" onClick={() => setPaused(false)} size="xs" type="button" variant="outline">
                        <LocateFixed />
                        Follow the audio
                    </Button>
                )}
            </div>
            <div
                className="relative max-h-[60vh] overflow-y-auto rounded-md border p-2 text-sm"
                onTouchMove={() => setPaused(true)}
                onWheel={() => setPaused(true)}
                ref={containerRef}
            >
                <div className="flex flex-col gap-1">
                    {wordTurns.map((turn, index) => (
                        <FollowTurn
                            activeWord={index === activeIndex ? activeWord : NO_WORD}
                            index={index}
                            // Turns have no id; their order within one answer is stable.
                            key={index}
                            onSeek={seekMs}
                            state={index === activeIndex ? "active" : index < activeIndex ? "spoken" : "upcoming"}
                            timed={timed[index]}
                            turn={turn}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
