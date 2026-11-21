import * as React from "react";

import { cn } from "@/lib/utils";

export type TabStripOption<T extends string> = { count?: string; label: string; value: T };

/**
 * A row of exclusive choices kept in the URL by the page (a tab, a window, a pill): `role="tablist"` with one
 * `aria-selected` tab, ←/→ move and select, Home / End jump. The page decides what a value means (`onSelect`).
 */
export function TabStrip<T extends string>({
    "aria-label": ariaLabel,
    className,
    onSelect,
    options,
    value,
}: {
    "aria-label": string;
    "className"?: string;
    "onSelect": (value: T) => void;
    "options": ReadonlyArray<TabStripOption<T>>;
    "value": T;
}) {
    const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

    const activeIndex = Math.max(0, options.findIndex(option => option.value === value));

    const onKeyDown = (event: React.KeyboardEvent) => {
        const last = options.length - 1;

        const target = { ArrowLeft: activeIndex === 0 ? last : activeIndex - 1, ArrowRight: activeIndex === last ? 0 : activeIndex + 1, End: last, Home: 0 }[event.key];

        if (target === undefined) return;

        event.preventDefault();

        onSelect(options[target].value);

        refs.current[target]?.focus();
    };

    return (
        <div
            aria-label={ariaLabel}
            className={cn("bg-muted text-muted-foreground inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg p-[3px]", className)}
            role="tablist"
        >
            {options.map((option, index) => {
                const selected = index === activeIndex;

                return (
                    <button
                        aria-selected={selected}
                        className={cn(
                            "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            selected ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
                        )}
                        key={option.value}
                        onClick={() => onSelect(option.value)}
                        onKeyDown={onKeyDown}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        role="tab"
                        tabIndex={selected ? 0 : -1}
                        type="button"
                    >
                        {option.label}
                        {option.count && <span className="text-muted-foreground tabular-nums">{option.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
