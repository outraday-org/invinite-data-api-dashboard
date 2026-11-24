import * as React from "react";

import { cn } from "@/lib/utils";

/** The heading level of a page's `PageHeader` title: 1 on a global page, 2 under a family header (ticker, alerts). */
export type PageHeadingLevel = 1 | 2;

const HeadingLevelContext = React.createContext<PageHeadingLevel>(1);

/**
 * Sets the `PageHeader` level of the pages below: the ticker layout (its header's `h1` is the symbol) and the alerts
 * layout provide 2, so no page passes a level by hand. A `Section` title is one step below it.
 */
export function HeadingLevelProvider({ children, value }: { children: React.ReactNode; value: PageHeadingLevel }) {
    return <HeadingLevelContext value={value}>{children}</HeadingLevelContext>;
}

/** The `PageHeader` level in this part of the tree (1 without a provider). */
export function usePageHeadingLevel(): PageHeadingLevel {
    return React.use(HeadingLevelContext);
}

/**
 * The one page title of the dashboard (ui-redesign task 6): the title (`h1` on a global page, `h2` under a family
 * header — `HeadingLevelProvider`; `level` overrides it), a muted description, an optional `meta` line (counts, the
 * newest filing, a coverage line) and `actions` = the page's PRIMARY actions only (create, alert entry point, live
 * switch) — filters go into a `FilterBar` below. Below 640 px the actions drop under the text, left-aligned. The Data
 * API requests of the page are in the top bar's request panel (task 3). Every page renders it, in its error state too.
 */
export function PageHeader({
    actions,
    className,
    description,
    level,
    meta,
    title,
}: {
    actions?: React.ReactNode;
    className?: string;
    description?: React.ReactNode;
    level?: PageHeadingLevel;
    meta?: React.ReactNode;
    title: React.ReactNode;
}) {
    const contextLevel = usePageHeadingLevel();

    const Heading = (level ?? contextLevel) === 1 ? "h1" : "h2";

    return (
        <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-6", className)} data-slot="page-header">
            <div className="flex min-w-0 max-w-3xl flex-col gap-1">
                <Heading className="text-xl font-semibold tracking-tight">{title}</Heading>
                {description && <div className="text-muted-foreground max-w-[68ch] text-sm">{description}</div>}
                {meta && <div className="text-muted-foreground text-xs" data-slot="page-header-meta">{meta}</div>}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    {actions}
                </div>
            )}
        </div>
    );
}
