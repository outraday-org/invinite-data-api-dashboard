import { Link } from "@tanstack/react-router";
import * as React from "react";

import type { V2Dataset } from "@/lib/api/types";

import { SCROLL_ROW_CLASS, ScrollEdgeFades, useActiveItemInView, useScrollEdges } from "@/components/ui/scroll-row";
import { Skeleton } from "@/components/ui/skeleton";
import { visibleInstrumentItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * The instrument's sections as one row of links in the pinned ticker header (ui-redesign task 5) — the twin of the
 * sidebar's context group: both read `visibleInstrumentItems` / `instrumentSectionGroups` of the same `datasets`
 * (`null` = every section, a failed read). Links, not `role="tab"`: each section is a page with its own URL; the active
 * one (`section` = `sectionOf(pathname)`, so a call page keeps "Calls") carries `aria-current="page"`. A link sends no
 * search params (each section has its own schema). The row never wraps: it scrolls sideways inside itself with a fade
 * on a cut edge.
 */
export function SectionTabs({ datasets, section, ticker }: { datasets: null | ReadonlyArray<V2Dataset>; section: string; ticker: string }) {
    const scroller = React.useRef<HTMLDivElement>(null);

    const items = visibleInstrumentItems(datasets);

    const active = items.find(item => item.section === section)?.section;

    const edges = useScrollEdges(scroller);

    useActiveItemInView(scroller, active);

    return (
        <nav aria-label={`Sections of ${ticker.toUpperCase()}`} className="relative min-w-0 flex-1" data-testid="section-tabs">
            <div className={cn(SCROLL_ROW_CLASS, "gap-1")} ref={scroller}>
                {items.map((item) => {
                    const isActive = item.section === active;

                    return (
                        <Link
                            activeOptions={{ exact: item.section === "", includeSearch: false }}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                                "text-muted-foreground hover:text-foreground relative flex h-9 shrink-0 items-center rounded-sm px-2.5 whitespace-nowrap transition-colors max-sm:h-10",
                                "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
                                isActive && "text-foreground font-medium after:bg-brand",
                            )}
                            data-active={isActive || undefined}
                            key={item.to}
                            params={{ ticker }}
                            to={item.to}
                        >
                            {item.shortLabel ?? item.label}
                        </Link>
                    );
                })}
            </div>
            <ScrollEdgeFades edges={edges} testId="section-tabs-fade" />
        </nav>
    );
}

/** The tab row while the instrument loads: fixed widths (a random width would differ between server and client). */
export function SectionTabsSkeleton() {
    return (
        <div aria-hidden className={cn(SCROLL_ROW_CLASS, "min-w-0 flex-1 gap-3 px-2.5")} data-testid="section-tabs-skeleton">
            {["w-16", "w-12", "w-20", "w-14", "w-20", "w-16", "w-24"].map((width, index) => (
                <div className="flex h-9 shrink-0 items-center max-sm:h-10" key={index}>
                    <Skeleton className={cn("h-4", width)} />
                </div>
            ))}
        </div>
    );
}
