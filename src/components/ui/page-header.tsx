import type * as React from "react";

import { ApiButton } from "@/components/api/api-sheet";
import { cn } from "@/lib/utils";

/**
 * The one page title of the dashboard: an `h2` at one size, a muted description under it and an actions slot on the
 * right (filters) ending in the "API" button (O6: the side sheet of the Data API requests the page shows; nothing
 * outside a query client). Every page renders it, in its error state too.
 */
export function PageHeader({
    actions,
    className,
    description,
    title,
}: {
    actions?: React.ReactNode;
    className?: string;
    description?: React.ReactNode;
    title: React.ReactNode;
}) {
    return (
        <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)} data-slot="page-header">
            <div className="flex min-w-0 max-w-3xl flex-col gap-1">
                <h2 className="text-base font-semibold tracking-tight">{title}</h2>
                {description && <div className="text-muted-foreground">{description}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {actions}
                <ApiButton />
            </div>
        </div>
    );
}
