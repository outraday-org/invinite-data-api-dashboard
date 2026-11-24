import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A row that scrolls sideways inside itself (never wraps), its scrollbar hidden: the ticker section tabs, the alerts tabs,
 * the call tabs. No scroll snapping: a snap point pulled `useActiveItemInView`'s scroll back and left the active item
 * under the edge fade.
 */
export const SCROLL_ROW_CLASS = "flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** The fades' width (`w-8`): the active item is scrolled clear of it. */
const FADE_WIDTH = 32;

/** Whether the row is cut on its left / right edge (a fade marks each cut edge); one row that fits has none. */
export function useScrollEdges(scroller: React.RefObject<HTMLElement | null>) {
    const [edges, setEdges] = React.useState({ end: false, start: false });

    React.useEffect(() => {
        const element = scroller.current;

        if (!element) return;

        // ±1: sub-pixel rounding of a row exactly as wide as its box.
        const measure = () => setEdges({
            end: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
            start: element.scrollLeft > 1,
        });

        measure();

        element.addEventListener("scroll", measure, { passive: true });

        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);

        observer?.observe(element);

        return () => {
            element.removeEventListener("scroll", measure);

            observer?.disconnect();
        };
    }, [scroller]);

    return edges;
}

/**
 * Brings the row's `[data-active]` item into the row's view whenever `active` changes, by scrolling the row itself
 * (never the page: no `scrollIntoView`, which would also scroll the document to the row).
 */
export function useActiveItemInView(scroller: React.RefObject<HTMLElement | null>, active: string | undefined) {
    React.useEffect(() => {
        const element = scroller.current;

        const item = element?.querySelector<HTMLElement>("[data-active]");

        if (!element || !item) return;

        // The item's place in the row's scrolled content.
        const left = item.getBoundingClientRect().left - element.getBoundingClientRect().left + element.scrollLeft;

        const right = left + item.offsetWidth;

        // Clear of the edge fade (`ScrollEdgeFades`, 32 px) where the row has room for it; nothing to do when it fits.
        if (element.scrollWidth <= element.clientWidth) return;

        if (left - FADE_WIDTH < element.scrollLeft) element.scrollTo({ left: Math.max(0, left - FADE_WIDTH) });
        else if (right + FADE_WIDTH > element.scrollLeft + element.clientWidth) element.scrollTo({ left: right + FADE_WIDTH - element.clientWidth });
    }, [scroller, active]);
}

/** The fades over a scroll row's cut edges (the row's parent is `relative`). */
export function ScrollEdgeFades({ className, edges, testId }: { className?: string; edges: { end: boolean; start: boolean }; testId?: string }) {
    return (
        <>
            {edges.start && <div aria-hidden className={cn("from-background pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r to-transparent", className)} data-testid={testId} />}
            {edges.end && <div aria-hidden className={cn("from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l to-transparent", className)} data-testid={testId} />}
        </>
    );
}
