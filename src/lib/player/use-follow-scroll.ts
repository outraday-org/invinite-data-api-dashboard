import * as React from "react";

import { usePlayer } from "./player-context";

/**
 * The room a followed element keeps above it when the page scrolls it into view: the pinned top bar, the ticker header
 * and the sticky call player (`scroll-margin-top`; a literal, Tailwind only sees class names written out).
 */
export const FOLLOW_SCROLL_MARGIN_CLASS = "scroll-mt-[calc(var(--app-topbar-height,0px)+var(--ticker-header-height,0px)+7rem)]";

/** Keys that scroll the page (Space is the player's play / pause, never a scroll here). */
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp"]);

/** A key pressed here moves a control (the seek bar, a select, a menu), not the page. */
const CONTROL_SELECTOR = "input, textarea, select, [contenteditable='true'], [role='slider'], [role='menu'], [role='listbox'], [role='dialog'], [role='tablist'], [role='combobox']";

/**
 * A wheel / touch move here never scrolls the page: dragging the seek bar (or the volume) on a touch screen, an open
 * menu, list or dialog (the page is scroll-locked behind those).
 */
const NON_PAGE_SCROLL_SELECTOR = "[role='slider'], [role='menu'], [role='listbox'], [role='dialog']";

const targetsWithin = (event: Event, selector: string) => event.target instanceof Element && event.target.closest(selector) !== null;

/**
 * The player's Follow (task O3): while it is on and the audio plays, the page (the document, never a box) scrolls the
 * element marked `data-follow-index={activeIndex}` inside `containerRef` into view each time the index moves; a wheel,
 * touch or scroll-key move by the reader switches Follow off (the player's Follow button turns it back on). A
 * programmatic scroll ("Jump to transcript", `scrollToTurn`) fires none of those events, so it never switches it off.
 * Only a mounted list follows: the call page mounts the open tab only.
 */
export function useFollowScroll({
    activeIndex,
    block = "center",
    containerRef,
    enabled = true,
}: {
    activeIndex: number;
    /** `center` for turns; `nearest` for a single pane that should only come into view (the slide timeline). */
    block?: ScrollLogicalPosition;
    containerRef: React.RefObject<HTMLElement | null>;
    /** The audio plays: the reader's scroll only counts (and the page only follows) while it does. */
    enabled?: boolean;
}) {
    const { follow, setFollow } = usePlayer();

    const following = follow && enabled;

    React.useEffect(() => {
        if (!following || activeIndex < 0) return;

        const node = containerRef.current?.querySelector<HTMLElement>(`[data-follow-index="${activeIndex}"]`);

        node?.scrollIntoView({ behavior: "smooth", block });
    }, [activeIndex, block, containerRef, following]);

    React.useEffect(() => {
        if (!following) return;

        const stop = (event: Event) => {
            if (!targetsWithin(event, NON_PAGE_SCROLL_SELECTOR)) setFollow(false);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (!SCROLL_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;

            if (targetsWithin(event, CONTROL_SELECTOR)) return;

            setFollow(false);
        };

        window.addEventListener("wheel", stop, { passive: true });

        window.addEventListener("touchmove", stop, { passive: true });

        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("wheel", stop);

            window.removeEventListener("touchmove", stop);

            window.removeEventListener("keydown", onKeyDown);
        };
    }, [following, setFollow]);
}
