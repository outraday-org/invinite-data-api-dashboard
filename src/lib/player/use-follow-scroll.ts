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

/**
 * Where the followed word sits: its line is kept between `FOLLOW_BAND_TOP` and `FOLLOW_BAND_BOTTOM` of the visible
 * area under the pinned bars, and brought back to `FOLLOW_WORD_AT` once it leaves that band — so a turn longer than the
 * window is followed line by line, not only scrolled to its middle (the page moves now and then, never every word).
 */
export const FOLLOW_WORD_AT = 0.3;

const FOLLOW_BAND_TOP = 0.1;

const FOLLOW_BAND_BOTTOM = 0.65;

/**
 * How far the document must scroll (px, positive = down) so the active word's line sits at `FOLLOW_WORD_AT` of the
 * visible area `[insetTop, viewportHeight]`; 0 while it is inside the band. Pure.
 */
export function followWordDelta({ bottom, insetTop, top, viewportHeight }: { bottom: number; insetTop: number; top: number; viewportHeight: number }): number {
    const visible = Math.max(viewportHeight - insetTop, 1);

    if (top >= insetTop + visible * FOLLOW_BAND_TOP && bottom <= insetTop + visible * FOLLOW_BAND_BOTTOM) return 0;

    return Math.round(top - (insetTop + visible * FOLLOW_WORD_AT));
}

const targetsWithin = (event: Event, selector: string) => event.target instanceof Element && event.target.closest(selector) !== null;

/**
 * A press on the window's own scrollbar (O4): it targets the root element, right of (or below) the client area. A drag
 * of the scrollbar fires no wheel / touch / key event, so it is told apart here.
 */
export function onPageScrollbar(event: Pick<PointerEvent, "clientX" | "clientY" | "target">): boolean {
    const root = document.documentElement;

    return event.target === root && (event.clientX >= root.clientWidth || event.clientY >= root.clientHeight);
}

/**
 * The player's Follow (task O3): while it is on and the audio plays, the page (the document, never a box) scrolls the
 * element marked `data-follow-index={activeIndex}` inside `containerRef` into view each time the index moves; a wheel,
 * touch, scroll-key move or a press on the page's scrollbar by the reader switches Follow off (the player's Follow button turns it back on). A
 * programmatic scroll ("Jump to transcript", `scrollToTurn`) fires none of those events, so it never switches it off.
 * Only a mounted list follows: the call page mounts the open tab only. With an `activeWord` (a timed turn), the page
 * follows that word's line inside the element (`[data-word-index]`, `followWordDelta`) instead of centring the element.
 */
export function useFollowScroll({
    activeIndex,
    activeWord = -1,
    block = "center",
    containerRef,
    enabled = true,
}: {
    activeIndex: number;
    /** The heard word inside the active element (`data-word-index`), -1 = none: the element itself is followed. */
    activeWord?: number;
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

        if (!node) return;

        const word = activeWord < 0 ? null : node.querySelector<HTMLElement>(`[data-word-index="${activeWord}"]`);

        if (!word) {
            node.scrollIntoView({ behavior: "smooth", block });

            return;
        }

        // The pinned bars' height = the element's `scroll-margin-top` (`FOLLOW_SCROLL_MARGIN_CLASS`).
        const insetTop = Number.parseFloat(getComputedStyle(node).scrollMarginTop) || 0;

        const rect = word.getBoundingClientRect();

        const delta = followWordDelta({ bottom: rect.bottom, insetTop, top: rect.top, viewportHeight: window.innerHeight });

        if (delta !== 0) window.scrollBy({ behavior: "smooth", top: delta });
    }, [activeIndex, activeWord, block, containerRef, following]);

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

        const onPointerDown = (event: PointerEvent) => {
            if (onPageScrollbar(event)) setFollow(false);
        };

        window.addEventListener("wheel", stop, { passive: true });

        window.addEventListener("pointerdown", onPointerDown);

        window.addEventListener("touchmove", stop, { passive: true });

        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("wheel", stop);

            window.removeEventListener("touchmove", stop);

            window.removeEventListener("pointerdown", onPointerDown);

            window.removeEventListener("keydown", onKeyDown);
        };
    }, [following, setFollow]);
}
