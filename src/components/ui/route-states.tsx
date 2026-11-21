import type { ErrorComponentProps } from "@tanstack/react-router";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

/** The router's default error component: a route that throws while rendering or loading shows this, not a blank page. */
export function RouteError({ error }: ErrorComponentProps) {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
            <ErrorState error={error} title="This page failed to load" />
        </div>
    );
}

/** The router's default pending component (a route waiting on its loader). */
export function RoutePending() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 lg:px-8" data-testid="route-pending">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
