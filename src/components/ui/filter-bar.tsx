import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

/** The actions at the end of a `FilterBar` (a "Search text" toggle): shown beside "Reset filters", never collapsed. */
export function FilterBarTrailing({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

const isTrailing = (child: React.ReactNode) => React.isValidElement(child) && child.type === FilterBarTrailing;

/**
 * THE filter row of a list page (ui-redesign task 6): `FilterField`s on a grid of ≥ 11 rem tracks (`auto-fill`, so a
 * few fields stay compact and a long bar wraps into aligned rows, never a ragged flex row), top-aligned (`items-start`:
 * the labels of a row share one line and its first controls the next, even beside a taller field), a
 * `FilterBarTrailing` at the end (bottom-aligned with the controls, never the labels), and "Reset filters" while
 * `activeCount` > 0 (its space is kept while hidden, so the fields never resize when the first filter is set) (`onReset`: the page clears its filter params with `IN_PLACE`).
 * Below 640 px a bar of more than one field collapses into a "Filters · n" disclosure button (`aria-expanded`; the open
 * state is local). The collapse is CSS (`max-sm:hidden`), so the server render is already collapsed on a phone — no
 * `useIsMobile`, no hydration flash. A bar of one field shows it inline.
 * `more` = the rarely needed fields behind a "More filters" toggle (`aria-expanded`, local state; open at mount when
 * `moreActiveCount` > 0, and the toggle names that count while closed): they join the same grid once open.
 */
export function FilterBar({
    activeCount = 0,
    children,
    className,
    label = "Filters",
    more,
    moreActiveCount = 0,
    onReset,
}: {
    /** The filters set (a day range counts once): > 0 shows "Reset filters" and the count on the phone button. */
    activeCount?: number;
    children: React.ReactNode;
    className?: string;
    /** The accessible name of the bar's group. */
    label?: string;
    /** Fields shown only after "More filters" (a fragment of `FilterField`s). */
    more?: React.ReactNode;
    /** The filters set among `more`. */
    moreActiveCount?: number;
    onReset?: () => void;
}) {
    const [open, setOpen] = React.useState(false);

    const [moreOpen, setMoreOpen] = React.useState(() => moreActiveCount > 0);

    const fieldsId = React.useId();

    const items = React.Children.toArray(children);

    const fields = items.filter(child => !isTrailing(child));

    const trailing = items.filter(isTrailing);

    const collapsible = fields.length > 1 || more !== undefined;

    const canReset = activeCount > 0 && onReset !== undefined;

    return (
        <div aria-label={label} className={cn("flex flex-col gap-3 sm:flex-row sm:items-end", className)} data-slot="filter-bar" role="group">
            <div
                className={cn("grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] items-start gap-3", collapsible && !open && "max-sm:hidden")}
                data-slot="filter-bar-fields"
                id={fieldsId}
            >
                {fields}
                {moreOpen && more}
            </div>
            {(collapsible || onReset !== undefined || trailing.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 max-sm:order-first sm:shrink-0">
                    {collapsible && (
                        <Button aria-controls={fieldsId} aria-expanded={open} className="sm:hidden" onClick={() => setOpen(value => !value)} type="button" variant="outline">
                            <SlidersHorizontal />
                            {activeCount > 0 ? `Filters · ${activeCount}` : "Filters"}
                        </Button>
                    )}
                    {more !== undefined && (
                        <Button aria-controls={fieldsId} aria-expanded={moreOpen} className={cn(collapsible && !open && "max-sm:hidden")} onClick={() => setMoreOpen(value => !value)} type="button" variant="ghost">
                            <ChevronDown className={cn("transition-transform", moreOpen && "rotate-180")} />
                            {moreOpen ? "Fewer filters" : moreActiveCount > 0 ? `More filters · ${moreActiveCount}` : "More filters"}
                        </Button>
                    )}
                    {onReset !== undefined && (
                        // Always laid out from 640 px (hidden until a filter is set): setting the first filter never
                        // narrows the fields beside it. `aria-hidden` + `inert` keep the hidden one out of reach.
                        <Button
                            aria-hidden={canReset ? undefined : true}
                            className={cn(!canReset && "invisible max-sm:hidden")}
                            inert={!canReset}
                            onClick={onReset}
                            tabIndex={canReset ? undefined : -1}
                            type="button"
                            variant="ghost"
                        >
                            <X />
                            Reset filters
                        </Button>
                    )}
                    {trailing}
                </div>
            )}
        </div>
    );
}

FilterBar.Trailing = FilterBarTrailing;

/**
 * One labelled filter of a `FilterBar`: a visible 12 px label above its control. A render-prop child gets the label's
 * target id (`<label htmlFor>`: a select trigger, an input); any other child (a `DayRange`, a chip group) is a
 * `role="group"` named by the label (`aria-labelledby`). `span={2}` takes two grid tracks from 640 px (≥ 364 px: a
 * `DayRange`'s two 150 px inputs and its separator on one row); `span={3}` three from 1024 px (a row of chips).
 * Controls fill the field (`w-full`).
 */
export function FilterField({
    children,
    className,
    label,
    span = 1,
}: {
    children: ((id: string) => React.ReactNode) | React.ReactNode;
    className?: string;
    label: string;
    span?: 1 | 2 | 3;
}) {
    const id = React.useId();

    const labelId = `${id}-label`;

    const labelClass = "text-muted-foreground text-xs font-medium";

    const spanClass = span === 3 ? "sm:col-span-2 lg:col-span-3" : span === 2 ? "sm:col-span-2" : undefined;

    if (typeof children === "function") {
        return (
            <div className={cn("flex min-w-0 flex-col gap-1", spanClass, className)} data-slot="filter-field">
                <label className={labelClass} htmlFor={id} id={labelId}>{label}</label>
                {children(id)}
            </div>
        );
    }

    return (
        <div aria-labelledby={labelId} className={cn("flex min-w-0 flex-col gap-1", spanClass, className)} data-slot="filter-field" role="group">
            <span className={labelClass} id={labelId}>{label}</span>
            {children}
        </div>
    );
}
