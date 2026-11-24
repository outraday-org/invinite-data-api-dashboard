import type * as React from "react";

import { cn } from "@/lib/utils";

import { usePageHeadingLevel } from "./page-header";

/**
 * A top-level block of a page (ui-redesign task 6): a 15 px title row with an optional description and right-aligned
 * `actions` (an export menu, a "Show all"), the content below — no border, no background; the page separates sections by
 * whitespace (`gap-8`). The title is one level below the page's `PageHeader` (`h2` on a global page, `h3` under a family
 * header). `Card` stays for discrete objects (a tile, a call card, a destination) and forms; never a `Card` inside a
 * `Card`.
 */
export function Section({
    actions,
    "aria-label": ariaLabel,
    children,
    className,
    description,
    id,
    title,
}: {
    /** Names the section as a region (a test or assistive tech finds it by name); most sections need none. */
    "aria-label"?: string;
    "actions"?: React.ReactNode;
    "children"?: React.ReactNode;
    "className"?: string;
    "description"?: React.ReactNode;
    "id"?: string;
    "title": React.ReactNode;
}) {
    const Heading = usePageHeadingLevel() === 1 ? "h2" : "h3";

    return (
        <section aria-label={ariaLabel} className={cn("flex min-w-0 flex-col gap-3", className)} data-slot="section" id={id}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Heading className="text-section">{title}</Heading>
                    {description && <div className="text-muted-foreground max-w-[68ch]">{description}</div>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
        </section>
    );
}
