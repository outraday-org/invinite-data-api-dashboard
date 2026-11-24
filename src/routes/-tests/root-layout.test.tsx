// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestPanelToggle } from "@/components/api/request-panel-toggle";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useRequestPanelStore } from "@/lib/stores/request-panel-store";
import { Route } from "@/routes/__root";

vi.mock("@tanstack/react-router", () => ({
    // The route object keeps its options: the test renders `options.component` (the root layout) itself.
    createRootRoute: (options: unknown) => ({ options }),
    HeadContent: () => null,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
    Outlet: () => <h1>Page</h1>,
    Scripts: () => null,
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: "/" } }),
}));

vi.mock("@tanstack/react-devtools", () => ({ TanStackDevtools: () => null }));

vi.mock("@tanstack/react-router-devtools", () => ({ TanStackRouterDevtoolsPanel: () => null }));

// The shell's own pieces have their suites; here they are stand-ins with the landmarks they render.
vi.mock("@/components/navigation/app-sidebar", () => ({ AppSidebar: () => <nav aria-label="Main" /> }));

vi.mock("@/components/api/request-panel", () => ({
    REQUEST_PANEL_ID: "request-panel",
    REQUEST_PANEL_TOGGLE_ID: "request-panel-toggle",
    RequestPanel: () => <aside aria-label="API requests of this page" />,
}));

vi.mock("@/components/search/ticker-search", () => ({ TickerSearch: () => <button type="button">Search</button> }));

vi.mock("@/components/api-key/api-key-dialog", () => ({ ApiKeyDialogButton: () => null }));

vi.mock("@/components/api-key/key-gate", () => ({ KeyGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

vi.mock("@/components/theme/theme-toggle", () => ({ ThemeToggle: () => null }));

const RootLayout = (Route as unknown as { options: { component: () => React.ReactNode } }).options.component;

function renderShell(children: React.ReactNode) {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <SidebarProvider>{children}</SidebarProvider>
        </QueryClientProvider>,
    );
}

afterEach(cleanup);

beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() }));

    window.localStorage.clear();

    useRequestPanelStore.setState({ hasHydrated: true, open: false });
});

describe("root layout landmarks (ui-redesign task 14)", () => {
    it("one banner, the navigation, one main with the page, the request panel's complementary", () => {
        renderShell(<RootLayout />);

        expect(screen.getAllByRole("banner")).toHaveLength(1);

        expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();

        const main = screen.getByRole("main");

        expect(main).toHaveAttribute("id", "content");

        expect(main).toContainElement(screen.getByRole("heading", { level: 1, name: "Page" }));

        expect(screen.getByRole("complementary", { name: "API requests of this page" })).toBeInTheDocument();

        // The request panel's toggle sits in the top bar.
        expect(screen.getByRole("banner")).toContainElement(screen.getByRole("button", { name: "Show the API requests of this page" }));
    });

    it("the skip link is the first focusable element and targets the main landmark, which takes focus", () => {
        const { container } = renderShell(<RootLayout />);

        const first = container.querySelector("a[href], button, input, [tabindex]:not([tabindex='-1'])");

        expect(first).toHaveTextContent("Skip to content");

        expect(first).toHaveAttribute("href", "#content");

        expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    });
});

describe("request panel toggle (ui-redesign task 3)", () => {
    it("names its action, is pressed while open, and toggles on a click", () => {
        renderShell(<RequestPanelToggle />);

        const toggle = screen.getByRole("button", { name: "Show the API requests of this page" });

        expect(toggle).toHaveAttribute("aria-pressed", "false");

        expect(toggle).toHaveAttribute("aria-controls", "request-panel");

        fireEvent.click(toggle);

        expect(screen.getByRole("button", { name: "Hide the API requests of this page" })).toHaveAttribute("aria-pressed", "true");
    });

    it("the `.` key toggles it, never while typing in a field or with a modifier", () => {
        const { container } = renderShell(
            <>
                <input aria-label="Field" />
                <RequestPanelToggle />
            </>,
        );

        act(() => {
            fireEvent.keyDown(window, { key: "." });
        });

        expect(useRequestPanelStore.getState().open).toBe(true);

        act(() => {
            fireEvent.keyDown(container.querySelector("input")!, { key: "." });

            fireEvent.keyDown(window, { ctrlKey: true, key: "." });

            fireEvent.keyDown(window, { key: "," });
        });

        expect(useRequestPanelStore.getState().open).toBe(true);

        act(() => {
            fireEvent.keyDown(window, { key: "." });
        });

        expect(useRequestPanelStore.getState().open).toBe(false);
    });
});
