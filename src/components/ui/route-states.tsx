import type { ErrorComponentProps } from "@tanstack/react-router";

import { ErrorState } from "@/components/ui/error-state";
import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";

/** The router's default error component: a route that throws while rendering or loading shows this, not a blank page. */
export function RouteError({ error }: ErrorComponentProps) {
    return (
        <PageContainer width="narrow">
            <ErrorState error={error} title="This page failed to load" />
        </PageContainer>
    );
}

/** The router's default pending component (a route waiting on its loader). */
export function RoutePending() {
    return (
        <PageContainer data-testid="route-pending">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-64 w-full" />
        </PageContainer>
    );
}
