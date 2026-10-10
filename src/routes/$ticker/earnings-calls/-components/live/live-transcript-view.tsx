import * as React from "react";

import type { LiveTurn, LiveTurnSpeaker } from "@/lib/live/live-transcript-reducer";

import { Badge } from "@/components/ui/badge";
import { formatMs } from "@/lib/earnings/format";
import { cn } from "@/lib/utils";

/**
 * The live transcript (a port of the admin console's `LiveTranscriptView.tsx` behaviour).
 *
 * - At the live edge (`activeIndex === -1`) text appears as it arrives and the view keeps its
 *   bottom in sight; scrolling up more than 48 px pauses that (a note says so), scrolling back
 *   to the bottom resumes it.
 * - Behind the edge (follow mode) the turn being heard is highlighted and kept in view, and a
 *   click on a turn seeks the audio to its start.
 * - Provisional names: "Name · title, firm" + a "live" badge; the native tooltip says where the
 *   name came from ("provisional — from question cue, confidence 0.90"), since a turn may itself
 *   be a button. An `llm` name is lighter. No name → "Speaker N". The final transcript's names
 *   replace all of it once it is published.
 */

/** Closer to the bottom than this counts as "at the bottom". */
const BOTTOM_SLACK_PX = 48;

export function liveSpeakerName(label: null | string): string {
    if (label === null) return "Speaker";

    return /^spk\d+$/i.test(label) ? `Speaker ${Number(label.slice(3)) + 1}` : `Speaker ${label}`;
}

/** "CFO" / "Barclays" / "CFO, Acme" — what follows the name; `null` = nothing. */
function speakerDetail(speaker: LiveTurnSpeaker): null | string {
    const parts = [speaker.title, speaker.firm].filter((part): part is string => part !== null && part.length > 0);

    return parts.length === 0 ? null : parts.join(", ");
}

function speakerSourceText(speaker: LiveTurnSpeaker): string {
    return `provisional — from ${speaker.source.replaceAll("_", " ")}, confidence ${speaker.confidence.toFixed(2)}`;
}

function LiveSpeaker({ label, speaker }: { label: null | string; speaker: LiveTurnSpeaker | null }) {
    if (speaker === null) return <>{liveSpeakerName(label)}</>;

    const detail = speakerDetail(speaker);

    return (
        <span
            className={cn("inline-flex flex-wrap items-baseline gap-1", speaker.source === "llm" && "opacity-70")}
            title={speakerSourceText(speaker)}
        >
            <span className="sr-only">{detail === null ? `${speaker.name}, provisional` : `${speaker.name}, ${detail}, provisional`}</span>
            <span aria-hidden="true">{speaker.name}</span>
            {detail !== null && (
                <span aria-hidden="true" className="text-muted-foreground font-normal">
                    ·
                    {" "}
                    {detail}
                </span>
            )}
            <Badge aria-hidden="true" variant="outline">live</Badge>
        </span>
    );
}

export function LiveTranscriptView({
    activeIndex,
    onTurnClick,
    turns,
}: {
    /** The turn being heard (follow mode), or `-1` at the live edge. */
    activeIndex: number;
    /** Present in follow mode: a turn click seeks the audio. */
    onTurnClick?: (startMs: number) => void;
    turns: ReadonlyArray<LiveTurn>;
}) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const [paused, setPaused] = React.useState(false);

    const following = activeIndex >= 0;

    const onScroll = () => {
        const node = containerRef.current;

        if (node === null) return;

        setPaused(node.scrollHeight - node.scrollTop - node.clientHeight > BOTTOM_SLACK_PX);
    };

    const last = turns.at(-1);

    const lastKey = last?.key;

    const lastText = last?.text;

    const lastPartial = last?.partialText;

    // At the edge: keep the newest text in sight unless the reader scrolled up.
    React.useLayoutEffect(() => {
        const node = containerRef.current;

        if (node === null || paused || following) return;

        node.scrollTop = node.scrollHeight;
    }, [following, lastKey, lastPartial, lastText, paused, turns.length]);

    // Behind the edge: keep the turn being heard in view.
    React.useEffect(() => {
        if (!following || paused) return;

        const node = containerRef.current?.querySelector<HTMLElement>(`[data-live-turn-index="${activeIndex}"]`);

        node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [activeIndex, following, paused]);

    return (
        <div className="flex flex-col gap-1">
            {paused && (
                <p className="text-muted-foreground text-xs" role="status">
                    Auto-scroll paused — scroll to the bottom to follow again.
                </p>
            )}
            <div
                aria-live={following ? "off" : "polite"}
                className="max-h-[60vh] min-h-48 overflow-y-auto rounded-md border p-3 text-sm"
                onScroll={onScroll}
                ref={containerRef}
            >
                {turns.length === 0
                    ? <p className="text-muted-foreground text-xs">No transcript yet.</p>
                    : turns.map((turn, index) => {
                            const active = index === activeIndex;

                            const body = (
                                <>
                                    <span className="font-medium">
                                        <LiveSpeaker label={turn.speakerLabel} speaker={turn.speaker} />
                                    </span>
                                    {" "}
                                    <span className="text-muted-foreground mr-1 text-xs tabular-nums">{formatMs(turn.startMs)}</span>
                                    <span>
                                        {turn.text}
                                        {turn.partialText !== null && (
                                            <span className="text-muted-foreground italic">
                                                {turn.text.length > 0 ? " " : ""}
                                                {turn.partialText}
                                            </span>
                                        )}
                                    </span>
                                </>
                            );

                            const className = cn("block w-full rounded px-1 py-1 text-left", active && "bg-accent");

                            return onTurnClick
                                ? (
                                        <button
                                            aria-current={active ? "true" : undefined}
                                            className={cn(className, "hover:bg-accent/50 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-2")}
                                            data-live-turn-index={index}
                                            data-start-ms={turn.startMs}
                                            key={turn.key}
                                            onClick={() => onTurnClick(turn.startMs)}
                                            type="button"
                                        >
                                            {body}
                                        </button>
                                    )
                                : (
                                        <p
                                            aria-current={active ? "true" : undefined}
                                            className={className}
                                            data-live-turn-index={index}
                                            data-start-ms={turn.startMs}
                                            key={turn.key}
                                        >
                                            {body}
                                        </p>
                                    );
                        })}
            </div>
        </div>
    );
}
