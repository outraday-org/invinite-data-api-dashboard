import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The classes that let the LAST of `count` cells fill its row where it would stand alone (ui-redesign task 8): an odd
 * count on 2 columns, `n % 3 === 1` on 3 columns (640–1279 px), `n % 4 === 1` on 4 columns. Literal class names.
 */
export function statFillClass(count: number) {
    return cn(count % 2 === 1 && "max-sm:col-span-2", count % 3 === 1 && "sm:max-xl:col-span-3", count % 4 === 1 && "xl:col-span-4");
}

/**
 * A grid of label / value pairs (ui-redesign task 6) with hairlines between the cells instead of one bordered card per
 * value: 2 columns, 3 from 640 px, 4 from 1280 px. Each cell draws its top and left hairline and the grid is shifted
 * by 1 px inside a clipping frame, so only the lines BETWEEN cells show, whatever the last row's length. A last cell
 * that would be alone in its row fills it (`statFillClass`): no orphan. Leave a null value out (`{value && <Stat/>}`):
 * the count is taken from the rendered cells.
 */
export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
    const cells = React.Children.toArray(children).filter(child => React.isValidElement<{ className?: string }>(child));

    const last = cells.at(-1);

    const fill = last ? statFillClass(cells.length) : "";

    return (
        <div className={cn("overflow-hidden", className)} data-slot="stat-grid">
            <dl className="-mt-px -ml-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                {fill && last ? [...cells.slice(0, -1), React.cloneElement(last, { className: cn(last.props.className, fill) })] : cells}
            </dl>
        </div>
    );
}

/** One cell of a `StatGrid`: a 12 px muted label, the 15 px value, an optional muted sub-line. */
export function Stat({ className, label, sub, value }: { className?: string; label: React.ReactNode; sub?: React.ReactNode; value: React.ReactNode }) {
    return (
        <div className={cn("flex min-w-0 flex-col gap-0.5 border-t border-l px-3 py-2.5", className)} data-slot="stat">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-section font-medium tabular-nums wrap-break-word">{value}</dd>
            {sub !== undefined && sub !== null && <dd className="text-muted-foreground text-xs">{sub}</dd>}
        </div>
    );
}
