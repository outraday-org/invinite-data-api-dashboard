import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { ApiKeyDialogButton } from "@/components/api-key/api-key-dialog";
import { KeyGate } from "@/components/api-key/key-gate";
import { RequestPanel } from "@/components/api/request-panel";
import { RequestPanelToggle } from "@/components/api/request-panel-toggle";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { TickerSearch } from "@/components/search/ticker-search";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { isUnauthorized } from "@/lib/api/errors";
import { isMeQueryKey, ME_QUERY_KEY } from "@/lib/api/queries";
import { shareWithRequests } from "@/lib/api/request-meta";
import { brandIconHref } from "@/lib/brand";
import { THEME_SCRIPT } from "@/lib/theme";

import appCss from "../styles.css?url";

// Any request answering 401 (a revoked key) asks `/v1/me` again: the key gate then shows the onboarding card.
const queryCache = new QueryCache({
    onError: (error, query) => {
        if (isUnauthorized(error) && !isMeQueryKey(query.queryKey)) void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 60 * 1000,
            // React Query's own sharing, plus the API inspector's requests carried onto the kept copy.
            structuralSharing: shareWithRequests,
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
            { href: brandIconHref("/brand/icon.svg"), rel: "icon", type: "image/svg+xml" },
            { href: brandIconHref("/brand/icon-32.png"), rel: "icon", sizes: "32x32", type: "image/png" },
            { href: brandIconHref("/favicon.ico"), rel: "shortcut icon" },
            { href: brandIconHref("/brand/icon-180.png"), rel: "apple-touch-icon", sizes: "180x180" },
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
 * Every page: the pinned top bar (sidebar toggle, brand mark → home, search, theme, key / plan, the request-panel toggle), the
 * one sidebar (the context group first, then the collapsible `NAV_GROUPS`, `src/components/navigation/app-sidebar.tsx`) and the content column behind
 * the key gate.
 */
function RootLayout() {
    const scrolled = useScrolled();

    return (
        <>
            {/* The first focusable element: skips the top bar and the sidebar (a ticker page's section tabs are its first stop). */}
            <a
                className="bg-background text-foreground sr-only z-50 rounded-md border px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
                href="#content"
            >
                Skip to content
            </a>
            {/* The hairline appears once the page is scrolled (a border colour change, no layout shift). */}
            <header
                className="sticky shrink-0 top-0 z-40 h-14 border-b border-transparent bg-background/80 transition-colors supports-backdrop-filter:backdrop-blur-md data-scrolled:border-border"
                data-scrolled={scrolled || undefined}
                data-slot="top-bar"
            >
                <div className="grid h-full w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 sm:gap-3 sm:pr-4 lg:grid-cols-[1fr_auto_1fr]">
                    <div className="flex shrink-0 items-center gap-1 justify-self-start">
                        <SidebarTrigger
                            aria-label="Toggle sidebar"
                            className="shrink-0 flex items-center gap-2 rounded-md size-8 text-sm font-semibold text-foreground"
                        >
                            <PanelLeftIcon className="size-4" />
                        </SidebarTrigger>
                        {/* The brand mark links home; it leaves the phone's bar to the search. */}
                        <Link
                            aria-label="Invinite Data home"
                            className="hidden shrink-0 items-center gap-2 rounded-md px-1 py-1 sm:flex"
                            data-testid="brand-link"
                            to="/"
                        >
                            <img alt="" className="size-6" height={24} src={brandIconHref("/brand/icon.svg")} width={24} />
                            <span className="text-sm font-semibold tracking-tight">Invinite Data</span>
                        </Link>
                    </div>
                    <TickerSearch />
                    <div className="flex items-center gap-2 justify-self-end">
                        {/* Below 640 px the theme switch lives in the sidebar (beside Account), the plan beside Account too. */}
                        <div className="hidden sm:flex">
                            <ThemeToggle />
                        </div>
                        <ApiKeyDialogButton />
                        <RequestPanelToggle />
                    </div>
                </div>
            </header>
            <AppSidebar />
            {/*
              * The sidebar is `fixed` and its wrapper a column: the content steps aside by the sidebar's width while it
              * is docked (from 1024 px), and by `--request-panel-width` for a docked request panel (from 1280 px; the
              * `RequestPanel` after it writes the variable while it is docked and open).
              */}
            <div className="relative flex min-w-0 grow flex-col lg:peer-data-[state=expanded]:pl-(--sidebar-width) xl:pr-(--request-panel-width)">
                <SidebarInset className="outline-none" id="content" tabIndex={-1}>
                    <KeyGate>
                        <Outlet />
                    </KeyGate>
                </SidebarInset>
            </div>
            <RequestPanel />
        </>
    );
}

/** Whether the document is scrolled away from the top (the top bar's hairline); read once per frame. */
function useScrolled(): boolean {
    const [scrolled, setScrolled] = React.useState(false);

    React.useEffect(() => {
        let frame = 0;

        const read = () => {
            frame = 0;

            setScrolled(window.scrollY > 0);
        };

        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(read);
        };

        read();

        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);

            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);

    return scrolled;
}

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        // The no-flash script sets `.dark` before React hydrates: the class differs from the server's on purpose.
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
                <HeadContent />
            </head>
            <body style={{ "--app-topbar-height": "56px", "--request-panel-width": "0px" } as React.CSSProperties}>
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
