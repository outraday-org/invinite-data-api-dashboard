import * as React from "react";

import { segmentClass, SEGMENTED_GROUP_CLASS } from "@/components/ui/segmented-buttons";
import { cn } from "@/lib/utils";

export type TabStripOption<T extends string> = { count?: string; label: string; value: T };

/**
 * A row of exclusive choices kept in the URL by the page (a tab, a window, a pill): `role="tablist"` with one
 * `aria-selected` tab, ←/→ move and select, Home / End jump. The page decides what a value means (`onSelect`).
 * Looks like a quiet segmented control (28 px, 36 px touch targets below 640 px; the app's one focus outline); the line
 * tabs of `ui/tabs.tsx` are the in-page tab bars.
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
            className={cn(SEGMENTED_GROUP_CLASS, "max-w-full flex-wrap", className)}
            role="tablist"
        >
            {options.map((option, index) => {
                const selected = index === activeIndex;

                return (
                    <button
                        aria-selected={selected}
                        className={segmentClass(selected)}
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
