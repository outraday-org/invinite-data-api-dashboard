import { createRouter } from "@tanstack/react-router";

import { NotFound } from "@/components/ui/not-found";
import { RouteError, RoutePending } from "@/components/ui/route-states";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
    const router = createRouter({
        defaultErrorComponent: RouteError,
        defaultNotFoundComponent: NotFound,
        defaultPendingComponent: RoutePending,
        defaultPreloadStaleTime: 0,
        routeTree,
        scrollRestoration: true,
    });

    return router;
};
