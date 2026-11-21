import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { ApiKeyDialogButton } from "@/components/api-key/api-key-dialog";
import { KeyGate } from "@/components/api-key/key-gate";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { TickerSearch } from "@/components/search/ticker-search";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { isUnauthorized } from "@/lib/api/errors";
import { ME_QUERY_KEY } from "@/lib/api/queries";

import appCss from "../styles.css?url";

// The brand mark (copied from the invinite repo's `public/brand/` + `favicon.ico`). The `?v=` busts the
// browser's favicon cache, which keeps the old bytes for a redrawn file at the same URL: bump it with the files.
const BRAND_ICON_VERSION = "99ea9cdc";

const iconHref = (path: string): string => `${path}?v=${BRAND_ICON_VERSION}`;

// Any request answering 401 (a revoked key) asks `/v1/me` again: the key gate then shows the onboarding card.
const queryCache = new QueryCache({
    onError: (error, query) => {
        if (isUnauthorized(error) && query.queryKey[1] !== "me") void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 60 * 1000,
        },
    },
    queryCache,
});

export const Route = createRootRoute({
    component: RootLayout,
    head: () => ({
        links: [
            {
                href: appCss,
                rel: "stylesheet",
            },
            { href: iconHref("/brand/icon.svg"), rel: "icon", type: "image/svg+xml" },
            { href: iconHref("/brand/icon-32.png"), rel: "icon", sizes: "32x32", type: "image/png" },
            { href: iconHref("/favicon.ico"), rel: "shortcut icon" },
            { href: iconHref("/brand/icon-180.png"), rel: "apple-touch-icon", sizes: "180x180" },
            { href: "/manifest.json", rel: "manifest" },
        ],
        meta: [
            {
                charSet: "utf-8",
            },
            {
                content: "width=device-width, initial-scale=1",
                name: "viewport",
            },
            {
                title: "Invinite Data",
            },
        ],
    }),
    shellComponent: RootDocument,
});

/**
 * Every page: the pinned top bar (sidebar toggle, search, theme, key / account), the one sidebar (Market · Browse ·
 * Context, `src/components/navigation/app-sidebar.tsx`) and the content column behind the key gate.
 */
function RootLayout() {
    return (
        <>
            <div className="sticky shrink-0 top-0 z-40 h-14 bg-background/80 supports-backdrop-filter:backdrop-blur-md">
                <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-3 pl-2 pr-4">
                    <div className="justify-self-start shrink-0">
                        <SidebarTrigger
                            aria-label="Toggle sidebar"
                            className="shrink-0 flex items-center gap-2 rounded-md size-8 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <PanelLeftIcon className="size-4" />
                        </SidebarTrigger>
                    </div>
                    <TickerSearch />
                    <div className="justify-self-end flex items-center gap-3">
                        <ApiKeyDialogButton />
                    </div>
                </div>
            </div>
            <AppSidebar />
            {/* The sidebar is `fixed` and its wrapper a column: the content steps aside by the sidebar's width while it is open. */}
            <div className="relative flex min-w-0 grow flex-col md:peer-data-[state=expanded]:pl-(--sidebar-width)">
                <SidebarInset>
                    <KeyGate>
                        <Outlet />
                    </KeyGate>
                </SidebarInset>
            </div>
        </>
    );
}

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body style={{ "--app-topbar-height": "56px" } as React.CSSProperties}>
                <QueryClientProvider client={queryClient}>
                    <SidebarProvider className="has-data-[variant=inset]:bg-background" defaultOpen>
                        {children}
                        {/* Developer tools only on `pnpm run dev`, never in the deployed build. */}
                        {import.meta.env.DEV && (
                            <TanStackDevtools
                                config={{
                                    position: "bottom-right",
                                }}
                                plugins={[
                                    {
                                        name: "Tanstack Router",
                                        render: <TanStackRouterDevtoolsPanel />,
                                    },
                                ]}
                            />
                        )}
                        <Toaster />
                        <Scripts />
                    </SidebarProvider>
                </QueryClientProvider>
            </body>
        </html>
    );
}
