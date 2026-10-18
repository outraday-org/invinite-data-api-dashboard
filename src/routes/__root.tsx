import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { ApiKeyDialogButton } from "@/components/api-key/api-key-dialog";
import { TickerSearch } from "@/components/search/ticker-search";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 60 * 1000,
        },
    },
});

export const Route = createRootRoute({
    component: RootLayout,
    head: () => ({
        links: [
            {
                href: appCss,
                rel: "stylesheet",
            },
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
                title: "Invinite API Dashboard",
            },
        ],
    }),
    shellComponent: RootDocument,
});

function RootLayout() {
    const pathname = useRouterState({
        select: state => state.location.pathname,
    });

    const showSidebarTrigger = pathname !== "/";

    return (
        <>
            <div className="sticky shrink-0 top-0 z-40 h-14 bg-background/80 supports-backdrop-filter:backdrop-blur-md">
                <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-3 pl-2 pr-4">
                    <div className="justify-self-start shrink-0">
                        {showSidebarTrigger && (
                            <SidebarTrigger
                                aria-label="Toggle sidebar"
                                className="shrink-0 flex items-center gap-2 rounded-md size-8 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <PanelLeftIcon className="size-4" />
                            </SidebarTrigger>
                        )}
                    </div>
                    <TickerSearch />
                    <div className="justify-self-end">
                        <ApiKeyDialogButton />
                    </div>
                </div>
            </div>
            <Outlet />
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
                        <Toaster />
                        <Scripts />
                    </SidebarProvider>
                </QueryClientProvider>
            </body>
        </html>
    );
}
