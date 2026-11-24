// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

afterEach(cleanup);

const queries: Array<string> = [];

beforeEach(() => {
    queries.length = 0;

    // A phone or a tablet: `useIsMobile` reads `(max-width: 1023px)`.
    vi.stubGlobal("matchMedia", (query: string) => {
        queries.push(query);

        return { addEventListener: vi.fn(), matches: true, media: query, removeEventListener: vi.fn() };
    });
});

describe("the sidebar breakpoint", () => {
    it("is off-canvas below 1024 px (ui-redesign F9: docked at 768 px it took a third of a tablet)", () => {
        render(
            <SidebarProvider>
                <Sidebar>
                    <span>Browse</span>
                </Sidebar>
            </SidebarProvider>,
        );

        expect(queries).toContain("(max-width: 1023px)");
    });
});

describe("the sidebar on a phone (a sheet over the page)", () => {
    it("closes once a link in it is picked (F098)", async () => {
        render(
            <SidebarProvider>
                <Sidebar>
                    <a href="#funds">Funds</a>
                    <span>Browse</span>
                </Sidebar>
                <SidebarTrigger />
            </SidebarProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));

        expect(await screen.findByRole("dialog")).toBeInTheDocument();

        // A click on the sheet that is no link keeps it open.
        fireEvent.click(screen.getByText("Browse"));

        expect(screen.getByRole("dialog")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("link", { name: "Funds" }));

        await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
});
