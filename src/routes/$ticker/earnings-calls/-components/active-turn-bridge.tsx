import * as React from "react";

import type { TranscriptTurn } from "@/lib/earnings/transcript";

import { activeTurnIndex } from "@/lib/earnings/follow-along";

import { useCallPlayback } from "./audio-context";

/**
 * Marks the Transcript tab's turn being heard (`data-active="true"` on the
 * `[data-turn-index]` element inside `containerRef`) while a recording is in the player —
 * by the DOM, never by re-rendering the turns at frame rate (the admin console's
 * `TranscriptActiveWordBridge` pattern). It never scrolls: the reader is reading; the Audio
 * tab's follow view is the one that follows.
 */
export function ActiveTurnBridge({
    containerRef,
    turns,
}: {
    containerRef: React.RefObject<HTMLDivElement | null>;
    turns: ReadonlyArray<Pick<TranscriptTurn, "start_ms">>;
}) {
    const { positionMs } = useCallPlayback();

    const activeIndex = activeTurnIndex(turns, positionMs);

    const lastRef = React.useRef<HTMLElement | null>(null);

    React.useEffect(() => {
        const next = activeIndex < 0
            ? null
            : containerRef.current?.querySelector<HTMLElement>(`[data-turn-index="${activeIndex}"]`) ?? null;

        if (lastRef.current === next) return;

        lastRef.current?.removeAttribute("data-active");

        next?.setAttribute("data-active", "true");

        lastRef.current = next;
    }, [activeIndex, containerRef]);

    React.useEffect(
        () => () => {
            lastRef.current?.removeAttribute("data-active");

            lastRef.current = null;
        },
        [],
    );

    return null;
}
