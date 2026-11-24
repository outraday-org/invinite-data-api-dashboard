// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { ME_PRO } from "@/lib/account-fixtures";
import { ApiRequestError } from "@/lib/api/errors";
import { useInstrument, useKeyState, useV2Filer, useV2FilingsInfinite, useV2LiveEvents, useV2Person } from "@/lib/api/queries";
import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { AAPL_INSTRUMENT, SPY_INSTRUMENT, VXX_INSTRUMENT } from "@/lib/instruments-fixtures";
import { PERSON_ANALYST } from "@/lib/people-fixtures";
import { useSidebarGroupsStore } from "@/lib/stores/sidebar-groups-store";

const route = vi.hoisted(() => ({ params: {} as Record<string, string>, pathname: "/" }));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params = {}, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
    useParams: () => route.params,
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: route.pathname } }),
}));

// The sidebar primitives need a provider and `matchMedia`; plain containers are enough here.
vi.mock("@/components/ui/sidebar", () => {
    const Box = ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>;

    return {
        Sidebar: Box,
        SidebarContent: Box,
        SidebarFooter: Box,
        SidebarGroup: Box,
        SidebarGroupContent: Box,
        SidebarGroupLabel: Box,
        SidebarHeader: Box,
        SidebarMenu: Box,
        SidebarMenuItem: Box,
    };
});

vi.mock("@/lib/api/queries", () => ({
    useInstrument: vi.fn(),
    useKeyState: vi.fn(),
    useV2Filer: vi.fn(),
    useV2FilingsInfinite: vi.fn(),
    useV2LiveEvents: vi.fn(),
    useV2Person: vi.fn(),
}));

vi.mock("@/lib/reference/public-status", () => ({ useOverallStatus: () => "degraded" }));

afterEach(cleanup);

beforeEach(() => {
    vi.clearAllMocks();

    route.params = {};

    route.pathname = "/";

    window.localStorage.clear();

    useSidebarGroupsStore.setState({ hasHydrated: false, open: {} });

    // The theme switch beside Account follows the system theme.
    vi.stubGlobal("matchMedia", (query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() }));

    vi.mocked(useKeyState).mockReturnValue({ me: ME_PRO, state: "ready" });

    vi.mocked(useV2LiveEvents).mockReturnValue({ data: { data: [CALENDAR_EVENT, { ...CALENDAR_EVENT, event_id: "x" }] } } as never);

    vi.mocked(useV2Filer).mockReturnValue({ data: null, isLoading: false } as never);

    vi.mocked(useV2FilingsInfinite).mockReturnValue({ data: null } as never);

    vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: false } as never);
});

// A collapsed Market group's name also carries its live dot's label.
const groupHeader = (label: string) => screen.getByRole("button", { name: name => name.startsWith(label) });

const contextLinks = () => within(screen.getByTestId("sidebar-context")).getAllByRole("link").map(link => link.textContent);

