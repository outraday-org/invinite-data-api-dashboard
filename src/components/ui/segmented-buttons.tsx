import type * as React from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
    /** Shown after the label (a `PlanBadge`). */
    badge?: React.ReactNode;
    label: string;
    title?: string;
    value: T;
};

/** The quiet segmented control's frame (`SegmentedButtons`, `TabStrip`): a muted pill holding its segments. */
export const SEGMENTED_GROUP_CLASS = "bg-muted text-muted-foreground inline-flex w-fit items-center gap-0.5 rounded-lg p-[3px]";

/** One segment of the quiet segmented control (28 px, 36 px below 640 px); the selected one is raised. */
export function segmentClass(selected: boolean) {
    return cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors max-sm:h-9",
        selected ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
    );
}

/**
 * A row of exclusive choices that switch a view in place (ui-redesign task 9: the statement's layout and period, the
 * segments layout, the filing reader's panel): `aria-pressed` buttons in a `role="group"`, drawn like `TabStrip`'s
 * quiet segmented control (28 px, 36 px below 640 px). It never wraps inside itself (`shrink-0`), so a toolbar breaks
 * between groups, never in the middle of one. `TabStrip` is the tablist variant (a page's own tabs).
 */
export function SegmentedButtons<T extends string>({
    "aria-label": ariaLabel,
    className,
    onChange,
    options,
    value,
}: {
    "aria-label": string;
    "className"?: string;
    "onChange": (value: T) => void;
    "options": ReadonlyArray<SegmentedOption<T>>;
    "value": T;
}) {
    return (
        <div
            aria-label={ariaLabel}
            className={cn(SEGMENTED_GROUP_CLASS, "shrink-0", className)}
            data-slot="segmented-buttons"
            role="group"
        >
            {options.map((option) => {
                const selected = option.value === value;

                return (
                    <button
                        aria-pressed={selected}
                        className={segmentClass(selected)}
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        title={option.title}
                        type="button"
                    >
                        {option.label}
                        {option.badge}
                    </button>
                );
            })}
        </div>
    );
}