describe("the sidebar's collapsible groups (ui-redesign task 4)", () => {
    it("six groups; Market and Securities open by default, the others collapsed (their pages not rendered)", () => {
        render(<AppSidebar />);

        for (const [label, open] of [["Market", true], ["Securities", true], ["Filings", false], ["News & search", false], ["US macro", false], ["Build", false]] as const) {
            expect(groupHeader(label)).toHaveAttribute("aria-expanded", String(open));
        }

        expect(screen.getByRole("link", { name: "Funds" })).toBeInTheDocument();

        expect(screen.queryByRole("link", { name: "Alerts" })).toBeNull();

        expect(screen.queryByRole("link", { name: "Inflation" })).toBeNull();
    });

    it("is the app's one navigation landmark, named Main", () => {
        render(<AppSidebar />);

        expect(screen.getByRole("navigation", { name: "Main" })).toContainElement(screen.getByRole("link", { name: "Funds" }));
    });

    it("the current page's group is open whatever is stored, and its header does not collapse it", async () => {
        window.localStorage.setItem("invinite-sidebar-groups", JSON.stringify({ state: { open: { build: false, market: false } }, version: 0 }));

        route.pathname = "/alerts/new";

        render(<AppSidebar />);

        await vi.waitFor(() => expect(useSidebarGroupsStore.getState().hasHydrated).toBe(true));

        expect(groupHeader("Build")).toHaveAttribute("aria-expanded", "true");

        expect(groupHeader("Build")).toHaveAttribute("aria-disabled", "true");

        fireEvent.click(groupHeader("Build"));

        expect(screen.getByRole("link", { name: "Alerts" })).toBeInTheDocument();

        // The stored state applies to the other groups once hydrated.
        expect(groupHeader("Market")).toHaveAttribute("aria-expanded", "false");
    });

    it("a toggle is stored; ← / → collapse and expand a focused header", async () => {
        render(<AppSidebar />);

        await vi.waitFor(() => expect(useSidebarGroupsStore.getState().hasHydrated).toBe(true));

        fireEvent.click(groupHeader("US macro"));

        expect(screen.getByRole("link", { name: "Inflation" })).toBeInTheDocument();

        expect(JSON.parse(window.localStorage.getItem("invinite-sidebar-groups")!)).toMatchObject({ state: { open: { macro: true } } });

        fireEvent.keyDown(groupHeader("Securities"), { key: "ArrowLeft" });

        expect(groupHeader("Securities")).toHaveAttribute("aria-expanded", "false");

        fireEvent.keyDown(groupHeader("Securities"), { key: "ArrowRight" });

        expect(groupHeader("Securities")).toHaveAttribute("aria-expanded", "true");
    });

    it("a collapsed Market group shows the live dot while calls are live", () => {
        route.pathname = "/funds";

        useSidebarGroupsStore.setState({ hasHydrated: true, open: { market: false } });

        render(<AppSidebar />);

        expect(screen.queryByTestId("live-count")).toBeNull();

        expect(screen.getByTestId("group-live-dot")).toHaveAccessibleName("2 calls live now");
    });

    it("the subject's context comes before the groups", () => {
        route.params = { ticker: "AAPL" };

        vi.mocked(useInstrument).mockReturnValue({ data: AAPL_INSTRUMENT, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        const context = screen.getByTestId("sidebar-context");

        expect(context.compareDocumentPosition(groupHeader("Market")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("a long filer name keeps its full text in a title", () => {
        route.params = { cik: "1" };

        const name = "A Very Long Registered Investment Adviser Name Holdings Incorporated";

        vi.mocked(useV2Filer).mockReturnValue({ data: { cik: "1", fund: null, listing: null, name, phase: "public", private_offerings: null }, isLoading: false } as never);

        render(<AppSidebar />);

        expect(screen.getByTitle(`${name} · SEC filer`)).toBeInTheDocument();
    });
});

describe("the sidebar on every page (context, groups, footer)", () => {
    it("holds the theme switch beside Account in the footer, for a phone whose top bar has none (ui-redesign tasks 2, 4)", () => {
        render(<AppSidebar />);

        expect(screen.getByRole("button", { name: /theme \(switch to/i }).parentElement).toHaveClass("sm:hidden");
    });

    it("a tickerless page: the open groups, the live count, Help and the account with its plan; no context", () => {
        render(<AppSidebar />);

        const links = screen.getAllByRole("link").map(link => link.textContent);

        expect(links).toEqual(expect.arrayContaining(["Home", "Earnings calendar", "IPOs", "Market holidays", "Funds", "API status", "Licensing"]));

        expect(screen.getByTestId("live-count")).toHaveTextContent("2");

        expect(screen.getByRole("link", { name: /Account/ })).toHaveTextContent("PRO");

        expect(screen.queryByTestId("sidebar-context")).toBeNull();

        expect(screen.getByRole("img", { name: "Partial service disruption" })).toBeInTheDocument();
    });

    it("the public status stays visible while account queries wait for a valid key", () => {
        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "invalid" });

        route.params = { ticker: "AAPL" };

        render(<AppSidebar />);

        expect(useV2LiveEvents).toHaveBeenLastCalledWith(false);

        expect(screen.getByRole("img", { name: "Partial service disruption" })).toBeInTheDocument();

        // No key: no context to load (the page is the onboarding card).
        expect(useInstrument).not.toHaveBeenCalled();

        expect(screen.queryByTestId("sidebar-context")).toBeNull();

        cleanup();

        // While `/v1/me` is checked: the context waits idle.
        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "checking" });

        render(<AppSidebar />);

        expect(useInstrument).toHaveBeenLastCalledWith("");

        expect(screen.getByTestId("context-skeleton")).toBeInTheDocument();
    });

    it("an instrument: its type-labelled context with the sections its datasets allow (Financials one entry)", () => {
        route.params = { ticker: "AAPL" };

        vi.mocked(useInstrument).mockReturnValue({ data: AAPL_INSTRUMENT, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        expect(screen.getByText("AAPL · Stock")).toBeInTheDocument();

        const links = contextLinks();

        expect(links.filter(link => link === "Financials")).toHaveLength(1);

        expect(links).not.toContain("Holdings");

        expect(screen.getByRole("link", { name: "Financials" })).toHaveAttribute("href", "/AAPL/financials");

        cleanup();

        route.params = { ticker: "SPY" };

        vi.mocked(useInstrument).mockReturnValue({ data: SPY_INSTRUMENT, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        expect(contextLinks()).toContain("Holdings");

        expect(contextLinks()).not.toContain("Financials");

        cleanup();

        route.params = { ticker: "VXX" };

        vi.mocked(useInstrument).mockReturnValue({ data: VXX_INSTRUMENT, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        expect(contextLinks()).not.toContain("Financials");

        expect(contextLinks()).not.toContain("Holdings");
    });

    it("no context for an unknown symbol or a segment no symbol can be (as the layout)", () => {
        route.params = { ticker: "ZZZZ" };

        vi.mocked(useInstrument).mockReturnValue({ data: null, error: new ApiRequestError(404, { error: "not_covered", message: "No instrument" }), isLoading: false } as never);

        render(<AppSidebar />);

        expect(screen.queryByTestId("sidebar-context")).toBeNull();

        cleanup();

        // `useInstrument` stays idle for it (not loading, no error): no context, never "every section".
        route.params = { ticker: "THIS-IS-NOT-A-SYMBOL" };

        vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        expect(screen.queryByTestId("sidebar-context")).toBeNull();
    });

    it("skeleton rows while the subject loads", () => {
        route.params = { ticker: "AAPL" };

        vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: true } as never);

        render(<AppSidebar />);

        expect(screen.getByTestId("context-skeleton")).toBeInTheDocument();
    });

    it("a filer: its blocks as anchors and its listing", () => {
        route.params = { cik: "0000102909" };

        vi.mocked(useV2Filer).mockReturnValue({
            data: { cik: "102909", fund: null, listing: { exchange: "XNAS", ticker: "VGRD" }, name: "Vanguard Group Inc", phase: "manager", private_offerings: null },
            isLoading: false,
        } as never);

        render(<AppSidebar />);

        expect(useV2Filer).toHaveBeenLastCalledWith("102909", expect.any(Array));

        expect(screen.getByText("Vanguard Group Inc · Institution")).toBeInTheDocument();

        expect(contextLinks()).toEqual(["Profile", "13F portfolio", "Filings", "Open VGRD"]);

        expect(screen.getByRole("link", { name: "13F portfolio" })).toHaveAttribute("href", "#portfolio");
    });

    it("a person: name · role and the page's three blocks as anchors (the page's own `/v1/people/{id}` answer)", () => {
        route.params = { personId: PERSON_ANALYST.person_id.toUpperCase() };

        vi.mocked(useV2Person).mockReturnValue({ data: PERSON_ANALYST, isLoading: false } as never);

        render(<AppSidebar />);

        expect(useV2Person).toHaveBeenLastCalledWith(PERSON_ANALYST.person_id);

        expect(screen.getByText("Richard Kramer · Analyst")).toBeInTheDocument();

        expect(contextLinks()).toEqual(["Profile", "Calls", "Role & firm history"]);

        expect(screen.getByRole("link", { name: "Calls" })).toHaveAttribute("href", "#calls");
    });

    it("a path parameter that is no person id: no person context, no request", () => {
        route.params = { personId: "not-a-person" };

        render(<AppSidebar />);

        expect(useV2Person).not.toHaveBeenCalled();

        expect(screen.queryByTestId("sidebar-context")).toBeNull();
    });
});
